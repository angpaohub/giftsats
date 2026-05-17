import { useState, useRef, useEffect } from 'react';
import QRCode from 'qrcode';

const BACKEND = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || 'http://localhost:3001';
const LOGO_URL = '/logo.png';

const designs = [
  {
    id: 'classic',
    name: 'Bitcoin Classic',
    designer: 'GiftSats',
    emoji: '₿',
    bg: 'linear-gradient(135deg, #F7931A 0%, #FF6B00 50%, #E8820A 100%)',
    accent: '#fff',
    accentAlt: 'rgba(255,255,255,0.7)',
    borderColor: '#F7931A',
    qrBg: '#111',
    qrBorder: '#2a1a00',
    qrAccent: '#F7931A',
    patternColor: 'rgba(255,255,255,0.07)',
  },
  {
    id: 'midnight',
    name: 'Midnight Stack',
    designer: 'GiftSats',
    emoji: '⚡',
    bg: 'linear-gradient(135deg, #1a0a3a 0%, #2d1060 50%, #1a0a3a 100%)',
    accent: '#a78bfa',
    accentAlt: 'rgba(167,139,250,0.7)',
    borderColor: '#7B61FF',
    qrBg: '#0d0a1a',
    qrBorder: '#1a1030',
    qrAccent: '#7B61FF',
    patternColor: 'rgba(167,139,250,0.07)',
  },
  {
    id: 'emerald',
    name: 'Emerald Vault',
    designer: 'GiftSats',
    emoji: '🔐',
    bg: 'linear-gradient(135deg, #064e3b 0%, #065f46 50%, #064e3b 100%)',
    accent: '#6ee7b7',
    accentAlt: 'rgba(110,231,183,0.7)',
    borderColor: '#00C97A',
    qrBg: '#041a10',
    qrBorder: '#0a2a18',
    qrAccent: '#00C97A',
    patternColor: 'rgba(110,231,183,0.07)',
  },
];

const SAT_PRESETS = [1000, 5000, 10000, 21000, 100000];
const EXCHANGE_RATE = 3500000;
const FEE_PERCENT = 0.02;

const labelStyle = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  color: '#555',
  letterSpacing: 2,
  display: 'block',
  marginBottom: 10,
};

function satsToTHB(sats) {
  return ((sats / 100000000) * EXCHANGE_RATE).toFixed(2);
}

