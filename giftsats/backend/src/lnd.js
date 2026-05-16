import https from 'https';
import dotenv from 'dotenv';
dotenv.config();

const LND_HOST = process.env.LND_REST_URL?.replace('https://', '').replace('http://', '');
const MACAROON = process.env.LND_MACAROON_HEX;
const agent = new https.Agent({ rejectUnauthorized: false });

async function lndFetch(path, options = {}) {
  const res = await fetch(`https://${LND_HOST}${path}`, {
    ...options,
    agent,
    headers: {
      'Grpc-Metadata-macaroon': MACAROON,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error(`LND ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function createInvoice(amountSats, memo = 'GiftSats') {
  return lndFetch('/v1/invoices', {
    method: 'POST',
    body: JSON.stringify({ value: amountSats, memo, expiry: 600 }),
  });
}

export async function checkPayment(paymentHash) {
  const hashHex = Buffer.from(paymentHash, 'base64').toString('hex');
  const data = await lndFetch(`/v1/invoice/${hashHex}`);
  return data.state === 'SETTLED';
}

export async function payLightningAddress(lightningAddress, amountSats) {
  const [user, domain] = lightningAddress.split('@');
  if (!user || !domain) throw new Error('Invalid Lightning address');
  const lnurlRes = await fetch(`https://${domain}/.well-known/lnurlp/${user}`);
  if (!lnurlRes.ok) throw new Error('Could not resolve Lightning address');
  const lnurlData = await lnurlRes.json();
  const amountMsats = amountSats * 1000;
  const invoiceRes = await fetch(`${lnurlData.callback}?amount=${amountMsats}`);
  if (!invoiceRes.ok) throw new Error('Could not get invoice');
  const { pr } = await invoiceRes.json();
  return lndFetch('/v1/channels/transactions', {
    method: 'POST',
    body: JSON.stringify({ payment_request: pr }),
  });
}
