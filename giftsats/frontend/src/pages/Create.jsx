import { useEffect, useState } from 'react';
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
const REDEEM_DAYS = 30;
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

// A mini version of the card front, used for the design swatches.
function Swatch({ art, active, onClick, name, author }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={active ? undefined : 'gs-tile'}
      style={{
        padding: '12px 12px 14px',
        borderRadius: 12,
        textAlign: 'left',
        background: T.surface,
        border: active ? `1.5px solid ${T.orange}` : `1px solid ${T.hair16}`,
        boxShadow: active ? '0 0 0 3px rgba(247,147,26,.14)' : 'none',
        transition: 'border-color .15s',
        flex: '1 1 130px',
        minWidth: 118,
      }}
    >
      <div
        style={{
          height: 74,
          borderRadius: 8,
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
      <div style={{ fontFamily: T.serif, fontSize: 16, marginTop: 9 }}>{name}</div>
      <div style={{ fontFamily: T.mono, fontSize: 10, color: T.muted, marginTop: 2 }}>{author}</div>
    </button>
  );
}

export default function Create() {
  const navigate = useNavigate();
  const [form, setForm] = useState(loadDraft);
  const [marketDesign, setMarketDesign] = useState(null);
  const [codeState, setCodeState] = useState('idle'); // idle | loading | ok | bad
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

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
  const total = amount + serviceFee + NETWORK_FEE_SATS + designFee;

  const designId = marketDesign ? marketDesign.id : form.designId;
  const art = resolveArt(designId, marketDesign);

  const amountOk = Number.isFinite(amount) && amount >= MIN_SATS;
  const refundOk = !form.refund.trim() || isLightningAddress(form.refund);
  const ready = amountOk && refundOk && !submitting;

  const hint = !amountOk
    ? `Minimum ${fmt(MIN_SATS)} sats.`
    : !refundOk
      ? 'That refund address does not look like a Lightning address.'
      : 'Nothing is charged until you pay the invoice.';

  async function handleSubmit() {
    if (!ready) return;
    setSubmitting(true);
    setError('');
    try {
      const data = await api.createGift({
        amountSats: amount,
        designCode: designId,
        senderNote: form.message.trim(),
        recipientName: form.to.trim(),
        senderName: form.from.trim(),
        senderLightningAddress: form.refund.trim() || undefined,
      });
      // Kept so a refresh (or a trip out to a wallet app) lands back on the invoice.
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
      <div style={{ ...microLabel }}>Step 1 of 2</div>
      <h1 style={{ ...headline, marginTop: 14, fontWeight: 400 }}>
        Create a <em>gift.</em>
      </h1>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'clamp(28px, 4vw, 56px)', marginTop: 40 }}>
        {/* ── Form ───────────────────────────────────────── */}
        <div style={{ flex: '1 1 420px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 30 }}>
          <div>
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
            <Input
              type="number"
              inputMode="numeric"
              min={MIN_SATS}
              placeholder="Custom amount in sats"
              value={form.custom}
              onChange={(e) => set({ custom: e.target.value, amount: Number(e.target.value) || 0 })}
              style={{ fontFamily: T.mono }}
            />
          </div>

          <div>
            <Label hint="or paste a design code from Explore">Design</Label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {BUILT_IN.map((d) => (
                <Swatch
                  key={d.id}
                  art={d}
                  name={d.name}
                  author={d.author}
                  active={!marketDesign && form.designId === d.id}
                  onClick={() => set({ designId: d.id, code: '' })}
                />
              ))}
            </div>
            <div style={{ marginTop: 12 }}>
              <Input
                placeholder="gfts-a3x9k"
                value={form.code}
                onChange={(e) => set({ code: e.target.value.trim() })}
                style={{ fontFamily: T.mono, fontSize: 14 }}
              />
              <div style={{ marginTop: 8, fontSize: 13, color: T.mutedWarm }}>
                {codeState === 'loading' && 'Looking up that code…'}
                {codeState === 'bad' && <span style={{ color: '#B3341E' }}>No design with that code.</span>}
                {codeState === 'ok' && marketDesign && (
                  <span style={{ color: T.successText }}>
                    {marketDesign.name} {marketDesign.designerName ? `· by ${marketDesign.designerName}` : ''}
                    {marketDesign.priceSats > 0 ? ` · +${fmt(marketDesign.priceSats)} sats` : ' · free'}
                  </span>
                )}
                {codeState === 'idle' && (
                  <>
                    Browse community fronts on <Link to="/explore">Explore</Link>.
                  </>
                )}
              </div>
            </div>
          </div>

          <div>
            <Label>Message</Label>
            <Textarea
              rows={3}
              maxLength={140}
              placeholder="Happy birthday — stay humble."
              value={form.message}
              onChange={(e) => set({ message: e.target.value })}
              style={{ fontFamily: T.serif, fontSize: 16 }}
            />
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ flex: '1 1 180px' }}>
              <Label>To</Label>
              <Input
                maxLength={40}
                placeholder="Ploy"
                value={form.to}
                onChange={(e) => set({ to: e.target.value })}
              />
            </div>
            <div style={{ flex: '1 1 180px' }}>
              <Label>From</Label>
              <Input
                maxLength={40}
                placeholder="Nan"
                value={form.from}
                onChange={(e) => set({ from: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label hint="optional">Refund address</Label>
            <Input
              placeholder="you@walletofsatoshi.com"
              value={form.refund}
              onChange={(e) => set({ refund: e.target.value })}
              style={{ fontFamily: T.mono, fontSize: 14 }}
            />
            <div style={{ marginTop: 8, fontSize: 13, color: T.mutedWarm, lineHeight: 1.5 }}>
              A card is redeemable for {REDEEM_DAYS} days. If nobody redeems it, the sats go back to this
              address — leave it blank and they are forfeited.
            </div>
          </div>

          {/* ── Summary ──────────────────────────────────── */}
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
            {[
              ['Gift amount', `${fmt(amount)} sats`],
              [`Service fee (${SERVICE_FEE_PERCENT}%)`, `${fmt(serviceFee)} sats`],
              ['Network fee', `${fmt(NETWORK_FEE_SATS)} sats`],
              ...(designFee > 0 ? [[`Design fee · ${marketDesign.name}`, `${fmt(designFee)} sats`]] : []),
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
              <span style={{ color: T.ink, fontWeight: 500 }}>Total</span>
              <span style={{ color: T.ink, fontWeight: 500 }}>{fmt(total)} sats</span>
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
