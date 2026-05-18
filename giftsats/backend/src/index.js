import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createInvoice, checkPayment, payLightningAddress, getChannelBalance } from './lnd.js';
import { initDB, createGiftCard, getGiftCard, updateGiftCard, listDesigns, getStats, listAllCards } from './store.js';

dotenv.config();

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());

const MINT_URL = process.env.MINT_URL || 'http://localhost:3338';
const PLATFORM_FEE_PERCENT = 0.02; // 2%

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

// ── Admin: list all cards ───────────────────────────────
app.get('/api/admin/cards', async (req, res) => {
  try {
    const cards = await listAllCards();
    res.json(cards);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Designs ─────────────────────────────────────────────
app.get('/api/designs', (req, res) => res.json(listDesigns()));

// ── Create gift card ────────────────────────────────────
app.post('/api/gift/create', async (req, res) => {
  try {
    const { amountSats, designId, senderNote } = req.body;
   if (!amountSats || amountSats < 1000) {
  return res.status(400).json({ error: 'Minimum 1000 sats' });
}

    // ── CHECK INBOUND CAPACITY ─────────────────────────
    const { remoteSats } = await getChannelBalance();
    if (remoteSats < amountSats) {
      return res.status(400).json({
        error: `Not enough capacity. Available: ${remoteSats.toLocaleString()} sats`,
        availableSats: remoteSats,
      });
    }

    const design = listDesigns().find(d => d.id === designId) || listDesigns()[0];
    const platformFee = Math.ceil(amountSats * PLATFORM_FEE_PERCENT);
    const networkFee = 2;
    const totalSats = amountSats + platformFee + networkFee;

    const invoice = await createInvoice(totalSats, `GiftSats: ${amountSats} sats`);
    const giftCard = await createGiftCard({
      amountSats,
      designId: design.id,
      platformFee,
      senderNote: senderNote || '',
      paymentHash: invoice.r_hash,
      paymentRequest: invoice.payment_request,
    });

    res.json({
      giftCardId: giftCard.id,
      paymentRequest: invoice.payment_request,
      totalSats,
      amountSats,
      platformFee,
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

    // Already minted or redeemed — return as-is (never re-process)
    if (giftCard.status === 'minted' || giftCard.status === 'redeemed') {
      return res.json(giftCard);
    }

    if (giftCard.status === 'pending') {
      const paid = await checkPayment(giftCard.paymentHash);
      if (paid) {
        // Build a placeholder token — real Cashu mint integration pending
        // Token encodes giftCardId so redeem endpoint can look it up safely
        const cashuToken = `cashuA_${Buffer.from(JSON.stringify({
          giftCardId: giftCard.id,
          amount: giftCard.amountSats,
        })).toString('base64')}`;

        const updated = await updateGiftCard(giftCard.id, {
          status: 'minted',
          cashuToken,
          cashuQuote: null,
        });

        // Pay platform fee
        if (process.env.PLATFORM_WALLET && giftCard.platformFee > 0) {
          try {
            await payLightningAddress(process.env.PLATFORM_WALLET, giftCard.platformFee);
          } catch (feeErr) {
            console.error('platform fee error (non-fatal):', feeErr.message);
          }
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

// ── Redeem gift card ────────────────────────────────────
app.post('/api/redeem', async (req, res) => {
  try {
    const { cashuToken, lightningAddress, giftCardId } = req.body;
    if (!cashuToken) return res.status(400).json({ error: 'No token provided' });
    if (!lightningAddress) return res.status(400).json({ error: 'Lightning address required' });
    if (!giftCardId) return res.status(400).json({ error: 'Gift card ID required' });

    // ── DOUBLE SPEND GUARD ──────────────────────────────
    const card = await getGiftCard(giftCardId);
    if (!card) return res.status(404).json({ error: 'Gift card not found' });
    if (card.status === 'redeemed') {
      return res.status(409).json({ error: 'Gift card already redeemed' });
    }
    if (card.status !== 'minted') {
      return res.status(400).json({ error: 'Gift card not ready for redemption' });
    }

    // Verify token matches this card
    let tokenData = null;
    try {
      tokenData = JSON.parse(Buffer.from(cashuToken.replace('cashuA_', ''), 'base64').toString());
    } catch {
      return res.status(400).json({ error: 'Invalid token format' });
    }

    if (tokenData.giftCardId !== giftCardId) {
      return res.status(400).json({ error: 'Token does not match gift card' });
    }

    const amountSats = card.amountSats;

    // ── MARK REDEEMED FIRST (prevent double spend) ──────
    await updateGiftCard(giftCardId, {
      status: 'redeemed',
      redeemedTo: lightningAddress,
      redeemedAt: new Date().toISOString(),
    });

    // ── PAY OUT ─────────────────────────────────────────
    try {
      await payLightningAddress(lightningAddress, amountSats);
    } catch (payErr) {
      // Payment failed — roll back status so user can retry
      console.error('payout failed, rolling back:', payErr.message);
      await updateGiftCard(giftCardId, { status: 'minted' });
      return res.status(500).json({ error: `Payment failed: ${payErr.message}` });
    }

    return res.json({ success: true, amountSats, msg: `Sent ${amountSats} sats to ${lightningAddress}` });
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

// ── Start ────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
initDB()
  .then(() => app.listen(PORT, () => console.log(`GiftSats backend running on :${PORT}`)))
  .catch(err => {
    console.error('Failed to init DB:', err);
    process.exit(1);
  });
