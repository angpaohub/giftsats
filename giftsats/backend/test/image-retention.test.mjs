// Verifies the store-level half of the "your own design/pic" 30-day
// retention feature: custom_image_url round-trips through createGiftCard,
// listCardsWithExpiredImages() finds only expired cards that still have an
// image (and ignores expired cards with no image, and non-expired cards
// with an image), and clearCardImage() removes the image reference without
// ever touching the card row itself. Run with DATABASE_URL pointed at a
// scratch database.
import { initDB, pool, createGiftCard, getGiftCard, listCardsWithExpiredImages, clearCardImage } from '../src/store.js';

const ok = (label, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? ` — ${extra}` : ''}`);
  if (!cond) process.exitCode = 1;
};

await initDB();

// Test helper: createGiftCard always sets expires_at = now + 30 days (by
// design — nothing in the public API lets a caller set their own expiry).
// To exercise the "already expired" branch we backdate it directly here,
// the same way a real card gets there naturally after 30 days pass.
async function backdateExpiry(id, daysAgo) {
  await pool.query(
    `UPDATE gift_cards SET expires_at = NOW() - ($2 || ' days')::interval WHERE id = $1`,
    [id, String(daysAgo)]
  );
}

const baseCard = {
  amountSats: 21000, designId: 'giftsats-classic', platformFee: 210, designFee: 0,
  senderNote: 'hi', recipientName: 'Ploy', senderName: 'Nan',
  senderLightningAddress: 'nan@getalby.com', paymentHash: 'h-img-1', paymentRequest: 'lnbc-img-1',
};

// ── 1. customImageUrl round-trips ─────────────────────────
const withImage = await createGiftCard({ ...baseCard, paymentHash: 'h-img-1', paymentRequest: 'lnbc-img-1', customImageUrl: 'https://r2.example/cards/abc.jpg' });
ok('customImageUrl stored on create', withImage.customImageUrl === 'https://r2.example/cards/abc.jpg');

const withoutImage = await createGiftCard({ ...baseCard, paymentHash: 'h-img-2', paymentRequest: 'lnbc-img-2' });
ok('customImageUrl defaults to null when omitted', withoutImage.customImageUrl === null);

// ── 2. Not-yet-expired cards are never picked up, image or not ──
const before1 = await listCardsWithExpiredImages();
ok('fresh card with an image is not listed as expired', !before1.some(c => c.id === withImage.id));
ok('fresh card without an image is not listed', !before1.some(c => c.id === withoutImage.id));

// ── 3. Expired + has image → picked up. Expired + no image → ignored ──
const withImageExpired = await createGiftCard({ ...baseCard, paymentHash: 'h-img-3', paymentRequest: 'lnbc-img-3', customImageUrl: 'https://r2.example/cards/def.jpg' });
const withoutImageExpired = await createGiftCard({ ...baseCard, paymentHash: 'h-img-4', paymentRequest: 'lnbc-img-4' });
await backdateExpiry(withImageExpired.id, 1);
await backdateExpiry(withoutImageExpired.id, 1);

const due = await listCardsWithExpiredImages();
ok('expired card with an image is listed', due.some(c => c.id === withImageExpired.id));
ok('expired card without an image is ignored (no image to clean up)', !due.some(c => c.id === withoutImageExpired.id));
ok('still-fresh card with an image is not listed', !due.some(c => c.id === withImage.id));

// ── 4. clearCardImage() removes only the image, never the card row ──
await clearCardImage(withImageExpired.id);
const afterClear = await getGiftCard(withImageExpired.id);
ok('card row survives clearCardImage', afterClear !== null);
ok('customImageUrl is nulled out', afterClear.customImageUrl === null);
ok('every other field is untouched', afterClear.amountSats === 21000 && afterClear.recipientName === 'Ploy' && afterClear.status === 'pending');

const dueAfterClear = await listCardsWithExpiredImages();
ok('cleared card no longer shows up as due for cleanup', !dueAfterClear.some(c => c.id === withImageExpired.id));

// clearCardImage on a card that was never expired / had no image: a no-op,
// must not throw and must not disturb the row.
await clearCardImage(withoutImage.id);
const stillThere = await getGiftCard(withoutImage.id);
ok('clearCardImage on an image-less card is a harmless no-op', stillThere !== null && stillThere.customImageUrl === null);

if (process.exitCode) {
  console.log('\nOne or more assertions FAILED.');
} else {
  console.log('\nAll assertions passed.');
}

await pool.end();
