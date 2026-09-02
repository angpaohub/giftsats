import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Page from '../components/Page.jsx';
import CopyButton from '../components/CopyButton.jsx';
import GiftCard from '../components/GiftCard.jsx';
import { resolveArt } from '../lib/designs.js';
import {
  T,
  Bolt,
  Label,
  Input,
  Textarea,
  Pill,
  PrimaryButton,
  Notice,
  microLabel,
  headline,
} from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { fmt, isEmail, isLightningAddress } from '../lib/format.js';

const FEE_PRESETS = [0, 50, 100, 200, 500];
const TAGS = ['Minimal', 'Bold', 'Celebration', 'Seasonal'];
const PLATFORM_SHARE_PERCENT = 20;
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_DESC = 140;
const TARGET_RATIO = 16 / 10;

const hair14 = 'rgba(27,23,20,.14)';

function CheckIcon() {
  return (
    <span style={{ width: 12, height: 12, display: 'block', color: T.ink }}>
      <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 12.6 L9.4 18 L20 6.6" />
      </svg>
    </span>
  );
}

function ExpandIcon() {
  return (
    <span style={{ width: 14, height: 14, display: 'block' }}>
      <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 3H4v4M16 3h4v4M8 21H4v-4M16 21h4v-4" />
      </svg>
    </span>
  );
}

