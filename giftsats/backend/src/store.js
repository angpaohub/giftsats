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
      recipient_name           TEXT NOT NULL DEFAULT '',
      sender_name              TEXT NOT NULL DEFAULT '',
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
      redeem_secret_hash       TEXT,
      created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Safe migrations
  await pool.query(`ALTER TABLE gift_cards ADD COLUMN IF NOT EXISTS sender_lightning_address TEXT`);
  await pool.query(`ALTER TABLE gift_cards ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE gift_cards ADD COLUMN IF NOT EXISTS refund_status TEXT NOT NULL DEFAULT 'none'`);
  await pool.query(`ALTER TABLE gift_cards ADD COLUMN IF NOT EXISTS design_fee INTEGER NOT NULL DEFAULT 0`);
  await pool.query(`ALTER TABLE gift_cards ADD COLUMN IF NOT EXISTS recipient_name TEXT NOT NULL DEFAULT ''`);
  await pool.query(`ALTER TABLE gift_cards ADD COLUMN IF NOT EXISTS sender_name TEXT NOT NULL DEFAULT ''`);
  // GS-004: the real redeem credential. Generated once at card creation and
  // handed to the creator in the /api/gift/create response only — never
  // stored in plaintext, never returned by any GET. /api/redeem in index.js
  // requires a match against this hash for every card, no exceptions — there
  // were no outstanding pre-fix cards at deploy time, so no legacy fallback.
  await pool.query(`ALTER TABLE gift_cards ADD COLUMN IF NOT EXISTS redeem_secret_hash TEXT`);

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
      tag               TEXT NOT NULL DEFAULT 'Minimal',
      email             TEXT,
      handle            TEXT,
      palette           JSONB,
      active            BOOLEAN NOT NULL DEFAULT true,
      use_count         INTEGER NOT NULL DEFAULT 0,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Safe migrations for the designs table
  await pool.query(`ALTER TABLE designs ADD COLUMN IF NOT EXISTS tag TEXT NOT NULL DEFAULT 'Minimal'`);
  await pool.query(`ALTER TABLE designs ADD COLUMN IF NOT EXISTS email TEXT`);
  await pool.query(`ALTER TABLE designs ADD COLUMN IF NOT EXISTS handle TEXT`);
  await pool.query(`ALTER TABLE designs ADD COLUMN IF NOT EXISTS palette JSONB`);

  // Built-in GiftSats fronts are rendered by the frontend (CSS art, no uploaded
  // image), so they are not catalogue rows. Hide the legacy seeded rows — they
  // point at image files that were never shipped and would show up broken in
  // Explore. Existing cards that reference these ids still render fine: the
  // frontend resolves any `giftsats-*` id from its own built-in table.
  await pool.query(`UPDATE designs SET active = false WHERE id LIKE 'giftsats-%'`);

  console.log('✓ DB ready');
}

// ── Designs (marketplace) ────────────────────────────────

export async function listDesigns({ activeOnly = true, includePrivate = false } = {}) {
  const where = activeOnly ? 'WHERE active = true' : '';
  const { rows } = await pool.query(
    `SELECT * FROM designs ${where} ORDER BY use_count DESC, created_at DESC`
  );
  return rows.map(r => dbRowToDesign(r, includePrivate));
}

export async function getDesignByCode(code) {
  const { rows } = await pool.query(
    `SELECT * FROM designs WHERE id = $1`,
    [code]
  );
  return rows[0] ? dbRowToDesign(rows[0]) : null;
}

