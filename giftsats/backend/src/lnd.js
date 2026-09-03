import fetch from 'node-fetch';
import https from 'https';
import dotenv from 'dotenv';
dotenv.config();

const LND_URL = process.env.LND_REST_URL;
const MACAROON = process.env.LND_MACAROON_HEX;

// LND's REST endpoint uses a self-signed cert, so *only* calls to our own
// node skip certificate verification. Every call that leaves our
// infrastructure (resolving a Lightning address, hitting its LNURL
// callback) must use the default agent, which verifies certs normally —
// otherwise a MITM between us and the recipient's wallet provider could
// swap the invoice we end up paying. See GS-006.
const agent = new https.Agent({ rejectUnauthorized: false });

const headers = {
  'Grpc-Metadata-macaroon': MACAROON,
  'Content-Type': 'application/json',
};

export async function createInvoice(amountSats, memo = 'GiftSats') {
  const res = await fetch(`${LND_URL}/v1/invoices`, {
    method: 'POST', agent, headers,
    body: JSON.stringify({ value: amountSats, memo, expiry: 600, private: true }),
  });
  if (!res.ok) throw new Error(`LND invoice error: ${await res.text()}`);
  return res.json();
}

export async function checkPayment(paymentHash) {
  const hashHex = Buffer.from(paymentHash, 'base64').toString('hex');
  const res = await fetch(`${LND_URL}/v1/invoice/${hashHex}`, { agent, headers });
  if (!res.ok) throw new Error(`LND lookup error: ${await res.text()}`);
  const data = await res.json();
  return data.state === 'SETTLED';
}

// Routing-fee ceiling for anything we pay out. Without this, LND will happily
// spend whatever a route costs, and the payee picks the route — with a
// user-supplied BOLT11 invoice that means an attacker can point us through a
// channel of their own that charges an enormous fee and pocket the difference,
// even when the invoice amount itself is exactly right. 1% (min 5 sats) is
// generous for Lightning while capping that.
export function feeLimitSatsFor(amountSats) {
  return Math.max(5, Math.ceil(amountSats * 0.01));
}

// ── Shared outbound payment ──────────────────────────────
// Both payout paths (Lightning address and BOLT11 invoice) funnel through
// here so the ambiguous-failure contract below is identical for both. Callers
// (redeem/refund) rely on `.ambiguous` to decide between "safe to retry" and
// "freeze this card for a human" — a payout path that forgot to tag its
// errors would silently lose the GS-003 double-spend protection.
//
// Past this point we're asking our own LND node to actually move funds. If
// anything goes wrong from here on, we can't always be sure whether the
// payment went out anyway (a timed-out HTTP call, or a response that came
// back before LND itself resolved the payment) — so those failures are tagged
// `.ambiguous = true` and must not be treated as "safe to retry
// automatically", since the sats may already be gone. Everything thrown
// before this call is a clean failure (nothing was ever sent).
// `amtSats`: only for a zero-amount ("amountless") invoice, where the payer
// — us — is the one who decides how much to send. LND rejects `amt` outright
// on an invoice that already encodes an amount, so this is never a way to
// override what a fixed-amount invoice says; it only fills in the blank on
// one that has none.
async function sendPayment(paymentRequest, amountSatsForFeeLimit, amtSats) {
  let payRes;
  try {
    payRes = await fetch(`${LND_URL}/v1/channels/transactions`, {
      method: 'POST', agent, headers,
      body: JSON.stringify({
        payment_request: paymentRequest,
        fee_limit: { fixed: String(feeLimitSatsFor(amountSatsForFeeLimit)) },
        ...(amtSats ? { amt: String(amtSats) } : {}),
      }),
    });
  } catch (networkErr) {
    const err = new Error(`LND pay request failed: ${networkErr.message}`);
    err.ambiguous = true;
    throw err;
  }
  if (!payRes.ok) {
    const err = new Error(`LND pay error: ${await payRes.text()}`);
    err.ambiguous = true;
    throw err;
  }

  const payData = await payRes.json();
  if (payData.payment_error) {
    // LND resolved the call and explicitly says routing failed — nothing left the node.
    throw new Error(`LND routing failed: ${payData.payment_error}`);
  }
  if (!payData.payment_preimage) {
    const err = new Error('LND payment did not return a preimage — payment status unknown');
    err.ambiguous = true;
    throw err;
  }

  return payData;
}

