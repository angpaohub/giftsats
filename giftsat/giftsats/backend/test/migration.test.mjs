// Throwaway check: apply the new initDB on top of the OLD production schema,
// then exercise the new store functions. Run with DATABASE_URL pointed at a
// scratch database.
import {
  initDB, pool, createGiftCard, getGiftCard, getGiftCardByCode,
  createDesign, listDesigns, getDesignByCode, getStats, updateGiftCard,
} from '../src/store.js';

const ok = (label, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? ` — ${extra}` : ''}`);
  if (!cond) process.exitCode = 1;
};

// ── 1. Recreate the pre-upgrade schema, with data in it ──
await pool.query(`
  CREATE TABLE gift_cards (
    id UUID PRIMARY KEY, amount_sats INTEGER NOT NULL, design_id TEXT NOT NULL,
    platform_fee INTEGER NOT NULL DEFAULT 0, sender_note TEXT NOT NULL DEFAULT '',
    payment_hash TEXT NOT NULL, payment_request TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', cashu_token TEXT, cashu_quote TEXT,
    redeemed_to TEXT, redeemed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE TABLE designs (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, designer_name TEXT NOT NULL DEFAULT 'Anonymous',
    lightning_address TEXT NOT NULL, price_sats INTEGER NOT NULL DEFAULT 0,
    image_url TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
    active BOOLEAN NOT NULL DEFAULT true, use_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  INSERT INTO designs (id, name, lightning_address, image_url)
    VALUES ('giftsats-classic', 'Bitcoin Classic', 'giftsats@getalby.com', '/designs/classic.png'),
           ('gfts-abcde', 'Community Front', 'lisel@getalby.com', 'https://cdn/x.png');
  INSERT INTO gift_cards (id, amount_sats, design_id, sender_note, payment_hash, payment_request, status)
    VALUES ('11111111-1111-4111-8111-111111111111', 5000, 'giftsats-classic', 'old card', 'hash', 'lnbc1', 'minted');
`);

// ── 2. The upgrade ────────────────────────────────────────
await initDB();
ok('initDB runs on the old schema', true);

// Idempotent — Railway restarts run it on every boot.
await initDB();
ok('initDB is re-runnable', true);

// ── 3. Legacy rows survive and are hidden from Explore ────
const legacy = await getGiftCard('11111111-1111-4111-8111-111111111111');
ok('legacy card still readable', legacy?.amountSats === 5000);
ok('legacy card gets empty to/from', legacy.recipientName === '' && legacy.senderName === '');

const active = await listDesigns({ activeOnly: true });
ok('built-in seeds hidden from Explore', !active.some((d) => d.id.startsWith('giftsats-')));
ok('community design still listed', active.some((d) => d.id === 'gfts-abcde'));
ok('public listing carries no email', !('email' in active[0]));

const admin = await listDesigns({ activeOnly: false, includePrivate: true });
ok('admin listing exposes email', 'email' in admin[0]);

// ── 4. New columns round-trip ─────────────────────────────
const design = await createDesign({
  name: 'Sand Ledger', designerName: 'lisel', handle: '@lisel', email: 'lisel@example.com',
  lightningAddress: 'lisel@getalby.com', priceSats: 200, imageUrl: 'https://cdn/sand.png',
  description: 'warm', tag: 'Celebration', palette: { amount: '#15120F', body: '#3A332C' },
});
ok('design code shape', /^gfts-[0-9a-f]{5}$/.test(design.id), design.id);
ok('tag stored', design.tag === 'Celebration');
ok('palette stored as an object', design.palette?.amount === '#15120F');
ok('createDesign result hides email', !('email' in design));
ok('getDesignByCode finds it', (await getDesignByCode(design.id))?.name === 'Sand Ledger');

const card = await createGiftCard({
  amountSats: 21000, designId: design.id, platformFee: 420, designFee: 200,
  senderNote: 'Happy birthday', recipientName: 'Ploy', senderName: 'Nan',
  senderLightningAddress: 'nan@getalby.com', paymentHash: 'h2', paymentRequest: 'lnbc2',
});
ok('to/from round-trip', card.recipientName === 'Ploy' && card.senderName === 'Nan');
ok('expiry is 30 days out', Math.round((new Date(card.expiresAt) - Date.now()) / 86400000) === 30);

// ── 5. Redeem code = card id ──────────────────────────────
const short = card.id.replace(/-/g, '').slice(0, 12);
ok('lookup by 12-char prefix', (await getGiftCardByCode(short))?.id === card.id);
ok('lookup by grouped prefix', (await getGiftCardByCode(short.match(/.{1,4}/g).join('-').toUpperCase()))?.id === card.id);
ok('lookup by full id', (await getGiftCardByCode(card.id))?.id === card.id);
ok('short input is refused', (await getGiftCardByCode('ABCD')) === null);
ok('unknown code is null', (await getGiftCardByCode('ffffffffffff')) === null);
ok('malformed id does not throw', (await getGiftCard('not-a-uuid')) === null);

// ── 6. Stats still compute ────────────────────────────────
await updateGiftCard(card.id, { status: 'minted' });
const stats = await getStats();
ok('stats query runs', Number(stats.minted_count) >= 1, JSON.stringify(stats.minted_count));

await pool.end();
