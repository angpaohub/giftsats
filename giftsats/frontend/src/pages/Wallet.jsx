import { useState, useRef, useEffect, useCallback } from 'react';

const BACKEND = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || 'http://localhost:3001';

const labelStyle = {
  fontFamily: 'var(--font-mono)', fontSize: 11, color: '#555',
  letterSpacing: 2, display: 'block', marginBottom: 10,
};

function b64decode(str) {
  try { return JSON.parse(atob(str)); } catch { return null; }
}

// Load zxing-js — handles logo overlay QR codes
async function loadZxing() {
  const { BrowserMultiFormatReader } = await import('https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/+esm');
  return BrowserMultiFormatReader;
}

export default function Wallet() {
  const [cashuToken, setCashuToken] = useState('');
  const [lightningAddress, setLightningAddress] = useState('');
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [parsedGiftCardId, setParsedGiftCardId] = useState(null);

  // Camera
  const [scanning, setScanning] = useState(false);
  const [camError, setCamError] = useState(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const readerRef = useRef(null);

  // Image upload
  const fileInputRef = useRef(null);
  const [uploadError, setUploadError] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);

  useEffect(() => {
    if (!cashuToken) { setParsedGiftCardId(null); return; }
    try {
      const decoded = b64decode(cashuToken.replace('cashuA_', ''));
      setParsedGiftCardId(decoded?.giftCardId || null);
    } catch { setParsedGiftCardId(null); }
  }, [cashuToken]);

  const stopCamera = useCallback(() => {
    if (readerRef.current) {
      try { readerRef.current.reset(); } catch {}
      readerRef.current = null;
    }
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
      const BrowserMultiFormatReader = await loadZxing();
      const reader = new BrowserMultiFormatReader();
      readerRef.current = reader;

      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        reader.decodeFromVideoElement(videoRef.current, (result, err) => {
          if (result) {
            setCashuToken(result.getText());
            stopCamera();
          }
        });
      }
    } catch (e) {
      setCamError('Cannot access camera. Please allow camera permission.');
      setScanning(false);
    }
  }

  // Upload image and decode QR with zxing
  async function handleImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploadLoading(true);

    try {
      const BrowserMultiFormatReader = await loadZxing();
      const reader = new BrowserMultiFormatReader();

      const url = URL.createObjectURL(file);
      const img = new Image();
      img.src = url;
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });

      // Draw to canvas and decode
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext('2d').drawImage(img, 0, 0);
      URL.revokeObjectURL(url);

      const result = await reader.decodeFromCanvas(canvas);
      setCashuToken(result.getText());
    } catch {
      setUploadError('No QR code found in image. Try uploading the gift card PNG directly.');
    } finally {
      setUploadLoading(false);
      e.target.value = '';
    }
  }

  useEffect(() => () => stopCamera(), [stopCamera]);

  async function handleRedeem() {
    if (!cashuToken || !lightningAddress) return;
    setLoading(true); setStatus(null);
    try {
      const res = await fetch(`${BACKEND}/api/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cashuToken, lightningAddress, giftCardId: parsedGiftCardId }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus({ ok: true, msg: `✓ Sent ${data.amountSats} sats to ${lightningAddress}` });
        setCashuToken(''); setParsedGiftCardId(null);
      } else {
        let msg = data.error || 'Failed to redeem';
        if (res.status === 410 || msg.toLowerCase().includes('expired')) {
          msg = '⏳ This gift card has expired and can no longer be redeemed. If a refund address was provided, sats will be returned to the sender automatically.';
        } else if (res.status === 409 || msg.toLowerCase().includes('already redeemed')) {
          msg = '✗ This gift card has already been redeemed.';
        } else if (msg.toLowerCase().includes('not found')) {
          msg = '✗ Gift card not found. Please check the code and try again.';
        }
        setStatus({ ok: false, msg });
      }
    } catch (e) {
      setStatus({ ok: false, msg: e.message });
    } finally { setLoading(false); }
  }

  const canRedeem = cashuToken && lightningAddress && !loading;

  return (
    <div style={{ maxWidth: 480 }}>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, letterSpacing: '-1px', margin: 0 }}>
          <span style={{ color: '#F7931A' }}>Redeem</span>
        </h2>
        <p style={{ color: '#555', fontFamily: 'var(--font-mono)', fontSize: 12, marginTop: 6, marginBottom: 0 }}>
          Claim your sats • Lightning-native ⚡
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <span style={labelStyle}>GIFT CARD CODE</span>

        {scanning ? (
          <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', background: '#000', aspectRatio: '1/1' }}>
            <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} playsInline muted />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              <div style={{ width: 200, height: 200, border: '2px solid #F7931A', borderRadius: 16, boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)' }} />
              <div style={{ marginTop: 16, fontFamily: 'var(--font-mono)', fontSize: 12, color: '#F7931A', background: 'rgba(0,0,0,0.6)', padding: '6px 14px', borderRadius: 20 }}>
                Point at the QR code on the gift card
              </div>
            </div>
            <button onClick={stopCamera} style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(0,0,0,0.7)', border: '1px solid #444', color: '#fff', borderRadius: 8, padding: '6px 12px', fontFamily: 'var(--font-mono)', fontSize: 12, cursor: 'pointer' }}>
              ✕ Close
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={startCamera} style={{ padding: '10px 14px', borderRadius: 10, background: '#1a1a1a', border: '1px solid #333', color: '#F7931A', fontFamily: 'var(--font-mono)', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
              📷 Scan
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadLoading}
              style={{ padding: '10px 14px', borderRadius: 10, background: '#1a1a1a', border: '1px solid #333', color: '#F7931A', fontFamily: 'var(--font-mono)', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              {uploadLoading ? '⏳' : '🖼️ Upload'}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
            <textarea
              placeholder="or paste gift card code here..."
              value={cashuToken}
              onChange={e => setCashuToken(e.target.value)}
              rows={2}
              style={{ flex: 1, padding: '10px 14px', borderRadius: 10, background: '#111', border: cashuToken ? '1px solid #F7931A55' : '1px solid #333', color: '#fff', fontFamily: 'var(--font-mono)', fontSize: 11, outline: 'none', resize: 'none', boxSizing: 'border-box' }}
            />
          </div>
        )}

        {camError && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#ff6b6b', padding: '8px 12px', background: '#1a0d0d', borderRadius: 8, border: '1px solid #3a1a1a' }}>{camError}</div>
        )}
        {uploadError && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#ff6b6b', padding: '8px 12px', background: '#1a0d0d', borderRadius: 8, border: '1px solid #3a1a1a' }}>{uploadError}</div>
        )}

        {cashuToken && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#39ff14', padding: '8px 12px', background: '#0d1a0d', borderRadius: 8, border: '1px solid #1a3a1a' }}>
            ✓ Gift card loaded {parsedGiftCardId ? `• ID: ${parsedGiftCardId.slice(0, 8)}...` : ''}
          </div>
        )}

        <div>
          <span style={labelStyle}>YOUR LIGHTNING ADDRESS</span>
          <input
            type="text"
            placeholder="you@walletofsatoshi.com"
            value={lightningAddress}
            onChange={e => setLightningAddress(e.target.value)}
            style={{ width: '100%', padding: '10px 14px', borderRadius: 10, background: '#111', border: '1px solid #333', color: '#fff', fontFamily: 'var(--font-mono)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
          />
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#333', marginTop: 6 }}>
            Sats will be sent directly to this address
          </div>
        </div>

        <button onClick={handleRedeem} disabled={!canRedeem} style={{
          width: '100%', padding: '14px', borderRadius: 10,
          background: canRedeem ? '#F7931A' : '#1a1a1a',
          color: canRedeem ? '#000' : '#444',
          fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15,
          border: 'none', cursor: canRedeem ? 'pointer' : 'not-allowed', transition: 'all 0.2s',
        }}>
          {loading ? 'Processing...' : 'Redeem ⚡'}
        </button>

        {status && (
          <div style={{
            padding: '14px', borderRadius: 10,
            background: status.ok ? '#0d1a0d' : '#1a0d0d',
            border: `1px solid ${status.ok ? '#1a3a1a' : '#3a1a1a'}`,
            fontFamily: 'var(--font-mono)', fontSize: 12,
            color: status.ok ? '#39ff14' : '#ff4444',
            lineHeight: 1.6,
          }}>
            {status.msg}
          </div>
        )}
      </div>
    </div>
  );
}
