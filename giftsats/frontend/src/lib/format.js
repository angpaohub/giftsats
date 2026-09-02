export const fmt = (n) => (Number(n) || 0).toLocaleString('en-US');

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

export const cardUrl = (id) => `${window.location.origin}/card/${id}`;

export async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
