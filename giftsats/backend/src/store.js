import { randomUUID } from 'crypto';
import pg from 'pg';

const { Pool } = pg;

// ── DB connection ────────────────────────────────────────
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('railway') ? { rejectUnauthorized: false } : false,
});

// ── Init table (runs on startup) ─────────────────────────
export async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gift_cards (
      id                       UUID PRIMARY KEY,
      amount_sats              INTEGER NOT NULL,
      design_id                TEXT NOT NULL,
      platform_fee             INTEGER NOT NULL DEFAULT 0,
      design_fee               INTEGER NOT NULL DEFAULT 0,
      sender_note              TEXT NOT NULL DEFAULT '',
      sender_lightning_address TEXT,
      payment_hash             TEXT NOT NULL,
      payment_request          TEXT NOT NULL,
      status                   TEXT NOT NULL DEFAULT 'pending',
      cashu_token              TEXT,
      cashu_quote              TEXT,
      redeemed_to              TEXT,
      redeemed_at              TIMESTAMPTZ,
      expires_at               TIMESTAMPTZ,
      refund_status            TEXT NOT NULL DEFAULT 'none',
      created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Safe migrations
  await pool.query(`ALTER TABLE gift_cards ADD COLUMN IF NOT EXISTS sender_lightning_address TEXT`);
  await pool.query(`ALTER TABLE gift_cards ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE gift_cards ADD COLUMN IF NOT EXISTS refund_status TEXT NOT NULL DEFAULT 'none'`);
  await pool.query(`ALTER TABLE gift_cards ADD COLUMN IF NOT EXISTS design_fee INTEGER NOT NULL DEFAULT 0`);

  // ── Marketplace designs table ────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS designs (
      id                TEXT PRIMARY KEY,
      name              TEXT NOT NULL,
      designer_name     TEXT NOT NULL DEFAULT 'Anonymous',
      lightning_address TEXT NOT NULL,
      price_sats        INTEGER NOT NULL DEFAULT 0,
      image_url         TEXT NOT NULL,
      description       TEXT NOT NULL DEFAULT '',
      active            BOOLEAN NOT NULL DEFAULT true,
      use_count         INTEGER NOT NULL DEFAULT 0,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Seed default GiftSats designs if table is empty
  const { rows } = await pool.query(`SELECT COUNT(*) FROM designs WHERE id LIKE 'giftsats-%'`);
  if (parseInt(rows[0].count) === 0) {
    await pool.query(`
      INSERT INTO designs (id, name, designer_name, lightning_address, price_sats, image_url, description, active)
      VALUES
        ('giftsats-classic',  'Bitcoin Classic',  'GiftSats', 'giftsats@getalby.com', 0, '/designs/classic.png',  'The original Bitcoin gift card', true),
        ('giftsats-midnight', 'Midnight Stack',   'GiftSats', 'giftsats@getalby.com', 0, '/designs/midnight.png', 'Dark and mysterious',           true),
        ('giftsats-emerald',  'Emerald Vault',    'GiftSats', 'giftsats@getalby.com', 0, '/designs/emerald.png',  'Sovereign and secure',          true)
      ON CONFLICT (id) DO NOTHING
    `);
  }

  console.log('✓ DB ready');
}

// ── Designs (marketplace) ────────────────────────────────

export async function listDesigns({ activeOnly = true } = {}) {
  const where = activeOnly ? 'WHERE active = true' : '';
  const { rows } = await pool.query(
    `SELECT * FROM designs ${where} ORDER BY use_count DESC, created_at DESC`
  );
  return rows.map(dbRowToDesign);
}

export async function getDesignByCode(code) {
  const { rows } = await pool.query(
    `SELECT * FROM designs WHERE id = $1`,
    [code]
  );
  return rows[0] ? dbRowToDesign(rows[0]) : null;
}

export async function createDesign({ name, designerName, lightningAddress, priceSats, imageUrl, description }) {
  // Generate short readable code like "gfts-a3x9k"
  const code = 'gfts-' + randomUUID().replace(/-/g, '').slice(0, 5);
  const { rows } = await pool.query(`
    INSERT INTO designs (id, name, designer_name, lightning_address, price_sats, image_url, description)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `, [code, name, designerName || 'Anonymous', lightningAddress, priceSats || 0, imageUrl, description || '']);
  return dbRowToDesign(rows[0]);
}

export async function incrementDesignUseCount(id) {
  await pool.query(`UPDATE designs SET use_count = use_count + 1 WHERE id = $1`, [id]);
}

export async function takedownDesign(id) {
  const { rows } = await pool.query(
    `UPDATE designs SET active = false WHERE id = $1 RETURNING *`,
    [id]
  );
  return rows[0] ? dbRowToDesign(rows[0]) : null;
}

