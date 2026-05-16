import { useState } from 'react';

const API = import.meta.env.VITE_API_URL || '';
const labelStyle = { fontFamily: 'var(--font-mono)', fontSize: 11, color: '#666', letterSpacing: 2, display: 'block', marginBottom: 12 };

export default function Wallet() {
  const [tab, setTab] = useState('redeem');
  const [cashuToken, setCashuToken] = useState('');
  const [lightningAddress, setLightningAddress] = useState('');
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lnAddress, setLnAddress] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [sendStatus, setSendStatus] = useState(null);
  const [sendLoading, setSendLoading] = useState(false);

  async function handleRedeem() {
    if (!cashuToken) return;
    setLoading(true);
    setStatus(null);
    try {
      // Extract gift card ID from token or let user paste ID directly
      const res = await fetch(`${API}/api/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cashuToken, lightningAddress: lightningAddress || undefined }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus({ ok: true, msg: lightningAddress ? `✓ Sent ${data.amountSats?.toLocaleString()} sats to ${lightningAddress}` : '✓ Redeemed successfully' });
        setCashuToken('');
        setLightningAddress('');
      } else {
        setStatus({ ok: false, msg: data.error || 'Redemption failed' });
      }
    } catch (e) {
      setStatus({ ok: false, msg: e.message });
    } finally {
      setLoading(false);
    }
  }

  async function handleSend() {
    if (!lnAddress || !sendAmount) return;
    setSendLoading(true);
    setSendStatus(null);
    try {
      const res = await fetch(`${API}/api/wallet/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lightningAddress: lnAddress, amountSats: Number(sendAmount) }),
      });
      const data = await res.json();
      if (data.success) {
        setSendStatus({ ok: true, msg: `✓ Sent ${Number(sendAmount).toLocaleString()} sats to ${lnAddress}` });
        setLnAddress('');
        setSendAmount('');
      } else {
        setSendStatus({ ok: false, msg: data.error || 'Send failed' });
      }
    } catch (e) {
      setSendStatus({ ok: false, msg: e.message });
    } finally {
      setSendLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 520 }}>
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, letterSpacing: '-1px' }}>
          Your <span style={{ color: '#F7931A' }}>Wallet</span>
        </h2>
        <p style={{ color: '#555', fontFamily: 'var(--font-mono)', fontSize: 12, marginTop: 8 }}>
          Redeem Cashu tokens • Send to any Lightning address
        </p>
      </div>

      {/* Info banner */}
      <div style={{ background: '#0d1020', border: '1px solid #1a1a3a', borderRadius: 12, padding: 16, marginBottom: 24 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#4a6a9a', letterSpacing: 2, marginBottom: 8 }}>HOW IT WORKS</div>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: 13, color: '#5a7ab5', lineHeight: 1.6 }}>
          Paste your Cashu token to redeem. You can send sats directly to any Lightning address (Wallet of Satoshi, Phoenix, etc.) or keep them in your Cashu wallet.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, background: '#111', borderRadius: 8, padding: 4 }}>
        {[
          { id: 'redeem', label: '🎁 Redeem Gift' },
          { id: 'send', label: '⚡ Send Sats' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: '10px', cursor: 'pointer',
            background: tab === t.id ? '#1a1a1a' : 'none',
            border: tab === t.id ? '1px solid #2a2a2a' : '1px solid transparent',
            borderRadius: 6, color: tab === t.id ? '#f0f0f0' : '#444',
            fontFamily: 'var(--font-display)', fontWeight: tab === t.id ? 600 : 400,
            fontSize: 13, transition: 'all 0.2s',
          }}>{t.label}</button>
        ))}
      </div>

      {tab === 'redeem' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={labelStyle}>CASHU TOKEN</label>
            <textarea
              value={cashuToken}
              onChange={e => setCashuToken(e.target.value)}
              placeholder="cashuA..."
              rows={4}
              style={{
                width: '100%', padding: '12px 14px', background: '#111',
                border: '1px solid #2a2a2a', borderRadius: 8, color: '#f0f0f0',
                fontSize: 12, fontFamily: 'var(--font-mono)', resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label style={labelStyle}>SEND TO LIGHTNING ADDRESS (OPTIONAL)</label>
            <input
              type="text"
              value={lightningAddress}
              onChange={e => setLightningAddress(e.target.value)}
              placeholder="you@walletofsatoshi.com"
              style={{ width: '100%', padding: '12px 14px', background: '#111', border: '1px solid #2a2a2a', borderRadius: 8, color: '#f0f0f0', fontSize: 13, fontFamily: 'var(--font-display)', boxSizing: 'border-box' }}
            />
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#333', marginTop: 6 }}>
              Leave empty to keep as Cashu token
            </div>
          </div>

          <button
            onClick={handleRedeem}
            disabled={loading || !cashuToken}
            style={{
              padding: '14px', borderRadius: 10, cursor: cashuToken ? 'pointer' : 'not-allowed',
              background: cashuToken ? 'linear-gradient(135deg, #F7931A, #FF6B35)' : '#1a1a1a',
              color: cashuToken ? '#000' : '#333', border: 'none',
              fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15, transition: 'all 0.2s',
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
              {status.msg}
            </div>
          )}
        </div>
      )}

      {tab === 'send' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={labelStyle}>LIGHTNING ADDRESS</label>
            <input
              type="text"
              value={lnAddress}
              onChange={e => setLnAddress(e.target.value)}
              placeholder="friend@walletofsatoshi.com"
              style={{ width: '100%', padding: '12px 14px', background: '#111', border: '1px solid #2a2a2a', borderRadius: 8, color: '#f0f0f0', fontSize: 13, fontFamily: 'var(--font-display)', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={labelStyle}>AMOUNT (SATS)</label>
            <input
              type="number"
              value={sendAmount}
              onChange={e => setSendAmount(e.target.value)}
              placeholder="1000"
              min={1}
              style={{ width: '100%', padding: '12px 14px', background: '#111', border: '1px solid #2a2a2a', borderRadius: 8, color: '#F7931A', fontSize: 18, fontFamily: 'var(--font-mono)', boxSizing: 'border-box' }}
            />
          </div>

          <button
            onClick={handleSend}
            disabled={sendLoading || !lnAddress || !sendAmount}
            style={{
              padding: '14px', borderRadius: 10, border: 'none',
              cursor: (lnAddress && sendAmount) ? 'pointer' : 'not-allowed',
              background: (lnAddress && sendAmount) ? 'linear-gradient(135deg, #F7931A, #FF6B35)' : '#1a1a1a',
              color: (lnAddress && sendAmount) ? '#000' : '#333',
              fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15, transition: 'all 0.2s',
            }}
          >
            {sendLoading ? 'Sending...' : 'Send ⚡'}
          </button>

          {sendStatus && (
            <div style={{
              padding: '14px', borderRadius: 10,
              background: sendStatus.ok ? '#0d1a0d' : '#1a0d0d',
              border: `1px solid ${sendStatus.ok ? '#1a3a1a' : '#3a1a1a'}`,
              fontFamily: 'var(--font-mono)', fontSize: 12,
              color: sendStatus.ok ? '#39ff14' : '#ff4444',
            }}>
              {sendStatus.msg}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
