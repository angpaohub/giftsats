import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Page from '../components/Page.jsx';
import GiftCard from '../components/GiftCard.jsx';
import QR from '../components/QR.jsx';
import CopyButton from '../components/CopyButton.jsx';
import { T, Notice, microLabel, headline } from '../components/ui.jsx';
import { resolveArt } from '../lib/designs.js';
import { api } from '../lib/api.js';
import { clock, fmt } from '../lib/format.js';

const WALLETS = [
  { name: 'Wallet of Satoshi', note: 'iOS · Android' },
  { name: 'Phoenix', note: 'iOS · Android' },
];

function loadPending(id) {
  try {
    const p = JSON.parse(localStorage.getItem('giftsats_pending') || 'null');
    return p && p.giftCardId === id ? p : null;
  } catch {
    return null;
  }
}

export default function PayInvoice() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [pending] = useState(() => loadPending(id));
  const [status, setStatus] = useState('awaiting'); // awaiting | paid | expired
  const [left, setLeft] = useState(() => {
    if (!pending?.invoiceExpiresAt) return 600;
    return Math.max(0, Math.floor((new Date(pending.invoiceExpiresAt).getTime() - Date.now()) / 1000));
  });
  const poll = useRef(null);

  // Countdown
  useEffect(() => {
    if (status !== 'awaiting') return undefined;
    const t = setInterval(() => {
      setLeft((s) => {
        if (s <= 1) {
          setStatus('expired');
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [status]);

  // Poll for settlement. The backend mints the card the moment LND reports the
  // invoice settled, so a 200 with status "minted" is the signal to move on.
  useEffect(() => {
    if (!id) return undefined;
    async function check() {
      try {
        const card = await api.gift(id);
        if (card.status === 'minted' || card.status === 'redeemed') {
          clearInterval(poll.current);
          setStatus('paid');
          localStorage.removeItem('giftsats_pending');
          localStorage.removeItem('giftsats_form');
          setTimeout(() => navigate(`/ready/${id}`, { replace: true }), 700);
        }
      } catch {
        /* transient — the next tick tries again */
      }
    }
    check();
    poll.current = setInterval(check, 2500);
    return () => clearInterval(poll.current);
  }, [id, navigate]);

  if (!pending) {
    return (
      <Page footer={false} maxWidth={720} title="Pay the invoice">
        <h1 style={{ ...headline, fontWeight: 400 }}>This invoice isn’t on this device.</h1>
        <p style={{ fontSize: 16, color: T.text2, marginTop: 16, lineHeight: 1.6 }}>
          The Lightning invoice is only held in the browser that created it. If you paid it already, the card is
          live at its share link. Otherwise, start a new one.
        </p>
        <div style={{ marginTop: 24, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <Link to={`/card/${id}`}>Open the card</Link>
          <Link to="/create">Create another gift</Link>
        </div>
      </Page>
    );
  }

  const { paymentRequest, amountSats, platformFee, designFee, networkFee, form, designId, marketDesign } = pending;
  const art = resolveArt(designId, marketDesign);
  const total = amountSats + platformFee + (designFee || 0) + (networkFee || 0);
  const expired = status === 'expired';
  const paid = status === 'paid';

  return (
    <Page footer={false} maxWidth={1180} title="Pay the invoice">
      <h1 style={{ ...headline, fontWeight: 400 }}>
        Pay the <em>invoice.</em>
      </h1>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'clamp(28px, 4vw, 56px)', marginTop: 40 }}>
        <div style={{ flex: '1 1 420px', minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 20,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: paid ? T.success : expired ? T.muted : T.orange,
              }}
            />
            <span
              style={{
                ...microLabel,
                fontSize: 11,
                letterSpacing: '0.16em',
                color: paid ? T.success : expired ? T.muted : T.orangeDeep,
              }}
            >
              {paid ? 'Payment settled' : expired ? 'Invoice expired' : 'Awaiting payment'}
            </span>
            <span
              style={{
                fontFamily: T.mono,
                fontSize: 20,
                marginLeft: 'auto',
                color: paid ? T.success : expired ? T.muted : left <= 60 ? '#B3341E' : T.orange,
              }}
            >
              {paid ? 'PAID' : clock(left)}
            </span>
          </div>

          {expired ? (
            <Notice tone="bad">
              The invoice expired and nothing was charged.{' '}
              <Link to="/create">Create the gift again</Link> to get a fresh one.
            </Notice>
          ) : (
            <>
              <div
                style={{
                  display: 'inline-block',
                  padding: 16,
                  background: T.surfaceBright,
                  borderRadius: 16,
                  border: `1px solid ${T.hair}`,
                  boxShadow: '0 4px 12px rgba(40,30,18,.09)',
                }}
              >
                <QR value={paymentRequest} size={232} light={T.surfaceBright} />
              </div>

              <div
                style={{
                  marginTop: 16,
                  fontFamily: T.mono,
                  fontSize: 12,
                  color: T.text2,
                  wordBreak: 'break-all',
                  lineHeight: 1.6,
                  background: T.surface,
                  border: `1px solid ${T.hair}`,
                  borderRadius: 12,
                  padding: '12px 14px',
                }}
              >
                {paymentRequest.slice(0, 44)}…{paymentRequest.slice(-8)}
              </div>

              <div style={{ marginTop: 12 }}>
                <CopyButton value={paymentRequest} label="Copy invoice" copiedLabel="Copied" block />
              </div>
            </>
          )}

          <div
            style={{
              marginTop: 28,
              background: T.surface,
              border: `1px solid ${T.hair}`,
              borderRadius: 16,
              padding: '18px 20px',
              fontFamily: T.mono,
              fontSize: 13.5,
            }}
          >
            {[
              ['Gift amount', `${fmt(amountSats)} sats`],
              ['Service fee', `${fmt(platformFee)} sats`],
              ['Network fee', `${fmt(networkFee)} sats`],
              ...(designFee > 0 ? [['Design fee', `${fmt(designFee)} sats`]] : []),
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 9 }}>
                <span style={{ color: T.text2 }}>{k}</span>
                <span style={{ color: T.ink }}>{v}</span>
              </div>
            ))}
            <div
              style={{
                borderTop: `1px solid ${T.hair}`,
                paddingTop: 12,
                display: 'flex',
                justifyContent: 'space-between',
                gap: 16,
              }}
            >
              <span style={{ color: T.ink, fontWeight: 500 }}>You pay</span>
              <span style={{ color: T.ink, fontWeight: 500 }}>{fmt(total)} sats</span>
            </div>
          </div>

          <div style={{ marginTop: 28 }}>
            <div style={{ ...microLabel, fontSize: 10.5, letterSpacing: '0.2em' }}>Pay from</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
              {WALLETS.map((w) => (
                <div
                  key={w.name}
                  style={{
                    border: `1px solid ${T.hair16}`,
                    borderRadius: 12,
                    padding: '12px 16px',
                    background: T.surface,
                  }}
                >
                  <div style={{ fontSize: 14.5, fontWeight: 500 }}>{w.name}</div>
                  <div style={{ fontFamily: T.mono, fontSize: 10.5, color: T.muted, marginTop: 3 }}>{w.note}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ flex: '1 1 330px', minWidth: 0 }}>
          <div style={{ position: 'sticky', top: 32 }}>
            <GiftCard
              amount={amountSats}
              message={form?.message}
              to={form?.to}
              from={form?.from}
              art={art}
              code={null}
              expiresAt={pending.expiresAt}
              locked
            />
            <p style={{ fontSize: 13.5, color: T.mutedWarm, marginTop: 16, lineHeight: 1.55, maxWidth: 420 }}>
              The redeem QR stays locked until the invoice settles. Nothing is charged if the timer runs out.
            </p>
          </div>
        </div>
      </div>
    </Page>
  );
}
