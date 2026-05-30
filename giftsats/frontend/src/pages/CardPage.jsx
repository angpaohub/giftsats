import { useState, useRef, useEffect } from 'react';
import QRCode from 'qrcode';

const BACKEND = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || 'http://localhost:3001';
const LOGO_URL = '/logo.png';

const designs = [
  {
    id: 'classic',
    name: 'Bitcoin Classic',
    bg: 'linear-gradient(135deg, #F7931A 0%, #FF6B00 50%, #E8820A 100%)',
    accent: '#fff', accentAlt: 'rgba(255,255,255,0.7)',
    borderColor: '#F7931A', qrBg: '#111', qrBorder: '#2a1a00', qrAccent: '#F7931A',
    patternColor: 'rgba(255,255,255,0.07)', emoji: '₿',
  },
  {
    id: 'midnight',
    name: 'Midnight Stack',
    bg: 'linear-gradient(135deg, #1a0a3a 0%, #2d1060 50%, #1a0a3a 100%)',
    accent: '#a78bfa', accentAlt: 'rgba(167,139,250,0.7)',
    borderColor: '#7B61FF', qrBg: '#0d0a1a', qrBorder: '#1a1030', qrAccent: '#7B61FF',
    patternColor: 'rgba(167,139,250,0.07)', emoji: '⚡',
  },
  {
    id: 'emerald',
    name: 'Emerald Vault',
    bg: 'linear-gradient(135deg, #064e3b 0%, #065f46 50%, #064e3b 100%)',
    accent: '#6ee7b7', accentAlt: 'rgba(110,231,183,0.7)',
    borderColor: '#00C97A', qrBg: '#041a10', qrBorder: '#0a2a18', qrAccent: '#00C97A',
    patternColor: 'rgba(110,231,183,0.07)', emoji: '🔐',
  },
];

async function drawQRWithLogo(canvas, tokenValue, logoSrc) {
  const size = canvas.width;
  const ctx = canvas.getContext('2d');
  await QRCode.toCanvas(canvas, tokenValue, {
    width: size, margin: 1, errorCorrectionLevel: 'H',
    color: { dark: '#000000', light: '#ffffff' },
  });
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const logoSize = size * 0.22;
      const logoX = (size - logoSize) / 2;
      const logoY = (size - logoSize) / 2;
      ctx.save();
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, logoSize / 2 + 4, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, logoSize / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, logoX, logoY, logoSize, logoSize);
      ctx.restore();
      resolve();
    };
    img.onerror = () => resolve();
    img.src = logoSrc;
  });
}

