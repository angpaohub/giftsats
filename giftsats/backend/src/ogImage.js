import sharp from 'sharp';
import fetch from 'node-fetch';
import { resolveOgArt } from './cardArt.js';

// Standard link-preview size — this is what iMessage/Slack/Twitter/etc. all
// expect and crop to, so the composition mirrors the card front's look
// (same colors, mark, and amount typography) rather than reproducing the
// card's own tall aspect ratio, which a preview box would just crop badly.
const W = 1200;
const H = 630;

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function truncate(str, max) {
  const s = String(str || '');
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

async function backgroundBuffer(art) {
  if (art.image) {
    try {
      const res = await fetch(art.image);
      if (!res.ok) throw new Error(`fetch ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      return await sharp(buf).resize(W, H, { fit: 'cover' }).png().toBuffer();
    } catch {
      // Artwork fetch failed (deleted asset, network hiccup) — fall back to
      // the default built-in look rather than a broken image.
      return backgroundBuffer(resolveOgArt(null, null));
    }
  }

  if (art.kind === 'radial') {
    const stops = art.stops.map((s) => `<stop offset="${s.offset}" stop-color="${s.color}"/>`).join('');
    const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <defs><radialGradient id="bg" cx="18%" cy="8%" r="95%">${stops}</radialGradient></defs>
      <rect width="${W}" height="${H}" fill="url(#bg)"/>
    </svg>`;
    return sharp(Buffer.from(svg)).png().toBuffer();
  }

  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${W}" height="${H}" fill="${art.color}"/>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/**
 * Render the link-preview (og:image) PNG for a gift card, matching the
 * front-card look: same background art, GIFTSATS mark, and big amount+sats
 * typography, with the sender's message and credit line underneath.
 */
export async function renderCardOgImage({ amountSats, senderNote, recipientName, senderName, designId, design, customImageUrl }) {
  const art = resolveOgArt(designId, design, customImageUrl);
  const sats = Number(amountSats || 0).toLocaleString('en-US');
  const credit = [recipientName && `For ${recipientName}`, senderName && `from ${senderName}`]
    .filter(Boolean)
    .join(' · ');

  const bg = await backgroundBuffer(art);
  const pad = 76;

  const overlay = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="glow" cx="100%" cy="0%" r="55%">
        <stop offset="0%" stop-color="${art.glow || 'rgba(247,147,26,.2)'}"/>
        <stop offset="100%" stop-color="${art.glow || 'rgba(247,147,26,.2)'}" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#000" stop-opacity="0.25"/>
        <stop offset="100%" stop-color="#000" stop-opacity="0.55"/>
      </linearGradient>
    </defs>

    ${art.image ? `<rect width="${W}" height="${H}" fill="url(#scrim)"/>` : ''}
    <rect width="${W}" height="${H}" fill="url(#glow)"/>

    <text x="${pad}" y="${pad + 14}" font-family="monospace" font-size="26" letter-spacing="7"
      fill="${art.muted}">GIFTSATS</text>

    <!-- bolt mark, top right -->
    <path d="M ${W - pad - 16} ${pad - 20} L ${W - pad - 34} ${pad + 6} L ${W - pad - 20} ${pad + 6}
             L ${W - pad - 38} ${pad + 34} L ${W - pad - 6} ${pad} L ${W - pad - 20} ${pad}
             Z" fill="${art.mark}"/>

    <text x="${pad}" y="420" font-family="Liberation Sans, Arial, sans-serif" font-weight="700" font-size="150"
      letter-spacing="-3" fill="${art.amount}">${escapeXml(sats)}</text>
    <text x="${pad + sats.length * 92 + 26}" y="410" font-family="monospace" font-size="46"
      fill="${art.unit}">sats</text>

    ${
      senderNote
        ? `<text x="${pad}" y="472" font-family="Georgia, 'Times New Roman', serif" font-style="italic"
             font-size="34" fill="${art.body}">${escapeXml(`“${truncate(senderNote, 60)}”`)}</text>`
        : ''
    }
    ${
      credit
        ? `<text x="${pad}" y="${senderNote ? 518 : 472}" font-family="Georgia, 'Times New Roman', serif"
             font-size="30" fill="${art.body}" opacity="0.85">${escapeXml(credit)}</text>`
        : ''
    }
  </svg>`;

  return sharp(bg)
    .composite([{ input: Buffer.from(overlay), top: 0, left: 0 }])
    .png()
    .toBuffer();
}