async function drawQRWithLogo(canvas, tokenValue, logoSrc) {
  const size = canvas.width;
  const ctx = canvas.getContext('2d');
  await QRCode.toCanvas(canvas, tokenValue || 'giftsats_placeholder', {
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

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" && window.innerWidth < 640);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isMobile;
}

export default function CreateGift() {
  const [selectedDesign, setSelectedDesign] = useState(0);
  const [amountSats, setAmountSats] = useState(21000);
  const [customAmount, setCustomAmount] = useState('');
  const [senderNote, setSenderNote] = useState('');
  const [senderName, setSenderName] = useState('');
  const [status, setStatus] = useState('preview');
  const [invoice, setInvoice] = useState(null);
  const [giftCard, setGiftCard] = useState(null);
  const [countdown, setCountdown] = useState(600);
  const [toast, setToast] = useState(null);

  const cardRef = useRef(null);
  const qrCanvasRef = useRef(null);
  const timerRef = useRef(null);
  const pollRef = useRef(null);

  const isMobile = useIsMobile();
  const design = designs[selectedDesign];
  const isReady = status === 'ready';
  const isPaying = status === 'pay';
  const feeSats = Math.ceil(amountSats * FEE_PERCENT);
  const totalSats = amountSats + feeSats;

  useEffect(() => {
    if (!qrCanvasRef.current) return;
    const token = isReady && giftCard?.cashuToken ? giftCard.cashuToken : 'giftsats_placeholder';
    drawQRWithLogo(qrCanvasRef.current, token, LOGO_URL);
  }, [isReady, giftCard, selectedDesign]);

  useEffect(() => {
    if (status !== 'pay') return;
    setCountdown(600);
    timerRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(timerRef.current);
          setStatus('preview');
          showToast('Invoice expired. Try again.', 'error');
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [status]);

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  async function handleGenerate() {
    try {
      const res = await fetch(`${BACKEND}/api/gift/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountSats, senderNote, designId: design.id }),
      });
      const data = await res.json();
      if (data.paymentRequest) {
        setInvoice(data);
        setStatus('pay');
        startPolling(data.giftCardId);
      } else {
        showToast(data.error || 'Failed to create invoice', 'error');
      }
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  function startPolling(giftCardId) {
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${BACKEND}/api/gift/${giftCardId}`);
        const data = await res.json();
        if (data.status === 'minted') {
          clearInterval(pollRef.current);
          clearInterval(timerRef.current);
          setGiftCard(data);
          setStatus('ready');
          showToast('Payment received! Gift card ready 🎉');
        }
      } catch {}
    }, 2000);
  }

  useEffect(() => () => {
    clearInterval(pollRef.current);
    clearInterval(timerRef.current);
  }, []);

  async function handleDownloadPNG() {
    if (!cardRef.current) return;
    const { default: html2canvas } = await import('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.esm.js');
    const canvas = await html2canvas(cardRef.current, {
      backgroundColor: null, scale: 3, useCORS: true, allowTaint: true,
    });
    const link = document.createElement('a');
    link.download = `giftsats-${amountSats}sats.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  const mins = String(Math.floor(countdown / 60)).padStart(2, '0');
  const secs = String(countdown % 60).padStart(2, '0');

  return (
    <div style={{ maxWidth: 900 }}>
      {toast && (
        <div style={{
          position: 'fixed', top: 24, right: 24, zIndex: 999,
          background: toast.type === 'error' ? '#2a0d0d' : '#0d1a0d',
          border: `1px solid ${toast.type === 'error' ? '#5a1a1a' : '#1a3a1a'}`,
          color: toast.type === 'error' ? '#ff6b6b' : '#39ff14',
          fontFamily: 'var(--font-mono)', fontSize: 12,
          padding: '14px 20px', borderRadius: 10, maxWidth: 320,
        }}>{toast.msg}</div>
      )}

      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, letterSpacing: '-1px', margin: 0 }}>
          Create <span style={{ color: '#F7931A' }}>Gift Card</span>
        </h2>
        <p style={{ color: '#555', fontFamily: 'var(--font-mono)', fontSize: 12, marginTop: 6, marginBottom: 0 }}>
          Bitcoin gift cards powered by Cashu ⚡
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? 24 : 40, alignItems: 'start' }}>

        {/* LEFT — switches between: controls | invoice | done */}
        <div style={{ order: isMobile ? 2 : 1 }}>

          {/* PREVIEW STATE — controls */}
          {status === 'preview' && (<>
            <div style={{ marginBottom: 24 }}>
              <span style={labelStyle}>CHOOSE DESIGN</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {designs.map((d, i) => (
                  <button key={d.id} onClick={() => setSelectedDesign(i)} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 14px', borderRadius: 10,
                    background: selectedDesign === i ? '#1a1a1a' : 'transparent',
                    border: selectedDesign === i ? `1px solid ${d.borderColor}66` : '1px solid #222',
                    cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left',
                  }}>
                    <span style={{ fontSize: 20 }}>{d.emoji}</span>
                    <div>
                      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, color: selectedDesign === i ? d.borderColor : '#888' }}>{d.name}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#444' }}>by {d.designer}</div>
                    </div>
                    {selectedDesign === i && <div style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', background: d.borderColor }} />}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <span style={labelStyle}>AMOUNT</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {SAT_PRESETS.map(p => (
                  <button key={p} onClick={() => { setAmountSats(p); setCustomAmount(''); }} style={{
                    padding: '6px 12px', borderRadius: 8, fontSize: 12, fontFamily: 'var(--font-mono)',
                    background: amountSats === p && !customAmount ? design.borderColor : 'transparent',
                    color: amountSats === p && !customAmount ? '#000' : '#666',
                    border: amountSats === p && !customAmount ? `1px solid ${design.borderColor}` : '1px solid #333',
                    cursor: 'pointer', transition: 'all 0.15s', fontWeight: 600,
                  }}>{p.toLocaleString()}</button>
                ))}
              </div>
              <input type="number" placeholder="Custom amount (sats)" value={customAmount}
                onChange={e => { setCustomAmount(e.target.value); setAmountSats(Number(e.target.value) || 0); }}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 8, background: '#111', border: '1px solid #333', color: '#fff', fontFamily: 'var(--font-mono)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <span style={labelStyle}>MESSAGE (OPTIONAL)</span>
              <textarea placeholder="Happy Birthday! 🎂" value={senderNote}
                onChange={e => setSenderNote(e.target.value)} rows={2}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 8, background: '#111', border: '1px solid #333', color: '#fff', fontFamily: 'var(--font-display)', fontSize: 13, outline: 'none', resize: 'none', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <span style={labelStyle}>FROM (OPTIONAL)</span>
              <input
                type="text"
                placeholder="Sender Name"
                value={senderName}
                onChange={e => setSenderName(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 8, background: '#111', border: '1px solid #333', color: '#fff', fontFamily: 'var(--font-display)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ background: '#111', border: '1px solid #222', borderRadius: 10, padding: '14px 16px', marginBottom: 20, fontFamily: 'var(--font-mono)', fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#555', marginBottom: 6 }}>
                <span>Gift amount</span><span style={{ color: '#aaa' }}>{amountSats.toLocaleString()} sats</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#555', marginBottom: 6 }}>
                <span>Service fee (2%)</span><span style={{ color: '#aaa' }}>{feeSats.toLocaleString()} sats</span>
              </div>
              <div style={{ borderTop: '1px solid #222', paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#888' }}>Total to pay</span>
                <span style={{ color: design.borderColor, fontWeight: 700 }}>{totalSats.toLocaleString()} sats</span>
              </div>
              <div style={{ marginTop: 6, color: '#444', fontSize: 10 }}>≈ ฿{satsToTHB(totalSats)} THB</div>
            </div>

            <button onClick={handleGenerate} style={{
              width: '100%', padding: '14px', borderRadius: 10,
              background: design.borderColor, color: '#000',
              fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15,
              border: 'none', cursor: 'pointer',
            }}>Generate Invoice ⚡</button>
          </>)}

          {/* PAY STATE — invoice QR fills the whole left panel */}
          {status === 'pay' && invoice && (
            <div>
              <span style={labelStyle}>PAY LIGHTNING INVOICE</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, color: design.borderColor, fontWeight: 700 }}>⏱ {mins}:{secs}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#444' }}>remaining</div>
              </div>
              <div style={{ background: '#fff', padding: 16, borderRadius: 14, display: 'inline-block', marginBottom: 16 }}>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(invoice.paymentRequest)}`}
                  alt="Lightning Invoice QR"
                  style={{ display: 'block', width: isMobile ? 200 : 240, height: isMobile ? 200 : 240 }}
                />
              </div>
              <div style={{ background: '#111', border: '1px solid #222', borderRadius: 10, padding: '12px 14px', marginBottom: 14, fontFamily: 'var(--font-mono)', fontSize: 10, color: '#555', wordBreak: 'break-all', lineHeight: 1.6 }}>
                {invoice.paymentRequest?.slice(0, 80)}...
              </div>
              <div style={{ background: '#111', border: '1px solid #222', borderRadius: 10, padding: '12px 16px', marginBottom: 14, fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#555', marginBottom: 6 }}>
                  <span>You pay</span><span style={{ color: design.borderColor }}>{totalSats.toLocaleString()} sats</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#555' }}>
                  <span>Recipient gets</span><span style={{ color: '#39ff14' }}>{amountSats.toLocaleString()} sats</span>
                </div>
              </div>
              <button onClick={() => { navigator.clipboard.writeText(invoice.paymentRequest); showToast('Copied!'); }} style={{
                width: '100%', padding: '12px', borderRadius: 10,
                background: '#1a1a1a', border: '1px solid #333',
                color: '#aaa', fontFamily: 'var(--font-mono)', fontSize: 13, cursor: 'pointer', marginBottom: 12,
              }}>Copy Invoice</button>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#444', textAlign: 'center' }}>
                • Waiting for payment...
              </div>
            </div>
          )}

          {/* READY STATE — download/print */}
          {status === 'ready' && (
            <div>
              <span style={labelStyle}>GIFT CARD READY</span>
              <div style={{ background: '#0d1a0d', border: '1px solid #1a3a1a', borderRadius: 10, padding: '16px', marginBottom: 28, fontFamily: 'var(--font-mono)', fontSize: 13, color: '#39ff14' }}>
                ✓ Payment received! Your gift card is ready to share.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button onClick={handleDownloadPNG} style={{
                  width: '100%', padding: '14px', borderRadius: 10,
                  background: design.borderColor, color: '#000',
                  fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15,
                  border: 'none', cursor: 'pointer',
                }}>↓ Download PNG</button>
                <button onClick={() => window.print()} style={{
                  width: '100%', padding: '14px', borderRadius: 10,
                  background: '#1a1a1a', color: '#aaa',
                  fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14,
                  border: '1px solid #333', cursor: 'pointer',
                }}>🖨 Print</button>
                <button onClick={() => { setStatus('preview'); setInvoice(null); setGiftCard(null); }} style={{
                  width: '100%', padding: '12px', borderRadius: 10,
                  background: 'transparent', color: '#555',
                  fontFamily: 'var(--font-mono)', fontSize: 12,
                  border: '1px solid #222', cursor: 'pointer',
                }}>+ Create another gift card</button>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT — Card preview, always visible */}
        <div style={{ order: isMobile ? 1 : 2 }}>
          <span style={{ ...labelStyle, marginBottom: 16 }}>PREVIEW</span>
          <div ref={cardRef} style={{
            width: '100%', maxWidth: isMobile ? '100%' : 340, margin: '0 auto',
            borderRadius: 20, overflow: 'hidden',
            border: `1px solid ${design.borderColor}55`,
            display: 'flex', flexDirection: 'column',
            boxShadow: `0 0 60px ${design.borderColor}20`,
          }}>
            {/* TOP */}
            <div style={{
              background: design.bg,
              padding: '28px 24px 24px',
              display: 'flex', flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: 220, position: 'relative', overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', inset: 0, backgroundImage: `radial-gradient(circle, ${design.patternColor} 1.5px, transparent 1.5px)`, backgroundSize: '20px 20px', pointerEvents: 'none' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative' }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: design.accentAlt, letterSpacing: 3, marginBottom: 4 }}>GIFT SATS</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, color: design.accent }}>{design.name}</div>
                </div>
                <div style={{ fontSize: 28 }}>{design.emoji}</div>
              </div>
              <div style={{ position: 'relative', padding: '16px 0' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 48, fontWeight: 800, color: design.accent, lineHeight: 1 }}>{amountSats.toLocaleString()}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: design.accentAlt, marginTop: 4, letterSpacing: 2 }}>sats</div>
                {senderNote && <div style={{ fontFamily: 'var(--font-display)', fontSize: 12, color: design.accentAlt, marginTop: 10, fontStyle: 'italic' }}>"{senderNote.slice(0, 50)}"</div>}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: design.accentAlt }}>{senderName ? `from ${senderName}` : 'by GiftSats'}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: isReady ? '#39ff14' : design.accentAlt }}>{isReady ? '✓ READY TO SEND' : isPaying ? '⏳ AWAITING PAYMENT' : 'PREVIEW'}</div>
              </div>
            </div>

            {/* BOTTOM — dark QR section */}
            <div style={{
              background: design.qrBg,
              borderTop: `1px solid ${design.qrBorder}`,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', padding: '24px 20px 20px', gap: 12,
            }}>
              <div style={{ width: '60%', borderTop: `1px dashed ${design.qrAccent}33` }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: design.qrAccent, letterSpacing: 2 }}>CASHU REDEEM QR</span>
              <div style={{ position: 'relative' }}>
                <div style={{ background: '#fff', padding: 10, borderRadius: 10, filter: isReady ? 'none' : 'blur(7px)', transition: 'filter 0.6s ease' }}>
                  <canvas ref={qrCanvasRef} width={160} height={160} style={{ display: 'block', borderRadius: 4 }} />
                </div>
                {!isReady && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <div style={{ fontSize: 28 }}>🔒</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#888' }}>{isPaying ? 'Waiting payment...' : 'Pay to reveal'}</div>
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#555', lineHeight: 1.7 }}>Scan QR or visit</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: design.qrAccent, fontWeight: 700 }}>giftsats.com</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#555', lineHeight: 1.7 }}>Enter Lightning address to receive sats ⚡</div>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#333', letterSpacing: 1, borderTop: `1px solid ${design.qrBorder}`, paddingTop: 10, width: '100%', textAlign: 'center' }}>
                {isReady && giftCard?.id ? giftCard.id : 'POWERED BY BITCOIN ⚡ CASHU'}
              </div>
            </div>
          </div>
          <div style={{ marginTop: 12, fontFamily: 'var(--font-mono)', fontSize: 10, color: '#444', textAlign: 'center' }}>
      
          </div>
        </div>

      </div>
    </div>
  );
}
