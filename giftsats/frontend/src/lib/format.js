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

// GS-004: `secret` is the card's real redeem credential. It rides in the URL
// fragment (`#s=...`), which browsers never send to any server in any HTTP
// request — see api.js's redeemSecretFromHash()/extractRedeemSecret() for the
// reverse direction. Omit it to build a lookup-only link (e.g. an OG preview
// URL) that can't move funds.
export const cardUrl = (id, secret) => `${window.location.origin}/card/${id}${secret ? `#s=${secret}` : ''}`;

export async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
