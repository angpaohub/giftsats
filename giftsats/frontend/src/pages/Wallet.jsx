import { useState } from 'react';

const API = import.meta.env.VITE_API_URL || '';

export default function Wallet() {
  const [tab, setTab] = useState('receive'); // receive | redeem
  const [giftCardId, setGiftCardId] = useState('');
  const [lightningAddress, setLightningAddress] = useState('');
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleRedeem() {
    if (!giftCardId) return;
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch(`${API}/api/gift/${giftCardId}/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lightningAddress: lightningAddress || undefined }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus({ ok: true, msg: lightningAddress ? `Sent to ${lightningAddress}` : 'Token received in wallet' });
      } else {
        setStatus({ ok: false, msg: data.error });
      }
    } catch (e) {
      setStatus({ ok: false, msg: e.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, letterSpacing: '-1px' }}>
          Your <span style={{ color: '#F7931A' }}>Wallet</span>
        </h2>
        <p style={{ color: '#555', fontFamily: 'var(--font-mono)', fontSize: 12, marginTop: 8 }}>
          Redeem gift cards • Lightning-native
        </p>
      </div>

      {/* Balance display (placeholder) */}
      <div style={{
        background: 'linear-gradient(135deg, #1a1a1a, #111)',
        border: '1px solid #2a2a2a', borderRadius: 16,
        padding: 28, marginBottom: 32,
      }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#444', letterSpacing: 2 }}>WALLET BALANCE</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 42, fontWeight: 700, color: '#F7931A', marginTop: 8 }}>
          0 <span style={{ fontSize: 16, color: '#555' }}>sats</span>
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#333', marginTop: 8 }}>
          full wallet coming soon • redeem below for now
        </div>
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, background: '#111', borderRadius: 8, padding: 4 }}>
        {['receive', 'redeem'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: '10px',
            background: tab === t ? '#1a1a1a' : 'none',
            border: tab === t ? '1px solid #2a2a2a' : '1px solid transparent',
            borderRadius: 6, color: tab === t ? '#f0f0f0' : '#444',
            fontFamily: 'var(--font-display)', fontWeight: tab === t ? 600 : 400,
            fontSize: 13, transition: 'all 0.2s',
          }}>
            {t === 'receive' ? '⬇ Receive' : '🎁 Redeem Gift Card'}
          </button>
        ))}
      </div>

      {tab === 'receive' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ padding: 20, background: '#111', border: '1px solid #2a2a2a', borderRadius: 12 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#555', marginBottom: 12 }}>YOUR LIGHTNING ADDRESS</div>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 14,
              color: '#F7931A', background: '#0a0a0a',
              padding: '12px 14px', borderRadius: 8,
              border: '1px solid #1a1a1a',
            }}>
              coming-soon@giftsats.app
            </div>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#333', marginTop: 12 }}>
              Personal Lightning addresses will be available when we launch on mainnet.
              For now, use "Redeem Gift Card" to send sats to any Lightning address.
            </p>
          </div>

          <div style={{ padding: 16, background: '#0d1a0d', border: '1px solid #1a3a1a', borderRadius: 10 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#39ff14', marginBottom: 8 }}>COMING SOON</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, color: '#4a8a4a' }}>
              CEX integration • Redeem directly to exchange account
            </div>
          </div>
        </div>
      )}

      {tab === 'redeem' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#666', letterSpacing: 2, display: 'block', marginBottom: 8 }}>
              GIFT CARD ID
            </label>
            <input
              type="text"
              value={giftCardId}
              onChange={e => setGiftCardId(e.target.value)}
              placeholder="paste gift card ID here"
              style={{
                width: '100%', padding: '12px 14px',
                background: '#111', border: '1px solid #2a2a2a',
                borderRadius: 8, color: '#f0f0f0', fontSize: 13,
              }}
            />
          </div>

          <div>
            <label style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#666', letterSpacing: 2, display: 'block', marginBottom: 8 }}>
              SEND TO (OPTIONAL)
            </label>
            <input
              type="text"
              value={lightningAddress}
              onChange={e => setLightningAddress(e.target.value)}
              placeholder="you@walletofsatoshi.com"
              style={{
                width: '100%', padding: '12px 14px',
                background: '#111', border: '1px solid #2a2a2a',
                borderRadius: 8, color: '#f0f0f0', fontSize: 13,
              }}
            />
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#333', marginTop: 6 }}>
              leave empty to keep sats in GiftSats wallet
            </div>
          </div>

          <button
            onClick={handleRedeem}
            disabled={loading || !giftCardId}
            style={{
              padding: '14px',
              background: giftCardId ? 'linear-gradient(135deg, #F7931A, #FF6B35)' : '#1a1a1a',
              color: giftCardId ? '#000' : '#333',
              borderRadius: 10, fontFamily: 'var(--font-display)',
              fontWeight: 800, fontSize: 15,
              transition: 'all 0.2s',
              cursor: giftCardId ? 'pointer' : 'not-allowed',
            }}
          >
            {loading ? 'Processing...' : 'Redeem ⚡'}
          </button>

          {status && (
            <div style={{
              padding: '14px', borderRadius: 10,
              background: status.ok ? '#0d1a0d' : '#1a0d0d',
              border: `1px solid ${status.ok ? '#1a3a1a' : '#3a1a1a'}`,
              fontFamily: 'var(--font-mono)', fontSize: 12,
              color: status.ok ? '#39ff14' : '#ff4444',
            }}>
              {status.ok ? '✓ ' : '✗ '}{status.msg}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
