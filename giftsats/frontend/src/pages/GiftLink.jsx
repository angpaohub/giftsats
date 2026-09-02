import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Page from '../components/Page.jsx';
import GiftCard from '../components/GiftCard.jsx';
import { T, Bolt, Input, PrimaryButton, Notice, microLabel, headline } from '../components/ui.jsx';
import { useCard } from '../lib/useCard.js';
import { api } from '../lib/api.js';
import { cardUrl, fmt, formatDate, isLightningAddress } from '../lib/format.js';

// Send people straight to the store listing for their platform. Desktop
// visitors (no store to send them to) land on the wallet's own site instead.
const WALLET_LINKS = {
  wos: {
    ios: 'https://apps.apple.com/us/app/wallet-of-satoshi/id1438599608',
    android: 'https://play.google.com/store/apps/details?id=com.livingroomofsatoshi.wallet',
    fallback: 'https://www.walletofsatoshi.com/',
  },
  phoenix: {
    ios: 'https://apps.apple.com/us/app/phoenix-wallet/id1544097028',
    android: 'https://play.google.com/store/apps/details?id=fr.acinq.phoenix.mainnet',
    fallback: 'https://github.com/ACINQ/phoenix',
  },
};

function walletDownloadUrl(kind) {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || navigator.vendor || '' : '';
  const links = WALLET_LINKS[kind];
  if (/iPad|iPhone|iPod/.test(ua)) return links.ios;
  if (/android/i.test(ua)) return links.android;
  return links.fallback;
}

// A quiet, centred mark instead of the full site header — this page is a
// one-off destination someone lands on from a link, not site navigation.
function MiniLogo() {
  return (
    <Link
      to="/"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        padding: '26px 0 30px',
        color: 'inherit',
        textDecoration: 'none',
      }}
    >
      <span
        style={{
          position: 'relative',
          borderRadius: 10,
          background: T.inkDeep,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          height: 32,
          width: 32,
          flex: '0 0 32px',
        }}
      >
        <span style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 1.5, background: 'rgba(247,147,26,.5)' }} />
        <span style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: 1.5, background: 'rgba(247,147,26,.5)' }} />
        <span style={{ position: 'relative' }}>
          <Bolt size={14} color={T.orange} />
        </span>
      </span>
      <span style={{ fontFamily: T.serif, fontWeight: 500, fontSize: 24, letterSpacing: '-0.02em' }}>
        Gift<span style={{ color: T.orangeDeep }}>sats</span>
      </span>
    </Link>
  );
}