export default function Submit() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [dims, setDims] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [form, setForm] = useState({ name: '', handle: '', email: '', ln: '', fee: 50, desc: '', tag: 'Minimal' });
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState(null);
  const [showFullPreview, setShowFullPreview] = useState(false);
  const inputRef = useRef(null);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  function takeFile(f) {
    if (!f) return;
    if (!/\.(png|jpe?g|webp)$/i.test(f.name)) {
      setError('Card fronts must be PNG, JPG or WEBP.');
      return;
    }
    if (f.size > MAX_BYTES) {
      setError('That image is over 5 MB. Compress it and try again.');
      return;
    }
    setError('');
    setFile(f);
    setDims(null);
    const url = URL.createObjectURL(f);
    setPreview(url);
    const img = new Image();
    img.onload = () => setDims({ width: img.naturalWidth, height: img.naturalHeight });
    img.src = url;
  }

  const share = Math.round((form.fee * PLATFORM_SHARE_PERCENT) / 100);
  const ready =
    !!file && form.name.trim().length > 1 && isLightningAddress(form.ln) && isEmail(form.email) && agreed && !busy;

  const hint = !file
    ? 'Add a card front to continue.'
    : form.name.trim().length < 2
      ? 'Give the design a name.'
      : !isLightningAddress(form.ln)
        ? 'Add the Lightning address your fees should go to.'
        : !isEmail(form.email)
          ? 'Add an email so we can reach you about the submission.'
          : !agreed
            ? 'Accept the designer terms to publish.'
            : 'Reviewed within a day — you’ll get the design code by email or nostr DM.';

  const ratioNote = dims
    ? Math.abs(dims.width / dims.height - TARGET_RATIO) < 0.05
      ? 'ratio ok'
      : `ratio off · aim for 16:10`
    : null;

  async function submit() {
    if (!ready) return;
    setBusy(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('image', file);
      fd.append('name', form.name.trim());
      fd.append('designerName', (form.handle || '').trim() || 'Anonymous');
      fd.append('handle', form.handle.trim());
      fd.append('email', form.email.trim());
      fd.append('lightningAddress', form.ln.trim());
      fd.append('priceSats', String(form.fee));
      fd.append('description', form.desc.trim());
      fd.append('tag', form.tag);
      const design = await api.submitDesign(fd);
      setCreated(design);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    return (
      <Page footer={false} maxWidth={720} title="Design submitted">
        <div style={microLabel}>Submitted</div>
        <h1 style={{ ...headline, marginTop: 14, fontWeight: 400 }}>
          Your front is <em>live.</em>
        </h1>
        <p style={{ fontSize: 17, color: T.text2, marginTop: 18, lineHeight: 1.55 }}>
          Anyone can use it by pasting this code into the create form. Your fee goes straight to{' '}
          {created.lightningAddress || 'your Lightning address'} each time a card is minted with it.
        </p>
        <div
          style={{
            marginTop: 28,
            background: T.surface,
            border: `1px solid ${T.hair}`,
            borderRadius: 16,
            padding: '22px 24px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 16,
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ ...microLabel, fontSize: 10, letterSpacing: '0.2em' }}>Design code</div>
            <div style={{ fontFamily: T.mono, fontSize: 22, marginTop: 8 }}>{created.id}</div>
          </div>
          <CopyButton value={created.id} label="Copy code" />
        </div>
        <div style={{ marginTop: 28, display: 'flex', gap: 18, flexWrap: 'wrap' }}>
          <Link to="/explore">See it on Explore</Link>
          <Link to="/create">Make a card with it</Link>
        </div>
      </Page>
    );
  }

  const art = preview
    ? { ...resolveArt(null, { imageUrl: preview }) }
    : { bg: '#EDE6D8', glow: 'rgba(199,122,18,.08)', muted: '#A2957F', mark: T.orangeDeep, amount: T.ink, unit: '#A2957F' };

  return (
    <Page footer={false} title="Submit a design">
      {/* Hero */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 32,
          borderBottom: `1px solid ${T.hair16}`,
          paddingBottom: 30,
        }}
      >
        <div
          style={{
            fontFamily: T.serif,
            fontSize: 'clamp(34px, 7vw, 52px)',
            lineHeight: 1.06,
            letterSpacing: '-0.015em',
          }}
        >
          Submit a <em style={{ fontStyle: 'italic' }}>design.</em>
        </div>
        <div style={{ fontSize: 15, color: T.text2, maxWidth: 380, lineHeight: 1.6 }}>
          One image, one Lightning address, one fee. No account, no portfolio review.
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'clamp(30px, 4vw, 56px) clamp(30px, 5vw, 72px)', alignItems: 'flex-start', marginTop: 48 }}>
        {/* ── Left: form ─────────────────────────────────── */}
        <div style={{ flex: '1 1 460px', minWidth: 0 }}>
          {/* Artwork */}
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <div style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: '0.14em', color: T.muted, textTransform: 'uppercase' }}>
              Artwork
            </div>
            <div style={{ fontFamily: T.mono, fontSize: 11, color: T.muted }}>856 × 540 · PNG, JPG, WEBP · max 5 MB</div>
          </div>

          <div
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              takeFile(e.dataTransfer.files?.[0]);
            }}
            style={{
              marginTop: 14,
              borderRadius: 16,
              border: `1.5px dashed ${file && !dragging ? 'rgba(27,23,20,.22)' : T.orange}`,
              background: file && !dragging ? T.surface : 'rgba(247,147,26,.05)',
              padding: file ? '20px 22px' : '56px 32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 18,
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'border-color .15s',
            }}
          >
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => takeFile(e.target.files?.[0])}
              style={{ display: 'none' }}
            />
            {file ? (
              <>
                {preview && (
                  <img
                    src={preview}
                    alt=""
                    style={{
                      width: 120,
                      aspectRatio: '16 / 10',
                      objectFit: 'cover',
                      borderRadius: 8,
                      border: `1px solid ${hair14}`,
                      flex: '0 0 auto',
                    }}
                  />
                )}
                <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                  <div style={{ fontSize: 16, fontWeight: 500, wordBreak: 'break-all' }}>{file.name}</div>
                  <div style={{ fontFamily: T.mono, fontSize: 12, color: T.muted, marginTop: 6 }}>
                    {dims ? `${dims.width} × ${dims.height}` : '…'} · {(file.size / 1024).toFixed(0)} KB
                    {ratioNote ? ` · ${ratioNote}` : ''}
                  </div>
                </div>
                <span style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: '0.1em', color: T.orangeDeep, flex: '0 0 auto' }}>
                  REPLACE
                </span>
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                <div
                  style={{
                    width: 56,
                    height: 36,
                    borderRadius: 6,
                    border: '1.5px dashed rgba(27,23,20,.3)',
                    background: T.surface,
                  }}
                />
                <div style={{ fontSize: 16, color: T.ink }}>Drop your 16:10 artwork here</div>
                <div style={{ fontFamily: T.mono, fontSize: 12, color: T.muted }}>or click to browse</div>
              </div>
            )}
          </div>
          <div style={{ fontSize: 13, color: T.mutedWarm, marginTop: 9, lineHeight: 1.5 }}>
            Keep the top-right corner clear — the bolt mark and amount are drawn over your artwork.{' '}
            <a href="#template" className="gs-link" style={{ color: T.orangeDeep }}>
              Download the template
            </a>
          </div>

          {/* Name / handle */}
          <div style={{ marginTop: 34, borderTop: `1px solid ${T.hair16}`, paddingTop: 26, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22 }}>
            <div>
              <Label>Design name</Label>
              <Input maxLength={60} placeholder="Solstice" value={form.name} onChange={(e) => set({ name: e.target.value })} />
            </div>
            <div>
              <Label hint="optional">Handle</Label>
              <Input maxLength={40} placeholder="Anonymous" value={form.handle} onChange={(e) => set({ handle: e.target.value })} />
            </div>
          </div>

          {/* Email */}
          <div style={{ marginTop: 22 }}>
            <Label>Contact email</Label>
            <Input
              type="email"
              placeholder="you@studio.com"
              value={form.email}
              onChange={(e) => set({ email: e.target.value })}
              style={{ fontFamily: T.mono, fontSize: 14 }}
            />
            <div style={{ fontSize: 13, color: T.mutedWarm, marginTop: 9 }}>
              Used for the review result and your design code. Never shown on the marketplace.
            </div>
          </div>

          {/* Fee */}
          <div style={{ marginTop: 34, borderTop: `1px solid ${T.hair16}`, paddingTop: 26 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <div style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: '0.14em', color: T.muted, textTransform: 'uppercase' }}>
                Design fee
              </div>
              <div style={{ fontFamily: T.mono, fontSize: 11, color: T.muted }}>0 = free</div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 14 }}>
              {FEE_PRESETS.map((v) => {
                const active = form.fee === v;
                return (
                  <button
                    key={v}
                    type="button"
                    className={active ? undefined : 'gs-outline'}
                    onClick={() => set({ fee: v })}
                    style={{
                      padding: '11px 18px',
                      borderRadius: 10,
                      fontFamily: T.mono,
                      fontSize: 14,
                      background: active ? 'rgba(247,147,26,.12)' : 'transparent',
                      color: T.ink,
                      border: `${active ? '1.5px' : '1px'} solid ${active ? T.orange : T.hair16}`,
                      transition: 'border-color .15s',
                    }}
                  >
                    {v === 0 ? 'Free' : fmt(v)}
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
                border: '1px dashed rgba(27,23,20,.24)',
                background: T.surface,
                marginTop: 12,
              }}
            >
              <input
                type="text"
                inputMode="numeric"
                value={FEE_PRESETS.includes(form.fee) ? '' : String(form.fee)}
                onChange={(e) => {
                  const n = parseInt(e.target.value.replace(/[^0-9]/g, ''), 10);
                  set({ fee: Number.isNaN(n) ? 0 : Math.min(n, 1000000) });
                }}
                placeholder="Custom fee"
                style={{ border: 'none', background: 'transparent', fontFamily: T.mono, fontSize: 16, color: T.ink, width: '100%', padding: 0, outline: 'none' }}
              />
              <span style={{ fontFamily: T.mono, fontSize: 13, color: T.muted }}>sats</span>
            </div>
          </div>

          {/* Lightning address */}
          <div style={{ marginTop: 24 }}>
            <Label>Lightning address</Label>
            <Input
              placeholder="you@walletofsatoshi.com"
              value={form.ln}
              onChange={(e) => set({ ln: e.target.value })}
              style={{ fontFamily: T.mono, fontSize: 14 }}
            />
            <div style={{ fontSize: 13, color: T.mutedWarm, marginTop: 9 }}>
              Payouts are sent here automatically, per use. Nothing is held on the platform.
            </div>
          </div>

          {/* Description */}
          <div style={{ marginTop: 24 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
              <Label hint="optional">Description</Label>
              <div style={{ fontFamily: T.mono, fontSize: 11, color: T.muted }}>
                {form.desc.length}/{MAX_DESC}
              </div>
            </div>
            <Textarea
              rows={3}
              maxLength={MAX_DESC}
              placeholder="Warm midwinter gradient — good for birthdays and year-end gifts."
              value={form.desc}
              onChange={(e) => set({ desc: e.target.value })}
            />
          </div>

          {/* Category */}
          <div style={{ marginTop: 24 }}>
            <Label>Category</Label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9 }}>
              {TAGS.map((t) => (
                <Pill key={t} active={form.tag === t} onClick={() => set({ tag: t })}>
                  {t}
                </Pill>
              ))}
            </div>
          </div>

          {/* Fee breakdown */}
          <div
            style={{
              marginTop: 40,
              border: `1px solid ${hair14}`,
              borderRadius: 14,
              background: T.surface,
              padding: '22px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: 11,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14.5, color: T.text2 }}>
              <span>Your fee per use</span>
              <span style={{ fontFamily: T.mono, color: T.ink }}>{fmt(form.fee)} sats</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14.5, color: T.text2 }}>
              <span>
                Platform share{' '}
                <span style={{ fontFamily: T.mono, fontSize: 13, color: T.muted }}>({PLATFORM_SHARE_PERCENT}%)</span>
              </span>
              <span style={{ fontFamily: T.mono, color: T.ink }}>{fmt(share)} sats</span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                borderTop: `1px solid ${T.hair16}`,
                paddingTop: 13,
                marginTop: 2,
              }}
            >
              <span style={{ fontWeight: 600, fontSize: 16 }}>You receive per use</span>
              <span style={{ fontFamily: T.mono, fontWeight: 500, fontSize: 20, color: T.orangeDeep }}>
                {fmt(form.fee - share)} sats
              </span>
            </div>
          </div>

          {/* Rights checkbox */}
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 13, marginTop: 22, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }}
            />
            <span
              style={{
                width: 20,
                height: 20,
                flex: '0 0 20px',
                marginTop: 1,
                borderRadius: 5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: agreed ? T.orange : T.surface,
                border: `1.5px solid ${agreed ? T.orange : 'rgba(27,23,20,.28)'}`,
                transition: 'background .15s, border-color .15s',
              }}
            >
              {agreed && <CheckIcon />}
            </span>
            <span style={{ fontSize: 14.5, color: T.text2, lineHeight: 1.5 }}>
              I own the rights to this artwork and agree to the{' '}
              <Link to="/terms" className="gs-link">
                terms and conditions
              </Link>{' '}
              of GiftSats.
            </span>
          </label>

          {error && (
            <div style={{ marginTop: 22 }}>
              <Notice tone="bad">{error}</Notice>
            </div>
          )}

          <div style={{ marginTop: 22 }}>
            <PrimaryButton onClick={submit} disabled={!ready} style={{ width: '100%' }}>
              <Bolt size={15} />
              {busy ? 'Uploading…' : 'Publish design'}
            </PrimaryButton>
            <div style={{ marginTop: 12, fontSize: 13, color: T.muted, textAlign: 'center' }}>{hint}</div>
          </div>
        </div>

        {/* ── Right: preview ─────────────────────────────── */}
        <div style={{ position: 'sticky', top: 32, flex: '1 1 330px', maxWidth: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <div style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: '0.18em', color: T.muted, textTransform: 'uppercase' }}>
              Preview
            </div>
            <div style={{ fontFamily: T.mono, fontSize: 11, color: T.muted }}>as buyers see it</div>
          </div>

          <div style={{ marginTop: 14, borderRadius: 20, overflow: 'hidden', boxShadow: '0 34px 64px -26px rgba(40,30,18,.5)' }}>
            <div
              style={{
                position: 'relative',
                overflow: 'hidden',
                padding: 'clamp(22px, 5vw, 31px) clamp(22px, 5vw, 33px)',
                aspectRatio: '16 / 10',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                background: preview ? `#15120F url(${preview}) center/cover` : art.bg,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  right: -56,
                  top: -56,
                  width: 222,
                  height: 222,
                  borderRadius: '50%',
                  background: `radial-gradient(circle, ${art.glow}, transparent 70%)`,
                }}
              />
              {preview && <div style={{ position: 'absolute', inset: 0, background: art.scrim }} />}
              {!preview && (
                <>
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'repeating-linear-gradient(135deg, rgba(27,23,20,.05) 0 10px, rgba(27,23,20,.02) 10px 20px)',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      textAlign: 'center',
                      fontFamily: T.mono,
                      fontSize: 11,
                      letterSpacing: '0.18em',
                      color: '#A2957F',
                      textTransform: 'uppercase',
                    }}
                  >
                    your artwork here
                  </div>
                </>
              )}
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: T.mono, fontSize: 12, letterSpacing: '0.24em', color: art.muted }}>
                  GIFTSATS
                </span>
                <Bolt size={20} color={art.mark} />
              </div>
              <div style={{ position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
                  <span style={{ fontFamily: T.mono, fontWeight: 500, fontSize: 'clamp(36px, 9vw, 52px)', letterSpacing: '-0.02em', lineHeight: 1, color: art.amount }}>
                    21,000
                  </span>
                  <span style={{ fontFamily: T.mono, fontSize: 17, color: art.unit }}>sats</span>
                </div>
                <div style={{ fontFamily: T.serif, fontStyle: 'italic', fontSize: 16, lineHeight: 1.35, color: art.body || art.amount, marginTop: 13 }}>
                  “Happy birthday — stay humble.”
                </div>
              </div>
            </div>
            <div
              style={{
                background: T.surface,
                padding: '20px 24px',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 16,
                border: `1px solid ${hair14}`,
                borderTop: 'none',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: T.serif, fontSize: 24, lineHeight: 1.15 }}>{form.name.trim() || 'Untitled design'}</div>
                <div style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, marginTop: 6 }}>
                  by {form.handle.trim() || 'Anonymous'}
                </div>
              </div>
              <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                <div style={{ fontFamily: T.mono, fontSize: 14, color: T.orangeDeep }}>
                  {form.fee === 0 ? 'Free' : `+${fmt(form.fee)} sats`}
                </div>
                <div style={{ fontFamily: T.mono, fontSize: 10.5, color: T.muted, marginTop: 6 }}>0 uses</div>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => file && setShowFullPreview(true)}
            disabled={!file}
            className={file ? 'gs-outline' : undefined}
            style={{
              width: '100%',
              marginTop: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 9,
              padding: '13px 20px',
              borderRadius: 999,
              border: `1px solid ${file ? T.hair16 : T.hair}`,
              background: 'transparent',
              color: file ? T.ink : T.muted,
              fontSize: 14.5,
              fontWeight: 500,
              cursor: file ? 'pointer' : 'not-allowed',
              transition: 'border-color .15s',
            }}
          >
            <ExpandIcon />
            Preview full card
          </button>

          <div style={{ marginTop: 26, border: `1px solid ${hair14}`, borderRadius: 14, padding: '22px 24px' }}>
            <div style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: '0.14em', color: T.muted, textTransform: 'uppercase' }}>
              Specs
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', marginTop: 14 }}>
              {[
                ['Size', '856 × 540 px'],
                ['Ratio', '16:10'],
                ['Formats', 'PNG · JPG · WEBP'],
                ['Max size', '5 MB'],
                ['Safe zone', '40 px inset'],
                ['Overlay drawn on top', 'mark + amount'],
              ].map(([k, v]) => (
                <div
                  key={k}
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    gap: 16,
                    padding: '11px 0',
                    borderTop: `1px solid ${T.hair}`,
                    fontSize: 14.5,
                    color: T.text2,
                  }}
                >
                  <span>{k}</span>
                  <span style={{ fontFamily: T.mono, color: T.ink }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Full-card preview modal */}
      {showFullPreview && file && (
        <div
          onClick={() => setShowFullPreview(false)}
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
          <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative', width: 'min(510px, 100%)', animation: 'gsCardIn .3s ease both' }}>
            <button
              type="button"
              onClick={() => setShowFullPreview(false)}
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
            {/* Real GiftCard component, front + back — exactly what a buyer sees,
                not a scaled-down mock of it. Sample amount/message/QR only. */}
            <GiftCard
              amount={21000}
              message="Happy birthday — stay humble."
              to="Alex"
              from={form.handle.trim() || 'Anonymous'}
              art={resolveArt(null, { imageUrl: preview })}
              qrValue="giftsats-preview"
            />
            <div style={{ textAlign: 'center', marginTop: 14, fontSize: 13, color: 'rgba(255,247,234,.7)' }}>
              Sample amount, message and QR — for layout only, not a real card.
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}
