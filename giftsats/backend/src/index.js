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
// or lets someone change platform state or move funds. One ADMIN_KEY shared
// across all of it — no per-route secret to manage. Compared as a SHA-256
// digest via timingSafeEqual so neither the key's length nor its bytes can
// be inferred from response timing.
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
// Backs the "Node" tab in the React admin dashboard. Read-only LND calls,
// returned as JSON (the old server-rendered /admin/node HTML page that used
// to bake this into a page — auth'd by a key in the URL, GS-008 — is gone;
// this JSON API plus the React Node tab is the only dashboard now).
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
    // Same format check already used for designer/sender addresses elsewhere
    // (GS-006) — the redeem endpoint was the one place this was missing,
    // and its address goes straight into an outbound payment lookup.
    const lnAddrRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
    if (!lnAddrRegex.test(lightningAddress)) {
      return res.status(400).json({ error: 'Invalid Lightning address format' });
    }

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

// ── Admin: create invoice (receive) — protected by ADMIN_KEY ──
// Header only (X-Admin-Key), like every other /api/admin/* route. This used
// to also accept ?key= for the old server-rendered /admin/node page, which
// put the key in the URL (GS-008); that page is gone, so the query-string
// fallback goes with it. The React admin's Node tab already sends the key
// as a header via adminFetch(), so it is unaffected.
// Lives under /api/admin (not the old /admin/action prefix) so it's covered
// by the same `app.use('/api', cors(...))` middleware as every other admin
// route — the old prefix fell outside CORS entirely and broke this button
// whenever the frontend and backend are on different origins, which is the
// real GiftSats topology (Cloudflare Pages + Railway). See GS-009 follow-up.
app.post('/api/admin/create-invoice', requireAdminKey, async (req, res) => {
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
// ADMIN_KEY (X-Admin-Key header) proves you can view the dashboard.
// ADMIN_PAY_KEY (form field, separate secret) proves you're allowed to move funds out.
// Same /api/admin move as create-invoice above, and for the same reason —
// this used to be /admin/action/pay, outside the CORS-covered /api prefix.
app.post('/api/admin/pay', requireAdminKey, async (req, res) => {
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
