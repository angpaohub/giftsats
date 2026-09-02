export const BACKEND =
  import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || 'http://localhost:3001';

async function request(path, options) {
  const res = await fetch(`${BACKEND}${path}`, options);
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON body — fall through to the status-based error below */
  }
  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

const json = (body) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const api = {
  stats: () => request('/api/stats'),
  designs: () => request('/api/designs'),
  design: (code) => request(`/api/designs/${encodeURIComponent(code)}`),
  submitDesign: (formData) => request('/api/designs', { method: 'POST', body: formData }),

  createGift: (body) => request('/api/gift/create', json(body)),
  gift: (id) => request(`/api/gift/${encodeURIComponent(id)}`),
  giftByCode: (code) => request(`/api/gift/code/${encodeURIComponent(code)}`),
  redeem: (body) => request('/api/redeem', json(body)),
};

// A share link, a full card id, or the short printed code all resolve to the
// same card. Returns null when the input does not look like any of them.
export async function resolveCard(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;

  const urlMatch = text.match(/\/(?:card|g)\/([0-9a-fA-F-]{36})/);
  if (urlMatch) return api.gift(urlMatch[1]);

  const uuid = text.match(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/);
  if (uuid) return api.gift(text);

  const hex = text.replace(/[^0-9a-fA-F]/g, '');
  if (hex.length >= 12) return api.giftByCode(hex);

  return null;
}
