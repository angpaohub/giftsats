import { Link } from 'react-router-dom';
import Page from '../components/Page.jsx';
import { T, Bolt, PrimaryButton } from '../components/ui.jsx';

const WALLETS = [
  {
    initial: 'W',
    name: 'Wallet of Satoshi',
    tag: 'Easiest',
    body: 'Custodial, one-tap setup. You get a Lightning address the second you install it.',
    meta: 'iOS · Android · custodial',
    href: 'https://www.walletofsatoshi.com/',
  },
  {
    initial: 'P',
    name: 'Phoenix',
    tag: 'Self-custody',
    body: 'Your keys, automatic channel management. Good if you plan to hold more than pocket change.',
    meta: 'iOS · Android · non-custodial',
    href: 'https://phoenix.acinq.co/',
  },
  {
    initial: 'B',
    name: 'Blink',
    tag: 'Beginner',
    body: 'Simple account with a @blink.sv address and a built-in stablesats option.',
    meta: 'iOS · Android · custodial',
    href: 'https://www.blink.sv/',
  },
];

const TRACKS = [
  {
    dark: false,
    title: 'How to create',
    href: '/create',
    ctaLabel: 'Create a gift card →',
    steps: [
      ['Pick a design', 'Use a GiftSats front, or paste a design code from the marketplace.'],
      ['Set the amount', 'Any amount from 1,000 sats. Add a message, a sender and a recipient name.'],
      ['Pay the invoice', 'A Lightning invoice appears. Pay from any wallet — no account, no signup.'],
      ['Share the card', 'The card is minted on settlement. Send the link, print the PDF, or hand over the QR.'],
    ],
  },
  {
    dark: true,
    title: 'How to redeem',
    href: '/redeem',
    ctaLabel: 'Redeem a card →',
    steps: [
      ['Open the card', 'Scan the QR on the back, or type the code at giftsats.org/redeem.'],
      ['Check the amount', 'The card shows the sats, the message, and the redeem-by date.'],
      ['Enter your Lightning address', 'Something like you@walletofsatoshi.com. No seed phrase, no login.'],
      ['Sats arrive', 'The payout is pushed instantly. The card is then marked as redeemed.'],
    ],
  },
];

const TERMS = [
  {
    value: '30 days',
    title: 'Redeem window',
    body: "The card is claimable until the printed redeem-by date. Unclaimed sats return to the sender's refund address.",
  },
  {
    value: '1,000+',
    title: 'Minimum amount',
    body: 'Cards start at 1,000 sats so the Lightning payout stays economical for the recipient.',
  },
  {
    value: '2%',
    title: 'Service fee',
    body: 'Charged on top of the gift amount at creation, plus a small network fee. The recipient always gets the full face value.',
  },
  {
    value: 'Once',
    title: 'Single redemption',
    body: 'A code can be claimed one time only. Once redeemed, the card is archived and the QR stops working.',
  },
  {
    value: 'No Register process',
    title: 'No account',
    body: 'Nothing to sign up for on either side. The code is the bearer instrument — treat it like cash.',
  },
  {
    value: 'Bearer',
    title: 'Whoever holds it',
    body: "Anyone with the code can redeem it. Share the link privately and don't post the QR publicly.",
  },
];

const hair14 = 'rgba(27,23,20,.14)';

