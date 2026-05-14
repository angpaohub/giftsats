import { CashuMint, CashuWallet, getEncodedToken } from '@cashu/cashu-ts';
import dotenv from 'dotenv';
dotenv.config();

const MINT_URL = process.env.MINT_URL || 'http://localhost:3338';
const mint = new CashuMint(MINT_URL);
const wallet = new CashuWallet(mint);

export async function getMintInfo() {
  return mint.getInfo();
}

export async function mintTokens(amountSats, paymentRequest) {
  // Request mint quote
  const { quote, request } = await wallet.createMintQuote(amountSats);
  // Mint the tokens (payment already settled via LND)
  const { proofs } = await wallet.mintProofs(amountSats, quote);
  const token = getEncodedToken({ mint: MINT_URL, proofs });
  return token;
}

export async function redeemTokens(encodedToken) {
  const { proofs } = await wallet.receive(encodedToken);
  return proofs;
}
