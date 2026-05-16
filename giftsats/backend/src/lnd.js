import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const LND_URL = process.env.LND_REST_URL;
const MACAROON = process.env.LND_MACAROON_HEX;

const headers = {
  'Grpc-Metadata-macaroon': MACAROON,
  'Content-Type': 'application/json',
};

export async function createInvoice(amountSats, memo = 'GiftSats') {
  const res = await fetch(`${LND_URL}/v1/invoices`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ value: amountSats, memo, expiry: 600 }),
  });
  if (!res.ok) throw new Error(`LND invoice error: ${await res.text()}`);
  return res.json();
}

export async function checkPayment(paymentHash) {
  const hashHex = Buffer.from(paymentHash, 'base64').toString('hex');
  const res = await fetch(`${LND_URL}/v1/invoice/${hashHex}`, { headers });
  if (!res.ok) throw new Error(`LND lookup error: ${await res.text()}`);
  const data = await res.json();
  return data.state === 'SETTLED';
}

export async function payLightningAddress(lightningAddress, amountSats) {
  const [user, domain] = lightningAddress.split('@');
  if (!user || !domain) throw new Error('Invalid Lightning address');

  const lnurlRes = await fetch(`https://${domain}/.well-known/lnurlp/${user}`);
  if (!lnurlRes.ok) throw new Error('Could not resolve Lightning address');
  const lnurlData = await lnurlRes.json();

  const amountMsats = amountSats * 1000;
  if (amountMsats < lnurlData.minSendable || amountMsats > lnurlData.maxSendable) {
    throw new Error(`Amount out of range: min ${lnurlData.minSendable / 1000}, max ${lnurlData.maxSendable / 1000} sats`);
  }

  const invoiceRes = await fetch(`${lnurlData.callback}?amount=${amountMsats}`);
  if (!invoiceRes.ok) throw new Error('Could not get invoice from Lightning address');
  const { pr } = await invoiceRes.json();

  const payRes = await fetch(`${LND_URL}/v1/channels/transactions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ payment_request: pr }),
  });
  if (!payRes.ok) throw new Error(`LND pay error: ${await payRes.text()}`);
  return payRes.json();
}
