// Cloudflare Pages Function — handles GET /card/:id
//
// Netlify's `_redirects` supports proxying a path to an external origin
// (the `200!` rewrite rule that used to live here). Cloudflare Pages'
// `_redirects` does NOT support that — it can only redirect (change the
// browser URL) or rewrite to a file inside this same Pages project. So the
// old rule silently did nothing and every request fell through to the SPA,
// which is why link previews always showed the generic site image instead
// of the per-card one.
//
// This Function replaces that rule: it fetches the backend's rendered HTML
// (OG tags + redirect script) for this card id and returns it as-is, so
// crawlers hitting https://giftsats.org/card/:id see the real thing.
const BACKEND_URL = 'https://giftsats-production.up.railway.app';

export async function onRequestGet({ params }) {
  const id = params.id;
  const upstream = `${BACKEND_URL}/card/${encodeURIComponent(id)}`;

  try {
    const res = await fetch(upstream, { cf: { cacheTtl: 0 } });
    const body = await res.text();
    return new Response(body, {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('Content-Type') || 'text/html; charset=utf-8' },
    });
  } catch (e) {
    // Backend unreachable — bounce to the SPA's own card view rather than
    // showing a raw error page.
    return Response.redirect(`https://giftsats.org/g/${id}`, 302);
  }
}