export async function createDesign({ name, designerName, handle, email, lightningAddress, priceSats, imageUrl, description, tag, palette }) {
  // Generate short readable code like "gfts-a3x9k"
  const code = 'gfts-' + randomUUID().replace(/-/g, '').slice(0, 5);
  const { rows } = await pool.query(`
    INSERT INTO designs (id, name, designer_name, handle, email, lightning_address, price_sats, image_url, description, tag, palette)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *
  `, [
    code, name, designerName || 'Anonymous', handle || null, email || null,
    lightningAddress, priceSats || 0, imageUrl, description || '',
    tag || 'Minimal', palette ? JSON.stringify(palette) : null,
  ]);
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
export async function createGiftCard({ amountSats, designId, platformFee, designFee, senderNote, recipientName, senderName, senderLightningAddress, paymentHash, paymentRequest, redeemSecretHash }) {
  const id = randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  await pool.query(
    `INSERT INTO gift_cards
      (id, amount_sats, design_id, platform_fee, design_fee, sender_note, recipient_name, sender_name, sender_lightning_address, payment_hash, payment_request, status, expires_at, redeem_secret_hash)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending', $12, $13)`,
    [id, amountSats, designId, platformFee ?? 0, designFee ?? 0, senderNote ?? '', recipientName ?? '', senderName ?? '', senderLightningAddress ?? null, paymentHash, paymentRequest, expiresAt, redeemSecretHash ?? null]
  );
  return getGiftCard(id);
}

export async function getGiftCard(id) {
  // Guard: the id column is UUID, so a malformed id would throw a 500 in Postgres
  // rather than returning "not found".
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id || ''))) return null;
  const { rows } = await pool.query('SELECT * FROM gift_cards WHERE id = $1', [id]);
  return rows[0] ? dbRowToCard(rows[0]) : null;
}

