import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Page from '../components/Page.jsx';
import CopyButton from '../components/CopyButton.jsx';
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

export default function Submit() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [form, setForm] = useState({ name: '', handle: '', email: '', ln: '', fee: 50, desc: '', tag: 'Minimal' });
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState(null);
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
    setPreview(URL.createObjectURL(f));
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
            ? 'Confirm you hold the rights to the artwork.'
            : 'Reviewed within a day — you’ll get the design code by email or nostr DM.';

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

  return (
    <Page footer={false} maxWidth={1080} title="Submit a design">
      <div style={microLabel}>For designers</div>
      <h1 style={{ ...headline, marginTop: 14, fontWeight: 400 }}>
        Submit a <em>front.</em>
      </h1>
      <p style={{ fontSize: 17, color: T.text2, marginTop: 18, maxWidth: 560, lineHeight: 1.55 }}>
        One image, one Lightning address, one fee. No account, no portfolio review.
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'clamp(28px, 4vw, 48px)', marginTop: 40 }}>
        <div style={{ flex: '1 1 420px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 28 }}>
          {/* ── Artwork ──────────────────────────────────── */}
          <div>
            <Label hint="PNG, JPG or WEBP · up to 5 MB">Card front</Label>
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
                borderRadius: 16,
                border: `1.5px dashed ${file && !dragging ? T.hair16 : T.orange}`,
                background: file && !dragging ? T.surface : 'rgba(247,147,26,.05)',
                padding: file ? '20px 22px' : '56px 32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 16,
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
                      style={{ width: 96, height: 60, objectFit: 'cover', borderRadius: 8, flex: '0 0 auto' }}
                    />
                  )}
                  <div style={{ textAlign: 'left', minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 500, wordBreak: 'break-all' }}>{file.name}</div>
                    <div style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, marginTop: 4 }}>
                      {(file.size / 1024).toFixed(0)} KB · click to replace
                    </div>
                  </div>
                </>
              ) : (
                <div>
                  <div style={{ fontFamily: T.serif, fontSize: 22 }}>Drop your artwork here</div>
                  <div style={{ fontSize: 14.5, color: T.text2, marginTop: 8 }}>or click to choose a file</div>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ flex: '1 1 200px' }}>
              <Label>Design name</Label>
              <Input
                maxLength={60}
                placeholder="Sand Ledger"
                value={form.name}
                onChange={(e) => set({ name: e.target.value })}
              />
            </div>
            <div style={{ flex: '1 1 200px' }}>
              <Label hint="optional">Handle</Label>
              <Input
                maxLength={40}
                placeholder="@lisel"
                value={form.handle}
                onChange={(e) => set({ handle: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ flex: '1 1 200px' }}>
              <Label>Email</Label>
              <Input
                placeholder="you@example.com"
                value={form.email}
                onChange={(e) => set({ email: e.target.value })}
                style={{ fontFamily: T.mono, fontSize: 14 }}
              />
            </div>
            <div style={{ flex: '1 1 200px' }}>
              <Label>Lightning address</Label>
              <Input
                placeholder="you@walletofsatoshi.com"
                value={form.ln}
                onChange={(e) => set({ ln: e.target.value })}
                style={{ fontFamily: T.mono, fontSize: 14 }}
              />
            </div>
          </div>

          <div>
            <Label hint="charged once per card minted">Per-use fee</Label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
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
              <Input
                type="number"
                min={0}
                value={form.fee}
                onChange={(e) => set({ fee: Math.max(0, Number(e.target.value) || 0) })}
                style={{ width: 120, fontFamily: T.mono, fontSize: 14, padding: '11px 14px' }}
              />
            </div>
            {form.fee > 0 && (
              <div style={{ marginTop: 12, fontSize: 13.5, color: T.mutedWarm, lineHeight: 1.55 }}>
                You keep <strong style={{ color: T.ink }}>{fmt(form.fee - share)} sats</strong> per use; GiftSats
                takes {PLATFORM_SHARE_PERCENT}% ({fmt(share)} sats) to cover routing and review.
              </div>
            )}
          </div>

          <div>
            <Label>Category</Label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {TAGS.map((t) => (
                <Pill key={t} active={form.tag === t} onClick={() => set({ tag: t })}>
                  {t}
                </Pill>
              ))}
            </div>
          </div>

          <div>
            <Label hint="optional">Description</Label>
            <Textarea
              rows={3}
              maxLength={280}
              placeholder="Where it came from, what it is for."
              value={form.desc}
              onChange={(e) => set({ desc: e.target.value })}
            />
          </div>

          <label style={{ display: 'flex', gap: 12, alignItems: 'flex-start', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              style={{ width: 20, height: 20, marginTop: 2, accentColor: T.orange, flex: '0 0 auto' }}
            />
            <span style={{ fontSize: 14.5, color: T.text2, lineHeight: 1.55 }}>
              I made this artwork or hold the rights to it, and I accept the{' '}
              <Link to="/terms">terms for designer submissions</Link>.
            </span>
          </label>

          {error && <Notice tone="bad">{error}</Notice>}

          <div>
            <PrimaryButton onClick={submit} disabled={!ready} style={{ width: '100%' }}>
              <Bolt size={15} />
              {busy ? 'Uploading…' : 'Submit design'}
            </PrimaryButton>
            <div style={{ marginTop: 12, fontSize: 13.5, color: T.mutedWarm, textAlign: 'center' }}>{hint}</div>
          </div>
        </div>

        {/* ── Preview ────────────────────────────────────── */}
        <div style={{ flex: '1 1 300px', minWidth: 0 }}>
          <div style={{ position: 'sticky', top: 32 }}>
            <div style={{ ...microLabel, fontSize: 10.5, letterSpacing: '0.2em', marginBottom: 14 }}>Preview</div>
            <div
              style={{
                aspectRatio: '16 / 10',
                borderRadius: 16,
                overflow: 'hidden',
                background: preview ? `#15120F url(${preview}) center/cover` : '#EDE6D8',
                border: `1px solid ${T.hair}`,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '16px 18px',
                position: 'relative',
              }}
            >
              {preview && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(to bottom, rgba(0,0,0,.25), rgba(0,0,0,.55))',
                  }}
                />
              )}
              <div
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span
                  style={{
                    fontFamily: T.mono,
                    fontSize: 9,
                    letterSpacing: '0.24em',
                    color: preview ? 'rgba(255,247,234,.82)' : '#A2957F',
                  }}
                >
                  GIFTSATS
                </span>
                <Bolt size={12} color={preview ? '#FFFDF8' : T.orangeDeep} />
              </div>
              <div
                style={{
                  position: 'relative',
                  fontFamily: T.mono,
                  fontSize: 26,
                  fontWeight: 500,
                  color: preview ? '#FFF' : T.ink,
                }}
              >
                21,000
              </div>
            </div>
            <p style={{ fontSize: 13.5, color: T.mutedWarm, marginTop: 14, lineHeight: 1.55 }}>
              Card text sits over the artwork, so keep the lower-left corner calm — that is where the amount and
              message land.
            </p>
          </div>
        </div>
      </div>
    </Page>
  );
}
