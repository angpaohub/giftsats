import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import { randomUUID, createHash, timingSafeEqual } from 'crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createInvoice, checkPayment, payLightningAddress, getChannelBalance, getNodeInfo, listChannels, listInvoices, listPayments, payInvoice } from './lnd.js';
import {
  initDB, createGiftCard, getGiftCard, getGiftCardByCode, updateGiftCard, getStats,
  listAllCards, listExpiredUnredeemed,
  listDesigns, getDesignByCode, createDesign, incrementDesignUseCount, takedownDesign, restoreDesign,
  claimForRedeem, finalizeRedeem, markRedeemUnknown, releaseRedeemClaim,
  claimForMint,
  claimForRefund, finalizeRefund, markRefundUnknown, releaseRefundClaim, claimForForfeit,
} from './store.js';
import { renderCardOgImage } from './ogImage.js';

dotenv.config();

const app = express();
const allowedOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

app.use('/api', cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      cb(null, true);
    } else {
      cb(new Error('Not allowed by CORS'));
    }
  }
}));
app.use(express.json());

// ── R2 client ────────────────────────────────────────────
const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const R2_BUCKET = process.env.R2_BUCKET || 'giftsats-designs';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || process.env.R2_ENDPOINT;

async function uploadToR2(buffer, filename, mimetype) {
  await r2.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: `designs/${filename}`,
    Body: buffer,
    ContentType: mimetype,
  }));
  return `${R2_PUBLIC_URL}/designs/${filename}`;
}

// ── Multer: memory storage (buffer → R2) ─────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only PNG, JPG, WEBP images allowed'));
  },
});

const PLATFORM_FEE_PERCENT = 0.02;   // 2% of gift amount
const DESIGNER_PLATFORM_CUT = 0.20;  // Platform takes 20% of design fee
const NETWORK_FEE_SATS = 2;
const DESIGN_TAGS = ['Minimal', 'Bold', 'Celebration', 'Seasonal'];

// Anyone holding the share link can call GET /api/gift/:id, so the public shape
// of a card must not carry the payment request, the payment hash, the sender's
// refund address, or the address it was redeemed to.
// 'redeeming' / 'payout_unknown' / 'refunding' / 'refund_unknown' are internal
// in-flight or frozen-for-review states used to make redemption and refund
// atomic (see claimForRedeem/claimForRefund in store.js). A public poller has
// no use for that level of detail and no existing frontend code knows those
// values — fold them into the nearest stable, already-handled public status.
function publicStatus(card) {
  if (card.status === 'redeeming' || card.status === 'payout_unknown') return 'redeemed';
  if (card.status === 'refunding' || card.status === 'refund_unknown') return 'expired';
  return card.status;
}
function publicRefundStatus(card) {
  if (card.refundStatus === 'refunding' || card.refundStatus === 'refund_unknown') return 'refunded';
  return card.refundStatus;
}

// A card's full id (in the share link) is itself the redeem credential — no
// separate key, anyone with the complete link can redeem. The short printed
// code is only the first 12 hex chars of that id, so knowing the code alone
// never reveals the rest of it — that's what keeps the code lookup-only.
// GET /api/gift/code/:code therefore calls this with includeId: false, so a
// card looked up by its short code never carries a usable id in the response
// (see GET /api/gift/code/:code below). GET /api/gift/:id — reached only by
// someone who already has the full id — passes it through as normal.
function publicCard(card, { includeId = true } = {}) {
  if (!card) return card;
  return {
    ...(includeId ? { id: card.id } : {}),
    redeemCode:    redeemCodeFor(card.id),
    amountSats:    card.amountSats,
    designId:      card.designId,
    platformFee:   card.platformFee,
    designFee:     card.designFee,
    networkFee:    NETWORK_FEE_SATS,
    senderNote:    card.senderNote,
    recipientName: card.recipientName,
    senderName:    card.senderName,
    status:        publicStatus(card),
    expiresAt:     card.expiresAt,
    refundStatus:  publicRefundStatus(card),
    createdAt:     card.createdAt,
  };
}

// The redeem code IS the card id — the first 12 hex characters of the UUID,
// grouped for reading aloud. 48 bits of the id is enough to make guessing a
// live card impractical while staying short enough to print on the card back.
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function redeemCodeFor(id) {
  const hex = String(id || '').replace(/-/g, '').slice(0, 12).toUpperCase();
  return hex.match(/.{1,4}/g)?.join('-') || '';
}

// ── Admin auth ────────────────────────────────────────────
// Gate for every route that returns raw card/design rows, node/wallet data,
// or lets someone change platform state or move funds. Reuses the same
// ADMIN_KEY already used by /admin/node — no new secret to manage. Compared
// as a SHA-256 digest via timingSafeEqual so neither the key's length nor
// its bytes can be inferred from response timing.
function validAdminKey(provided) {
  const ADMIN_KEY = process.env.ADMIN_KEY;
  if (!ADMIN_KEY || !provided) return false;
  const a = createHash('sha256').update(provided).digest();
  const b = createHash('sha256').update(ADMIN_KEY).digest();
  return timingSafeEqual(a, b);
}

