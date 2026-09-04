import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Page from '../components/Page.jsx';
import GiftCard from '../components/GiftCard.jsx';
import {
  T,
  Bolt,
  Label,
  Input,
  Textarea,
  PrimaryButton,
  Notice,
  microLabel,
  headline,
} from '../components/ui.jsx';
import { BUILT_IN, resolveArt } from '../lib/designs.js';
import { api } from '../lib/api.js';
import { fmt, isLightningAddress } from '../lib/format.js';

const PRESETS = [1000, 2100, 5000, 10000, 21000];
const MIN_SATS = 1000;
const SERVICE_FEE_PERCENT = 2;
const NETWORK_FEE_SATS = 2;
const CUSTOM_IMAGE_FEE_SATS = 5000;
const CUSTOM_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const REDEEM_DAYS = 30;
const MESSAGE_MAX = 90;
const DRAFT_KEY = 'giftsats_form';

const empty = {
  amount: 1000,
  custom: '',
  designId: BUILT_IN[0].id,
  code: '',
  message: '',
  to: '',
  from: '',
  refund: '',
};

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return empty;
    const d = JSON.parse(raw);
    if (d.savedAt && Date.now() - d.savedAt > 30 * 60 * 1000) return empty;
    return { ...empty, ...d };
  } catch {
    return empty;
  }
}

// A static dot pattern standing in for a QR code on the swatch's mini "back" —
// purely decorative, echoing the real card's redeem-QR strip.
const MINI_QR = [1, 1, 1, 0, 1, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 1, 0, 0, 1, 1, 1, 1, 0, 1, 0];

// A mini version of the card front, used for the design swatches.
function Swatch({ art, active, onClick, name, author }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '12px 12px 14px',
        borderRadius: 12,
        textAlign: 'left',
        background: active ? 'rgba(247,147,26,.08)' : T.surface,
        border: active ? `1.5px solid ${T.orange}` : `1px solid ${T.hair16}`,
        transition: 'border-color .15s',
        flex: '1 1 130px',
        minWidth: 118,
      }}
    >
      <div style={{ borderRadius: 9, overflow: 'hidden', border: `1px solid ${T.hair16}` }}>
        <div
          style={{
            height: 74,
            padding: '9px 9px 10px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            // Built-in fronts are gradients; uploads are images. Compose the one
            // shorthand rather than leaving an undefined background-image behind.
            background: art.image ? `#15120F url(${art.image}) center/cover` : art.bg,
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: T.mono, fontSize: 5, letterSpacing: '0.24em', color: art.muted }}>
              GIFTSATS
            </span>
            <Bolt size={7} color={art.mark} />
          </div>
          <div style={{ fontFamily: T.mono, fontSize: 13, fontWeight: 500, color: art.amount }}>21,000</div>
        </div>
        {/* Mini "back" strip, echoing the real card's redeem-QR block. */}
        <div style={{ background: T.surfaceWarm, padding: '8px 9px', display: 'flex', alignItems: 'center', gap: 7 }}>
          <div
            style={{
              width: 22,
              height: 22,
              background: T.surfaceBright,
              border: `1px solid ${T.hair}`,
              borderRadius: 3,
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 3.4px)',
              gridAutoRows: '3.4px',
              alignContent: 'center',
              justifyContent: 'center',
              gap: 0.6,
            }}
          >
            {MINI_QR.map((on, i) => (
              <div key={i} style={{ background: on ? T.inkDeep : 'transparent' }} />
            ))}
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ height: 2, background: 'rgba(27,23,20,.22)', borderRadius: 2 }} />
            <div style={{ height: 2, width: '70%', background: 'rgba(27,23,20,.14)', borderRadius: 2 }} />
          </div>
        </div>
      </div>
      <div style={{ fontFamily: T.serif, fontWeight: 600, fontSize: 14.5, marginTop: 11 }}>{name}</div>
      <div style={{ fontFamily: T.mono, fontSize: 10.5, color: T.muted, marginTop: 4 }}>{author}</div>
    </button>
  );
}

