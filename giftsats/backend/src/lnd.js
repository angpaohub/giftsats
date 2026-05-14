import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const LND_URL = process.env.LND_REST_URL;
const MACAROON = process.env.LND_MACAROON_HEX;

const headers = {
  'Grpc-Metadata-macaroon': MACAROON,
  'Content-Type': 'application/json',
};

// Voltage manages TLS — disable cert check for their managed nodes
const fetchOpts = {
  headers,
  // For testnet on Voltage, TLS is handled by their proxy
};

export async function createInvoice(amountSats, memo = 'GiftSats') {
  const res = await fetch(`${LND_URL}/v1/invoices`, {
    method: 'POST',
    ...fetchOpts,
    body: JSON.stringify({
      value: amountSats,
      memo,
      expiry: 3600, // 1 hour
    }),
  });
  if (!res.ok) throw new Error(`LND invoice error: ${await res.text()}`);
  return res.json();
}

export async function checkPayment(paymentHash) {
  // paymentHash from LND is base64 — convert to hex for lookup
  const hashHex = Buffer.from(paymentHash, 'base64').toString('hex');
  const res = await fetch(`${LND_URL}/v1/invoice/${hashHex}`, fetchOpts);
  if (!res.ok) throw new Error(`LND lookup error: ${await res.text()}`);
  const data = await res.json();
  // state 'SETTLED' means paid
  return data.state === 'SETTLED';
}

export async function payInvoice(lightningAddress, amountSats) {
  // Resolve Lightning address → LNURL → invoice
  const [user, domain] = lightningAddress.split('@');
  const lnurlRes = await fetch(
    `https://${domain}/.well-known/lnurlp/${user}`
  );
  if (!lnurlRes.ok) throw new Error('Could not resolve Lightning address');
  const lnurlData = await lnurlRes.json();

  const amountMsats = amountSats * 1000;
  if (amountMsats < lnurlData.minSendable || amountMsats > lnurlData.maxSendable) {
    throw new Error('Amount out of range for this Lightning address');
  }

  const invoiceRes = await fetch(`${lnurlData.callback}?amount=${amountMsats}`);
  if (!invoiceRes.ok) throw new Error('Could not get invoice from Lightning address');
  const { pr } = await invoiceRes.json();

  // Pay the invoice via LND
  const payRes = await fetch(`${LND_URL}/v1/channels/transactions`, {
    method: 'POST',
    ...fetchOpts,
    body: JSON.stringify({ payment_request: pr }),
  });
  if (!payRes.ok) throw new Error(`LND pay error: ${await payRes.text()}`);
  return payRes.json();
}