export default function GiftLink() {
  const { id } = useParams();
  const { card, art, error, loading, setCard } = useCard(id, { poll: true });
  const [address, setAddress] = useState('');
  const [phase, setPhase] = useState('ready'); // ready | sending | done
  const [failure, setFailure] = useState('');
  const [showQr, setShowQr] = useState(false);

  // Lock the page behind the modal and let Escape close it, like any other
  // overlay on the site.
  useEffect(() => {
    if (!showQr) return undefined;
    const onKey = (e) => e.key === 'Escape' && setShowQr(false);
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [showQr]);

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
      <Page footer={false} header={false} maxWidth={720} title="A gift for you">
        <MiniLogo />
        <div style={microLabel}>Loading…</div>
      </Page>
    );
  }

  if (error || !card) {
    return (
      <Page footer={false} header={false} maxWidth={720} title="A gift for you">
        <MiniLogo />
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
    <Page footer={false} header={false} maxWidth={860} title="A gift for you">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <MiniLogo />
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
              variant="simple"
              amount={card.amountSats}
              message={card.senderNote}
              to={card.recipientName}
              from={card.senderName}
              art={art}
              expiresAt={card.expiresAt}
              statusLabel={done || alreadyRedeemed ? 'Redeemed' : 'Ready to redeem'}
              statusColor={done || alreadyRedeemed ? T.mutedWarm : T.success}
              onShowQr={() => setShowQr(true)}
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

              <div style={{ marginTop: 22, borderTop: `1px solid ${T.hair16}`, paddingTop: 20 }}>
                <div style={{ fontWeight: 600, fontSize: 15 }}>No wallet yet?</div>
                <div style={{ fontSize: 13.5, color: T.text2, lineHeight: 1.6, marginTop: 7 }}>
                  Install one free, get a Lightning address, then come back to this link. The sats stay here until{' '}
                  {formatDate(card.expiresAt)}.
                </div>

                <a
                  href={walletDownloadUrl('wos')}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    marginTop: 14,
                    border: `1.5px solid ${T.orange}`,
                    background: 'rgba(247,147,26,.08)',
                    borderRadius: 12,
                    padding: '15px 17px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 14,
                    flexWrap: 'wrap',
                    color: 'inherit',
                    textDecoration: 'none',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>Wallet of Satoshi</div>
                    <div style={{ fontSize: 13, color: T.text2, marginTop: 4 }}>
                      Easiest start — install, and you have a Lightning address.
                    </div>
                  </div>
                  <span
                    style={{
                      fontFamily: T.mono,
                      fontSize: 10,
                      letterSpacing: '0.16em',
                      color: T.orangeDeep,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    RECOMMENDED
                  </span>
                </a>

                <a
                  href={walletDownloadUrl('phoenix')}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    marginTop: 10,
                    border: `1px solid ${T.hair16}`,
                    background: T.surface,
                    borderRadius: 12,
                    padding: '15px 17px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 14,
                    flexWrap: 'wrap',
                    color: 'inherit',
                    textDecoration: 'none',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>Phoenix</div>
                    <div style={{ fontSize: 13, color: T.text2, marginTop: 4 }}>
                      Self-custodial — you hold the keys, still one tap to redeem.
                    </div>
                  </div>
                  <span
                    style={{
                      fontFamily: T.mono,
                      fontSize: 10,
                      letterSpacing: '0.16em',
                      color: T.mutedWarm,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    YOUR KEYS
                  </span>
                </a>

                <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap', marginTop: 12 }}>
                  <span style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: '0.12em', color: T.muted }}>
                    ALSO WORKS
                  </span>
                  {['Zeus', 'Alby'].map((w) => (
                    <span
                      key={w}
                      style={{
                        fontFamily: T.mono,
                        fontSize: 11.5,
                        color: T.text2,
                        border: `1px solid ${T.hair16}`,
                        borderRadius: 999,
                        padding: '7px 13px',
                      }}
                    >
                      {w}
                    </span>
                  ))}
                </div>

                <div style={{ marginTop: 16 }}>
                  <Link to="/how-it-works" className="gs-link" style={{ fontSize: 13.5, color: T.orangeDeep }}>
                    How Lightning gifts work →
                  </Link>
                </div>
              </div>
            </>
          )}

          <div style={{ marginTop: 28, textAlign: 'center', fontSize: 14 }}>
            <Link to="/how-it-works" className="gs-link" style={{ color: T.text2 }}>
              What is a Lightning address?
            </Link>
          </div>
        </div>

        <div style={{ fontFamily: T.mono, fontSize: 10.5, letterSpacing: '0.12em', color: T.muted, marginTop: 34 }}>
          CARD {card.id}
        </div>
      </div>

      {showQr && (
        <div
          onClick={() => setShowQr(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: 'rgba(21,18,15,.55)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            overflowY: 'auto',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ position: 'relative', width: 'min(460px, 100%)', animation: 'gsCardIn .3s ease both' }}
          >
            <button
              type="button"
              onClick={() => setShowQr(false)}
              aria-label="Close"
              style={{
                position: 'absolute',
                top: -16,
                right: -16,
                zIndex: 1,
                width: 34,
                height: 34,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                background: T.surfaceBright,
                border: `1px solid ${T.hair16}`,
                boxShadow: '0 6px 16px rgba(21,18,15,.3)',
                color: T.text2,
                fontSize: 15,
                lineHeight: 1,
                cursor: 'pointer',
              }}
            >
              ✕
            </button>
            {/* Same card as it renders on Card Ready: the full front+back,
                fully unlocked — this is just another look at a live card. */}
            <GiftCard
              amount={card.amountSats}
              message={card.senderNote}
              to={card.recipientName}
              from={card.senderName}
              art={art}
              code={card.id}
              expiresAt={card.expiresAt}
              qrValue={cardUrl(card.id)}
            />
          </div>
        </div>
      )}
    </Page>
  );
}
