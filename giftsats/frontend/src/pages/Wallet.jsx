import { useState, useRef, useEffect, useCallback } from 'react';

const BACKEND = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || 'http://localhost:3001';

const labelStyle = {
  fontFamily: 'var(--font-mono)', fontSize: 11, color: '#555',
  letterSpacing: 2, display: 'block', marginBottom: 10,
};

function parseGiftCardId(token) {
  try {
    const base64 = token.replace('cashuA_', '');
    const decoded = JSON.parse(Buffer.from(base64, 'base64').toString());
    return decoded.giftCardId || null;
  } catch {
    return null;
  }
}

// Browser-compatible base64 decode
function b64decode(str) {
  try {
    return JSON.parse(atob(str));
  } catch {
    return null;
  }
}

export default function Wallet() {
  const [tab, setTab] = useState('redeem');
  const [cashuToken, setCashuToken] = useState('');
  const [lightningAddress, setLightningAddress] = useState('');
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [parsedGiftCardId, setParsedGiftCardId] = useState(null);

  // Send tab
  const [lnAddress, setLnAddress] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [sendStatus, setSendStatus] = useState(null);
  const [sendLoading, setSendLoading] = useState(false);

  // Camera scanner
  const [scanning, setScanning] = useState(false);
  const [camError, setCamError] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const jsQRRef = useRef(null);

  // Parse giftCardId whenever token changes
  useEffect(() => {
    if (!cashuToken) { setParsedGiftCardId(null); return; }
    try {
      const base64 = cashuToken.replace('cashuA_', '');
      const decoded = b64decode(base64);
      setParsedGiftCardId(decoded?.giftCardId || null);
    } catch {
      setParsedGiftCardId(null);
    }
  }, [cashuToken]);

  async function loadJsQR() {
    if (jsQRRef.current) return jsQRRef.current;
    const mod = await import('https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js');
    jsQRRef.current = mod.default || window.jsQR;
    return jsQRRef.current;
  }

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setScanning(false);
  }, []);

  async function startCamera() {
    setCamError(null);
    setScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        scanFrame();
      }
    } catch (e) {
      setCamError('ไม่สามารถเปิดกล้องได้ กรุณาอนุญาต permission ก่อนครับ');
      setScanning(false);
    }
  }

  async function scanFrame() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(scanFrame);
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    try {
      const jsQR = await loadJsQR();
      if (jsQR) {
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code?.data) {
          const val = code.data;
          if (val.startsWith('cashu') || val.startsWith('CASHU')) {
            setCashuToken(val);
            stopCamera();
            return;
          }
        }
      }
    } catch {}

    rafRef.current = requestAnimationFrame(scanFrame);
  }

  useEffect(() => () => stopCamera(), [stopCamera]);

  async function handleRedeem() {
    if (!cashuToken || !lightningAddress) return;
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch(`${BACKEND}/api/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cashuToken,
          lightningAddress,
          giftCardId: parsedGiftCardId,   // ← ส่ง giftCardId ไปด้วย
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus({ ok: true, msg: `✓ Sent ${data.amountSats} sats to ${lightningAddress}` });
        setCashuToken('');
        setParsedGiftCardId(null);
      } else {
        setStatus({ ok: false, msg: data.error || 'Failed to redeem' });
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
      const res = await fetch(`${BACKEND}/api/wallet/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lightningAddress: lnAddress, amountSats: Number(sendAmount) }),
      });
      const data = await res.json();
      if (data.success) {
        setSendStatus({ ok: true, msg: `✓ Sent ${sendAmount} sats to ${lnAddress}` });
        setSendAmount('');
      } else {
        setSendStatus({ ok: false, msg: data.error });
      }
    } catch (e) {
      setSendStatus({ ok: false, msg: e.message });
    } finally {
      setSendLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, letterSpacing: '-1px', margin: 0 }}>
          Your <span style={{ color: '#F7931A' }}>Wallet</span>
        </h2>
        <p style={{ color: '#555', fontFamily: 'var(--font-mono)', fontSize: 12, marginTop: 6, marginBottom: 0 }}>
          Redeem gift cards • Lightning-native
        </p>
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 28, background: '#111', borderRadius: 10, padding: 4 }}>
        {[['redeem', 'Redeem Cashu'], ['send', 'Send sats']].map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: '10px',
            background: tab === t ? '#1a1a1a' : 'none',
            border: tab === t ? '1px solid #2a2a2a' : '1px solid transparent',
            borderRadius: 8, color: tab === t ? '#f0f0f0' : '#444',
            fontFamily: 'var(--font-display)', fontWeight: tab === t ? 700 : 400,
            fontSize: 13, cursor: 'pointer', transition: 'all 0.2s',
          }}>{label}</button>
        ))}
      </div>

      {/* REDEEM TAB */}
      {tab === 'redeem' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <span style={labelStyle}>CASHU TOKEN</span>

          {scanning ? (
            <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', background: '#000', aspectRatio: '1/1' }}>
              <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} playsInline muted />
              <canvas ref={canvasRef} style={{ display: 'none' }} />
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                pointerEvents: 'none',
              }}>
                <div style={{
                  width: 200, height: 200,
                  border: '2px solid #F7931A',
                  borderRadius: 16,
                  boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
                }} />
                <div style={{
                  marginTop: 16, fontFamily: 'var(--font-mono)', fontSize: 12,
                  color: '#F7931A', background: 'rgba(0,0,0,0.6)',
                  padding: '6px 14px', borderRadius: 20,
                }}>
                  Scan the QR code on the gift card
                </div>
              </div>
              <button onClick={stopCamera} style={{
                position: 'absolute', top: 12, right: 12,
                background: 'rgba(0,0,0,0.7)', border: '1px solid #444',
                color: '#fff', borderRadius: 8, padding: '6px 12px',
                fontFamily: 'var(--font-mono)', fontSize: 12, cursor: 'pointer',
              }}>✕ ปิด</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={startCamera} style={{
                padding: '10px 16px', borderRadius: 10,
                background: '#1a1a1a', border: '1px solid #333',
                color: '#F7931A', fontFamily: 'var(--font-mono)', fontSize: 12,
                cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
              }}>
                📷 QR Scan
              </button>
              <textarea
                placeholder="or paste Cashu token here... cashuA..."
                value={cashuToken}
                onChange={e => setCashuToken(e.target.value)}
                rows={2}
                style={{
                  flex: 1, padding: '10px 14px', borderRadius: 10,
                  background: '#111', border: cashuToken ? '1px solid #F7931A55' : '1px solid #333',
                  color: '#fff', fontFamily: 'var(--font-mono)', fontSize: 11,
                  outline: 'none', resize: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
          )}

          {camError && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#ff6b6b', padding: '8px 12px', background: '#1a0d0d', borderRadius: 8, border: '1px solid #3a1a1a' }}>
              {camError}
            </div>
          )}

          {cashuToken && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#39ff14', padding: '8px 12px', background: '#0d1a0d', borderRadius: 8, border: '1px solid #1a3a1a' }}>
              ✓ Token พร้อมแล้ว {parsedGiftCardId ? `• Card ID: ${parsedGiftCardId.slice(0, 8)}...` : '⚠ ไม่พบ Card ID'}
            </div>
          )}

          <div>
            <span style={labelStyle}>LIGHTNING ADDRESS (REQUIRED)</span>
            <input
              type="text"
              placeholder="you@walletofsatoshi.com"
              value={lightningAddress}
              onChange={e => setLightningAddress(e.target.value)}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 10,
                background: '#111', border: '1px solid #333',
                color: '#fff', fontFamily: 'var(--font-mono)', fontSize: 13,
                outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          <button
            onClick={handleRedeem}
            disabled={!cashuToken || !lightningAddress || loading}
            style={{
              width: '100%', padding: '14px', borderRadius: 10,
              background: cashuToken && lightningAddress ? '#F7931A' : '#1a1a1a',
              color: cashuToken && lightningAddress ? '#000' : '#444',
              fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15,
              border: 'none', cursor: cashuToken && lightningAddress ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s',
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

      {/* SEND TAB */}
      {tab === 'send' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <span style={labelStyle}>LIGHTNING ADDRESS</span>
            <input
              type="text"
              placeholder="friend@walletofsatoshi.com"
              value={lnAddress}
              onChange={e => setLnAddress(e.target.value)}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 10,
                background: '#111', border: '1px solid #333',
                color: '#fff', fontFamily: 'var(--font-mono)', fontSize: 13,
                outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <span style={labelStyle}>AMOUNT (SATS)</span>
            <input
              type="number"
              placeholder="1000"
              value={sendAmount}
              onChange={e => setSendAmount(e.target.value)}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 10,
                background: '#111', border: '1px solid #333',
                color: '#fff', fontFamily: 'var(--font-mono)', fontSize: 13,
                outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          <button
            onClick={handleSend}
            disabled={!lnAddress || !sendAmount || sendLoading}
            style={{
              width: '100%', padding: '14px', borderRadius: 10,
              background: lnAddress && sendAmount ? '#F7931A' : '#1a1a1a',
              color: lnAddress && sendAmount ? '#000' : '#444',
              fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15,
              border: 'none', cursor: lnAddress && sendAmount ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s',
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