// ── BOLT11 decoding ──────────────────────────────────────
// Decoded by LND itself rather than a local bolt11 parser on purpose: the
// node that will actually spend the money is the only authority on what this
// invoice says. A separate parser could disagree with LND about the amount —
// and a disagreement about the amount is exactly the bug that would let a
// card pay out more than it is worth.
export async function decodeInvoice(bolt11) {
  const res = await fetch(`${LND_URL}/v1/payreq/${encodeURIComponent(bolt11)}`, { agent, headers });
  if (!res.ok) {
    throw new Error('That does not look like a valid Lightning invoice.');
  }
  return res.json();
}

// Our own node's pubkey, cached for the process. Used to refuse invoices
// issued by this very node — see the self-payment check in index.js.
let ownPubkeyCache = null;
export async function getOwnPubkey() {
  if (ownPubkeyCache) return ownPubkeyCache;
  const info = await getNodeInfo();
  ownPubkeyCache = info.identity_pubkey;
  return ownPubkeyCache;
}

export async function payLightningAddress(lightningAddress, amountSats) {
  const [user, domain] = lightningAddress.split('@');
  if (!user || !domain) throw new Error('Invalid Lightning address');
  // No `agent` here on purpose — these two calls go to a server we don't
  // control (the recipient's wallet provider), so they must use normal,
  // verified HTTPS, not the LND-only insecure agent above.
  const lnurlRes = await fetch(`https://${domain}/.well-known/lnurlp/${user}`);
  if (!lnurlRes.ok) throw new Error('Could not resolve Lightning address');
  const lnurlData = await lnurlRes.json();
  const amountMsats = amountSats * 1000;
  const invoiceRes = await fetch(`${lnurlData.callback}?amount=${amountMsats}`);
  if (!invoiceRes.ok) throw new Error('Could not get invoice');
  const { pr } = await invoiceRes.json();

  // The invoice we just fetched is for `amountSats` because that's the amount
  // we asked the LNURL callback for, so it doubles as the fee-limit basis.
  return sendPayment(pr, amountSats);
}

// Pay a BOLT11 invoice supplied by someone else.
//
// SECURITY: this function pays whatever the invoice says. LND has no concept
// of "don't spend more than X" for a payment request — the amount inside the
// invoice is the authority, and the person redeeming a card is the person who
// created that invoice. Every caller MUST have already decoded the invoice and
// asserted its amount against the card's own amount (see
// validateRedeemInvoice in index.js) before calling this. Passing a
// user-supplied invoice straight in is a direct path to draining the node.
// `amtSats`: pass this only when the invoice being paid is zero-amount (see
// sendPayment above) — it must be the card's own already-validated amount,
// never anything read from the request body.
export async function payInvoice(bolt11, expectedAmountSats, amtSats) {
  if (!Number.isInteger(expectedAmountSats) || expectedAmountSats <= 0) {
    throw new Error('payInvoice requires the already-validated amount for its fee limit');
  }
  return sendPayment(bolt11, expectedAmountSats, amtSats);
}

export async function getChannelBalance() {
  const res = await fetch(`${LND_URL}/v1/balance/channels`, { agent, headers });
  if (!res.ok) throw new Error(`LND balance error: ${await res.text()}`);
  const data = await res.json();
  return {
    localSats: parseInt(data.local_balance?.sat || 0),
    remoteSats: parseInt(data.remote_balance?.sat || 0),
  };
}

export async function getNodeInfo() {
  const res = await fetch(`${LND_URL}/v1/getinfo`, { agent, headers });
  if (!res.ok) throw new Error(`LND getinfo error: ${await res.text()}`);
  return res.json();
}

export async function listChannels() {
  const res = await fetch(`${LND_URL}/v1/channels`, { agent, headers });
  if (!res.ok) throw new Error(`LND channels error: ${await res.text()}`);
  const data = await res.json();
  return data.channels || [];
}

export async function listInvoices(limit = 50) {
  const res = await fetch(`${LND_URL}/v1/invoices?num_max_invoices=${limit}&reversed=true`, { agent, headers });
  if (!res.ok) throw new Error(`LND invoices error: ${await res.text()}`);
  const data = await res.json();
  return data.invoices || [];
}

export async function listPayments(limit = 50) {
  const res = await fetch(`${LND_URL}/v1/payments?max_payments=${limit}&reversed=true`, { agent, headers });
  if (!res.ok) throw new Error(`LND payments error: ${await res.text()}`);
  const data = await res.json();
  return data.payments || [];
}
