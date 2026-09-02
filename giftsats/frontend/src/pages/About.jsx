import { useEffect, useState } from 'react';
import Page from '../components/Page.jsx';
import { T } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { fmt, fmtCompact, formatDate } from '../lib/format.js';

const PRINCIPLES = [
  { n: '01', title: 'No accounts', body: 'Neither side signs up. The card is the only credential that matters.' },
  { n: '02', title: 'Single redemption', body: "A code works once. After that, it's just paper." },
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

const PERKS = [
  ['01', 'Custom design'],
  ['02', 'Custom expiry date'],
  ['03', 'Custom specially for your event'],
  ['04', 'Worldwide shipping'],
];

const CONTACTS = [
  { k: 'Email', v: 'giftsats.official@gmail.com', href: 'mailto:giftsats.official@gmail.com' },
  { k: 'Nostr', v: 'Coming soon', href: null },
];

const hair14 = 'rgba(27,23,20,.14)';

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
    { k: 'Sats gifted', v: stats ? fmtCompact(stats.total_sats) : '—' },
    { k: 'Redemption rate', v: redemptionRate },
    { k: 'Community designs live', v: stats ? fmt(stats.active_designs) : '—' },
    {
      k: 'Paid to designers',
      v: stats?.designer_payout_sats != null ? `${fmtCompact(stats.designer_payout_sats)} sats` : '—',
    },
  ];

  return (
    <Page title="About us">
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
          A gift card, <em style={{ fontStyle: 'italic' }}>not a lecture.</em>
        </div>
        <div style={{ fontSize: 15, color: T.text2, maxWidth: 380, lineHeight: 1.6 }}>
          I'm building the friendliest way to hand someone their first bitcoin.
        </div>
      </div>

      {/* Story + stats */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'clamp(30px, 4vw, 56px) clamp(30px, 5vw, 72px)', marginTop: 48 }}>
        <div style={{ flex: '1 1 520px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div style={{ fontFamily: T.serif, fontSize: 26, lineHeight: 1.35 }}>
            I started because handing someone sats over dinner turned into a twenty-minute conversation about seed
            phrases.
          </div>
          <p style={{ fontSize: 16, color: T.text2, lineHeight: 1.65 }}>
            In 2024 I tried to give my niece 100,000 sats for her birthday. It took an app install, a KYC queue, a
            failed transfer, and a promise to explain custody later. The gift got lost in the setup.
          </p>
          <p style={{ fontSize: 16, color: T.text2, lineHeight: 1.65 }}>
            So I made the thing I actually wanted: a card with an amount of Bitcoin and a QR for redeeming. I pay a
            Lightning invoice, the card is minted, and the Bitcoin is gifted. That's it!
          </p>
          <p style={{ fontSize: 16, color: T.text2, lineHeight: 1.65 }}>
            Redeeming isn't hard either. She scans the QR, types in a wallet address, and the sats land. No
            accounts on either side, nothing to explain until she asks.
          </p>
          <p style={{ fontSize: 16, color: T.text2, lineHeight: 1.65 }}>
            The marketplace came later, when people kept asking to use their own artwork. Designers publish a card
            front, set a fee, and get paid in sats each time someone chooses theirs — the same rails as the gifts.
          </p>
        </div>

        <div style={{ flex: '1 1 320px', maxWidth: '100%' }}>
          <div style={{ border: `1px solid ${hair14}`, borderRadius: 18, background: T.surface, padding: '30px 32px' }}>
            <div
              style={{
                fontFamily: T.mono,
                fontSize: 11,
                letterSpacing: '0.18em',
                color: T.muted,
                textTransform: 'uppercase',
              }}
            >
              Since launch
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', marginTop: 16 }}>
              {NUMBERS.map((s) => (
                <div
                  key={s.k}
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    gap: 18,
                    padding: '14px 0',
                    borderTop: `1px solid ${T.hair}`,
                  }}
                >
                  <span style={{ fontSize: 14.5, color: T.text2 }}>{s.k}</span>
                  <span style={{ fontFamily: T.mono, fontSize: 18 }}>{s.v}</span>
                </div>
              ))}
            </div>
            <div
              style={{
                fontFamily: T.mono,
                fontSize: 10.5,
                letterSpacing: '0.1em',
                color: T.mutedWarm,
                textTransform: 'uppercase',
                marginTop: 16,
              }}
            >
              Figures as of {formatDate(new Date())}
            </div>
          </div>
        </div>
      </div>

      {/* For teams & events */}
      <div
        style={{
          marginTop: 72,
          borderTop: `1px solid ${T.hair16}`,
          paddingTop: 44,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 64,
          alignItems: 'flex-start',
        }}
      >
        <div style={{ flex: '1 1 380px', minWidth: 0 }}>
          <div
            style={{
              fontFamily: T.mono,
              fontSize: 11,
              letterSpacing: '0.18em',
              color: T.orangeDeep,
              textTransform: 'uppercase',
            }}
          >
            For teams &amp; events
          </div>
          <div style={{ fontFamily: T.serif, fontSize: 34, lineHeight: 1.1, marginTop: 12 }}>
            Want a custom physical Bitcoin gift card?
          </div>
          <p style={{ fontSize: 16, lineHeight: 1.6, color: T.text2, marginTop: 16, maxWidth: 420 }}>
            Printed cards, made for your event and fulfilled on the GiftSats infrastructure.
          </p>
          <a
            href="#contact"
            className="gs-outline"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 9,
              marginTop: 26,
              color: T.ink,
              padding: '15px 26px',
              borderRadius: 999,
              fontWeight: 600,
              fontSize: 15,
              border: `1px solid ${T.hair16}`,
              textDecoration: 'none',
            }}
          >
            Contact us
          </a>
        </div>
        <div
          style={{
            flex: '1 1 460px',
            minWidth: 0,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
            gap: 1,
            background: T.hair16,
          }}
        >
          {PERKS.map(([n, label]) => (
            <div key={n} style={{ background: T.canvas, padding: '26px 24px' }}>
              <div
                style={{
                  fontFamily: T.mono,
                  fontSize: 11,
                  letterSpacing: '0.16em',
                  color: T.muted,
                  textTransform: 'uppercase',
                }}
              >
                {n}
              </div>
              <div style={{ fontSize: 17, fontWeight: 500, marginTop: 12 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Principles */}
      <div style={{ marginTop: 72, borderTop: `1px solid ${T.hair16}`, paddingTop: 44 }}>
        <div
          style={{
            fontFamily: T.mono,
            fontSize: 11,
            letterSpacing: '0.18em',
            color: T.muted,
            textTransform: 'uppercase',
          }}
        >
          Principles
        </div>
        <div style={{ fontFamily: T.serif, fontSize: 34, lineHeight: 1.1, marginTop: 12 }}>
          Four things I won't trade away
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 230px), 1fr))',
            gap: 22,
            marginTop: 30,
          }}
        >
          {PRINCIPLES.map((p) => (
            <div key={p.n} style={{ borderTop: `1px solid ${T.hair16}`, paddingTop: 20 }}>
              <div style={{ fontFamily: T.mono, fontSize: 12, color: T.orangeDeep }}>{p.n}</div>
              <div style={{ fontFamily: T.serif, fontSize: 23, lineHeight: 1.2, marginTop: 12 }}>{p.title}</div>
              <p style={{ fontSize: 14, color: T.text2, lineHeight: 1.55, marginTop: 10 }}>{p.body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Contact */}
      <div style={{ marginTop: 72 }}>
        <div
          id="contact"
          style={{
            maxWidth: 480,
            background: T.inkDeep,
            color: '#F2EDE4',
            borderRadius: 18,
            padding: '34px 36px',
            scrollMarginTop: 96,
          }}
        >
          <div
            style={{
              fontFamily: T.mono,
              fontSize: 11,
              letterSpacing: '0.18em',
              color: '#7C7060',
              textTransform: 'uppercase',
            }}
          >
            Contact
          </div>
          <div style={{ fontFamily: T.serif, fontSize: 28, lineHeight: 1.2, marginTop: 12 }}>Say hello</div>
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 18 }}>
            {CONTACTS.map((c) => (
              <div
                key={c.k}
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: 16,
                  padding: '13px 0',
                  borderTop: '1px solid rgba(255,255,255,.12)',
                }}
              >
                <span
                  style={{
                    fontFamily: T.mono,
                    fontSize: 10.5,
                    letterSpacing: '0.14em',
                    color: '#7C7060',
                    textTransform: 'uppercase',
                  }}
                >
                  {c.k}
                </span>
                {c.href ? (
                  <a href={c.href} style={{ fontFamily: T.mono, fontSize: 13, color: T.orangeHover }}>
                    {c.v}
                  </a>
                ) : (
                  <span style={{ fontFamily: T.mono, fontSize: 13, color: T.orangeHover }}>{c.v}</span>
                )}
              </div>
            ))}
          </div>
          <p style={{ fontSize: 13.5, color: '#A89A86', lineHeight: 1.6, marginTop: 18 }}>
            For a stuck redemption, include the card code.
          </p>
        </div>
      </div>
    </Page>
  );
}