function UploadIcon() {
  return (
    <span style={{ width: 16, height: 16, display: 'block' }}>
      <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 16V4M12 4l-4 4M12 4l4 4M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
      </svg>
    </span>
  );
}

// The fourth tile in the design grid: pick a one-off photo for this single
// card instead of a preset or marketplace design. Mutually exclusive with
// both (enforced here and again on the backend) — this image is never
// listed anywhere, unlike a marketplace submission.
function UploadSwatch({ preview, onPick, onClear, error }) {
  const inputRef = useRef(null);
  return (
    <div style={{ flex: '1 1 130px', minWidth: 118 }}>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        style={{ display: 'none' }}
        onChange={(e) => {
          onPick(e.target.files?.[0] || null);
          e.target.value = ''; // allow re-picking the same file after REMOVE
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        style={{
          width: '100%',
          padding: '12px 12px 14px',
          borderRadius: 12,
          textAlign: 'left',
          background: preview ? 'rgba(247,147,26,.08)' : T.surface,
          border: preview ? `1.5px solid ${T.orange}` : `1px dashed ${T.hair16}`,
          transition: 'border-color .15s',
        }}
      >
        <div
          style={{
            height: 74,
            borderRadius: 9,
            overflow: 'hidden',
            border: `1px solid ${T.hair16}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: preview ? `#15120F url(${preview}) center/cover` : T.surfaceWarm,
            color: T.muted,
          }}
        >
          {!preview && <UploadIcon />}
        </div>
        <div style={{ fontFamily: T.serif, fontWeight: 600, fontSize: 14.5, marginTop: 11 }}>
          Your own design/pic
        </div>
        <div style={{ fontFamily: T.mono, fontSize: 10.5, color: T.orangeDeep, marginTop: 4 }}>
          +{fmt(CUSTOM_IMAGE_FEE_SATS)} sats
        </div>
      </button>
      {preview && (
        <div
          onClick={onClear}
          style={{
            fontFamily: T.mono,
            fontSize: 11,
            letterSpacing: '0.1em',
            color: T.orangeDeep,
            cursor: 'pointer',
            marginTop: 8,
          }}
        >
          REMOVE
        </div>
      )}
      {error && <div style={{ fontSize: 12, color: '#B3341E', marginTop: 8 }}>{error}</div>}
    </div>
  );
}

export default function Create() {
  const navigate = useNavigate();
  const [form, setForm] = useState(loadDraft);
  const [marketDesign, setMarketDesign] = useState(null);
  const [codeState, setCodeState] = useState('idle'); // idle | loading | ok | bad
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [customImage, setCustomImage] = useState(null); // File, not persisted in the draft
  const [customImagePreview, setCustomImagePreview] = useState(null);
  const [imageError, setImageError] = useState('');

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  function clearCustomImage() {
    if (customImagePreview) URL.revokeObjectURL(customImagePreview);
    setCustomImage(null);
    setCustomImagePreview(null);
    setImageError('');
  }

  function pickCustomImage(file) {
    if (!file) return;
    if (!/\.(png|jpe?g|webp)$/i.test(file.name)) {
      setImageError('Photo must be PNG, JPG or WEBP.');
      return;
    }
    if (file.size > CUSTOM_IMAGE_MAX_BYTES) {
      setImageError('That image is over 5 MB. Compress it and try again.');
      return;
    }
    setImageError('');
    if (customImagePreview) URL.revokeObjectURL(customImagePreview);
    setCustomImage(file);
    setCustomImagePreview(URL.createObjectURL(file));
    // Own photo, a preset, and a marketplace code are mutually exclusive —
    // matches the backend rejecting designCode + an uploaded file together.
    set({ code: '' });
    setMarketDesign(null);
  }

  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...form, savedAt: Date.now() }));
  }, [form]);

  // Resolve a marketplace design code as it is typed.
  useEffect(() => {
    const code = form.code.trim();
    if (!code) {
      setMarketDesign(null);
      setCodeState('idle');
      return undefined;
    }
    setCodeState('loading');
    const t = setTimeout(() => {
      api
        .design(code)
        .then((d) => {
          setMarketDesign(d);
          setCodeState('ok');
        })
        .catch(() => {
          setMarketDesign(null);
          setCodeState('bad');
        });
    }, 450);
    return () => clearTimeout(t);
  }, [form.code]);

  const amount = Number(form.amount) || 0;
  const serviceFee = Math.ceil((amount * SERVICE_FEE_PERCENT) / 100);
  const designFee = marketDesign?.priceSats || 0;
  const customImageFee = customImage ? CUSTOM_IMAGE_FEE_SATS : 0;
  const total = amount + serviceFee + NETWORK_FEE_SATS + designFee + customImageFee;

  const designId = marketDesign ? marketDesign.id : form.designId;
  const art = customImage
    ? resolveArt(designId, { imageUrl: customImagePreview })
    : resolveArt(designId, marketDesign);

  const amountOk = Number.isFinite(amount) && amount >= MIN_SATS;
  const refundOk = !form.refund.trim() || isLightningAddress(form.refund);
  const ready = amountOk && refundOk && !imageError && !submitting;

  const hint = !amountOk
    ? `Minimum ${fmt(MIN_SATS)} sats.`
    : !refundOk
      ? 'That refund address does not look like a Lightning address.'
      : imageError
        ? imageError
        : 'Pay the Lightning invoice on the next step — no account needed.';

  async function handleSubmit() {
    if (!ready) return;
    setSubmitting(true);
    setError('');
    try {
      const data = await api.createGift({
        amountSats: amount,
        designCode: customImage ? undefined : designId,
        senderNote: form.message.trim(),
        recipientName: form.to.trim(),
        senderName: form.from.trim(),
        senderLightningAddress: form.refund.trim() || undefined,
        image: customImage || undefined,
      });
      // Kept so a refresh (or a trip out to a wallet app) lands back on the
      // invoice.
      localStorage.setItem(
        'giftsats_pending',
        JSON.stringify({ ...data, designId, marketDesign, form, savedAt: Date.now() })
      );
      navigate(`/pay/${data.giftCardId}`);
    } catch (e) {
      setError(e.message);
      setSubmitting(false);
    }
  }

  return (
    <Page footer={false} maxWidth={1180} title="Create a gift">
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 24,
          borderBottom: `1px solid ${T.hair16}`,
          paddingBottom: 30,
        }}
      >
        <h1 style={{ ...headline, fontWeight: 400 }}>
          Create a <em>gift card.</em>
        </h1>
        <div style={{ fontSize: 15, color: T.text2, maxWidth: 360, lineHeight: 1.6 }}>
          Bitcoin gift cards powered by Lightning. The card is minted the moment your invoice settles.
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'clamp(28px, 4vw, 56px)', marginTop: 40 }}>
        {/* ── Form ───────────────────────────────────────── */}
        <div style={{ flex: '1 1 420px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 30 }}>
          <div>
            <Label>Choose design</Label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {BUILT_IN.map((d) => (
                <Swatch
                  key={d.id}
                  art={d}
                  name={d.name}
                  author={d.author}
                  active={!marketDesign && !customImage && form.designId === d.id}
                  onClick={() => {
                    set({ designId: d.id, code: '' });
                    clearCustomImage();
                  }}
                />
              ))}
              <UploadSwatch
                preview={customImagePreview}
                error={imageError}
                onPick={pickCustomImage}
                onClear={clearCustomImage}
              />
            </div>

            <div style={{ marginTop: 30 }}>
              <Label>
                Marketplace design code <span style={{ color: '#B7AB99' }}>(optional)</span>
              </Label>
              <Input
                placeholder="gfts-a3x9k — paste code from Explore"
                value={form.code}
                onChange={(e) => {
                  set({ code: e.target.value.trim() });
                  if (e.target.value.trim()) clearCustomImage();
                }}
                style={{ fontFamily: T.mono, fontSize: 14 }}
              />
              {codeState === 'loading' && (
                <div style={{ marginTop: 12, fontSize: 13, color: T.mutedWarm }}>Looking up that code…</div>
              )}
              {codeState === 'bad' && (
                <div style={{ marginTop: 12, fontSize: 13, color: '#B3341E' }}>No design with that code.</div>
              )}
              {codeState === 'ok' && marketDesign && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    marginTop: 12,
                    padding: '11px 14px',
                    borderRadius: 10,
                    border: `1.5px solid ${T.orange}`,
                    background: 'rgba(247,147,26,.08)',
                  }}
                >
                  <div
                    style={{
                      width: 38,
                      height: 26,
                      borderRadius: 5,
                      flexShrink: 0,
                      background: art.image ? `#15120F url(${art.image}) center/cover` : art.bg,
                      border: `1px solid ${T.hair16}`,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{marketDesign.name}</div>
                    <div style={{ fontFamily: T.mono, fontSize: 10.5, color: T.mutedWarm, marginTop: 3 }}>
                      {marketDesign.designerName ? `by ${marketDesign.designerName}` : 'by GiftSats'} · applied to
                      preview
                    </div>
                  </div>
                  <span
                    onClick={() => set({ code: '' })}
                    style={{
                      fontFamily: T.mono,
                      fontSize: 11,
                      letterSpacing: '0.1em',
                      color: T.orangeDeep,
                      cursor: 'pointer',
                    }}
                  >
                    REMOVE
                  </span>
                </div>
              )}
              <div style={{ fontSize: 13, color: T.mutedWarm, marginTop: 9 }}>
                Browse designs at <Link to="/explore">giftsats.org/explore</Link>
              </div>
            </div>
          </div>

          <div style={{ borderTop: `1px solid ${T.hair16}`, paddingTop: 26 }}>
            <Label>Amount</Label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {PRESETS.map((p) => {
                const active = amount === p && !form.custom;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => set({ amount: p, custom: '' })}
                    className={active ? undefined : 'gs-outline'}
                    style={{
                      padding: '11px 18px',
                      borderRadius: 999,
                      fontFamily: T.mono,
                      fontSize: 14,
                      background: active ? 'rgba(247,147,26,.12)' : 'transparent',
                      color: T.ink,
                      border: `${active ? '1.5px' : '1px'} solid ${active ? T.orange : T.hair16}`,
                      transition: 'border-color .15s',
                    }}
                  >
                    {fmt(p)}
                  </button>
                );
              })}
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '13px 16px',
                borderRadius: 10,
                border: `1px dashed ${T.hair16}`,
                background: T.surface,
              }}
            >
              <input
                type="number"
                inputMode="numeric"
                min={MIN_SATS}
                placeholder="Custom amount"
                value={form.custom}
                onChange={(e) => set({ custom: e.target.value, amount: Number(e.target.value) || 0 })}
                style={{
                  flex: 1,
                  minWidth: 0,
                  border: 'none',
                  background: 'transparent',
                  fontFamily: T.mono,
                  fontSize: 16,
                  color: T.ink,
                  padding: 0,
                }}
              />
              <span style={{ fontFamily: T.mono, fontSize: 13, color: T.muted }}>sats</span>
            </div>
          </div>

          <div style={{ borderTop: `1px solid ${T.hair16}`, paddingTop: 26 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 9 }}>
              <span style={{ ...microLabel, fontSize: 10.5, letterSpacing: '0.2em' }}>
                Message <span style={{ color: '#B7AB99' }}>(optional)</span>
              </span>
              <span style={{ ...microLabel, fontSize: 11, letterSpacing: 0 }}>
                {form.message.length}/{MESSAGE_MAX}
              </span>
            </div>
            <Textarea
              rows={3}
              maxLength={MESSAGE_MAX}
              placeholder="Happy birthday — stay humble."
              value={form.message}
              onChange={(e) => set({ message: e.target.value })}
              style={{ fontFamily: T.serif, fontSize: 16 }}
            />
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ flex: '1 1 180px' }}>
              <div style={{ marginBottom: 9 }}>
                <span style={{ ...microLabel, fontSize: 10.5, letterSpacing: '0.2em' }}>
                  From <span style={{ color: '#B7AB99' }}>(optional)</span>
                </span>
              </div>
              <Input
                maxLength={40}
                placeholder="Sender name"
                value={form.from}
                onChange={(e) => set({ from: e.target.value })}
              />
            </div>
            <div style={{ flex: '1 1 180px' }}>
              <div style={{ marginBottom: 9 }}>
                <span style={{ ...microLabel, fontSize: 10.5, letterSpacing: '0.2em' }}>
                  To <span style={{ color: '#B7AB99' }}>(optional)</span>
                </span>
              </div>
              <Input
                maxLength={40}
                placeholder="Recipient name"
                value={form.to}
                onChange={(e) => set({ to: e.target.value })}
              />
            </div>
          </div>

          <div>
            <div style={{ marginBottom: 9 }}>
              <span style={{ ...microLabel, fontSize: 10.5, letterSpacing: '0.2em' }}>
                Refund address <span style={{ color: '#B7AB99' }}>(optional)</span>
              </span>
            </div>
            <Input
              placeholder="your@lightning.address"
              value={form.refund}
              onChange={(e) => set({ refund: e.target.value })}
              style={{ fontFamily: T.mono, fontSize: 14 }}
            />
            <div style={{ marginTop: 8, fontSize: 13, color: T.mutedWarm, lineHeight: 1.5 }}>
              If not redeemed within {REDEEM_DAYS} days, sats are refunded here. Leave blank to forfeit to the
              platform.
            </div>
          </div>

          {/* ── Summary ──────────────────────────────────── */}
          <div
            style={{
              background: T.surface,
              border: '1px solid rgba(27,23,20,.14)',
              borderRadius: 14,
              padding: '22px 24px',
            }}
          >
            {[
              ['Gift amount', `${fmt(amount)} sats`],
              [`Service fee (${SERVICE_FEE_PERCENT}%)`, `${fmt(serviceFee)} sats`],
              ['Network fee', `${fmt(NETWORK_FEE_SATS)} sats`],
              ...(designFee > 0 ? [[`Design fee · ${marketDesign.name}`, `${fmt(designFee)} sats`]] : []),
              ...(customImageFee > 0 ? [['Your own design/pic', `${fmt(customImageFee)} sats`]] : []),
            ].map(([k, v]) => (
              <div
                key={k}
                style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 11, fontSize: 14.5 }}
              >
                <span style={{ color: T.text2 }}>{k}</span>
                <span style={{ fontFamily: T.mono, color: T.ink }}>{v}</span>
              </div>
            ))}
            <div
              style={{
                borderTop: `1px solid ${T.hair}`,
                paddingTop: 13,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                gap: 16,
              }}
            >
              <span style={{ color: T.ink, fontWeight: 600, fontSize: 16 }}>Total to pay</span>
              <span style={{ fontFamily: T.mono, fontWeight: 500, fontSize: 20, color: T.orangeDeep }}>
                {fmt(total)} sats
              </span>
            </div>
          </div>

          {error && <Notice tone="bad">{error}</Notice>}

          <div>
            <PrimaryButton onClick={handleSubmit} disabled={!ready} style={{ width: '100%' }}>
              <Bolt size={15} />
              {submitting ? 'Creating invoice…' : 'Generate invoice'}
            </PrimaryButton>
            <div style={{ marginTop: 12, fontSize: 13.5, color: T.mutedWarm, textAlign: 'center' }}>{hint}</div>
          </div>
        </div>

        {/* ── Sticky preview ─────────────────────────────── */}
        <div style={{ flex: '1 1 330px', minWidth: 0 }}>
          <div style={{ position: 'sticky', top: 32 }}>
            <div style={{ ...microLabel, fontSize: 10.5, letterSpacing: '0.2em', marginBottom: 14 }}>Preview</div>
            <GiftCard
              amount={amount}
              message={form.message}
              to={form.to}
              from={form.from}
              art={art}
              code={null}
              expiresAt={new Date(Date.now() + REDEEM_DAYS * 86400000).toISOString()}
              locked
            />
          </div>
        </div>
      </div>
    </Page>
  );
}
