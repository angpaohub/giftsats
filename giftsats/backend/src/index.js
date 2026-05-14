import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createInvoice, checkPayment, payInvoice } from './lnd.js';
import { mintTokens, redeemTokens, getMintInfo } from './mint.js';
import { createGiftCard, getGiftCard, listDesigns } from './store.js';

dotenv.config();

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());

// ── Health ──────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ ok: true }));

// ── Mint info ───────────────────────────────────────────
app.get('/api/mint/info', async (req, res) => {
  try {
    const info = await getMintInfo();
    res.json(info);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Designs marketplace ─────────────────────────────────
app.get('/api/designs', (req, res) => {
  res.json(listDesigns());
});

// ── Create gift card ────────────────────────────────────
// Flow: frontend calls this → gets Lightning invoice → user pays → poll /api/gift/:id
app.post('/api/gift/create', async (req, res) => {
  try {
    const { amountSats, designId, senderNote } = req.body;
    if (!amountSats || amountSats < 100) {
      return res.status(400).json({ error: 'Minimum 100 sats' });
    }

    // Create Lightning invoice for (amount + design fee)
    const design = listDesigns().find(d => d.id === designId) || listDesigns()[0];
    const designFeeSats = design.priceSats || 0;
    const totalSats = amountSats + designFeeSats;

    const invoice = await createInvoice(totalSats, `GiftSats: ${amountSats} sats`);
    const giftCard = createGiftCard({
      amountSats,
      designId: design.id,
      designFeeSats,
      senderNote,
      paymentHash: invoice.r_hash,
      paymentRequest: invoice.payment_request,
    });

    res.json({
      giftCardId: giftCard.id,
      paymentRequest: invoice.payment_request,
      totalSats,
      amountSats,
      designFeeSats,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Poll gift card status ────────────────────────────────
app.get('/api/gift/:id', async (req, res) => {
  try {
    const giftCard = getGiftCard(req.params.id);
    if (!giftCard) return res.status(404).json({ error: 'Not found' });

    // If already minted, return token
    if (giftCard.status === 'minted') {
      return res.json(giftCard);
    }

    // Check if Lightning payment arrived
    if (giftCard.status === 'pending') {
      const paid = await checkPayment(giftCard.paymentHash);
      if (paid) {
        // Mint Cashu token for the gift amount
        const token = await mintTokens(giftCard.amountSats, giftCard.paymentRequest);
        giftCard.cashuToken = token;
        giftCard.status = 'minted';
      }
    }

    res.json(giftCard);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Redeem gift card ────────────────────────────────────
app.post('/api/gift/:id/redeem', async (req, res) => {
  try {
    const { lightningAddress } = req.body;
    const giftCard = getGiftCard(req.params.id);

    if (!giftCard) return res.status(404).json({ error: 'Not found' });
    if (giftCard.status === 'redeemed') return res.status(400).json({ error: 'Already redeemed' });
    if (giftCard.status !== 'minted') return res.status(400).json({ error: 'Not ready yet' });

    if (lightningAddress) {
      // Pay out to Lightning address
      const result = await payInvoice(lightningAddress, giftCard.amountSats);
      giftCard.status = 'redeemed';
      giftCard.redeemedTo = lightningAddress;
      return res.json({ success: true, result });
    }

    // Return raw Cashu token (for wallet tab)
    giftCard.status = 'redeemed';
    res.json({ success: true, cashuToken: giftCard.cashuToken });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`GiftSats backend running on :${PORT}`));
