// Built-in card fronts. These are drawn in CSS rather than uploaded, so they
// live here rather than in the designs table — the backend accepts any
// `giftsats-*` code and charges no design fee for it.
export const BUILT_IN = [
  {
    id: 'giftsats-obsidian',
    name: 'Obsidian',
    author: 'by GiftSats',
    swatch: 'radial-gradient(125% 125% at 20% 10%, #3A342C, #15120F 60%)',
    bg: 'radial-gradient(125% 125% at 18% 8%, #2C2823 0%, #15120F 52%, #0B0907 100%)',
    glow: 'rgba(247,147,26,.22)',
    muted: '#A89A86',
    mark: '#F7931A',
    amount: '#FFF',
    unit: '#FFA729',
    body: '#C9BFB0',
  },
  {
    id: 'giftsats-sand',
    name: 'Sand',
    author: 'by GiftSats',
    swatch: 'linear-gradient(150deg, #E9DCC1, #DCC9A4)',
    bg: '#E3D3B4',
    glow: 'rgba(247,147,26,.16)',
    muted: '#8A7A5E',
    mark: '#C77A12',
    amount: '#15120F',
    unit: '#8A7A5E',
    body: '#3A332C',
  },
  {
    id: 'giftsats-orange',
    name: 'Orange',
    author: 'by GiftSats',
    swatch: 'linear-gradient(150deg, #FFA02A, #FF910B)',
    bg: '#FF910B',
    glow: 'rgba(255,247,234,.28)',
    muted: 'rgba(255,247,234,.8)',
    mark: '#FFFDF8',
    amount: '#FFF',
    unit: 'rgba(255,247,234,.75)',
    body: '#FFF3E2',
  },
];

// Cards minted before the redesign point at the original three seeds.
const LEGACY = {
  'giftsats-classic': 'giftsats-orange',
  'giftsats-midnight': 'giftsats-obsidian',
  'giftsats-emerald': 'giftsats-obsidian',
};

// Text on an uploaded image has to stay legible whatever the artwork is, so an
// image front without a stored palette gets a scrim and light type.
const OVER_IMAGE = {
  glow: 'rgba(255,247,234,.18)',
  muted: 'rgba(255,247,234,.82)',
  mark: '#FFFDF8',
  amount: '#FFF',
  unit: '#FFA729',
  body: '#F2E9DA',
  scrim: 'linear-gradient(to bottom, rgba(0,0,0,.25) 0%, rgba(0,0,0,.55) 100%)',
};

export function builtInById(id) {
  const key = LEGACY[id] || id;
  return BUILT_IN.find((d) => d.id === key) || null;
}

/**
 * Resolve whatever we know about a card's front into one art object the
 * GiftCard component can render: { bg, image, scrim, glow, muted, mark,
 * amount, unit, body }.
 *
 * @param {string} designId  the card's design id
 * @param {object} design    the catalogue row, when the front is an upload
 */
export function resolveArt(designId, design) {
  if (design?.imageUrl) {
    return { ...OVER_IMAGE, ...(design.palette || {}), image: design.imageUrl, bg: '#15120F' };
  }
  const built = builtInById(designId) || BUILT_IN[0];
  return { ...built, image: null, scrim: null };
}
