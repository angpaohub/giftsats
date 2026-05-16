const labelStyle = { fontFamily: 'var(--font-mono)', fontSize: 11, color: '#666', letterSpacing: 2, display: 'block', marginBottom: 12 };

const steps = [
  {
    num: '01',
    title: 'Receive your gift',
    desc: 'Your gift giver sends you a Cashu token — a string starting with "cashuA..." or a QR code. This token contains your sats.',
    icon: '🎁',
  },
  {
    num: '02',
    title: 'Redeem on this site',
    desc: 'Go to "Your Wallet" tab, paste the Cashu token, and optionally enter your Lightning address to receive sats directly.',
    icon: '🌐',
  },
  {
    num: '03',
    title: 'Or use a Cashu wallet',
    desc: 'You can also redeem directly in any Cashu-compatible wallet by pasting the token or scanning the QR code.',
    icon: '📱',
  },
];

const wallets = [
  { name: 'Minibits', desc: 'iOS & Android • Best Cashu wallet', link: 'https://www.minibits.cash', tag: 'RECOMMENDED' },
  { name: 'Wallet of Satoshi', desc: 'iOS & Android • For Lightning address', link: 'https://www.walletofsatoshi.com', tag: 'LIGHTNING' },
  { name: 'Cashu.me', desc: 'Web browser • No install needed', link: 'https://cashu.me', tag: 'WEB' },
  { name: 'Nutstash', desc: 'Web browser • Open source', link: 'https://nutstash.app', tag: 'WEB' },
];

export default function HowToRedeem() {
  return (
    <div style={{ maxWidth: 680 }}>
      <div style={{ marginBottom: 40 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, letterSpacing: '-1px' }}>
          How to <span style={{ color: '#F7931A' }}>Redeem</span>
        </h2>
        <p style={{ color: '#555', fontFamily: 'var(--font-mono)', fontSize: 12, marginTop: 8 }}>
          Three ways to claim your sats
        </p>
      </div>

      {/* Steps */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 48 }}>
        {steps.map((step, i) => (
          <div key={i} style={{
            display: 'flex', gap: 20, padding: 24,
            background: '#111', border: '1px solid #1a1a1a', borderRadius: 12,
            alignItems: 'flex-start',
          }}>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 11, color: '#F7931A',
              fontWeight: 700, minWidth: 28, paddingTop: 2,
            }}>{step.num}</div>
            <div style={{ fontSize: 28, minWidth: 40 }}>{step.icon}</div>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{step.title}</div>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#555', lineHeight: 1.7 }}>{step.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Compatible wallets */}
      <div>
        <label style={labelStyle}>COMPATIBLE WALLETS</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {wallets.map((w, i) => (
            <a key={i} href={w.link} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
              <div style={{
                padding: 16, background: '#111', border: '1px solid #2a2a2a', borderRadius: 12,
                transition: 'border-color 0.2s', cursor: 'pointer',
              }}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#F7931A'}
                onMouseLeave={e => e.currentTarget.style.borderColor = '#2a2a2a'}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: '#f0f0f0' }}>{w.name}</div>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: 1,
                    color: w.tag === 'RECOMMENDED' ? '#F7931A' : '#555',
                    border: `1px solid ${w.tag === 'RECOMMENDED' ? '#F7931A' : '#2a2a2a'}`,
                    padding: '2px 6px', borderRadius: 4,
                  }}>{w.tag}</span>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#444' }}>{w.desc}</div>
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* Note */}
      <div style={{ marginTop: 32, padding: 20, background: '#0d1a0d', border: '1px solid #1a3a1a', borderRadius: 12 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#39ff14', letterSpacing: 2, marginBottom: 8 }}>NOTE</div>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: 13, color: '#4a8a4a', lineHeight: 1.6 }}>
          Cashu tokens are bearer instruments — anyone with the token can redeem it. Keep your token safe and redeem it promptly. Tokens are one-time use only.
        </p>
      </div>
    </div>
  );
}
