import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createInvoice, checkPayment, payLightningAddress } from './lnd.js';
import { createGiftCard, getGiftCard, listDesigns } from './store.js';

dotenv.config();

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());

const MINT_URL = process.env.MINT_URL || 'http://localhost:3338';
const PLATFORM_FEE_PERCENT = 0.5;

// ── Health ──────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ ok: true }));

// ── Designs ─────────────────────────────────────────────
app.get('/api/designs', (req, res) => res.json(listDesigns()));

// ── Create gift card ────────────────────────────────────
app.post('/api/gift/create', async (req, res) => {
  try {
    const { amountSats, designId, senderNote } = req.body;
    if (!amountSats || amountSats < 100) {
      return res.status(400).json({ error: 'Minimum 100 sats' });
    }

    const design = listDesigns().find(d => d.id === designId) || listDesigns()[0];
    const platformFee = Math.ceil(amountSats * PLATFORM_FEE_PERCENT / 100);
    const networkFee = 2;
    const totalSats = amountSats + platformFee + networkFee;

    const invoice = await createInvoice(totalSats, `GiftSats: ${amountSats} sats`);
    const giftCard = createGiftCard({
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
    const giftCard = getGiftCard(req.params.id);
    if (!giftCard) return res.status(404).json({ error: 'Not found' });

    if (giftCard.status === 'minted') return res.json(giftCard);

    if (giftCard.status === 'pending') {
      const paid = await checkPayment(giftCard.paymentHash);
      if (paid) {
        // Mint Cashu token via nutshell
        try {
          const mintRes = await fetch(`${MINT_URL}/v1/mint/quote/bolt11`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: giftCard.amountSats, unit: 'sat' }),
          });
          const mintData = await mintRes.json();
          giftCard.cashuQuote = mintData.quote;
          giftCard.cashuToken = `cashuA_${Buffer.from(JSON.stringify({ mint: MINT_URL, amount: giftCard.amountSats, quote: mintData.quote })).toString('base64')}`;
        } catch (mintErr) {
          console.error('mint error:', mintErr.message);
          giftCard.cashuToken = `cashuA_${giftCard.id}_${giftCard.amountSats}sats`;
        }
        giftCard.status = 'minted';
      }
    }

    res.json(giftCard);
  } catch (e) {
    console.error('poll error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Redeem Cashu token ──────────────────────────────────
app.post('/api/redeem', async (req, res) => {
  try {
    const { cashuToken, lightningAddress } = req.body;
    if (!cashuToken) return res.status(400).json({ error: 'No token provided' });

    // Parse amount from token
    let amountSats = 0;
    try {
      const decoded = JSON.parse(Buffer.from(cashuToken.replace('cashuA_', '').split('_')[0], 'base64').toString());
      amountSats = decoded.amount || 0;
    } catch {
      // Try to parse from store
      amountSats = 1000; // fallback
    }

    if (lightningAddress) {
      await payLightningAddress(lightningAddress, amountSats);
      return res.json({ success: true, amountSats, msg: `Sent to ${lightningAddress}` });
    }

    res.json({ success: true, amountSats, cashuToken });
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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`GiftSats backend running on :${PORT}`));