export default function HowItWorks() {
  return (
    <Page title="How it works">
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
          How it <em style={{ fontStyle: 'italic' }}>works.</em>
        </div>
      </div>

      {/* Lightning address */}
      <div style={{ marginTop: 44 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24 }}>
          <div
            style={{
              fontFamily: T.serif,
              fontSize: 34,
              lineHeight: 1.1,
            }}
          >
            First of all, you have to get a <em style={{ fontStyle: 'italic' }}>Lightning Address.</em>
          </div>
          <div style={{ fontSize: 14.5, color: T.text2, maxWidth: 400, lineHeight: 1.6 }}>
            It looks like an email address, for example, "<i>alice007@walletofsatoshi.com</i>". Any of these
            three wallets give you one in a couple of minutes. GiftSats is not affiliated with them.
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
            gap: 22,
            marginTop: 30,
          }}
        >
          {WALLETS.map((w) => (
            <a
              key={w.name}
              href={w.href}
              target="_blank"
              rel="noopener noreferrer"
              className="gs-tile"
              style={{
                border: `1px solid ${hair14}`,
                borderRadius: 16,
                padding: '22px 24px',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                color: 'inherit',
                textDecoration: 'none',
                transition: 'border-color .15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                  <span
                    style={{
                      width: 34,
                      height: 34,
                      flex: '0 0 34px',
                      borderRadius: 10,
                      background: T.inkDeep,
                      color: T.orange,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: T.mono,
                      fontSize: 14,
                    }}
                  >
                    {w.initial}
                  </span>
                  <span style={{ fontFamily: T.serif, fontSize: 22, lineHeight: 1.1 }}>{w.name}</span>
                </div>
                <span
                  style={{
                    fontFamily: T.mono,
                    fontSize: 10,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: T.text2,
                    border: `1px solid ${T.hair16}`,
                    borderRadius: 999,
                    padding: '5px 10px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {w.tag}
                </span>
              </div>
              <div style={{ fontSize: 14, color: T.text2, lineHeight: 1.55 }}>{w.body}</div>
              <div
                style={{
                  fontFamily: T.mono,
                  fontSize: 11,
                  letterSpacing: '0.1em',
                  color: T.muted,
                  textTransform: 'uppercase',
                  borderTop: `1px solid ${T.hair}`,
                  paddingTop: 12,
                }}
              >
                {w.meta}
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* Create / redeem tracks */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 32, marginTop: 56 }}>
        {TRACKS.map((t) => (
          <div
            key={t.title}
            style={{
              flex: '1 1 420px',
              minWidth: 0,
              borderRadius: 20,
              padding: '34px 36px 30px',
              background: t.dark ? T.inkDeep : T.surface,
              color: t.dark ? '#F2EDE4' : T.ink,
              border: t.dark ? 'none' : `1px solid ${hair14}`,
            }}
          >
            <div style={{ fontFamily: T.serif, fontSize: 34, lineHeight: 1.1 }}>{t.title}</div>

            <div style={{ display: 'flex', flexDirection: 'column', marginTop: 26 }}>
              {t.steps.map(([stepTitle, stepBody], i) => (
                <div
                  key={stepTitle}
                  style={{
                    display: 'flex',
                    gap: 18,
                    padding: '18px 0',
                    borderTop: `1px solid ${t.dark ? 'rgba(255,255,255,.1)' : T.hair}`,
                  }}
                >
                  <span
                    style={{
                      fontFamily: T.mono,
                      fontSize: 12,
                      paddingTop: 3,
                      color: t.dark ? T.orangeHover : T.orangeDeep,
                    }}
                  >
                    0{i + 1}
                  </span>
                  <span style={{ flex: 1 }}>
                    <span style={{ display: 'block', fontWeight: 600, fontSize: 16.5 }}>{stepTitle}</span>
                    <span
                      style={{
                        display: 'block',
                        fontSize: 14.5,
                        lineHeight: 1.55,
                        marginTop: 6,
                        color: t.dark ? '#A89A86' : T.text2,
                      }}
                    >
                      {stepBody}
                    </span>
                  </span>
                </div>
              ))}
            </div>

            <Link
              to={t.href}
              style={{
                display: 'inline-flex',
                marginTop: 24,
                fontFamily: T.mono,
                fontSize: 12,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: t.dark ? T.orangeHover : T.orangeDeep,
              }}
            >
              {t.ctaLabel}
            </Link>
          </div>
        ))}
      </div>

      {/* Card terms */}
      <div style={{ marginTop: 72, borderTop: `1px solid ${T.hair16}`, paddingTop: 44 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24 }}>
          <div>
            <div
              style={{
                fontFamily: T.mono,
                fontSize: 11,
                letterSpacing: '0.18em',
                color: T.muted,
                textTransform: 'uppercase',
              }}
            >
              Card terms
            </div>
            <div style={{ fontFamily: T.serif, fontSize: 34, lineHeight: 1.1, marginTop: 12 }}>
              What the card guarantees
            </div>
          </div>
          <div style={{ fontSize: 14.5, color: T.text2, maxWidth: 400, lineHeight: 1.6 }}>
            Everything below is fixed at the moment your invoice settles and printed on the card back.
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
            gap: 22,
            marginTop: 30,
          }}
        >
          {TERMS.map((tm) => (
            <div
              key={tm.title}
              style={{
                border: `1px solid ${hair14}`,
                borderRadius: 16,
                background: T.surface,
                padding: '24px 26px',
              }}
            >
              <div style={{ fontFamily: T.mono, fontSize: 22, letterSpacing: '-0.01em', color: T.orangeDeep }}>
                {tm.value}
              </div>
              <div style={{ fontWeight: 600, fontSize: 15.5, marginTop: 14 }}>{tm.title}</div>
              <div style={{ fontSize: 14, color: T.text2, lineHeight: 1.55, marginTop: 8 }}>{tm.body}</div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 13.5, color: T.mutedWarm, marginTop: 18, lineHeight: 1.6, maxWidth: 760 }}>
          Sats are held in the platform's Lightning node until redemption. A card can be redeemed once; partial
          claims are not supported.
        </div>
      </div>

      {/* CTA banner */}
      <div
        style={{
          marginTop: 72,
          border: `1px solid ${hair14}`,
          borderRadius: 18,
          background: T.inkDeep,
          color: '#F2EDE4',
          padding: '38px 40px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 28,
        }}
      >
        <div style={{ maxWidth: 540 }}>
          <div
            style={{
              fontFamily: T.mono,
              fontSize: 11,
              letterSpacing: '0.18em',
              color: '#7C7060',
              textTransform: 'uppercase',
            }}
          >
            Still unsure?
          </div>
          <div style={{ fontFamily: T.serif, fontSize: 34, lineHeight: 1.1, marginTop: 12 }}>
            Send yourself a <em style={{ fontStyle: 'italic' }}>1,000 sats</em> card first.
          </div>
          <div style={{ fontSize: 15, color: '#A89A86', lineHeight: 1.6, marginTop: 14 }}>
            It costs a few cents and walks you through both halves — paying the invoice and claiming to a
            wallet.
          </div>
        </div>
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
