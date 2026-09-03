import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Page from '../components/Page.jsx';
import GiftCard from '../components/GiftCard.jsx';
import { T, GhostButton, Textarea, Notice, microLabel, headline } from '../components/ui.jsx';
import { useCard } from '../lib/useCard.js';
import { redeemSecretFromHash } from '../lib/api.js';
import { cardUrl, fmt, copy } from '../lib/format.js';

const SHARE_TARGETS = [
  { name: 'Message', hint: 'SMS / iMessage' },
  { name: 'Email', hint: 'with card image' },
  { name: 'Nostr DM', hint: 'npub…' },
  { name: 'QR poster', hint: 'print A5' },
];

export default function CardReady() {
  const { id } = useParams();
  const { card, art, error, loading } = useCard(id, { poll: true });
  // GS-004: this card's real redeem credential, carried here from Create.jsx
  // via the URL fragment (see PayInvoice.jsx). Every share link/QR built on
  // this page must embed it — without it, the recipient can't redeem.
  const [redeemSecret] = useState(() => redeemSecretFromHash());
  const cardRef = useRef(null);
  const [busy, setBusy] = useState('');
  const [customCopyText, setCustomCopyText] = useState(null);
  const [editingCopy, setEditingCopy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const copiedTimer = useRef(null);
  useEffect(() => () => clearTimeout(copiedTimer.current), []);

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
    const url = cardUrl(card.id, redeemSecret);
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

  const link = cardUrl(card.id, redeemSecret);
  const defaultCopyText = `🎁 I'm sending you a Bitcoin gift card worth ${fmt(card.amountSats)} sats!\n\nRedeem it here: ${link}`;
  const copyText = customCopyText ?? defaultCopyText;

  async function copyGiftLink() {
    const ok = await copy(copyText);
    if (!ok) return;
    setCopied(true);
    clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), 1600);
  }

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

      {!redeemSecret && (
        <div style={{ marginTop: 20 }}>
          <Notice tone="bad">
            Couldn't find this card's redeem key on this device. The link below won't let the recipient redeem —
            reload this page from the original payment step, or <Link to="/create">create the gift again</Link>.
          </Notice>
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'clamp(28px, 4vw, 56px)', marginTop: 40 }}>
        <div
          style={{
            flex: '1 1 380px',
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 26,
            animation: 'gsRise .6s ease .12s both',
          }}
        >
          <div>
            <button
              type="button"
              onClick={copyGiftLink}
              className="gs-cta-btn gs-no-print"
              style={{
                display: 'flex',
                width: '100%',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px 20px',
                borderRadius: 999,
                fontWeight: 600,
                fontSize: 16,
                color: copied ? T.successText : T.ink,
                background: copied ? T.successFill : T.orange,
                border: copied ? `1px solid ${T.successBorder}` : 'none',
                boxShadow: copied ? 'none' : '0 12px 24px -10px rgba(247,147,26,.5)',
                transition: 'background .15s',
              }}
            >
              {copied ? 'Copied!' : 'Copy gift link'}
            </button>

            <div className="gs-no-print" style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
              <GhostButton onClick={downloadPng} style={{ width: '100%' }}>
                {busy === 'png' ? 'Rendering…' : 'Download PNG'}
              </GhostButton>
              <GhostButton onClick={() => window.print()} style={{ width: '100%' }}>
                Print card
              </GhostButton>
              <GhostButton onClick={() => setShareOpen((v) => !v)} style={{ width: '100%' }}>
                Share to recipient
              </GhostButton>
            </div>

            {shareOpen && (
              <div
                className="gs-no-print"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))',
                  gap: 10,
                  marginTop: 10,
                }}
              >
                {SHARE_TARGETS.map((t) => (
                  <button
                    key={t.name}
                    type="button"
                    onClick={share}
                    className="gs-tile"
                    style={{
                      textAlign: 'left',
                      border: `1px solid ${T.hair16}`,
                      background: T.surface,
                      borderRadius: 12,
                      padding: '15px 17px',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontSize: 14.5, fontWeight: 500, color: T.ink }}>{t.name}</div>
                    <div style={{ fontFamily: T.mono, fontSize: 10.5, color: T.muted, marginTop: 5 }}>{t.hint}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div
            style={{
              background: T.surface,
              border: `1px solid ${T.hair}`,
              borderRadius: 16,
              padding: '16px 18px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ ...microLabel, fontSize: 10.5, letterSpacing: '0.2em' }}>What gets copied</span>
              <button
                type="button"
                onClick={() => setEditingCopy((v) => !v)}
                style={{
                  fontFamily: T.mono,
                  fontSize: 11,
                  letterSpacing: '0.1em',
                  color: T.orangeDeep,
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                }}
              >
                {editingCopy ? 'DONE' : 'EDIT'}
              </button>
            </div>
            {editingCopy ? (
              <Textarea
                rows={4}
                value={copyText}
                onChange={(e) => setCustomCopyText(e.target.value)}
                style={{ fontSize: 14 }}
              />
            ) : (
              <div
                style={{
                  background: T.surfaceBright,
                  border: `1px solid ${T.hair}`,
                  borderRadius: 10,
                  padding: '12px 14px',
                  fontSize: 14,
                  color: T.text2,
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.5,
                }}
              >
                {copyText}
              </div>
            )}
            <div style={{ fontSize: 13, color: T.mutedWarm, marginTop: 10, lineHeight: 1.5 }}>
              Paste it straight into any chat. Anyone with the link can redeem — send it like a gift, not in a public
              channel.
            </div>
            <a
              href={link}
              target="_blank"
              rel="noreferrer"
              className="gs-link"
              style={{
                display: 'inline-block',
                marginTop: 10,
                fontFamily: T.mono,
                fontSize: 11.5,
                letterSpacing: '0.08em',
                color: T.orangeDeep,
              }}
            >
              DEMO: OPEN THE GIFT LINK →
            </a>
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

          <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
            <Link
              to="/create"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '14px 24px',
                borderRadius: 999,
                fontWeight: 600,
                fontSize: 15,
                color: T.canvas,
                background: T.inkDeep,
              }}
            >
              Create another gift
            </Link>
            <a href={link} target="_blank" rel="noreferrer" className="gs-link" style={{ fontSize: 14.5, color: T.text2 }}>
              See what the recipient sees →
            </a>
          </div>
        </div>

        <div style={{ flex: '1 1 330px', minWidth: 0, animation: 'gsRise .6s ease .24s both' }}>
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
      </div>
    </Page>
  );
}
