import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Page from '../components/Page.jsx';
import QR from '../components/QR.jsx';
import { T, Bolt } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { fmt } from '../lib/format.js';

const SECTION = {
  maxWidth: 1280,
  margin: '0 auto',
};
const PAD_X = 'clamp(16px, 4vw, 64px)';

const STEPS = [
  { n: '01', title: 'Pick an amount', body: 'at least 1,000 sats. Add a note and your name.' },
  { n: '02', title: 'Pay the invoice', body: 'Lightning invoice settles in seconds. The card will be created.' },
  { n: '03', title: 'They redeem', body: 'Scan the QR, enter a Lightning address, sats arrive.' },
];

const PHYSICAL = [
  { n: '01', label: 'Custom design' },
  { n: '02', label: 'Custom expiry date' },
  { n: '03', label: 'Specially for your event' },
  { n: '04', label: 'Worldwide shipping' },
];

// The Contact us button on this page only — the footer and About still use the
// giftsats.org addresses.
const CONTACT_EMAIL = 'giftsats.official@gmail.com';

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

// Fires once, true forever after, the first time the observed node is
// (partly) on screen. Used to hold off the mascot bounce / step-card
// reveal until someone actually scrolls this far.
function useInView(threshold = 0.3) {
  const [inView, setInView] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || inView) return undefined;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setInView(true);
            obs.disconnect();
          }
        });
      },
      { threshold }
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [inView, threshold]);

  return [ref, inView];
}

/**
 * The piggy mascot for "What is Sats?" — hops into place once, the first
 * time it scrolls into view.
 */
function Mascot() {
  const [ref, bounce] = useInView(0.5);
  return (
    <div
      style={{
        position: 'relative',
        width: 200,
        height: 200,
        margin: '34px auto 0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          position: 'absolute',
          width: 220,
          height: 220,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(247,147,26,.2), transparent 72%)',
        }}
      />
      <div
        ref={ref}
        style={{
          width: 190,
          margin: '0 auto',
          transformOrigin: 'center bottom',
          animation: bounce ? 'gsMascotJump 1.05s cubic-bezier(.34,1.56,.64,1) 1' : undefined,
        }}
      >
        <svg viewBox="0 0 160 180" width="100%" height="100%">
          <defs>
            <clipPath id="gsBlobClip2">
              <ellipse cx={80} cy={92} rx={48} ry={52} />
            </clipPath>
          </defs>
          <ellipse cx={80} cy={164} rx={38} ry={7} fill="#1B1714" opacity={0.1} />
          <ellipse cx={60} cy={158} rx={13} ry={8} fill="#F7931A" />
          <ellipse cx={100} cy={158} rx={13} ry={8} fill="#F7931A" />
          <ellipse cx={34} cy={100} rx={9} ry={15} fill="#F7931A" transform="rotate(-15 34 100)" />
          <ellipse cx={122} cy={62} rx={9} ry={17} fill="#F7931A" transform="rotate(35 122 62)" />
          <ellipse cx={80} cy={92} rx={48} ry={52} fill="#F7931A" />
          <g clipPath="url(#gsBlobClip2)">
            <ellipse cx={98} cy={118} rx={46} ry={46} fill="#D9790E" opacity={0.55} />
          </g>
          <ellipse cx={62} cy={66} rx={14} ry={10} fill="#FFFFFF" opacity={0.22} />
          <polygon points="78,26 70,44 76,44 74,55 89,37 80,37 83,26" fill="#C77A12" />
          <path d="M64,88 Q71,80 78,88" stroke="#1B1714" strokeWidth={3.4} fill="none" strokeLinecap="round" />
          <path d="M84,88 Q91,80 98,88" stroke="#1B1714" strokeWidth={3.4} fill="none" strokeLinecap="round" />
          <path d="M66,110 Q80,123 101,104" stroke="#1B1714" strokeWidth={3.4} fill="none" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}

// Thousands groups after the first are set a shade lighter, and the separators
// lighter still, so a long number reads as a shape rather than a wall.
function Digits({ value }) {
  const groups = fmt(value).split(',');
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        fontFamily: T.mono,
        fontWeight: 500,
        fontSize: 'clamp(26px, 7.5vw, 50px)',
        lineHeight: 1,
        letterSpacing: '-0.03em',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {groups.map((group, i) => (
        <span key={i} style={{ display: 'contents' }}>
          {i > 0 && <span style={{ color: 'rgba(27,23,20,.28)' }}>,</span>}
          <span style={{ color: i === 0 ? T.ink : '#4A423A' }}>{group}</span>
        </span>
      ))}
    </div>
  );
}

