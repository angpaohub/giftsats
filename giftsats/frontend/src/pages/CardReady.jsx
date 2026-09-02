import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Page from '../components/Page.jsx';
import GiftCard from '../components/GiftCard.jsx';
import CopyButton from '../components/CopyButton.jsx';
import { T, GhostButton, Notice, microLabel, headline } from '../components/ui.jsx';
import { useCard } from '../lib/useCard.js';
import { cardUrl, fmt } from '../lib/format.js';

const SHARE_TARGETS = [
  { name: 'Message', hint: 'SMS / iMessage' },
  { name: 'Email', hint: 'with card image' },
  { name: 'Nostr DM', hint: 'npub…' },
  { name: 'QR poster', hint: 'print A5' },
];

export default function CardReady() {
  const { id } = useParams();
  const { card, art, error, loading } = useCard(id, { poll: true });
  const cardRef = useRef(null);
  const [busy, setBusy] = useState('');

  async function renderCanvas() {
    const { default: html2canvas } = await import('html2canvas');
    return html2canvas(cardRef.current, { backgroundColor: null, scale: 3, useCORS: true });
  }

  async function downloadPng() {
    if (!cardRef.current) return;
    setBusy('png');
    try {
      const canvas = await renderCanvas();
      const link = document.createElement('a');
      link.download = `giftsats-${card.amountSats}sats.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } finally {
      setBusy('');
    }
  }

  async function share() {
    const url = cardUrl(card.id);
    const text = `🎁 I'm sending you a Bitcoin gift card worth ${fmt(card.amountSats)} sats!\n\nRedeem it here: ${url}`;
    try {
      const canvas = await renderCanvas();
      const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
      const file = new File([blob], `giftsats-${card.amountSats}sats.png`, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: 'A gift for you', text, url, files: [file] });
        return;
      }
      if (navigator.share) {
        await navigator.share({ title: 'A gift for you', text, url });
        return;
      }
      await navigator.clipboard.writeText(text);
    } catch {
      await navigator.clipboard.writeText(text).catch(() => {});
    }
  }

  if (loading) {
    return (
      <Page footer={false} title="Your card">
        <div style={{ ...microLabel }}>Loading…</div>
      </Page>
    );
  }

  if (error || !card) {
    return (
      <Page footer={false} maxWidth={720} title="Your card">
        <Notice tone="bad">{error || 'Gift card not found'}</Notice>
      </Page>
    );
  }

  if (card.status === 'pending') {
    return (
      <Page footer={false} maxWidth={720} title="Your card">
        <h1 style={{ ...headline, fontWeight: 400 }}>Still waiting on the invoice.</h1>
        <p style={{ fontSize: 16, color: T.text2, marginTop: 16 }}>
          This card is minted the moment the payment settles. <Link to={`/pay/${card.id}`}>Back to the invoice</Link>
        </p>
      </Page>
    );
  }

  const link = cardUrl(card.id);

  return (
    <Page footer={false} maxWidth={1180} title="Your card is live">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span
          style={{
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: T.success,
            color: '#fff',
            fontSize: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ✓
        </span>
        <span style={{ ...microLabel, fontSize: 11, letterSpacing: '0.16em', color: T.success }}>
          Payment settled
        </span>
      </div>

      <h1 style={{ ...headline, marginTop: 16, fontWeight: 400, animation: 'gsRise .6s ease both' }}>
        Your card is <em>live.</em>
      </h1>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'clamp(28px, 4vw, 56px)', marginTop: 40 }}>
        <div style={{ flex: '1 1 330px', minWidth: 0, animation: 'gsRise .6s ease .12s both' }}>
          <div ref={cardRef} style={{ background: T.canvas }}>
            <GiftCard
              amount={card.amountSats}
              message={card.senderNote}
              to={card.recipientName}
              from={card.senderName}
              art={art}
              code={card.id}
              expiresAt={card.expiresAt}
              qrValue={link}
            />
          </div>
        </div>

        <div
          style={{
            flex: '1 1 380px',
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 26,
            animation: 'gsRise .6s ease .24s both',
          }}
        >
          <div>
            <div style={{ ...microLabel, fontSize: 10.5, letterSpacing: '0.2em', marginBottom: 10 }}>Share link</div>
            <div
              style={{
                fontFamily: T.mono,
                fontSize: 13,
                color: T.text2,
                background: T.surface,
                border: `1px solid ${T.hair}`,
                borderRadius: 12,
                padding: '13px 15px',
                wordBreak: 'break-all',
              }}
            >
              {link}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
              <CopyButton value={link} label="Copy link" style={{ flex: '1 1 140px' }} />
              <CopyButton value={card.id} label="Copy code" style={{ flex: '1 1 140px' }} />
            </div>
          </div>

          <div className="gs-no-print" style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <GhostButton onClick={downloadPng} style={{ flex: '1 1 140px' }}>
              {busy === 'png' ? 'Rendering…' : 'Download PNG'}
            </GhostButton>
            <GhostButton onClick={() => window.print()} style={{ flex: '1 1 140px' }}>
              Print card
            </GhostButton>
            <GhostButton onClick={share} style={{ flex: '1 1 140px' }}>
              Share
            </GhostButton>
          </div>

          <div>
            <div style={{ ...microLabel, fontSize: 10.5, letterSpacing: '0.2em', marginBottom: 12 }}>Send it via</div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))',
                gap: 10,
              }}
            >
              {SHARE_TARGETS.map((t) => (
                <div
                  key={t.name}
                  style={{
                    border: `1px solid ${T.hair16}`,
                    background: T.surface,
                    borderRadius: 12,
                    padding: '15px 17px',
                  }}
                >
                  <div style={{ fontSize: 14.5, fontWeight: 500 }}>{t.name}</div>
                  <div style={{ fontFamily: T.mono, fontSize: 10.5, color: T.muted, marginTop: 5 }}>{t.hint}</div>
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              background: T.surface,
              border: `1px solid ${T.hair}`,
              borderRadius: 16,
              padding: '18px 20px',
              fontFamily: T.mono,
              fontSize: 13.5,
            }}
          >
            <div style={{ ...microLabel, fontSize: 10, letterSpacing: '0.2em', marginBottom: 14 }}>Receipt</div>
            {[
              ['Gift amount', `${fmt(card.amountSats)} sats`],
              ['Service fee', `${fmt(card.platformFee)} sats`],
              ['Network fee', `${fmt(card.networkFee)} sats`],
              ...(card.designFee > 0 ? [['Design fee', `${fmt(card.designFee)} sats`]] : []),
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 9 }}>
                <span style={{ color: T.text2 }}>{k}</span>
                <span style={{ color: T.ink }}>{v}</span>
              </div>
            ))}
          </div>

          <Link to="/create" className="gs-link" style={{ fontSize: 14.5, color: T.text2 }}>
            Create another gift →
          </Link>
        </div>
      </div>
    </Page>
  );
}