export default function CardPage() {
  const id = window.location.pathname.split('/card/')[1];
  const [card, setCard] = useState(null);
  const [designData, setDesignData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lightningAddress, setLightningAddress] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [redeemStatus, setRedeemStatus] = useState(null);
  const qrCanvasRef = useRef(null);

  useEffect(() => {
    if (!id) { setError('Invalid link'); setLoading(false); return; }
    fetch(`${BACKEND}/api/gift/${id}`)
      .then(r => r.json())
      .then(async data => {
        if (data.error) { setError('Gift card not found'); return; }
        setCard(data);
        if (data.designId && !data.designId.startsWith('giftsats-')) {
          const res = await fetch(`${BACKEND}/api/designs/${data.designId}`);
          if (res.ok) setDesignData(await res.json());
        }
      })
      .catch(() => setError('Failed to load gift card'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!card?.cashuToken || !qrCanvasRef.current) return;
    // Small delay to ensure canvas is visible after designData sets background
    const timer = setTimeout(() => {
      drawQRWithLogo(qrCanvasRef.current, card.cashuToken, LOGO_URL);
    }, 50);
    return () => clearTimeout(timer);
  }, [card, designData]);

  async function handleRedeem() {
    if (!lightningAddress || !card?.cashuToken) return;
    setRedeeming(true);
    setRedeemStatus(null);
    try {
      const res = await fetch(`${BACKEND}/api/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cashuToken: card.cashuToken, lightningAddress, giftCardId: card.id }),
      });
      const data = await res.json();
      if (data.success) {
        setRedeemStatus({ ok: true, msg: `✓ ${data.amountSats.toLocaleString()} sats sent to ${lightningAddress}` });
      } else {
        let msg = data.error || 'Failed to redeem';
        if (res.status === 410 || msg.toLowerCase().includes('expired')) {
          msg = '⏳ This gift card has expired.';
        } else if (res.status === 409 || msg.toLowerCase().includes('already redeemed')) {
          msg = '✗ This gift card has already been redeemed.';
        }
        setRedeemStatus({ ok: false, msg });
      }
    } catch (e) {
      setRedeemStatus({ ok: false, msg: e.message });
    } finally {
      setRedeeming(false);
    }
  }

  const getDesign = () => {
    const designId = card?.designId || 'giftsats-classic';
    if (designId === 'giftsats-midnight') return designs[1];
    if (designId === 'giftsats-emerald') return designs[2];
    return designs[0];
  };

  const design = getDesign();
  const isReady = card?.status === 'minted';
  const isRedeemed = card?.status === 'redeemed';

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a' }}>
      <div style={{ fontFamily: 'var(--font-mono)', color: '#444', fontSize: 13 }}>Loading...</div>
    </div>
  );

  if (error) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a' }}>
      <div style={{ fontFamily: 'var(--font-mono)', color: '#ff6b6b', fontSize: 13 }}>{error}</div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 16px' }}>

      {/* Header */}
      <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32, textDecoration: 'none' }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #F7931A, #FF6B35)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>₿</div>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18 }}>Gift<span style={{ color: '#F7931A' }}>Sats</span></span>
      </a>

      <div style={{ width: '100%', maxWidth: 360 }}>

        {/* Card */}
        <div style={{ borderRadius: 20, overflow: 'hidden', border: `1px solid ${design.borderColor}55`, boxShadow: `0 0 60px ${design.borderColor}15`, marginBottom: 24 }}>

          {/* Top */}
          <div style={{
            background: designData?.imageUrl ? 'transparent' : design.bg,
            padding: '28px 24px 24px', position: 'relative', minHeight: 200,
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          }}>
            {designData?.imageUrl && (
              <img src={designData.imageUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            )}
            {designData?.imageUrl && (
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.25), rgba(0,0,0,0.55))' }} />
            )}
            {!designData?.imageUrl && (
              <div style={{ position: 'absolute', inset: 0, backgroundImage: `radial-gradient(circle, ${design.patternColor} 1.5px, transparent 1.5px)`, backgroundSize: '20px 20px' }} />
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative' }}>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: designData?.imageUrl ? 'rgba(255,255,255,0.7)' : design.accentAlt, letterSpacing: 3, marginBottom: 4 }}>GIFT SATS</div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, color: '#fff' }}>{designData ? designData.name : design.name}</div>
              </div>
              <div style={{ fontSize: 28 }}>{designData?.imageUrl ? '🎨' : design.emoji}</div>
            </div>
            <div style={{ position: 'relative', padding: '16px 0' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 48, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{card.amountSats.toLocaleString()}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: designData?.imageUrl ? 'rgba(255,255,255,0.7)' : design.accentAlt, marginTop: 4, letterSpacing: 2 }}>sats</div>
              {card.senderNote && <div style={{ fontFamily: 'var(--font-display)', fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 10, fontStyle: 'italic' }}>"{card.senderNote.slice(0, 50)}"</div>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(255,255,255,0.6)' }}>by GiftSats</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: isRedeemed ? '#aaa' : '#39ff14' }}>
                {isRedeemed ? '✓ REDEEMED' : isReady ? '✓ READY TO REDEEM' : '⏳ PENDING'}
              </div>
            </div>
          </div>

          {/* Bottom QR */}
          <div style={{ background: design.qrBg, borderTop: `1px solid ${design.qrBorder}`, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 20px 20px', gap: 12 }}>
            <div style={{ width: '60%', borderTop: `1px dashed ${design.qrAccent}33` }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: design.qrAccent, letterSpacing: 2 }}>REDEEM QR</span>
            <div style={{ background: '#fff', padding: 10, borderRadius: 10, filter: isReady ? 'none' : 'blur(7px)' }}>
              <canvas ref={qrCanvasRef} width={160} height={160} style={{ display: 'block', borderRadius: 4 }} />
            </div>
            <div style={{ background: '#161616', border: '1px solid #2a2a2a', borderRadius: 8, padding: '10px 16px', textAlign: 'center', width: '100%', boxSizing: 'border-box' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#444', marginBottom: 4, letterSpacing: 1 }}>TO REDEEM, PLEASE VISIT</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: '#e0e0e0', fontWeight: 700, letterSpacing: 1 }}>giftsats.org</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#3a3a3a', marginTop: 4 }}>Enter Lightning address to receive sats ⚡</div>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#333', letterSpacing: 1, borderTop: `1px solid ${design.qrBorder}`, paddingTop: 10, width: '100%', textAlign: 'center' }}>
              {card.id}
            </div>
          </div>
        </div>

        {/* Redeem form */}
        {isReady && !redeemStatus?.ok && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 11, color: '#444', lineHeight: 1.8 }}>
              To redeem, scan QR code at <span style={{ color: '#e0e0e0' }}>giftsats.org</span><br />
              or enter your Lightning address here
            </div>
            <input
              type="text"
              placeholder="your@lightning.address"
              value={lightningAddress}
              onChange={e => setLightningAddress(e.target.value)}
              style={{ width: '100%', padding: '12px 14px', borderRadius: 10, background: '#111', border: '1px solid #333', color: '#fff', fontFamily: 'var(--font-mono)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
            />
            <button
              onClick={handleRedeem}
              disabled={!lightningAddress || redeeming}
              style={{
                width: '100%', padding: '14px', borderRadius: 10,
                background: lightningAddress && !redeeming ? design.borderColor : '#1a1a1a',
                color: lightningAddress && !redeeming ? '#000' : '#444',
                fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15,
                border: 'none', cursor: lightningAddress && !redeeming ? 'pointer' : 'not-allowed',
              }}
            >
              {redeeming ? 'Sending sats...' : 'Redeem ⚡'}
            </button>
          </div>
        )}

        {isRedeemed && (
          <div style={{ padding: '14px', borderRadius: 10, background: '#111', border: '1px solid #222', fontFamily: 'var(--font-mono)', fontSize: 12, color: '#555', textAlign: 'center' }}>
            This gift card has been redeemed.
          </div>
        )}

        {redeemStatus && (
          <div style={{
            marginTop: 12, padding: '14px', borderRadius: 10,
            background: redeemStatus.ok ? '#0d1a0d' : '#1a0d0d',
            border: `1px solid ${redeemStatus.ok ? '#1a3a1a' : '#3a1a1a'}`,
            fontFamily: 'var(--font-mono)', fontSize: 12,
            color: redeemStatus.ok ? '#39ff14' : '#ff4444',
            lineHeight: 1.6,
          }}>
            {redeemStatus.msg}
          </div>
        )}
      </div>
    </div>
  );
}
