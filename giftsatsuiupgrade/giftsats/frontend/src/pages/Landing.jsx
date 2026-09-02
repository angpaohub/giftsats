import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Page from '../components/Page.jsx';
import GiftCard from '../components/GiftCard.jsx';
import { T, Bolt, PrimaryButton, GhostButton, microLabel, sectionTitle } from '../components/ui.jsx';
import { BUILT_IN } from '../lib/designs.js';
import { api } from '../lib/api.js';
import { fmt } from '../lib/format.js';

const VALUE_PROPS = [
  {
    n: '01',
    title: 'No accounts, either side',
    body: 'The sender pays an invoice. The receiver opens a link. Nobody signs up, nobody stores a password.',
  },
  {
    n: '02',
    title: 'Redeemed in seconds',
    body: 'The receiver pastes any Lightning address — a wallet, an exchange, a node — and the sats land there.',
  },
  {
    n: '03',
    title: 'Designers get paid per use',
    body: 'Card fronts are made by people. Their fee goes to their Lightning address the moment a card is minted.',
  },
];

// One animated counter, eased over 1100ms, run once on mount.
function useCountUp(target, duration = 1100) {
  const [value, setValue] = useState(0);
  const raf = useRef(null);

  useEffect(() => {
    if (!target) return undefined;
    const start = performance.now();
    const tick = () => {
      const t = Math.min(1, (performance.now() - start) / duration);
      setValue(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);

  return value;
}

function Counter({ label, value, unit }) {
  const shown = useCountUp(value);
  return (
    <div>
      <div style={{ ...microLabel, fontSize: 11 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 14 }}>
        <div
          style={{
            fontFamily: T.mono,
            fontWeight: 500,
            fontSize: 'clamp(34px, 9vw, 50px)',
            lineHeight: 1,
            letterSpacing: '-0.03em',
            fontVariantNumeric: 'tabular-nums',
            color: T.ink,
          }}
        >
          {fmt(shown)}
        </div>
        {unit && <span style={{ fontFamily: T.mono, fontSize: 16, color: T.orangeDeep }}>{unit}</span>}
      </div>
      <div style={{ height: 2, width: 52, background: T.orange, marginTop: 16, borderRadius: 2 }} />
    </div>
  );
}

export default function Landing() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.stats().then(setStats).catch(() => {});
  }, []);

  const satsGiven = Number(stats?.total_sats || 0);
  const cardsCreated =
    Number(stats?.minted_count || 0) + Number(stats?.redeemed_count || 0) + Number(stats?.expired_count || 0);

  return (
    <Page>
      {/* ── Hero ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'clamp(40px, 6vw, 72px)', alignItems: 'center' }}>
        <div style={{ flex: '1 1 460px', minWidth: 0 }}>
          <div
            style={{
              fontFamily: T.mono,
              fontSize: 12,
              letterSpacing: '0.18em',
              color: '#E08600',
              textTransform: 'uppercase',
            }}
          >
            Bitcoin gift cards
          </div>
          <h1
            style={{
              fontFamily: T.serif,
              fontWeight: 400,
              fontSize: 'clamp(46px, 6.2vw, 74px)',
              lineHeight: 0.98,
              letterSpacing: '-0.02em',
              marginTop: 20,
              animation: 'gsRise .85s cubic-bezier(.22,1,.36,1) both',
            }}
          >
            Give bitcoin to the one you <em>love.</em>
          </h1>
          <p
            style={{
              fontFamily: T.serif,
              fontSize: 20,
              lineHeight: 1.55,
              color: T.text2,
              marginTop: 26,
              maxWidth: 480,
              animation: 'gsRise .85s cubic-bezier(.22,1,.36,1) .12s both',
            }}
          >
            Give the world’s strongest money. Wrap up some sats as a card, hand it over, and whoever opens it
            redeems instantly to any Lightning address.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 38 }}>
            <Link to="/create">
              <PrimaryButton>
                <Bolt size={15} />
                Create a gift
              </PrimaryButton>
            </Link>
            <Link to="/redeem">
              <GhostButton style={{ padding: '16px 28px', fontSize: 16 }}>Redeem sats</GhostButton>
            </Link>
          </div>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '26px clamp(24px,5vw,52px)',
              marginTop: 56,
              borderTop: `1px solid ${T.hair}`,
              paddingTop: 32,
            }}
          >
            <Counter label="Given so far" value={satsGiven} unit="sats" />
            <div style={{ borderLeft: `1px solid ${T.hair}` }} />
            <Counter label="Cards created" value={cardsCreated} />
          </div>
        </div>

        <div style={{ flex: '1 1 380px', display: 'flex', justifyContent: 'center', minWidth: 0 }}>
          <GiftCard
            amount={21000}
            message="Happy birthday — stay humble."
            from="Alice"
            art={{ ...BUILT_IN[0], image: null, scrim: null }}
            code={null}
            expiresAt={new Date(Date.now() + 30 * 86400000).toISOString()}
            locked
            style={{ animation: 'gsCardIn .9s cubic-bezier(.22,1,.36,1) both' }}
          />
        </div>
      </div>

      {/* ── Value props ──────────────────────────────────── */}
      <div style={{ marginTop: 'clamp(56px, 8vw, 96px)' }}>
        <h2 style={sectionTitle}>
          A gift card that is <em style={{ fontStyle: 'italic' }}>actually</em> bitcoin.
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
            gap: 24,
            marginTop: 32,
          }}
        >
          {VALUE_PROPS.map((v) => (
            <div
              key={v.n}
              className="gs-tile"
              style={{
                background: T.surface,
                border: `1px solid ${T.hair}`,
                borderRadius: 16,
                padding: 24,
                transition: 'border-color .15s',
              }}
            >
              <div style={{ fontFamily: T.mono, fontSize: 12, color: T.orangeDeep, letterSpacing: '0.14em' }}>
                {v.n}
              </div>
              <div style={{ fontFamily: T.serif, fontSize: 23, marginTop: 12, lineHeight: 1.2 }}>{v.title}</div>
              <p style={{ fontSize: 15, lineHeight: 1.6, color: T.text2, marginTop: 10 }}>{v.body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Bottom strip ─────────────────────────────────── */}
      <div
        style={{
          marginTop: 'clamp(40px, 6vw, 72px)',
          paddingTop: 24,
          borderTop: `1px solid ${T.hair}`,
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          gap: 12,
          ...microLabel,
          fontSize: 11,
          letterSpacing: '0.16em',
        }}
      >
        <span>giftsats.org</span>
        <span>Powered by Lightning Network</span>
      </div>
    </Page>
  );
}
