// Cloudflare Pages Function for /g/:id — the SPA's own "view card" route.
//
// /card/:id (functions/card/[id].js) is the link the app's Copy Link button
// and QR code actually hand out, and it already gets correct per-card OG
// tags. But people often copy the browser address-bar URL instead — which,
// once the SPA finishes loading a card, IS /g/:id — so that link needs to
// carry correct OG tags too, without breaking the real app for the people
// who open it.
//
// Approach: serve the real SPA shell (same file every visitor gets), then
// rewrite just the <title>/OG/twitter meta tags in its <head> using the
// values the backend already computes for /card/:id. React mounts over this
// normally, so human visitors see the exact same working app; crawlers that
// only read the initial HTML (they never run JS) see the correct card-
// specific preview instead of the generic default.
//
// If anything about the backend fetch goes wrong, we fall back to the
// untouched SPA shell — a broken link preview is fine, a broken app is not.

const BACKEND_URL = 'https://giftsats-production.up.railway.app';

export async function onRequest(context) {
  const { request, env, params } = context;
  const id = params.id;

  // The actual index.html Cloudflare would otherwise serve for this route
  // (via the SPA catch-all in _redirects). This is what real visitors run.
  const assetResponse = await env.ASSETS.fetch(request);

  const contentType = assetResponse.headers.get('content-type') || '';
  if (!contentType.includes('text/html') || !id) {
    return assetResponse;
  }

  try {
    const ogRes = await fetch(`${BACKEND_URL}/card/${id}`, {
      headers: { 'User-Agent': 'GiftSatsMetaFetcher/1.0' },
    });
    if (!ogRes.ok) return assetResponse;
    const ogHtml = await ogRes.text();

    // The backend's /card/:id HTML already has quotes/&/< escaped inside
    // these attributes (see escapeHtml in backend/src/index.js), so a plain
    // "no quote characters inside" capture is safe here.
    const pick = (re) => {
      const m = ogHtml.match(re);
      return m ? m[1] : null;
    };
    const title = pick(/<title>([^<]*)<\/title>/);
    const ogTitle = pick(/property="og:title" content="([^"]*)"/);
    const ogDescription = pick(/property="og:description" content="([^"]*)"/);
    const ogImage = pick(/property="og:image" content="([^"]*)"/);

    // If the backend didn't have a real card to describe (e.g. a bad id),
    // /card/:id 302-redirects instead of returning this HTML, so ogTitle
    // will be null here — just hand back the normal SPA shell.
    if (!title || !ogTitle) return assetResponse;

    // og:url should point at the page actually being served (/g/:id), not
    // the /card/:id bridge page the tags were sourced from.
    const requestUrl = request.url;
    const description = ogDescription || '';
    const image = ogImage || '';

    const rewriter = new HTMLRewriter()
      .on('title', {
        element(el) {
          el.setInnerContent(title);
        },
      })
      .on('meta[property="og:title"]', {
        element(el) {
          el.setAttribute('content', ogTitle);
        },
      })
      .on('meta[property="og:description"]', {
        element(el) {
          el.setAttribute('content', description);
        },
      })
      .on('meta[property="og:image"]', {
        element(el) {
          el.setAttribute('content', image);
        },
      })
      .on('head', {
        element(el) {
          // og:url/og:type/twitter:* and the image dimensions don't exist
          // in the default index.html at all, so they're appended fresh
          // rather than rewritten in place.
          el.append(
            [
              `<meta property="og:url" content="${requestUrl}" />`,
              `<meta property="og:type" content="website" />`,
              `<meta property="og:image:width" content="1200" />`,
              `<meta property="og:image:height" content="630" />`,
              `<meta name="twitter:card" content="summary_large_image" />`,
              `<meta name="twitter:title" content="${ogTitle}" />`,
              `<meta name="twitter:description" content="${description}" />`,
              `<meta name="twitter:image" content="${image}" />`,
            ].join('\n    '),
            { html: true }
          );
        },
      });

    return rewriter.transform(assetResponse);
  } catch (e) {
    return assetResponse;
  }
}
