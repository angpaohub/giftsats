import fetch from 'node-fetch';
import https from 'https';
import dotenv from 'dotenv';
dotenv.config();

const LND_URL = process.env.LND_REST_URL;
const MACAROON = process.env.LND_MACAROON_HEX;
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

export async function payLightningAddress(lightningAddress, amountSats) {
  const [user, domain] = lightningAddress.split('@');
  if (!user || !domain) throw new Error('Invalid Lightning address');
  const lnurlRes = await fetch(`https://${domain}/.well-known/lnurlp/${user}`, { agent });
  if (!lnurlRes.ok) throw new Error('Could not resolve Lightning address');
  const lnurlData = await lnurlRes.json();
  const amountMsats = amountSats * 1000;
  const invoiceRes = await fetch(`${lnurlData.callback}?amount=${amountMsats}`, { agent });
  if (!invoiceRes.ok) throw new Error('Could not get invoice');
  const { pr } = await invoiceRes.json();

  const payRes = await fetch(`${LND_URL}/v1/channels/transactions`, {
    method: 'POST', agent, headers,
    body: JSON.stringify({ payment_request: pr }),
  });
  if (!payRes.ok) throw new Error(`LND pay error: ${await payRes.text()}`);

  const payData = await payRes.json();
  if (payData.payment_error) {
    throw new Error(`LND routing failed: ${payData.payment_error}`);
  }
  if (!payData.payment_preimage) {
    throw new Error('LND payment did not return a preimage — payment likely failed');
  }

  return payData;
}

export async function payInvoice(bolt11) {
  const payRes = await fetch(`${LND_URL}/v1/channels/transactions`, {
    method: 'POST', agent, headers,
    body: JSON.stringify({ payment_request: bolt11 }),
  });
  if (!payRes.ok) throw new Error(`LND pay error: ${await payRes.text()}`);
  const payData = await payRes.json();
  if (payData.payment_error) {
    throw new Error(`LND routing failed: ${payData.payment_error}`);
  }
  if (!payData.payment_preimage) {
    throw new Error('LND payment did not return a preimage — payment likely failed');
  }
  return payData;
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
