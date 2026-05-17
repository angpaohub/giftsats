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
      id              UUID PRIMARY KEY,
      amount_sats     INTEGER NOT NULL,
      design_id       TEXT NOT NULL,
      platform_fee    INTEGER NOT NULL DEFAULT 0,
      sender_note     TEXT NOT NULL DEFAULT '',
      payment_hash    TEXT NOT NULL,
      payment_request TEXT NOT NULL,
      status          TEXT NOT NULL DEFAULT 'pending',
      cashu_token     TEXT,
      cashu_quote     TEXT,
      redeemed_to     TEXT,
      redeemed_at     TIMESTAMPTZ,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  console.log('✓ DB ready');
}

// ── Designs (hardcoded until marketplace) ───────────────
const designs = [
  {
    id: 'classic',
    name: 'Bitcoin Classic',
    designer: 'GiftSats',
    priceSats: 0,
    lightningAddress: null,
    colors: ['#F7931A', '#FF6B35'],
    emoji: '₿',
    free: true,
  },
  {
    id: 'midnight',
    name: 'Midnight Stack',
    designer: 'GiftSats',
    priceSats: 0,
    lightningAddress: null,
    colors: ['#1a1a2e', '#16213e'],
    emoji: '⚡',
    free: true,
  },
  {
    id: 'emerald',
    name: 'Emerald Vault',
    designer: 'GiftSats',
    priceSats: 0,
    lightningAddress: null,
    colors: ['#064e3b', '#065f46'],
    emoji: '🔐',
    free: true,
  },
];

export function listDesigns() {
  return designs;
}

// ── Gift card CRUD ───────────────────────────────────────
export async function createGiftCard({ amountSats, designId, platformFee, senderNote, paymentHash, paymentRequest }) {
  const id = randomUUID();
  await pool.query(
    `INSERT INTO gift_cards
      (id, amount_sats, design_id, platform_fee, sender_note, payment_hash, payment_request, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')`,
    [id, amountSats, designId, platformFee ?? 0, senderNote ?? '', paymentHash, paymentRequest]
  );
  return getGiftCard(id);
}

export async function getGiftCard(id) {
  const { rows } = await pool.query('SELECT * FROM gift_cards WHERE id = $1', [id]);
  return rows[0] ? dbRowToCard(rows[0]) : null;
}

export async function updateGiftCard(id, fields) {
  // Build SET clause dynamically from fields object
  const colMap = {
    status: 'status',
    cashuToken: 'cashu_token',
    cashuQuote: 'cashu_quote',
    redeemedTo: 'redeemed_to',
    redeemedAt: 'redeemed_at',
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

// ── Stats ────────────────────────────────────────────────
export async function getStats() {
  const { rows } = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE status = 'minted')   AS minted_count,
      COUNT(*) FILTER (WHERE status = 'redeemed') AS redeemed_count,
      COALESCE(SUM(amount_sats) FILTER (WHERE status = 'redeemed'), 0) AS redeemed_sats,
      COALESCE(SUM(amount_sats) FILTER (WHERE status IN ('minted','redeemed')), 0) AS total_sats
    FROM gift_cards
  `);
  return rows[0];
}

// ── Row mapper (snake_case → camelCase) ──────────────────
function dbRowToCard(row) {
  return {
    id:             row.id,
    amountSats:     row.amount_sats,
    designId:       row.design_id,
    platformFee:    row.platform_fee,
    senderNote:     row.sender_note,
    paymentHash:    row.payment_hash,
    paymentRequest: row.payment_request,
    status:         row.status,
    cashuToken:     row.cashu_token,
    cashuQuote:     row.cashu_quote,
    redeemedTo:     row.redeemed_to,
    redeemedAt:     row.redeemed_at,
    createdAt:      row.created_at,
  };
}
