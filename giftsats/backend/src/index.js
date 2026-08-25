import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import { randomUUID } from 'crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createInvoice, checkPayment, payLightningAddress, getChannelBalance, getNodeInfo, listChannels, listInvoices, listPayments, payInvoice } from './lnd.js';
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

    if (!amountSats || amountSats < 500) {
      return res.status(400).json({ error: 'Minimum 500 sats' });
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

// ── Admin: create invoice (receive) — protected by ADMIN_KEY only ──
app.post('/admin/action/create-invoice', async (req, res) => {
  const ADMIN_KEY = process.env.ADMIN_KEY;
  if (!ADMIN_KEY || req.query.key !== ADMIN_KEY) return res.status(403).json({ error: 'Forbidden' });
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
// ADMIN_KEY (URL) proves you can view the dashboard.
// ADMIN_PAY_KEY (form field, separate secret) proves you're allowed to move funds out.
app.post('/admin/action/pay', async (req, res) => {
  const ADMIN_KEY = process.env.ADMIN_KEY;
  const ADMIN_PAY_KEY = process.env.ADMIN_PAY_KEY;
  if (!ADMIN_KEY || req.query.key !== ADMIN_KEY) return res.status(403).json({ error: 'Forbidden' });
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
