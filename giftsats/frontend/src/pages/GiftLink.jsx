import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Page from '../components/Page.jsx';
import GiftCard from '../components/GiftCard.jsx';
import { T, Input, PrimaryButton, Notice, microLabel, headline } from '../components/ui.jsx';
import { useCard } from '../lib/useCard.js';
import { api } from '../lib/api.js';
import { cardUrl, fmt, isLightningAddress } from '../lib/format.js';

const WALLET_DOMAINS = ['@walletofsatoshi.com', '@phoenixwallet.me', '@getalby.com'];

export default function GiftLink() {
  const { id } = useParams();
  const { card, art, error, loading, setCard } = useCard(id, { poll: true });
  const [address, setAddress] = useState('');
  const [phase, setPhase] = useState('ready'); // ready | sending | done
  const [failure, setFailure] = useState('');

  async function redeem() {
    if (!card || !isLightningAddress(address)) return;
    setPhase('sending');
    setFailure('');
    try {
      await api.redeem({
        cashuToken: card.cashuToken,
        lightningAddress: address.trim(),
        giftCardId: card.id,
      });
      setPhase('done');
      setCard({ ...card, status: 'redeemed' });
    } catch (e) {
      // The card stays redeemable — the backend rolls the status back when a
      // payout fails, so the receiver can try a different address.
      setPhase('ready');
      setFailure(
        e.status === 409
          ? 'This card has already been redeemed.'
          : e.status === 410
            ? 'This card has expired.'
            : `${e.message} — the sats are still on the card, try another address.`
      );
    }
  }

  if (loading) {
    return (
      <Page footer={false} maxWidth={720} title="A gift for you">
        <div style={microLabel}>Loading…</div>
      </Page>
    );
  }

  if (error || !card) {
    return (
      <Page footer={false} maxWidth={720} title="A gift for you">
        <Notice tone="bad">{error || 'Gift card not found'}</Notice>
      </Page>
    );
  }

  const done = phase === 'done';
  const alreadyRedeemed = card.status === 'redeemed' && !done;
  const expired = card.status === 'expired' || ['refunded', 'forfeited'].includes(card.refundStatus);
  const pending = card.status === 'pending';
  const canRedeem = card.status === 'minted' && !expired;
  const from = (card.senderName || '').trim();

  return (
    <Page footer={false} maxWidth={860} title="A gift for you">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <div style={microLabel}>{done ? 'Redeemed' : 'A gift for you'}</div>
        <h1 style={{ ...headline, marginTop: 16, fontWeight: 400 }}>
          {done ? (
            <>
              All <em>yours.</em>
            </>
          ) : from ? (
            <>
              {from} sent you <em>bitcoin.</em>
            </>
          ) : (
            <>
              Someone sent you <em>bitcoin.</em>
            </>
          )}
        </h1>
        <p style={{ fontSize: 17, color: T.text2, marginTop: 18, maxWidth: 460, lineHeight: 1.55 }}>
          {done
            ? 'Nothing else to do. Your wallet holds the sats now.'
            : 'Redeem to any Lightning wallet in one tap. No account, no signup, no fees on your side.'}
        </p>

        <div
          style={{
            marginTop: 40,
            width: 'min(510px, 100%)',
            position: 'relative',
            animation: 'gsCardIn .9s cubic-bezier(.22,1,.36,1) both',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: -30,
              borderRadius: 40,
              background: 'radial-gradient(circle, rgba(247,147,26,.18), transparent 70%)',
              pointerEvents: 'none',
            }}
          />
          <div style={{ position: 'relative', animation: 'gsFloat 7s ease-in-out 1s infinite' }}>
            <GiftCard
              amount={card.amountSats}
              message={card.senderNote}
              to={card.recipientName}
              from={card.senderName}
              art={art}
              code={card.id}
              expiresAt={card.expiresAt}
              qrValue={cardUrl(card.id)}
              locked={pending}
            />
          </div>
        </div>

        <div style={{ marginTop: 36, width: 'min(440px, 100%)', textAlign: 'left' }}>
          {done && (
            <Notice tone="good">
              {fmt(card.amountSats)} sats sent to {address}. Payment settled over Lightning.
            </Notice>
          )}

          {alreadyRedeemed && <Notice>This gift card has already been redeemed.</Notice>}

          {expired && (
            <Notice tone="bad">
              This card expired before it was redeemed.
              {card.refundStatus === 'refunded' ? ' The sats went back to the sender.' : ''}
            </Notice>
          )}

          {pending && <Notice>This card is waiting on its payment to settle. Check back in a moment.</Notice>}

          {canRedeem && !done && (
            <>
              <div style={{ ...microLabel, fontSize: 10.5, letterSpacing: '0.2em', marginBottom: 10 }}>
                Your Lightning address
              </div>
              <Input
                placeholder="you@walletofsatoshi.com"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                style={{ fontFamily: T.mono, fontSize: 14.5 }}
              />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                {WALLET_DOMAINS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    className="gs-outline"
                    onClick={() => setAddress((a) => `${a.split('@')[0] || 'you'}${d}`)}
                    style={{
                      fontFamily: T.mono,
                      fontSize: 12,
                      padding: '7px 12px',
                      borderRadius: 999,
                      border: `1px solid ${T.hair16}`,
                      color: T.text2,
                      transition: 'border-color .15s',
                    }}
                  >
                    {d}
                  </button>
                ))}
              </div>

              {failure && (
                <div style={{ marginTop: 14 }}>
                  <Notice tone="bad">{failure}</Notice>
                </div>
              )}

              <PrimaryButton
                onClick={redeem}
                disabled={!isLightningAddress(address) || phase === 'sending'}
                style={{ width: '100%', marginTop: 16 }}
              >
                {phase === 'sending' ? 'Sending sats…' : 'Redeem to my wallet'}
              </PrimaryButton>
              <div style={{ marginTop: 12, fontSize: 13.5, color: T.mutedWarm, textAlign: 'center' }}>
                {isLightningAddress(address)
                  ? 'Sats leave the card the moment you tap.'
                  : 'Enter a valid Lightning address.'}
              </div>
            </>
          )}

          <div style={{ marginTop: 28, textAlign: 'center', fontSize: 14 }}>
            <Link to="/how-it-works" className="gs-link" style={{ color: T.text2 }}>
              What is a Lightning address?
            </Link>
          </div>
        </div>
      </div>
    </Page>
  );
}