export async function restoreDesign(id) {
  const { rows } = await pool.query(
    `UPDATE designs SET active = true WHERE id = $1 RETURNING *`,
    [id]
  );
  return rows[0] ? dbRowToDesign(rows[0]) : null;
}

// ── Gift card CRUD ───────────────────────────────────────
export async function createGiftCard({ amountSats, designId, platformFee, designFee, senderNote, senderLightningAddress, paymentHash, paymentRequest }) {
  const id = randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  await pool.query(
    `INSERT INTO gift_cards
      (id, amount_sats, design_id, platform_fee, design_fee, sender_note, sender_lightning_address, payment_hash, payment_request, status, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', $10)`,
    [id, amountSats, designId, platformFee ?? 0, designFee ?? 0, senderNote ?? '', senderLightningAddress ?? null, paymentHash, paymentRequest, expiresAt]
  );
  return getGiftCard(id);
}

export async function getGiftCard(id) {
  const { rows } = await pool.query('SELECT * FROM gift_cards WHERE id = $1', [id]);
  return rows[0] ? dbRowToCard(rows[0]) : null;
}

export async function updateGiftCard(id, fields) {
  const colMap = {
    status:         'status',
    cashuToken:     'cashu_token',
    cashuQuote:     'cashu_quote',
    redeemedTo:     'redeemed_to',
    redeemedAt:     'redeemed_at',
    refundStatus:   'refund_status',
  };
  const sets = [];
  const values = [];
  let i = 1;
  for (const [key, col] of Object.entries(colMap)) {
    if (key in fields) {
      sets.push(`${col} = $${i++}`);
      values.push(fields[key]);
    }
  }
  if (sets.length === 0) return getGiftCard(id);
  values.push(id);
  await pool.query(`UPDATE gift_cards SET ${sets.join(', ')} WHERE id = $${i}`, values);
  return getGiftCard(id);
}

export async function listAllCards() {
  const { rows } = await pool.query(
    'SELECT * FROM gift_cards ORDER BY created_at DESC LIMIT 500'
  );
  return rows.map(dbRowToCard);
}

export async function listExpiredUnredeemed() {
  const { rows } = await pool.query(`
    SELECT * FROM gift_cards
    WHERE status = 'minted'
      AND expires_at < NOW()
      AND refund_status = 'none'
    ORDER BY expires_at ASC
    LIMIT 100
  `);
  return rows.map(dbRowToCard);
}

// ── Stats ────────────────────────────────────────────────
export async function getStats() {
  const { rows } = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE status = 'pending')                       AS pending_count,
      COUNT(*) FILTER (WHERE status = 'minted' AND refund_status = 'none' AND expires_at >= NOW()) AS minted_count,
      COUNT(*) FILTER (WHERE status = 'redeemed' AND refund_status = 'none') AS redeemed_count,
      COUNT(*) FILTER (WHERE status = 'minted' AND refund_status = 'none' AND expires_at < NOW()) AS expired_count,
      COUNT(*) FILTER (WHERE refund_status = 'refunded')              AS refunded_count,
      COUNT(*) FILTER (WHERE refund_status = 'forfeited')             AS forfeited_count,
      COALESCE(SUM(amount_sats) FILTER (WHERE status = 'redeemed' AND refund_status = 'none'), 0) AS redeemed_sats,
      COALESCE(SUM(amount_sats) FILTER (WHERE refund_status = 'refunded'), 0)  AS refunded_sats,
      COALESCE(SUM(amount_sats) FILTER (WHERE refund_status = 'forfeited'), 0) AS forfeited_sats,
      COALESCE(SUM(amount_sats) FILTER (WHERE status IN ('minted','redeemed')), 0) AS total_sats,
      (SELECT COUNT(*) FROM designs WHERE active = true)               AS active_designs
    FROM gift_cards
  `);
  return rows[0];
}

// ── Row mappers ──────────────────────────────────────────
function dbRowToCard(row) {
  return {
    id:                     row.id,
    amountSats:             row.amount_sats,
    designId:               row.design_id,
    platformFee:            row.platform_fee,
    designFee:              row.design_fee,
    senderNote:             row.sender_note,
    senderLightningAddress: row.sender_lightning_address,
    paymentHash:            row.payment_hash,
    paymentRequest:         row.payment_request,
    status:                 row.status,
    cashuToken:             row.cashu_token,
    cashuQuote:             row.cashu_quote,
    redeemedTo:             row.redeemed_to,
    redeemedAt:             row.redeemed_at,
    expiresAt:              row.expires_at,
    refundStatus:           row.refund_status,
    createdAt:              row.created_at,
  };
}

function dbRowToDesign(row) {
  return {
    id:               row.id,
    name:             row.name,
    designerName:     row.designer_name,
    lightningAddress: row.lightning_address,
    priceSats:        row.price_sats,
    imageUrl:         row.image_url,
    description:      row.description,
    active:           row.active,
    useCount:         row.use_count, 
    createdAt:        row.created_at,
  };
}
