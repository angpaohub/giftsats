export const fmt = (n) => (Number(n) || 0).toLocaleString('en-US');

// Compact form for large sat counts on the About page's stats card:
// 2,940,000,000 -> "2.94 B", 1,280,000 -> "1.28 M", anything smaller -> fmt().
export function fmtCompact(n) {
  const v = Number(n) || 0;
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)} B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)} M`;
  return fmt(v);
}

export function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d
    .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    .toUpperCase();
}

export function clock(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

// The redeem code is the card id. The short form — the first 12 hex characters,
// grouped — is what the backend accepts at /api/gift/code/:code.
export function shortCode(id) {
  const hex = String(id || '').replace(/-/g, '').slice(0, 12).toUpperCase();
  return hex.match(/.{1,4}/g)?.join('-') || '';
}

export const isLightningAddress = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim());
export const isEmail = isLightningAddress;

// Strip what wallets and QR codes wrap around a raw invoice: the `lightning:`
// URI scheme, pasted whitespace/newlines, and the uppercase bech32 that QR
// encoders emit. Mirrors normalizeBolt11() on the backend — the backend does
// it again regardless, this is only so what we validate is what we send.
export const normalizeBolt11 = (v) =>
  String(v || '').trim().replace(/\s+/g, '').replace(/^lightning:/i, '').toLowerCase();

// Shape check only. The amount, expiry and destination are all checked by the
// backend against the card (it decodes the invoice with our own node) — this
// just avoids sending an obvious non-invoice.
export const isBolt11 = (v) => /^ln(bc|tb|bcrt|tbs)[a-z0-9]{50,}$/.test(normalizeBolt11(v));

// A card's full id is itself what /api/redeem accepts as giftCardId — there
// is no separate secret/key. Whoever holds this complete link can redeem.
export const cardUrl = (id) => `${window.location.origin}/card/${id}`;

export async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
