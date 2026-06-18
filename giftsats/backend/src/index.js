import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import { randomUUID } from 'crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createInvoice, checkPayment, payLightningAddress, getChannelBalance } from './lnd.js';
import {
  initDB, createGiftCard, getGiftCard, updateGiftCard, getStats,
  listAllCards, listExpiredUnredeemed,
  listDesigns, getDesignByCode, createDesign, incrementDesignUseCount, takedownDesign, restoreDesign,
} from './store.js';

dotenv.config();

const app = express();
const allowedOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

app.use(cors({
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

// ── Health ──────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ ok: true }));

// ── Stats (admin) ───────────────────────────────────────
app.get('/api/stats', async (req, res) => {
  try {
    const stats = await getStats();
    res.json(stats);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Admin: R2 storage stats ─────────────────────────────
app.get('/api/admin/r2-stats', async (req, res) => {
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
app.get('/api/admin/cards', async (req, res) => {
  try {
    const cards = await listAllCards();
    res.json(cards);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Admin: list ALL designs (incl. inactive) ────────────
app.get('/api/admin/designs', async (req, res) => {
  try {
    const designs = await listDesigns({ activeOnly: false });
    res.json(designs);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Admin: takedown a design ────────────────────────────
app.patch('/api/admin/designs/:id/takedown', async (req, res) => {
  try {
    const design = await takedownDesign(req.params.id);
    if (!design) return res.status(404).json({ error: 'Design not found' });
    res.json(design);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Admin: restore a taken-down design ──────────────────
app.patch('/api/admin/designs/:id/restore', async (req, res) => {
  try {
    const design = await restoreDesign(req.params.id);
    if (!design) return res.status(404).json({ error: 'Design not found' });
    res.json(design);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Channel balance (for admin) ─────────────────────────
app.get('/api/channel-balance', async (req, res) => {
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

    const { name, designerName, lightningAddress, priceSats, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Design name required' });
    if (!lightningAddress) return res.status(400).json({ error: 'Lightning address required' });

    const lnAddrRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
    if (!lnAddrRegex.test(lightningAddress)) {
      return res.status(400).json({ error: 'Invalid Lightning address format' });
    }

    const price = Math.max(0, parseInt(priceSats) || 0);
    const ext = path.extname(req.file.originalname).toLowerCase();
    const filename = `${randomUUID()}${ext}`;
    const imageUrl = await uploadToR2(req.file.buffer, filename, req.file.mimetype);

    const design = await createDesign({
      name,
      designerName: designerName || 'Anonymous',
      lightningAddress,
      priceSats: price,
      imageUrl,
      description: description || '',
    });

    res.json(design);
  } catch (e) {
    console.error('design submit error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Create gift card ─────────────────────────────────────
app.post('/api/gift/create', async (req, res) => {
  try {
    const { amountSats, designCode, senderNote, senderLightningAddress } = req.body;

    if (!amountSats || amountSats < 1000) {
      return res.status(400).json({ error: 'Minimum 1000 sats' });
    }

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
      senderNote: senderNote || '',
      senderLightningAddress: senderLightningAddress || null,
      paymentHash: invoice.r_hash,
      paymentRequest: invoice.payment_request,
    });

    res.json({
      giftCardId: giftCard.id,
      paymentRequest: invoice.payment_request,
      totalSats,
      amountSats,
      platformFee,
      designFee,
      networkFee: NETWORK_FEE_SATS,
      design: design || null,
      expiresAt: giftCard.expiresAt,
    });
  } catch (e) {
    console.error('create error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Poll gift card status ────────────────────────────────
app.get('/api/gift/:id', async (req, res) => {
  try {
    const giftCard = await getGiftCard(req.params.id);
    if (!giftCard) return res.status(404).json({ error: 'Not found' });

    if (giftCard.status === 'minted' || giftCard.status === 'redeemed') {
      return res.json(giftCard);
    }

    if (giftCard.status === 'pending') {
      const paid = await checkPayment(giftCard.paymentHash);
      if (paid) {
        const cashuToken = `cashuA_${Buffer.from(JSON.stringify({
          giftCardId: giftCard.id,
          amount: giftCard.amountSats,
        })).toString('base64')}`;

        const updated = await updateGiftCard(giftCard.id, {
          status: 'minted',
          cashuToken,
          cashuQuote: null,
        });

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

        return res.json(updated);
      }
    }

    res.json(giftCard);
  } catch (e) {
    console.error('poll error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Redeem gift card ─────────────────────────────────────
app.post('/api/redeem', async (req, res) => {
  try {
    const { cashuToken, lightningAddress, giftCardId } = req.body;
    if (!cashuToken) return res.status(400).json({ error: 'No token provided' });
    if (!lightningAddress) return res.status(400).json({ error: 'Lightning address required' });
    if (!giftCardId) return res.status(400).json({ error: 'Gift card ID required' });

    const card = await getGiftCard(giftCardId);
    if (!card) return res.status(404).json({ error: 'Gift card not found' });
    if (card.status === 'redeemed') return res.status(409).json({ error: 'Gift card already redeemed' });
    if (card.status !== 'minted') return res.status(400).json({ error: 'Gift card not ready for redemption' });

    if (card.expiresAt && new Date() > new Date(card.expiresAt)) {
      return res.status(410).json({ error: 'Gift card has expired', expiredAt: card.expiresAt });
    }

    let tokenData = null;
    try {
      tokenData = JSON.parse(Buffer.from(cashuToken.replace('cashuA_', ''), 'base64').toString());
    } catch {
      return res.status(400).json({ error: 'Invalid token format' });
    }

    if (tokenData.giftCardId !== giftCardId) {
      return res.status(400).json({ error: 'Token does not match gift card' });
    }

    await updateGiftCard(giftCardId, {
      status: 'redeemed',
      redeemedTo: lightningAddress,
      redeemedAt: new Date().toISOString(),
    });

    try {
      await payLightningAddress(lightningAddress, card.amountSats);
    } catch (payErr) {
      console.error('payout failed, rolling back:', payErr.message);
      await updateGiftCard(giftCardId, { status: 'minted' });
      return res.status(500).json({ error: `Payment failed: ${payErr.message}` });
    }

    return res.json({ success: true, amountSats: card.amountSats, msg: `Sent ${card.amountSats} sats to ${lightningAddress}` });
  } catch (e) {
    console.error('redeem error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Send sats via Lightning address ─────────────────────
app.post('/api/wallet/send', async (req, res) => {
  try {
    const { lightningAddress, amountSats } = req.body;
    if (!lightningAddress || !amountSats) return res.status(400).json({ error: 'Missing params' });
    await payLightningAddress(lightningAddress, amountSats);
    res.json({ success: true });
  } catch (e) {
    console.error('send error:', e.message);
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
        await payLightningAddress(card.senderLightningAddress, card.amountSats);
        await updateGiftCard(card.id, {
          status: 'expired',
          refundStatus: 'refunded',
          redeemedTo: card.senderLightningAddress,
          redeemedAt: new Date().toISOString(),
        });
        console.log(`[expiry] Refunded ${card.amountSats} sats → ${card.senderLightningAddress}`);
      } else {
        await updateGiftCard(card.id, {
          status: 'expired',
          refundStatus: 'forfeited',
        });
        console.log(`[expiry] Forfeited ${card.amountSats} sats (card ${card.id})`);
      }
    } catch (err) {
      console.error(`[expiry] Failed to process card ${card.id}:`, err.message);
    }
  }
}

// ── OG preview for /card/:id (for crawlers) ──────────────
app.get('/card/:id', async (req, res) => {
  try {
    const card = await getGiftCard(req.params.id);
    const frontendUrl = process.env.FRONTEND_URL || 'https://giftsats.org';
    const cardUrl = `${frontendUrl}/card/${req.params.id}`;

    if (!card) {
      return res.redirect(302, cardUrl);
    }

    const sats = card.amountSats.toLocaleString('en-US');
    const title = `🎁 ${sats} sats Gift Card`;
    const description = card.senderNote
      ? `"${card.senderNote}" — Redeem your Bitcoin gift card at giftsats.org`
      : `You received a Bitcoin gift card worth ${sats} sats. Redeem instantly with any Lightning address.`;

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
  <meta property="og:image" content="${frontendUrl}/og-card.png" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta http-equiv="refresh" content="0; url=${cardUrl}" />
</head>
<body>
  <script>window.location.href = "${cardUrl}";</script>
</body>
</html>`);
  } catch (e) {
    res.redirect(302, `${process.env.FRONTEND_URL || 'https://giftsats.org'}/card/${req.params.id}`);
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