// For JSON API routes: key must arrive as a header (never a query string,
// which leaks into logs/history).
function requireAdminKey(req, res, next) {
  if (!process.env.ADMIN_KEY) return res.status(500).json({ error: 'ADMIN_KEY not set on server' });
  if (!validAdminKey(req.get('X-Admin-Key') || '')) return res.status(403).json({ error: 'Forbidden' });
  next();
}

// ── Health ──────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ ok: true }));

// ── Stats — public ───────────────────────────────────────
// Aggregate counts only (no card ids, tokens, or PII), and it's not
// actually admin-only: Landing.jsx and About.jsx fetch this for the public
// "sats gifted so far" counters, so it must stay unauthenticated.
app.get('/api/stats', async (req, res) => {
  try {
    const stats = await getStats();
    res.json(stats);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Admin: key check ─────────────────────────────────────
// Used only by the /admin login screen to verify a key before showing the
// dashboard. Deliberately does nothing but check the header — no LND,
// database, or R2 call — so a temporary node/DB hiccup can never be
// mistaken for "wrong key" the way it would if the login screen probed a
// heavier endpoint instead.
app.get('/api/admin/ping', requireAdminKey, (req, res) => {
  res.json({ ok: true });
});

// ── Admin: node info + balance + channels (JSON) ────────
// Backs the "Node" tab in the React admin dashboard. Read-only — same LND
// calls /admin/node already makes, just returned as JSON instead of baked
// into an HTML string.
app.get('/api/admin/node-info', requireAdminKey, async (req, res) => {
  try {
    const [info, balance, channels] = await Promise.all([
      getNodeInfo(),
      getChannelBalance(),
      listChannels(),
    ]);
    res.json({ info, balance, channels });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Admin: recent Lightning transactions (JSON) ─────────
app.get('/api/admin/node-transactions', requireAdminKey, async (req, res) => {
  try {
    const [invoices, payments] = await Promise.all([listInvoices(50), listPayments(50)]);
    const received = invoices
      .filter(inv => inv.settled)
      .map(inv => ({
        time: parseInt(inv.settle_date) * 1000,
        direction: 'in',
        amount: parseInt(inv.amt_paid_sat || inv.value || 0),
        memo: inv.memo || '(no memo)',
        status: 'settled',
      }));
    const sent = payments.map(p => ({
      time: parseInt(p.creation_date) * 1000,
      direction: 'out',
      amount: parseInt(p.value_sat || p.value || 0),
      memo: p.payment_request ? p.payment_request.slice(0, 20) + '...' : '(no memo)',
      status: p.status === 'SUCCEEDED' ? 'succeeded' : (p.status === 'FAILED' ? 'failed' : p.status?.toLowerCase() || 'unknown'),
      fee: parseInt(p.fee_sat || 0),
    }));
    const txs = [...received, ...sent].sort((a, b) => b.time - a.time).slice(0, 50);
    res.json(txs);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Admin: R2 storage stats ─────────────────────────────
app.get('/api/admin/r2-stats', requireAdminKey, async (req, res) => {
  try {
    const { ListObjectsV2Command } = await import('@aws-sdk/client-s3');
    let totalSize = 0;
    let objectCount = 0;
    let continuationToken = undefined;

    do {
      const cmd = new ListObjectsV2Command({
        Bucket: R2_BUCKET,
        Prefix: 'designs/',
        ContinuationToken: continuationToken,
      });
      const result = await r2.send(cmd);
      for (const obj of (result.Contents || [])) {
        totalSize += obj.Size || 0;
        objectCount++;
      }
      continuationToken = result.IsTruncated ? result.NextContinuationToken : undefined;
    } while (continuationToken);

    const usedGB = totalSize / (1024 * 1024 * 1024);
    res.json({ usedGB, objectCount, usedBytes: totalSize });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Admin: list all cards ───────────────────────────────
app.get('/api/admin/cards', requireAdminKey, async (req, res) => {
  try {
    const cards = await listAllCards();
    res.json(cards);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Admin: list ALL designs (incl. inactive) ────────────
app.get('/api/admin/designs', requireAdminKey, async (req, res) => {
  try {
    const designs = await listDesigns({ activeOnly: false, includePrivate: true });
    res.json(designs);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Admin: takedown a design ────────────────────────────
app.patch('/api/admin/designs/:id/takedown', requireAdminKey, async (req, res) => {
  try {
    const design = await takedownDesign(req.params.id);
    if (!design) return res.status(404).json({ error: 'Design not found' });
    res.json(design);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Admin: restore a taken-down design ──────────────────
app.patch('/api/admin/designs/:id/restore', requireAdminKey, async (req, res) => {
  try {
    const design = await restoreDesign(req.params.id);
    if (!design) return res.status(404).json({ error: 'Design not found' });
    res.json(design);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Channel balance (for admin) ─────────────────────────
app.get('/api/channel-balance', requireAdminKey, async (req, res) => {
  try {
    const balance = await getChannelBalance();
    res.json(balance);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Public: list active designs (Explore page) ──────────
app.get('/api/designs', async (req, res) => {
  try {
    const designs = await listDesigns({ activeOnly: true });
    res.json(designs);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Public: fetch single design by code (for preview) ───
app.get('/api/designs/:code', async (req, res) => {
  try {
    const design = await getDesignByCode(req.params.code);
    if (!design || !design.active) return res.status(404).json({ error: 'Design not found' });
    res.json(design);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Public: submit new design ────────────────────────────
// Multipart: image file + JSON fields
app.post('/api/designs', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Image required' });

    const { name, designerName, handle, email, lightningAddress, priceSats, description, tag } = req.body;
    if (!name) return res.status(400).json({ error: 'Design name required' });
    if (!lightningAddress) return res.status(400).json({ error: 'Lightning address required' });

    const lnAddrRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
    if (!lnAddrRegex.test(lightningAddress)) {
      return res.status(400).json({ error: 'Invalid Lightning address format' });
    }
    // Email is how the designer is reached about their submission, so it is
    // required and validated the same way.
    if (!email || !lnAddrRegex.test(email)) {
      return res.status(400).json({ error: 'A valid email address is required' });
    }
    if (tag && !DESIGN_TAGS.includes(tag)) {
      return res.status(400).json({ error: `Category must be one of: ${DESIGN_TAGS.join(', ')}` });
    }

    const price = Math.max(0, parseInt(priceSats) || 0);
    const ext = path.extname(req.file.originalname).toLowerCase();
    const filename = `${randomUUID()}${ext}`;
    const imageUrl = await uploadToR2(req.file.buffer, filename, req.file.mimetype);

    const design = await createDesign({
      name: String(name).slice(0, 60),
      designerName: (designerName || handle || 'Anonymous').slice(0, 40),
      handle: handle ? String(handle).slice(0, 40) : null,
      email: String(email).slice(0, 120),
      lightningAddress,
      priceSats: price,
      imageUrl,
      description: String(description || '').slice(0, 280),
      tag: tag || 'Minimal',
      palette: null,
    });

    // Never echo the designer's email back over a public endpoint.
    const { email: _omit, ...publicDesign } = design;
    res.json(publicDesign);
  } catch (e) {
    console.error('design submit error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Create gift card ─────────────────────────────────────
app.post('/api/gift/create', async (req, res) => {
  try {
    const { amountSats, designCode, senderNote, recipientName, senderName, senderLightningAddress } = req.body;

    if (!amountSats || amountSats < 1000) {
      return res.status(400).json({ error: 'Minimum 1000 sats' });
    }

    // These three land on the printed card, so cap them rather than trusting
    // whatever the client sends.
    const note = String(senderNote || '').slice(0, 140);
    const to   = String(recipientName || '').slice(0, 40);
    const from = String(senderName || '').slice(0, 40);

    if (senderLightningAddress) {
      const lnAddrRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
      if (!lnAddrRegex.test(senderLightningAddress)) {
        return res.status(400).json({ error: 'Invalid Lightning address format' });
      }
    }

    // Resolve design
    let design = null;
    if (designCode) {
      const isBuiltIn = designCode.startsWith('giftsats-');
      design = await getDesignByCode(designCode);
      if (!design && !isBuiltIn) {
        return res.status(404).json({ error: 'Design code not found or unavailable' });
      }
      if (design && !design.active && !isBuiltIn) {
        return res.status(404).json({ error: 'Design code not found or unavailable' });
      }
    }

    // Fee calculation
    const platformFee = Math.ceil(amountSats * PLATFORM_FEE_PERCENT);
    const designFee = design?.priceSats || 0;
    const totalSats = amountSats + platformFee + designFee + NETWORK_FEE_SATS;

    // Check inbound capacity
    const { remoteSats } = await getChannelBalance();
    if (remoteSats < totalSats) {
      return res.status(400).json({
        error: `Not enough capacity. Available: ${remoteSats.toLocaleString()} sats`,
        availableSats: remoteSats,
      });
    }

    const invoice = await createInvoice(totalSats, `GiftSats: ${amountSats} sats`);
    const giftCard = await createGiftCard({
      amountSats,
      designId: design?.id || designCode || 'giftsats-classic',
      platformFee,
      designFee,
      senderNote: note,
      recipientName: to,
      senderName: from,
      senderLightningAddress: senderLightningAddress || null,
      paymentHash: invoice.r_hash,
      paymentRequest: invoice.payment_request,
    });

    res.json({
      giftCardId: giftCard.id,
      redeemCode: redeemCodeFor(giftCard.id),
      paymentRequest: invoice.payment_request,
      totalSats,
      amountSats,
      platformFee,
      designFee,
      networkFee: NETWORK_FEE_SATS,
      design: design || null,
      expiresAt: giftCard.expiresAt,
      // The LND invoice is created with expiry: 600 — let the client count down
      // against the server's clock instead of guessing ten minutes locally.
      invoiceExpiresAt: new Date(Date.now() + 600 * 1000).toISOString(),
    });
  } catch (e) {
    console.error('create error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Settle-on-read: shared by both card lookups ──────────
// If the card is still pending, ask LND whether the invoice settled; if it did,
// mint the card and fire the designer/platform payouts.
async function refreshCard(giftCard) {
  {
    if (giftCard.status !== 'pending') {
      return giftCard;
    }

    const paid = await checkPayment(giftCard.paymentHash);
    if (paid) {
      // ── Atomically claim the mint (GS-005) ───────────
      // /api/gift/:id and /api/gift/code/:code are both public and unrate-
      // limited, and the frontend polls them every few seconds — so several
      // requests can land here in the same instant right after an invoice
      // settles. Only the request whose UPDATE actually matches a row
      // (WHERE status='pending') is "the one" that minted this card, and
      // only that request fires the designer/platform fee payouts below.
      // Everyone else just gets back the card someone else already minted.
      // (The redeem secret was already generated in /api/gift/create — GS-004
      // — so minting itself no longer needs to produce any credential.)
      const claimed = await claimForMint(giftCard.id);
      if (!claimed) {
        return getGiftCard(giftCard.id);
      }

      // ── Pay platform wallet (non-fatal) ────────────
      if (process.env.PLATFORM_WALLET && giftCard.platformFee > 0) {
        payLightningAddress(process.env.PLATFORM_WALLET, giftCard.platformFee)
          .catch(e => console.error('platform fee error (non-fatal):', e.message));
      }

      // ── Auto-pay designer (non-fatal) ──────────────
      // Platform keeps 20%, designer gets 80%
      if (giftCard.designFee > 0) {
        const design = await getDesignByCode(giftCard.designId);
        if (design?.lightningAddress) {
          const designerPayout = Math.floor(giftCard.designFee * (1 - DESIGNER_PLATFORM_CUT));
          const platformDesignCut = giftCard.designFee - designerPayout;

          payLightningAddress(design.lightningAddress, designerPayout)
            .then(() => {
              console.log(`[design-fee] Paid ${designerPayout} sats → ${design.lightningAddress}`);
              incrementDesignUseCount(giftCard.designId).catch(() => {});
            })
            .catch(e => console.error('designer fee error (non-fatal):', e.message));

          // ── Platform 20% cut → platform wallet ────
          if (process.env.PLATFORM_WALLET && platformDesignCut > 0) {
            payLightningAddress(process.env.PLATFORM_WALLET, platformDesignCut)
              .then(() => console.log(`[design-cut] Paid ${platformDesignCut} sats → platform`))
              .catch(e => console.error('platform design cut error (non-fatal):', e.message));
          }
        }
      } else if (giftCard.designId) {
        // Still increment use count for free designs
        incrementDesignUseCount(giftCard.designId).catch(() => {});
      }

      return claimed;
    }

    return giftCard;
  }
}

// ── Poll gift card status by id (share link) ─────────────
app.get('/api/gift/:id', async (req, res) => {
  try {
    const giftCard = await getGiftCard(req.params.id);
    if (!giftCard) return res.status(404).json({ error: 'Not found' });
    res.json(publicCard(await refreshCard(giftCard)));
  } catch (e) {
    console.error('poll error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Look a card up by the short redeem code printed on it ─
// Track/lookup only — this response never carries the card's full id, so
// knowing just the short code (which is guessable/enumerable at 48 bits) can
// never be turned into a working redemption. Only someone with the complete
// share link (the full id) can redeem — see publicCard() above.
app.get('/api/gift/code/:code', async (req, res) => {
  try {
    const giftCard = await getGiftCardByCode(req.params.code);
    if (!giftCard) return res.status(404).json({ error: 'Not found' });
    res.json(publicCard(await refreshCard(giftCard), { includeId: false }));
  } catch (e) {
    console.error('code lookup error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Redeem gift card ─────────────────────────────────────
app.post('/api/redeem', async (req, res) => {
  try {
    const { lightningAddress, giftCardId } = req.body;
    if (!lightningAddress) return res.status(400).json({ error: 'Lightning address required' });
    if (!giftCardId) return res.status(400).json({ error: 'Gift card ID required' });

    const card = await getGiftCard(giftCardId);
    if (!card) return res.status(404).json({ error: 'Gift card not found' });
    if (card.status === 'redeemed' || card.status === 'redeeming' || card.status === 'payout_unknown') {
      return res.status(409).json({ error: 'Gift card already redeemed' });
    }
    if (card.status !== 'minted') return res.status(400).json({ error: 'Gift card not ready for redemption' });

    if (card.expiresAt && new Date() > new Date(card.expiresAt)) {
      return res.status(410).json({ error: 'Gift card has expired', expiredAt: card.expiresAt });
    }

    // Anyone who supplies this card's full id can redeem it — the id itself
    // is the credential (see publicCard()'s includeId comment above). There
    // is deliberately no separate secret/key check here.

    // ── Atomically claim the card before paying out (GS-003) ─
    // This UPDATE only matches a row if status is still 'minted' right now —
    // if 5 redeem requests land at once (or the expiry job grabs this same
    // card for a refund at the same instant), only one of them gets `claimed`
    // back. Everyone else is told the card is already taken, before any of
    // them touch the Lightning payment.
    const claimed = await claimForRedeem(giftCardId, lightningAddress);
    if (!claimed) {
      return res.status(409).json({ error: 'Gift card already redeemed' });
    }

    try {
      await payLightningAddress(lightningAddress, card.amountSats);
    } catch (payErr) {
      if (payErr.ambiguous) {
        // We don't know if the payment actually went out (see lnd.js). Handing
        // the card back to 'minted' here could let it be redeemed a second
        // time on top of a payment that may have already gone through, so it
        // stays frozen for a human to check against LND's payment history.
        console.error(`[REVIEW NEEDED] redeem payout ambiguous for card ${giftCardId}:`, payErr.message);
        await markRedeemUnknown(giftCardId);
        return res.status(500).json({ error: `Payment failed: ${payErr.message}. This card has been frozen for manual review — contact support instead of retrying.` });
      }
      console.error('payout failed cleanly, releasing claim:', payErr.message);
      await releaseRedeemClaim(giftCardId);
      return res.status(500).json({ error: `Payment failed: ${payErr.message}` });
    }

    await finalizeRedeem(giftCardId);
    return res.json({ success: true, amountSats: card.amountSats, msg: `Sent ${card.amountSats} sats to ${lightningAddress}` });
  } catch (e) {
    console.error('redeem error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Expiry cron job (runs every hour) ───────────────────
async function processExpiredCards() {
  const expired = await listExpiredUnredeemed();
  if (expired.length === 0) return;

  console.log(`[expiry] Processing ${expired.length} expired card(s)`);

  for (const card of expired) {
    try {
      if (card.senderLightningAddress) {
        // ── Atomically claim the refund (GS-007) ───────
        // Claims by flipping status away from 'minted', so this can't
        // double-pay if the job overlaps itself (multiple instances, or a
        // slow previous run still finishing) and can't race a redeem that
        // slipped in just before the card's expiry.
        const claimed = await claimForRefund(card.id);
        if (!claimed) continue; // someone else already has this one

        try {
          await payLightningAddress(card.senderLightningAddress, card.amountSats);
        } catch (payErr) {
          if (payErr.ambiguous) {
            // Same reasoning as the redeem route: don't guess, freeze it.
            console.error(`[REVIEW NEEDED] [expiry] refund payout ambiguous for card ${card.id}:`, payErr.message);
            await markRefundUnknown(card.id);
          } else {
            console.error(`[expiry] refund payout failed cleanly, will retry next run for card ${card.id}:`, payErr.message);
            await releaseRefundClaim(card.id);
          }
          continue;
        }

        await finalizeRefund(card.id, card.senderLightningAddress);
        console.log(`[expiry] Refunded ${card.amountSats} sats → ${card.senderLightningAddress}`);
      } else {
        const claimed = await claimForForfeit(card.id);
        if (claimed) console.log(`[expiry] Forfeited ${card.amountSats} sats (card ${card.id})`);
      }
    } catch (err) {
      console.error(`[expiry] Failed to process card ${card.id}:`, err.message);
    }
  }
}

// ── OG preview for /card/:id (for crawlers) ──────────────
// The backend's own public URL — /card/:id is proxied here from the
// frontend's domain (see frontend/public/_redirects) so crawlers get OG tags,
// but nothing proxies other backend paths, so the og:image URL below has to
// point at this host directly rather than at FRONTEND_URL.
const BACKEND_URL = (process.env.BACKEND_URL || 'https://giftsats-production.up.railway.app').trim();

app.get('/card/:id', async (req, res) => {
  try {
    const card = await getGiftCard(req.params.id);
    // FRONTEND_URL may hold a comma-separated allowlist for CORS; the first
    // entry is the canonical site.
    const frontendUrl = (process.env.FRONTEND_URL || 'https://giftsats.org').split(',')[0].trim();
    const cardUrl = `${frontendUrl}/card/${req.params.id}`;
    // Netlify proxies /card/:id here, so bouncing a browser back to that same
    // path would loop. /g/:id is the same screen served directly by the SPA.
    const viewUrl = `${frontendUrl}/g/${req.params.id}`;

    if (!card) {
      return res.redirect(302, viewUrl);
    }

    const sats = card.amountSats.toLocaleString('en-US');
    const title = `🎁 ${sats} sats Gift Card`;
    // The note is written by the sender, so it is escaped before it goes into
    // a meta content attribute.
    const description = card.senderNote
      ? `${escapeHtml(card.senderNote)} — Redeem your Bitcoin gift card at giftsats.org`
      : `You received a Bitcoin gift card worth ${sats} sats. Redeem instantly with any Lightning address.`;
    // Per-card link preview: same background art, mark and amount typography
    // as the card front, rendered server-side since crawlers never run the
    // SPA's JS.
    const ogImageUrl = `${BACKEND_URL}/og/card/${req.params.id}.png`;

    res.setHeader('Content-Type', 'text/html');
    res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:url" content="${cardUrl}" />
  <meta property="og:type" content="website" />
  <meta property="og:image" content="${ogImageUrl}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${ogImageUrl}" />
  <meta http-equiv="refresh" content="0; url=${viewUrl}" />
</head>
<body>
  <script>
    window.location.replace("${viewUrl}");
  </script>
</body>
</html>`);
  } catch (e) {
    const base = (process.env.FRONTEND_URL || 'https://giftsats.org').split(',')[0].trim();
    res.redirect(302, `${base}/g/${req.params.id}`);
  }
});

// Per-card link-preview image. Card art + amount are fixed once a card is
// minted, so this is safe to cache hard — a pending (unpaid) card's preview
// can still change until then, so those get a short cache instead.
app.get('/og/card/:id.png', async (req, res) => {
  try {
    const card = await getGiftCard(req.params.id);
    if (!card) return res.status(404).end();

    // Built-in fronts are named 'giftsats-*' / legacy seed ids and need no
    // lookup; anything else is a designer's uploaded artwork.
    let design = null;
    if (card.designId && !/^giftsats-/.test(card.designId)) {
      design = await getDesignByCode(card.designId).catch(() => null);
    }

    const png = await renderCardOgImage({
      amountSats: card.amountSats,
      senderNote: card.senderNote,
      recipientName: card.recipientName,
      senderName: card.senderName,
      designId: card.designId,
      design,
    });

    res.setHeader('Content-Type', 'image/png');
    res.setHeader(
      'Cache-Control',
      card.status === 'minted' || card.status === 'redeemed'
        ? 'public, max-age=31536000, immutable'
        : 'public, max-age=300'
    );
    res.send(png);
  } catch (e) {
    console.error('og image render failed:', e);
    res.status(500).end();
  }
});

// ── Admin: create invoice (receive) — protected by ADMIN_KEY only ──
// Accepts the key either as ?key= (the /admin/node HTML page) or as an
// X-Admin-Key header (the React admin's Node tab) — same key, same check.
app.post('/admin/action/create-invoice', async (req, res) => {
  if (!validAdminKey(req.get('X-Admin-Key') || req.query.key || '')) return res.status(403).json({ error: 'Forbidden' });
  try {
    const amountSats = parseInt(req.body.amountSats);
    if (!amountSats || amountSats < 1) return res.status(400).json({ error: 'Invalid amount' });
    const invoice = await createInvoice(amountSats, req.body.memo || 'Admin receive');
    res.json({ paymentRequest: invoice.payment_request });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Admin: pay bolt11 or Lightning address — needs BOTH keys ──
// ADMIN_KEY (query or header) proves you can view the dashboard.
// ADMIN_PAY_KEY (form field, separate secret) proves you're allowed to move funds out.
app.post('/admin/action/pay', async (req, res) => {
  if (!validAdminKey(req.get('X-Admin-Key') || req.query.key || '')) return res.status(403).json({ error: 'Forbidden' });
  const ADMIN_PAY_KEY = process.env.ADMIN_PAY_KEY;
  if (!ADMIN_PAY_KEY) return res.status(500).json({ error: 'ADMIN_PAY_KEY not set on server' });
  if (req.body.payKey !== ADMIN_PAY_KEY) return res.status(403).json({ error: 'Wrong or missing Pay Authorization Key' });

  try {
    const destination = (req.body.destination || '').trim();
    const amountSats = req.body.amountSats ? parseInt(req.body.amountSats) : null;
    if (!destination) return res.status(400).json({ error: 'Missing destination' });

    let result;
    if (destination.includes('@')) {
      if (!amountSats) return res.status(400).json({ error: 'Amount required for Lightning address' });
      result = await payLightningAddress(destination, amountSats);
    } else if (destination.toLowerCase().startsWith('lnbc') || destination.toLowerCase().startsWith('lntb')) {
      result = await payInvoice(destination);
    } else {
      return res.status(400).json({ error: 'Unrecognized destination — must be a bolt11 invoice or Lightning address' });
    }
    res.json({ success: true, preimage: result.payment_preimage });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Admin: node status dashboard ─────────────────────────
app.get('/admin/node', async (req, res) => {
  const ADMIN_KEY = process.env.ADMIN_KEY;
  if (!ADMIN_KEY) return res.status(500).send('ADMIN_KEY not set on server');
  if (req.query.key !== ADMIN_KEY) return res.status(403).send('Forbidden — missing or wrong ?key=');

  try {
    const [info, balance, channels, invoices, payments] = await Promise.all([
      getNodeInfo(),
      getChannelBalance(),
      listChannels(),
      listInvoices(50),
      listPayments(50),
    ]);

    const channelRows = channels.map(ch => {
      const cap = parseInt(ch.capacity);
      const local = parseInt(ch.local_balance);
      const remote = parseInt(ch.remote_balance);
      const reserve = parseInt(ch.local_chan_reserve_sat || 0);
      const spendable = Math.max(0, local - reserve);
      return `
        <tr>
          <td>${ch.peer_alias || '(unknown)'}</td>
          <td class="mono">${ch.active ? '🟢 active' : '🔴 inactive'}</td>
          <td class="mono">${cap.toLocaleString()}</td>
          <td class="mono">${local.toLocaleString()}</td>
          <td class="mono">${remote.toLocaleString()}</td>
          <td class="mono">${reserve.toLocaleString()}</td>
          <td class="mono" style="color:${spendable > 0 ? '#39ff14' : '#ff6b6b'}">${spendable.toLocaleString()}</td>
          <td class="mono">${ch.private ? 'private' : 'public'}</td>
        </tr>`;
    }).join('');

    const received = invoices
      .filter(inv => inv.settled)
      .map(inv => ({
        time: parseInt(inv.settle_date) * 1000,
        direction: 'in',
        amount: parseInt(inv.amt_paid_sat || inv.value || 0),
        memo: inv.memo || '(no memo)',
        status: 'settled',
      }));

    const sent = payments
      .map(p => ({
        time: parseInt(p.creation_date) * 1000,
        direction: 'out',
        amount: parseInt(p.value_sat || p.value || 0),
        memo: p.payment_request ? p.payment_request.slice(0, 20) + '...' : '(no memo)',
        status: p.status === 'SUCCEEDED' ? 'succeeded' : (p.status === 'FAILED' ? 'failed' : p.status?.toLowerCase() || 'unknown'),
        fee: parseInt(p.fee_sat || 0),
      }));

    const txs = [...received, ...sent].sort((a, b) => b.time - a.time).slice(0, 50);

    const txRows = txs.map(tx => {
      const dateStr = new Date(tx.time).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'medium' });
      const dirLabel = tx.direction === 'in' ? '⬇️ Received' : '⬆️ Sent';
      const dirColor = tx.direction === 'in' ? '#39ff14' : '#F7931A';
      const statusColor = tx.status === 'failed' ? '#ff6b6b' : (tx.status === 'succeeded' || tx.status === 'settled' ? '#39ff14' : '#888');
      return `
        <tr>
          <td class="mono">${dateStr}</td>
          <td class="mono" style="color:${dirColor}">${dirLabel}</td>
          <td class="mono">${tx.amount.toLocaleString()} sats</td>
          <td class="mono" style="color:${statusColor}">${tx.status}</td>
          <td class="mono" style="color:#666">${tx.fee ? tx.fee.toLocaleString() + ' sats' : '—'}</td>
          <td style="color:#888; max-width:280px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${tx.memo}</td>
        </tr>`;
    }).join('');

    res.setHeader('Content-Type', 'text/html');
    res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>GiftSats — Node Status</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { background:#0a0a0a; color:#f0ece4; font-family:'JetBrains Mono','Fira Code',monospace; padding:32px; margin:0; }
    h1 { color:#F7931A; font-size:20px; margin-bottom:4px; }
    h2 { font-size:14px; margin:40px 0 16px; text-transform:uppercase; letter-spacing:1px; color:#888; }
    .sub { color:#666; font-size:12px; margin-bottom:32px; }
    .cards { display:flex; gap:16px; flex-wrap:wrap; margin-bottom:32px; }
    .card { background:#141414; border:1px solid #262626; border-radius:8px; padding:16px 20px; min-width:160px; }
    .card .label { font-size:10px; color:#666; text-transform:uppercase; letter-spacing:1px; margin-bottom:6px; }
    .card .value { font-size:20px; font-weight:700; }
    table { width:100%; border-collapse:collapse; font-size:12px; margin-bottom:16px; }
    th { text-align:left; color:#666; font-size:10px; text-transform:uppercase; letter-spacing:1px; padding:8px 10px; border-bottom:1px solid #262626; }
    td { padding:10px; border-bottom:1px solid #1a1a1a; }
    .mono { font-family:'JetBrains Mono',monospace; }
    .refresh { color:#F7931A; text-decoration:none; font-size:11px; }
    .synced-yes { color:#39ff14; }
    .synced-no { color:#ff6b6b; }
    input { width:100%; padding:8px; margin-bottom:8px; background:#0a0a0a; border:1px solid #262626; color:#f0ece4; font-family:inherit; border-radius:4px; box-sizing:border-box; }
    button { width:100%; padding:8px; background:#F7931A; color:#000; border:none; border-radius:4px; cursor:pointer; font-family:inherit; font-weight:700; }
    button:hover { opacity:0.9; }
    .pay-key-note { font-size:10px; color:#666; margin-bottom:8px; }
  </style>
</head>
<body>
  <h1>⚡ GiftSats Node Status</h1>
  <div class="sub">
    ${info.alias || '(no alias)'} · ${info.identity_pubkey?.slice(0, 16)}...
    · block ${info.block_height?.toLocaleString()}
    · synced: <span class="${info.synced_to_chain ? 'synced-yes' : 'synced-no'}">${info.synced_to_chain ? 'yes' : 'no'}</span>
    &nbsp;·&nbsp; <a class="refresh" href="?key=${req.query.key}">↻ refresh</a>
  </div>

  <div class="cards">
    <div class="card"><div class="label">Total Local Balance</div><div class="value">${balance.localSats.toLocaleString()} sats</div></div>
    <div class="card"><div class="label">Total Remote Balance</div><div class="value">${balance.remoteSats.toLocaleString()} sats</div></div>
    <div class="card"><div class="label">Active Channels</div><div class="value">${channels.filter(c => c.active).length} / ${channels.length}</div></div>
    <div class="card"><div class="label">Peers</div><div class="value">${info.num_peers ?? '—'}</div></div>
  </div>

  <h2>Receive / Send</h2>
  <div class="cards" style="align-items:flex-start;">
    <div class="card" style="min-width:280px;">
      <div class="label" style="margin-bottom:12px;">Receive (Create Invoice)</div>
      <input id="recvAmt" type="number" placeholder="Amount (sats)">
      <button onclick="createInv()">Create Invoice</button>
      <div id="recvResult" style="margin-top:12px; word-break:break-all; font-size:10px; color:#888;"></div>
      <img id="recvQR" style="display:none; margin-top:12px; width:180px; border-radius:4px;">
    </div>
    <div class="card" style="min-width:280px;">
      <div class="label" style="margin-bottom:12px;">Send (bolt11 or Lightning address)</div>
      <input id="sendDest" type="text" placeholder="lnbc... or name@domain.com">
      <input id="sendAmt" type="number" placeholder="Amount in sats (only for Lightning address)">
      <div class="pay-key-note">Requires separate Pay Authorization Key ⬇️</div>
      <input id="payKey" type="password" placeholder="Pay Authorization Key">
      <button onclick="sendPay()">Pay</button>
      <div id="sendResult" style="margin-top:12px; word-break:break-all; font-size:11px;"></div>
    </div>
  </div>

  <h2>Channels</h2>
  <table>
    <thead>
      <tr>
        <th>Peer</th><th>Status</th><th>Capacity</th><th>Local</th><th>Remote</th>
        <th>Reserve</th><th>Spendable</th><th>Type</th>
      </tr>
    </thead>
    <tbody>
      ${channelRows || '<tr><td colspan="8" style="color:#666">No channels yet</td></tr>'}
    </tbody>
  </table>

  <h2>Recent Transactions (last 50)</h2>
  <table>
    <thead>
      <tr>
        <th>Time</th><th>Direction</th><th>Amount</th><th>Status</th><th>Fee</th><th>Details</th>
      </tr>
    </thead>
    <tbody>
      ${txRows || '<tr><td colspan="6" style="color:#666">No transactions yet</td></tr>'}
    </tbody>
  </table>

  <script>
    const ADMIN_KEY_Q = new URLSearchParams(location.search).get('key');

    async function createInv() {
      const amt = document.getElementById('recvAmt').value;
      const out = document.getElementById('recvResult');
      const qr = document.getElementById('recvQR');
      out.style.color = '#888';
      out.textContent = 'Creating...';
      qr.style.display = 'none';
      try {
        const res = await fetch('/admin/action/create-invoice?key=' + encodeURIComponent(ADMIN_KEY_Q), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amountSats: amt, memo: 'Admin receive' }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create invoice');
        out.textContent = data.paymentRequest;
        qr.src = 'https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=' + encodeURIComponent(data.paymentRequest);
        qr.style.display = 'block';
      } catch (e) {
        out.style.color = '#ff6b6b';
        out.textContent = '❌ ' + e.message;
      }
    }

    async function sendPay() {
      const dest = document.getElementById('sendDest').value;
      const amt = document.getElementById('sendAmt').value;
      const payKey = document.getElementById('payKey').value;
      const out = document.getElementById('sendResult');
      out.style.color = '#888';
      out.textContent = 'Sending...';
      try {
        const res = await fetch('/admin/action/pay?key=' + encodeURIComponent(ADMIN_KEY_Q), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ destination: dest, amountSats: amt || undefined, payKey }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Payment failed');
        out.style.color = '#39ff14';
        out.textContent = '✅ Payment succeeded — preimage: ' + data.preimage;
      } catch (e) {
        out.style.color = '#ff6b6b';
        out.textContent = '❌ ' + e.message;
      }
    }
  </script>
</body>
</html>`);
  } catch (e) {
    res.status(500).send(`Error loading node status: ${e.message}`);
  }
});

// ── Start ────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
initDB()
  .then(() => {
    app.listen(PORT, () => console.log(`GiftSats backend running on :${PORT}`));
    processExpiredCards();
    setInterval(processExpiredCards, 60 * 60 * 1000);
  })
  .catch(err => {
    console.error('Failed to init DB:', err);
    process.exit(1);
  });
