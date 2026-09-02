import { Link } from 'react-router-dom';
import Page from '../components/Page.jsx';
import { T, Bolt, PrimaryButton, microLabel, headline, sectionTitle } from '../components/ui.jsx';

const TRACKS = [
  {
    n: '01',
    title: 'Buy',
    body: 'Pick an amount and a front, write a line, and pay one Lightning invoice. The card is minted the moment that invoice settles — not before.',
  },
  {
    n: '02',
    title: 'Share',
    body: 'You get a link and a code. Send the link, print the card, or hand over a screenshot. Whoever holds it can redeem it, so treat it like cash.',
  },
  {
    n: '03',
    title: 'Redeem',
    body: 'The receiver opens the link or scans the QR, gives any Lightning address, and the sats are paid out. No account on either side.',
  },
];

const GLOSSARY = [
  ['Sats', 'The smallest unit of bitcoin. 100,000,000 sats is one bitcoin.'],
  ['Lightning address', 'An address that looks like an email — you@wallet.com — that any wallet can receive to.'],
  ['Invoice', 'A one-off Lightning payment request. It expires in ten minutes if unpaid, and nothing is charged.'],
  ['Redeem code', 'The code printed on the back of a card. It is the card’s id — anyone holding it can redeem.'],
];

const WALLETS = [
  { name: 'Wallet of Satoshi', tags: ['iOS', 'Android', 'Custodial'] },
  { name: 'Phoenix', tags: ['iOS', 'Android', 'Self-custodial'] },
  { name: 'Alby', tags: ['Browser', 'Custodial'] },
  { name: 'Blink', tags: ['iOS', 'Android', 'Custodial'] },
];

export default function HowItWorks() {
  return (
    <Page maxWidth={1080} title="How it works">
      <div style={microLabel}>How it works</div>
      <h1 style={{ ...headline, marginTop: 14, fontWeight: 400 }}>
        Three steps, no <em>accounts.</em>
      </h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginTop: 44 }}>
        {TRACKS.map((t) => (
          <div
            key={t.n}
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 'clamp(16px, 4vw, 44px)',
              padding: 'clamp(24px, 4vw, 34px) 0',
              borderTop: `1px solid ${T.hair}`,
            }}
          >
            <div style={{ fontFamily: T.mono, fontSize: 14, color: T.orangeDeep, flex: '0 0 44px' }}>{t.n}</div>
            <div style={{ flex: '1 1 460px', minWidth: 0 }}>
              <div style={sectionTitle}>{t.title}</div>
              <p style={{ fontSize: 16, color: T.text2, marginTop: 12, lineHeight: 1.6, maxWidth: 620 }}>{t.body}</p>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 'clamp(40px, 6vw, 64px)' }}>
        <h2 style={sectionTitle}>Words you will meet</h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
            gap: 20,
            marginTop: 24,
          }}
        >
          {GLOSSARY.map(([term, meaning]) => (
            <div key={term} style={{ borderTop: `1px solid ${T.hair}`, paddingTop: 16 }}>
              <div style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: T.muted }}>
                {term}
              </div>
              <p style={{ fontSize: 15, color: T.text2, marginTop: 10, lineHeight: 1.55 }}>{meaning}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 'clamp(40px, 6vw, 64px)' }}>
        <h2 style={sectionTitle}>Wallets that work</h2>
        <p style={{ fontSize: 15.5, color: T.text2, marginTop: 12, maxWidth: 560, lineHeight: 1.6 }}>
          Any wallet with a Lightning address can receive a redeemed card. These are the ones people bring most
          often.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginTop: 24 }}>
          {WALLETS.map((w) => (
            <div
              key={w.name}
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 14,
                padding: '16px 0',
                borderTop: `1px solid ${T.hair}`,
              }}
            >
              <span
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  background: T.inkDeep,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flex: '0 0 auto',
                }}
              >
                <Bolt size={14} color={T.orange} />
              </span>
              <span style={{ fontSize: 16, fontWeight: 500, flex: '1 1 160px' }}>{w.name}</span>
              <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {w.tags.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      fontFamily: T.mono,
                      fontSize: 10,
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      border: `1px solid ${T.hair16}`,
                      borderRadius: 999,
                      padding: '5px 10px',
                      color: T.text2,
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 'clamp(40px, 6vw, 64px)' }}>
        <Link to="/create">
          <PrimaryButton>
            <Bolt size={15} />
            Create a test card
          </PrimaryButton>
        </Link>
      </div>
    </Page>
  );
}
