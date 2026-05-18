const labelStyle = { fontFamily: 'var(--font-mono)', fontSize: 11, color: '#666', letterSpacing: 2, display: 'block', marginBottom: 12 };

const steps = [
  {
    num: '01',
    title: 'Receive your gift card',
    desc: 'Your gift giver sends you a gift card — as a PNG to save, or a printed card. It contains a QR code and a unique code that holds your sats.',
    icon: '🎁',
  },
  {
    num: '02',
    title: 'Scan or paste the code',
    desc: 'Go to the "Redeem" tab on this site. Scan the QR code with your camera, or paste the code manually.',
    icon: '📷',
  },
  {
    num: '03',
    title: 'Enter your Lightning address',
    desc: 'Type in your Lightning address (e.g. you@walletofsatoshi.com). Sats will be sent directly to your wallet — no app install required.',
    icon: '⚡',
  },
  {
    num: '04',
    title: 'Receive your sats',
    desc: 'That\'s it. Sats arrive in your Lightning wallet instantly. Each gift card can only be redeemed once.',
    icon: '✅',
  },
];

const wallets = [
  { name: 'Wallet of Satoshi', desc: 'iOS & Android • Easiest Lightning wallet', link: 'https://www.walletofsatoshi.com', tag: 'RECOMMENDED' },
  { name: 'Phoenix', desc: 'iOS & Android • Self-custodial', link: 'https://phoenix.acinq.co', tag: 'SELF-CUSTODY' },
  { name: 'Breez', desc: 'iOS & Android • Non-custodial', link: 'https://breez.technology', tag: 'SELF-CUSTODY' },
  { name: 'Alby', desc: 'Browser extension • Web-native', link: 'https://getalby.com', tag: 'WEB' },
];

export default function HowItWorks() {
  return (
    <div style={{ maxWidth: 680 }}>
      <div style={{ marginBottom: 40 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, letterSpacing: '-1px', margin: 0 }}>
          How It <span style={{ color: '#F7931A' }}>Works</span>
        </h2>
        <p style={{ color: '#555', fontFamily: 'var(--font-mono)', fontSize: 12, marginTop: 8, marginBottom: 0 }}>
          Redeem your Bitcoin gift card in under a minute
        </p>
      </div>

      {/* Steps */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 48 }}>
        {steps.map((step, i) => (
          <div key={i} style={{ display: 'flex', gap: 20, padding: 24, background: '#111', border: '1px solid #1a1a1a', borderRadius: 12, alignItems: 'flex-start' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#F7931A', fontWeight: 700, minWidth: 28, paddingTop: 2 }}>{step.num}</div>
            <div style={{ fontSize: 26, minWidth: 36 }}>{step.icon}</div>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, marginBottom: 6, color: '#f0f0f0' }}>{step.title}</div>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#555', lineHeight: 1.7, margin: 0 }}>{step.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Compatible wallets */}
      <div style={{ marginBottom: 32 }}>
        <label style={labelStyle}>RECOMMENDED LIGHTNING WALLETS</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {wallets.map((w, i) => (
            <a key={i} href={w.link} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
              <div style={{ padding: 16, background: '#111', border: `1px solid ${i === 0 ? '#F7931A44' : '#2a2a2a'}`, borderRadius: 12, transition: 'border-color 0.2s', cursor: 'pointer', height: '100%', boxSizing: 'border-box' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#F7931A'}
                onMouseLeave={e => e.currentTarget.style.borderColor = i === 0 ? '#F7931A44' : '#2a2a2a'}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: '#f0f0f0' }}>{w.name}</div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: 1, color: w.tag === 'RECOMMENDED' ? '#F7931A' : '#555', border: `1px solid ${w.tag === 'RECOMMENDED' ? '#F7931A' : '#2a2a2a'}`, padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap' }}>
                    {w.tag}
                  </span>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#444' }}>{w.desc}</div>
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* Expiry note */}
      <div style={{ padding: 20, background: '#0d0d14', border: '1px solid #1a1a2e', borderRadius: 12, marginBottom: 16 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#7B61FF', letterSpacing: 2, marginBottom: 8 }}>⏳ EXPIRY</div>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: 13, color: '#4a4a6a', lineHeight: 1.6, margin: 0 }}>
          Gift cards are valid for <strong style={{ color: '#7B61FF' }}>30 days</strong> from the date of purchase. After that, expired cards can no longer be redeemed. If the sender provided a refund address, sats are automatically returned — otherwise they are forfeited.
        </p>
      </div>

      {/* Security note */}
      <div style={{ padding: 20, background: '#0d1a0d', border: '1px solid #1a3a1a', borderRadius: 12 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#39ff14', letterSpacing: 2, marginBottom: 8 }}>🔒 SECURITY</div>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: 13, color: '#4a8a4a', lineHeight: 1.6, margin: 0 }}>
          Each gift card can only be redeemed once. Keep your QR code safe — anyone who scans it first can claim the sats.
        </p>
      </div>
    </div>
  );
}