// The human-readable redeem code IS the card id: the first 12 hex characters of
// the UUID, printed on the card back as XXXX-XXXX-XXXX. Look it up by prefix so
// a receiver can type the short code instead of the full 36-character id.
export async function getGiftCardByCode(code) {
  const hex = String(code || '').replace(/[^0-9a-fA-F]/g, '').toLowerCase();
  if (hex.length < 12) return null;
  const { rows } = await pool.query(
    `SELECT * FROM gift_cards WHERE replace(id::text, '-', '') LIKE $1 || '%' LIMIT 2`,
    [hex]
  );
  // A prefix collision must never hand back the wrong card.
  if (rows.length !== 1) return null;
  return dbRowToCard(rows[0]);
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

// ── Atomic state transitions (GS-003 / GS-005 / GS-007) ──
//
// Every one of these is a single conditional UPDATE — "claim this row only if
// it's still in the state I expect" — instead of the old pattern of reading a
// row, checking its status in JS, and writing an unconditional UPDATE after.
// That old pattern is a classic check-then-act race: two requests can both
// read "minted" before either has written "redeemed", so both go on to pay
// out. A conditional UPDATE closes that window because Postgres serializes
// concurrent UPDATEs against the same row — only one caller's WHERE clause
// can still match once the other's UPDATE has committed, so only one caller
// ever gets a row back from RETURNING.
//
// The `status` column doubles as the mutual-exclusion flag between the
// redeem flow and the expiry/refund flow, since both only ever act on a card
// that is still 'minted': whichever one claims it first flips `status` away
// from 'minted', so the other's UPDATE matches zero rows.

// ── Redeem (GS-003) ──────────────────────────────────────
export async function claimForRedeem(id, lightningAddress) {
  const { rows } = await pool.query(
    `UPDATE gift_cards SET status = 'redeeming', redeemed_to = $2
     WHERE id = $1 AND status = 'minted' RETURNING *`,
    [id, lightningAddress]
  );
  return rows[0] ? dbRowToCard(rows[0]) : null;
}

export async function finalizeRedeem(id) {
  const { rows } = await pool.query(
    `UPDATE gift_cards SET status = 'redeemed', redeemed_at = NOW()
     WHERE id = $1 AND status = 'redeeming' RETURNING *`,
    [id]
  );
  return rows[0] ? dbRowToCard(rows[0]) : null;
}

// The payout attempt failed in a way we can't be sure about (network error /
// LND timeout / missing preimage — see lnd.js's `.ambiguous` flag). We do NOT
// put the card back to 'minted' here, because if the payment actually did go
// through, that would let it be redeemed a second time. It sits frozen until
// a human checks LND's payment history and resolves it by hand.
export async function markRedeemUnknown(id) {
  await pool.query(
    `UPDATE gift_cards SET status = 'payout_unknown' WHERE id = $1 AND status = 'redeeming'`,
    [id]
  );
}

// The payout attempt failed in a way we're sure means no sats left the node
// (e.g. the address couldn't be resolved at all). Safe to hand the card back
// so the same recipient can immediately try again.
export async function releaseRedeemClaim(id) {
  await pool.query(
    `UPDATE gift_cards SET status = 'minted', redeemed_to = NULL WHERE id = $1 AND status = 'redeeming'`,
    [id]
  );
}

// ── Mint (GS-005) ────────────────────────────────────────
// No token/secret is generated here anymore (GS-004) — the redeem secret is
// created once up front in createGiftCard, so minting is just the status flip.
export async function claimForMint(id) {
  const { rows } = await pool.query(
    `UPDATE gift_cards SET status = 'minted'
     WHERE id = $1 AND status = 'pending' RETURNING *`,
    [id]
  );
  return rows[0] ? dbRowToCard(rows[0]) : null;
}

// ── Expiry refund / forfeit (GS-007) ─────────────────────
export async function claimForRefund(id) {
  const { rows } = await pool.query(
    `UPDATE gift_cards SET status = 'refunding', refund_status = 'refunding'
     WHERE id = $1 AND status = 'minted' AND refund_status = 'none' RETURNING *`,
    [id]
  );
  return rows[0] ? dbRowToCard(rows[0]) : null;
}

export async function finalizeRefund(id, refundedTo) {
  await pool.query(
    `UPDATE gift_cards SET status = 'expired', refund_status = 'refunded',
       redeemed_to = $2, redeemed_at = NOW()
     WHERE id = $1 AND status = 'refunding'`,
    [id, refundedTo]
  );
}

// Same ambiguous-failure handling as markRedeemUnknown above — frozen for
// manual review instead of guessed at.
export async function markRefundUnknown(id) {
  await pool.query(
    `UPDATE gift_cards SET status = 'refund_unknown', refund_status = 'refund_unknown'
     WHERE id = $1 AND status = 'refunding'`,
    [id]
  );
}

// Clean failure (e.g. the sender's Lightning address stopped resolving) —
// hand the card back to 'minted'/'none' so the next hourly run retries it,
// same as today's behavior.
export async function releaseRefundClaim(id) {
  await pool.query(
    `UPDATE gift_cards SET status = 'minted', refund_status = 'none'
     WHERE id = $1 AND status = 'refunding'`,
    [id]
  );
}

// No sender address on file → nothing to pay out, so claim and finalize is
// one safe atomic step.
export async function claimForForfeit(id) {
  const { rows } = await pool.query(
    `UPDATE gift_cards SET status = 'expired', refund_status = 'forfeited'
     WHERE id = $1 AND status = 'minted' AND refund_status = 'none' RETURNING *`,
    [id]
  );
  return rows[0] ? dbRowToCard(rows[0]) : null;
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
      -- Designers keep 80% of design_fee (see DESIGNER_PLATFORM_CUT in index.js);
      -- payout fires once the card mints, so this mirrors the total_sats filter.
      COALESCE(SUM(FLOOR(design_fee * 0.8)) FILTER (WHERE status IN ('minted','redeemed')), 0) AS designer_payout_sats,
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
    recipientName:          row.recipient_name || '',
    senderName:             row.sender_name || '',
    senderLightningAddress: row.sender_lightning_address,
    paymentHash:            row.payment_hash,
    paymentRequest:         row.payment_request,
    status:                 row.status,
    cashuToken:             row.cashu_token,
    cashuQuote:             row.cashu_quote,
    redeemSecretHash:       row.redeem_secret_hash,
    redeemedTo:             row.redeemed_to,
    redeemedAt:             row.redeemed_at,
    expiresAt:              row.expires_at,
    refundStatus:           row.refund_status,
    createdAt:              row.created_at,
  };
}

// `includePrivate` is admin-only: the designer's email must never leave the
// server on a public endpoint.
function dbRowToDesign(row, includePrivate = false) {
  return {
    ...(includePrivate ? { email: row.email || null } : {}),
    id:               row.id,
    name:             row.name,
    designerName:     row.designer_name,
    lightningAddress: row.lightning_address,
    priceSats:        row.price_sats,
    imageUrl:         row.image_url,
    description:      row.description,
    tag:              row.tag || 'Minimal',
    handle:           row.handle || null,
    palette:          row.palette || null,
    active:           row.active,
    useCount:         row.use_count, 
    createdAt:        row.created_at,
  };
}
