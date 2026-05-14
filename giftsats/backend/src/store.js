import { randomUUID } from 'crypto';

// In-memory store (MVP) — swap for Postgres later
const giftCards = new Map();

// Default designs — designers can add more later
const designs = [
  {
    id: 'default-orange',
    name: 'Bitcoin Classic',
    designer: 'GiftSats',
    priceSats: 0,
    lightningAddress: null,
    colors: ['#F7931A', '#FF6B35'],
    emoji: '₿',
    free: true,
  },
  {
    id: 'default-dark',
    name: 'Midnight Stack',
    designer: 'GiftSats',
    priceSats: 0,
    lightningAddress: null,
    colors: ['#1a1a2e', '#16213e'],
    emoji: '⚡',
    free: true,
  },
  {
    id: 'default-green',
    name: 'Sovereign Green',
    designer: 'GiftSats',
    priceSats: 0,
    lightningAddress: null,
    colors: ['#00b09b', '#96c93d'],
    emoji: '🔑',
    free: true,
  },
  {
    id: 'designer-neon',
    name: 'Neon Sats',
    designer: 'satoshi_art',
    priceSats: 21,
    lightningAddress: 'satoshi_art@getalby.com',
    colors: ['#0d0d0d', '#39ff14'],
    emoji: '🌐',
    free: false,
  },
];

export function listDesigns() {
  return designs;
}

export function createGiftCard({ amountSats, designId, designFeeSats, senderNote, paymentHash, paymentRequest }) {
  const id = randomUUID();
  const card = {
    id,
    amountSats,
    designId,
    designFeeSats,
    senderNote: senderNote || '',
    paymentHash,
    paymentRequest,
    status: 'pending', // pending → minted → redeemed
    cashuToken: null,
    redeemedTo: null,
    createdAt: new Date().toISOString(),
  };
  giftCards.set(id, card);
  return card;
}

export function getGiftCard(id) {
  return giftCards.get(id) || null;
}
