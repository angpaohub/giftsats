import { useEffect, useState } from 'react';
import Page from '../components/Page.jsx';
import { T, microLabel, headline, sectionTitle } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { fmt } from '../lib/format.js';

const PRINCIPLES = [
  { n: '01', title: 'No accounts', body: 'Neither side signs up. The card is the only credential that matters.' },
  {
    n: '02',
    title: 'Custody stated once',
    body: 'We say where the sats sit, in one sentence, on every relevant screen.',
  },
  {
    n: '03',
    title: 'Designers get paid',
    body: 'Card fronts are work. The fee goes to the designer, not into a bundle.',
  },
  {
    n: '04',
    title: 'Boring money',
    body: 'No token, no yield, no referral maze. A gift card should be forgettable infrastructure.',
  },
];

const CONTACTS = [
  { k: 'Email', v: 'hello@giftsats.org', href: 'mailto:hello@giftsats.org' },
  { k: 'Support', v: 'help@giftsats.org', href: 'mailto:help@giftsats.org' },
];

export default function About() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.stats().then(setStats).catch(() => {});
  }, []);

  const minted = Number(stats?.minted_count || 0);
  const redeemed = Number(stats?.redeemed_count || 0);
  const expired = Number(stats?.expired_count || 0);
  const created = minted + redeemed + expired;
  const redemptionRate = created > 0 ? `${((redeemed / created) * 100).toFixed(1)}%` : '—';

  const NUMBERS = [
    { k: 'Cards created', v: created ? fmt(created) : '—' },
    { k: 'Sats gifted', v: stats ? fmt(stats.total_sats) : '—' },
    { k: 'Redeemed', v: redeemed ? fmt(redeemed) : '—' },
    { k: 'Redemption rate', v: redemptionRate },
    { k: 'Designs live', v: stats ? fmt(stats.active_designs) : '—' },
  ];

  return (
    <Page maxWidth={1080} title="About us">
      <div style={microLabel}>About us</div>
      <h1 style={{ ...headline, marginTop: 14, fontWeight: 400 }}>
        A gift card that is <em>actually</em> bitcoin.
      </h1>
      <p style={{ fontSize: 18, color: T.text2, marginTop: 20, maxWidth: 620, lineHeight: 1.6 }}>
        Most bitcoin gifting asks the receiver to make an account somewhere before they see a single sat. GiftSats
        does the opposite: the card carries everything it needs, and the sats leave for a Lightning address of the
        receiver’s choosing the moment they ask for them.
      </p>

      {/* ── Numbers ──────────────────────────────────────── */}
      <div
        style={{
          marginTop: 'clamp(40px, 6vw, 64px)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
          gap: 1,
          background: T.hair,
          border: `1px solid ${T.hair}`,
          borderRadius: 16,
          overflow: 'hidden',
        }}
      >
        {NUMBERS.map((s) => (
          <div key={s.k} style={{ background: T.surface, padding: '22px 20px' }}>
            <div style={{ ...microLabel, fontSize: 10, letterSpacing: '0.18em' }}>{s.k}</div>
            <div style={{ fontFamily: T.mono, fontSize: 26, marginTop: 12, letterSpacing: '-0.02em' }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* ── Principles ───────────────────────────────────── */}
      <div style={{ marginTop: 'clamp(40px, 6vw, 64px)' }}>
        <h2 style={sectionTitle}>What we hold to</h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
            gap: 24,
            marginTop: 24,
          }}
        >
          {PRINCIPLES.map((p) => (
            <div key={p.n}>
              <div style={{ fontFamily: T.mono, fontSize: 12, color: T.orangeDeep, letterSpacing: '0.14em' }}>
                {p.n}
              </div>
              <div style={{ fontFamily: T.serif, fontSize: 23, marginTop: 10 }}>{p.title}</div>
              <p style={{ fontSize: 15, color: T.text2, marginTop: 8, lineHeight: 1.6 }}>{p.body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Custody note ─────────────────────────────────── */}
      <div
        style={{
          marginTop: 'clamp(40px, 6vw, 64px)',
          background: T.inkDeep,
          color: '#F2EDE4',
          borderRadius: 20,
          padding: 'clamp(24px, 4vw, 36px)',
        }}
      >
        <div style={{ ...microLabel, color: T.orangeHover }}>Where the sats sit</div>
        <p style={{ fontSize: 17, marginTop: 14, maxWidth: 640, lineHeight: 1.6, color: '#C9BFB0' }}>
          Between the invoice settling and the card being redeemed, the sats are held on the GiftSats Lightning
          node — not in the receiver’s wallet, and not in an escrow you can inspect. That is custody, and it is
          why cards expire after 30 days rather than sitting forever.
        </p>
      </div>

      {/* ── Contacts ─────────────────────────────────────── */}
      <div style={{ marginTop: 'clamp(40px, 6vw, 64px)' }}>
        <h2 style={sectionTitle}>Reach us</h2>
        <div style={{ marginTop: 20 }}>
          {CONTACTS.map((c) => (
            <div
              key={c.k}
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 12,
                justifyContent: 'space-between',
                padding: '15px 0',
                borderTop: `1px solid ${T.hair}`,
              }}
            >
              <span style={{ ...microLabel, fontSize: 10.5, letterSpacing: '0.18em' }}>{c.k}</span>
              <a href={c.href} className="gs-link" style={{ fontFamily: T.mono, fontSize: 14 }}>
                {c.v}
              </a>
            </div>
          ))}
        </div>
      </div>
    </Page>
  );
}
