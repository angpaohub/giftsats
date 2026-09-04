// Card front art, mirrors frontend/src/lib/designs.js — kept here in a form
// convenient for server-side rendering (og image) rather than CSS. If the
// frontend's built-in designs or their colors change, update both.

export const BUILT_IN_OG = {
  'giftsats-obsidian': {
    kind: 'radial',
    // Approximates the CSS radial-gradient(125% 125% at 18% 8%, ...) used on
    // the card front.
    stops: [
      { offset: '0%', color: '#2C2823' },
      { offset: '52%', color: '#15120F' },
      { offset: '100%', color: '#0B0907' },
    ],
    glow: 'rgba(247,147,26,.22)',
    muted: '#A89A86',
    mark: '#F7931A',
    amount: '#FFFFFF',
    unit: '#FFA729',
    body: '#C9BFB0',
  },
  'giftsats-sand': {
    kind: 'solid',
    color: '#E3D3B4',
    glow: 'rgba(247,147,26,.16)',
    muted: '#8A7A5E',
    mark: '#C77A12',
    amount: '#15120F',
    unit: '#8A7A5E',
    body: '#3A332C',
  },
  'giftsats-orange': {
    kind: 'solid',
    color: '#FF910B',
    glow: 'rgba(255,247,234,.28)',
    muted: 'rgba(255,247,234,.8)',
    mark: '#FFFDF8',
    amount: '#FFFFFF',
    unit: 'rgba(255,247,234,.75)',
    body: '#FFF3E2',
  },
};

// Cards minted before the redesign point at the original three seeds.
const LEGACY = {
  'giftsats-classic': 'giftsats-orange',
  'giftsats-midnight': 'giftsats-obsidian',
  'giftsats-emerald': 'giftsats-obsidian',
};

// Text on an uploaded image has to stay legible whatever the artwork is —
// same treatment as OVER_IMAGE on the frontend.
const OVER_IMAGE = {
  muted: 'rgba(255,247,234,.82)',
  mark: '#FFFDF8',
  amount: '#FFFFFF',
  unit: '#FFA729',
  body: '#F2E9DA',
};

/**
 * Resolve a card's front into whatever the og-image renderer needs:
 * either { kind:'solid'|'radial', ... } or { image: url, ... } for an
 * uploaded design front.
 *
 * customImageUrl (a card's own "your own design/pic" photo) takes priority
 * over everything else, same as the frontend's resolveArt() in
 * frontend/src/lib/designs.js — without this check the link preview shown
 * by iMessage/Slack/Twitter for a custom-photo card silently fell back to
 * the generic built-in art instead of the sender's actual photo.
 */
export function resolveOgArt(designId, design, customImageUrl) {
  if (customImageUrl) {
    return { ...OVER_IMAGE, image: customImageUrl };
  }
  if (design?.imageUrl) {
    return { ...OVER_IMAGE, ...(design.palette || {}), image: design.imageUrl };
  }
  const key = LEGACY[designId] || designId;
  return BUILT_IN_OG[key] || BUILT_IN_OG['giftsats-obsidian'];
}