const counterLabel = {
  fontFamily: T.mono,
  fontSize: 11,
  letterSpacing: '0.18em',
  color: T.muted,
  textTransform: 'uppercase',
};

/**
 * The hero card is marketing art, not a real card: a shorter body, a truncated
 * code and its own radii. The live card object lives in components/GiftCard.
 */
function HeroCard() {
  return (
    <div
      style={{
        position: 'relative',
        borderRadius: 26,
        overflow: 'hidden',
        boxShadow: '0 48px 90px -34px rgba(40,30,18,.45)',
        transform: 'rotate(-1.6deg)',
        animation: 'gsHeroCard 1.1s cubic-bezier(.22,1,.36,1) .18s both',
      }}
    >
      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          minHeight: 296,
          background: 'radial-gradient(125% 125% at 18% 8%, #2C2823 0%, #15120F 52%, #0B0907 100%)',
          color: '#F2EDE4',
          padding: 'clamp(22px,5vw,30px) clamp(22px,5vw,32px)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div
          style={{
            position: 'absolute',
            right: -56,
            top: -56,
            width: 220,
            height: 220,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(247,147,26,.22), transparent 70%)',
          }}
        />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: T.mono, fontSize: 12, letterSpacing: '0.24em', color: '#A89A86' }}>
            GIFTSATS
          </span>
          <Bolt size={20} color={T.orange} />
        </div>
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{ fontFamily: T.mono, fontWeight: 500, fontSize: 50, letterSpacing: '-0.02em', color: '#FFF' }}>
              21,000
            </span>
            <span style={{ fontFamily: T.mono, fontSize: 17, color: T.orangeHover }}>sats</span>
          </div>
          <div style={{ fontFamily: T.serif, fontStyle: 'italic', fontSize: 17, color: '#C9BFB0', marginTop: 14 }}>
            “Happy birthday — stay humble.”
          </div>
          <div style={{ fontFamily: T.serif, fontSize: 15, color: '#B5A997', marginTop: 10 }}>From Alice</div>
        </div>
      </div>

      <div style={{ position: 'relative', minHeight: 296, background: T.surfaceWarm, color: T.ink, padding: '22px 24px' }}>
        <div
          style={{
            position: 'absolute',
            inset: 15,
            border: `1px solid ${T.hair}`,
            borderRadius: 16,
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'relative',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '10px 28px 6px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%' }}>
            <div style={{ flex: 1, borderTop: '1px solid rgba(199,122,18,.35)' }} />
            <span style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: '0.26em', color: T.orangeDeep }}>
              REDEEM QR
            </span>
            <div style={{ flex: 1, borderTop: '1px solid rgba(199,122,18,.35)' }} />
          </div>

          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 'clamp(12px, 4vw, 18px)',
              width: '100%',
              padding: '16px 0',
            }}
          >
            <div
              style={{
                padding: 9,
                background: T.surfaceBright,
                borderRadius: 11,
                border: '1px solid rgba(27,23,20,.07)',
                boxShadow: '0 5px 14px rgba(40,30,18,.09)',
                flex: '0 0 auto',
              }}
            >
              <QR
                value="https://giftsats.org"
                size={88}
                light={T.surfaceBright}
                style={{ width: 'clamp(58px, 17vw, 88px)', height: 'clamp(58px, 17vw, 88px)' }}
              />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: T.serif, fontSize: 'clamp(18px, 5.2vw, 23px)', lineHeight: 1.15 }}>
                Scan to redeem
              </div>
              <div
                style={{
                  fontFamily: T.serif,
                  fontSize: 'clamp(10.5px, 2.9vw, 12px)',
                  color: T.text3,
                  lineHeight: 1.4,
                  marginTop: 9,
                }}
              >
                Enter your lightning address to receive sats
              </div>
            </div>
          </div>

          <div
            style={{
              width: '100%',
              borderTop: `1px solid ${T.hair}`,
              paddingTop: 12,
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              gap: 18,
            }}
          >
            <div>
              <div style={{ fontFamily: T.mono, fontSize: 8, letterSpacing: '0.2em', color: '#A2957F' }}>CODE</div>
              <div style={{ fontFamily: T.mono, fontSize: 9, color: '#6B6155', marginTop: 4 }}>
                51766a2d-954b-4858-b9f8
              </div>
            </div>
            <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
              <div style={{ fontFamily: T.mono, fontSize: 8, letterSpacing: '0.2em', color: '#A2957F' }}>
                REDEEM BY
              </div>
              <div style={{ fontFamily: T.mono, fontSize: 12, color: T.ink, marginTop: 4 }}>30 SEPT 2026</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  const [stats, setStats] = useState(null);
  const [stepsRef, stepsVisible] = useInView(0.3);

  useEffect(() => {
    api.stats().then(setStats).catch(() => {});
  }, []);

  const satsGiven = useCountUp(Number(stats?.total_sats || 0));
  const cardsCreated = useCountUp(
    Number(stats?.minted_count || 0) + Number(stats?.redeemed_count || 0) + Number(stats?.expired_count || 0)
  );

  return (
    <Page bare>
      {/* ── Hero ─────────────────────────────────────────── */}
      <section
        style={{
          ...SECTION,
          padding: `clamp(26px, 5vw, 56px) ${PAD_X} 0`,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 72,
          alignItems: 'center',
        }}
      >
        <div style={{ flex: '1 1 480px', minWidth: 0 }}>
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
            Give bitcoin to the one you <span style={{ fontStyle: 'italic' }}>love.</span>
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
            <Link
              to="/create"
              className="gs-cta-btn"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                color: T.ink,
                padding: '16px 28px',
                borderRadius: 999,
                fontWeight: 600,
                fontSize: 16,
                background: T.orange,
                boxShadow: '0 12px 24px -10px rgba(247,147,26,.6)',
              }}
            >
              <Bolt size={15} />
              Create a gift
            </Link>
            <Link
              to="/redeem"
              className="gs-outline"
              style={{
                padding: '16px 28px',
                borderRadius: 999,
                fontWeight: 500,
                fontSize: 16,
                color: T.ink,
                border: '1px solid rgba(27,23,20,.18)',
                transition: 'border-color .15s',
              }}
            >
              Redeem sats
            </Link>
          </div>

          {/* Counters */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'stretch',
              gap: '26px clamp(24px,5vw,52px)',
              marginTop: 56,
              borderTop: `1px solid ${T.hair}`,
              paddingTop: 32,
            }}
          >
            <div>
              <div style={counterLabel}>Given so far</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 14 }}>
                <Digits value={satsGiven} />
                <span style={{ fontFamily: T.mono, fontSize: 16, color: T.orangeDeep, letterSpacing: '0.02em' }}>
                  sats
                </span>
              </div>
              <div style={{ height: 2, width: 52, background: T.orange, marginTop: 16, borderRadius: 2 }} />
            </div>
            <div style={{ borderLeft: `1px solid ${T.hair}` }} />
            <div>
              <div style={counterLabel}>Cards created</div>
              <div style={{ marginTop: 14 }}>
                <Digits value={cardsCreated} />
              </div>
              <div style={{ fontSize: 14, color: '#6B6155', marginTop: 18 }}>and counting</div>
            </div>
          </div>
        </div>

        <div style={{ flex: '0 1 470px', minWidth: 320, maxWidth: 470 }}>
          <HeroCard />
        </div>
      </section>

      {/* ── What is Sats? / How it works, side by side ──────── */}
      <section id="how" style={{ ...SECTION, padding: `clamp(30px, 6vw, 64px) ${PAD_X} 0` }}>
        <div
          style={{
            borderTop: `1px solid ${T.hair}`,
            paddingTop: 56,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 64,
            alignItems: 'flex-start',
          }}
        >
          <div style={{ flex: '1 1 380px', minWidth: 0, textAlign: 'center' }}>
            <Mascot />
            <div
              style={{
                fontFamily: T.serif,
                fontSize: 'clamp(38px, 6vw, 58px)',
                lineHeight: 1.05,
                letterSpacing: '-0.02em',
                marginTop: 30,
              }}
            >
              What is <span style={{ fontStyle: 'italic', color: T.orangeDeep }}>“Sats” </span>?
            </div>
            <p
              style={{
                fontFamily: T.serif,
                fontSize: 20,
                lineHeight: 1.6,
                color: T.text2,
                margin: '20px auto 0',
                maxWidth: 440,
              }}
            >
              Short for “satoshi.” One bitcoin splits into 100,000,000 sats — the same way a dollar splits into
              cents.
            </p>
          </div>

          <div style={{ flex: '1 1 380px', minWidth: 0 }} ref={stepsRef}>
            <div
              style={{
                fontFamily: T.serif,
                fontSize: 'clamp(32px, 4vw, 44px)',
                lineHeight: 1.08,
                letterSpacing: '-0.015em',
                marginTop: 20,
              }}
            >
              Start to "Gift<span style={{ color: T.orangeDeep }}>sats</span>"
            </div>
            <div style={{ marginTop: 36, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {STEPS.map((s, i) => (
                <div
                  key={s.n}
                  style={{
                    display: 'flex',
                    gap: 18,
                    alignItems: 'flex-start',
                    padding: '22px 24px',
                    border: '1px solid rgba(27,23,20,.12)',
                    borderRadius: 16,
                    background: '#FBF9F4',
                    transition: `transform .2s ${i * 120}ms, box-shadow .2s, border-color .2s`,
                    opacity: stepsVisible ? 1 : 0,
                    transform: stepsVisible ? 'translateY(0)' : 'translateY(18px)',
                  }}
                >
                  <div
                    style={{
                      flex: '0 0 auto',
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      background: 'rgba(247,147,26,.14)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: T.mono,
                      fontSize: 13,
                      color: T.orangeDeep,
                    }}
                  >
                    {s.n}
                  </div>
                  <div>
                    <div style={{ fontFamily: T.serif, fontSize: 24 }}>{s.title}</div>
                    <p style={{ fontSize: 15, lineHeight: 1.6, color: T.text2, marginTop: 8 }}>{s.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Custom physical cards ──────────────────────────── */}
      <section style={{ ...SECTION, padding: `clamp(26px, 5vw, 56px) ${PAD_X} 0` }}>
        <div
          style={{
            borderTop: `1px solid ${T.hair}`,
            paddingTop: 40,
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
                fontSize: 12,
                letterSpacing: '0.18em',
                color: '#E08600',
                textTransform: 'uppercase',
              }}
            >
              For teams &amp; events
            </div>
            <h2
              style={{
                fontFamily: T.serif,
                fontWeight: 400,
                fontSize: 40,
                lineHeight: 1.08,
                letterSpacing: '-0.015em',
                marginTop: 18,
              }}
            >
              Want a custom physical Bitcoin gift card?
            </h2>
            <p style={{ fontSize: 16, lineHeight: 1.6, color: T.text2, marginTop: 18, maxWidth: 420 }}>
              Printed cards, made for your event and fulfilled on the GiftSats infrastructure.
            </p>
            <a
              href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Custom physical GiftSats cards')}`}
              className="gs-outline"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 9,
                marginTop: 28,
                color: T.ink,
                padding: '15px 26px',
                borderRadius: 999,
                fontWeight: 600,
                fontSize: 15,
                border: '1px solid rgba(27,23,20,.22)',
                transition: 'border-color .15s',
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
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 1,
              background: T.hair,
            }}
          >
            {PHYSICAL.map((p) => (
              <div key={p.n} style={{ background: T.canvas, padding: '26px 24px' }}>
                <div
                  style={{
                    fontFamily: T.mono,
                    fontSize: 11,
                    letterSpacing: '0.16em',
                    color: T.muted,
                    textTransform: 'uppercase',
                  }}
                >
                  {p.n}
                </div>
                <div style={{ fontSize: 17, fontWeight: 500, marginTop: 12 }}>{p.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Closer ─────────────────────────────────────────── */}
      <section style={{ ...SECTION, padding: `40px ${PAD_X} clamp(48px, 7vw, 96px)` }}>
        <div
          style={{
            background: T.inkDeep,
            borderRadius: 26,
            padding: 'clamp(28px, 5vw, 56px) clamp(20px, 4.5vw, 60px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 48,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div style={{ fontFamily: T.serif, fontSize: 42, lineHeight: 1.08, color: '#FFF' }}>
              Give the world’s <span style={{ fontStyle: 'italic' }}>strongest money.</span>
            </div>
            <p style={{ fontSize: 16, color: '#A89A86', marginTop: 16, maxWidth: 460 }}>
              No account, no custody of anyone’s keys. Just a card and a Lightning address.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <Link
              to="/create"
              className="gs-cta-btn"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                background: T.orange,
                color: T.inkDeep,
                padding: '16px 28px',
                borderRadius: 999,
                fontWeight: 600,
                fontSize: 16,
              }}
            >
              Create a gift
            </Link>
            <Link
              to="/redeem"
              style={{
                padding: '16px 28px',
                borderRadius: 999,
                fontWeight: 500,
                fontSize: 16,
                color: '#F2EDE4',
                border: '1px solid rgba(255,255,255,.24)',
                transition: 'border-color .15s',
              }}
            >
              Redeem sats
            </Link>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 24,
            marginTop: 34,
            fontFamily: T.mono,
            fontSize: 11,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: T.muted,
          }}
        >
          <span>giftsats.org</span>
          <span>Powered by Lightning Network</span>
        </div>
      </section>
    </Page>
  );
}
