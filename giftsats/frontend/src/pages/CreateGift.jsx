import { useState, useRef, useEffect } from 'react';
import QRCode from 'qrcode';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

const LOGO_URL = '/logo.png';

const designs = [
  {
    id: 'classic',
    name: 'Classic Bitcoin',
    designer: 'GiftSats',
    emoji: '₿',
    bg: 'linear-gradient(160deg, #1a0a00 0%, #2d1200 40%, #1a0a00 100%)',
    accent: '#F7931A',
    textColor: '#fff',
    borderColor: '#F7931A44',
    patternColor: 'rgba(247,147,26,0.06)',
  },
  {
    id: 'midnight',
    name: 'Midnight Stack',
    designer: 'GiftSats',
    emoji: '⚡',
    bg: 'linear-gradient(160deg, #0a0a1a 0%, #0d0d2b 40%, #070714 100%)',
    accent: '#7B61FF',
    textColor: '#fff',
    borderColor: '#7B61FF44',
    patternColor: 'rgba(123,97,255,0.06)',
  },
  {
    id: 'emerald',
    name: 'Emerald Vault',
    designer: 'GiftSats',
    emoji: '🔐',
    bg: 'linear-gradient(160deg, #001a0d 0%, #002d18 40%, #001a0d 100%)',
    accent: '#00C97A',
    textColor: '#fff',
    borderColor: '#00C97A44',
    patternColor: 'rgba(0,201,122,0.06)',
  },
];

const SAT_PRESETS = [1000, 5000, 10000, 21000, 100000];
const EXCHANGE_RATE = 3500000; // THB per BTC approx
const FEE_PERCENT = 0.02;

const labelStyle = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  color: '#666',
  letterSpacing: 2,
  display: 'block',
  marginBottom: 10,
};

function satsToTHB(sats) {
  return ((sats / 100000000) * EXCHANGE_RATE).toFixed(2);
}

// Draw QR with logo in center on canvas
async function drawQRWithLogo(canvas, tokenValue, logoSrc) {
  const size = canvas.width;
  const ctx = canvas.getContext('2d');

  // Draw QR
  await QRCode.toCanvas(canvas, tokenValue || 'giftsats_placeholder', {
    width: size,
    margin: 1,
    errorCorrectionLevel: 'H',
    color: { dark: '#000000', light: '#ffffff' },
  });

  // Draw logo in center
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const logoSize = size * 0.22;
      const logoX = (size - logoSize) / 2;
      const logoY = (size - logoSize) / 2;

      // White circle bg behind logo
      ctx.save();
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, logoSize / 2 + 4, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.restore();

      // Draw logo (remove black bg by drawing with destination-out if needed)
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

export default function CreateGift() {
  const [selectedDesign, setSelectedDesign] = useState(0);
  const [amountSats, setAmountSats] = useState(21000);
  const [customAmount, setCustomAmount] = useState('');
  const [senderNote, setSenderNote] = useState('');
  const [status, setStatus] = useState('preview'); // preview | pay | ready
  const [invoice, setInvoice] = useState(null);
  const [giftCard, setGiftCard] = useState(null);
  const [countdown, setCountdown] = useState(600);
  const [polling, setPolling] = useState(false);
  const [toast, setToast] = useState(null);

  const cardRef = useRef(null);
  const qrCanvasRef = useRef(null);
  const timerRef = useRef(null);
  const pollRef = useRef(null);

  const design = designs[selectedDesign];
  const isReady = status === 'ready';
  const isPaying = status === 'pay';
  const feeSats = Math.ceil(amountSats * FEE_PERCENT);
  const totalSats = amountSats + feeSats;

  // Draw QR whenever token changes
  useEffect(() => {
    if (!qrCanvasRef.current) return;
    const token = isReady && giftCard?.cashuToken ? giftCard.cashuToken : 'giftsats_placeholder';
    drawQRWithLogo(qrCanvasRef.current, token, LOGO_URL);
  }, [isReady, giftCard]);

  // Countdown timer
  useEffect(() => {
    if (status !== 'pay') return;
    setCountdown(600);
    timerRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(timerRef.current);
          setStatus('preview');
          showToast('Invoice expired. Please try again.', 'error');
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
      const res = await fetch(`${BACKEND}/api/create-gift`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountSats, senderNote, designId: design.id }),
      });
      const data = await res.json();
      if (data.invoice) {
        setInvoice(data);
        setStatus('pay');
        startPolling(data.paymentHash);
      } else {
        showToast(data.error || 'Failed to create invoice', 'error');
      }
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  function startPolling(paymentHash) {
    setPolling(true);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${BACKEND}/api/check-payment/${paymentHash}`);
        const data = await res.json();
        if (data.paid) {
          clearInterval(pollRef.current);
          clearInterval(timerRef.current);
          setPolling(false);
          setGiftCard(data);
          setStatus('ready');
          showToast('Payment received! Your gift card is ready 🎉');
        }
      } catch {}
    }, 2000);
  }

  useEffect(() => () => {
    clearInterval(pollRef.current);
    clearInterval(timerRef.current);
  }, []);

  // Export as PNG
  async function handleDownloadPNG() {
    if (!cardRef.current) return;
    const { default: html2canvas } = await import('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.esm.js');
    const canvas = await html2canvas(cardRef.current, {
      backgroundColor: null,
      scale: 3,
      useCORS: true,
      allowTaint: true,
    });
    const link = document.createElement('a');
    link.download = `giftsats-${amountSats}sats.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  // Print
  function handlePrint() {
    window.print();
  }

  const mins = String(Math.floor(countdown / 60)).padStart(2, '0');
  const secs = String(countdown % 60).padStart(2, '0');

  return (
    <div style={{ maxWidth: 560 }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 24, right: 24, zIndex: 999,
          background: toast.type === 'error' ? '#2a0d0d' : '#0d1a0d',
          border: `1px solid ${toast.type === 'error' ? '#5a1a1a' : '#1a3a1a'}`,
          color: toast.type === 'error' ? '#ff6b6b' : '#39ff14',
          fontFamily: 'var(--font-mono)', fontSize: 12,
          padding: '14px 20px', borderRadius: 10,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          maxWidth: 320,
        }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, letterSpacing: '-1px', margin: 0 }}>
          Create <span style={{ color: '#F7931A' }}>Gift Card</span>
        </h2>
        <p style={{ color: '#555', fontFamily: 'var(--font-mono)', fontSize: 12, marginTop: 8, marginBottom: 0 }}>
          Bitcoin gift cards powered by Cashu ⚡
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, alignItems: 'start' }}>

        {/* LEFT — Controls */}
        <div>
          {/* Design picker */}
          <div style={{ marginBottom: 24 }}>
            <span style={labelStyle}>CHOOSE DESIGN</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {designs.map((d, i) => (
                <button key={d.id} onClick={() => setSelectedDesign(i)} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 14px', borderRadius: 10,
                  background: selectedDesign === i ? '#1a1a1a' : 'transparent',
                  border: selectedDesign === i ? `1px solid ${d.accent}55` : '1px solid #222',
                  cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left',
                }}>
                  <span style={{ fontSize: 20 }}>{d.emoji}</span>
                  <div>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, color: selectedDesign === i ? d.accent : '#888' }}>{d.name}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#444' }}>by {d.designer}</div>
                  </div>
                  {selectedDesign === i && <div style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', background: d.accent }} />}
                </button>
              ))}
            </div>
          </div>

          {/* Amount */}
          <div style={{ marginBottom: 24 }}>
            <span style={labelStyle}>AMOUNT</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {SAT_PRESETS.map(p => (
                <button key={p} onClick={() => { setAmountSats(p); setCustomAmount(''); }} style={{
                  padding: '6px 12px', borderRadius: 8, fontSize: 12,
                  fontFamily: 'var(--font-mono)',
                  background: amountSats === p && !customAmount ? design.accent : 'transparent',
                  color: amountSats === p && !customAmount ? '#000' : '#666',
                  border: amountSats === p && !customAmount ? `1px solid ${design.accent}` : '1px solid #333',
                  cursor: 'pointer', transition: 'all 0.15s', fontWeight: 600,
                }}>
                  {p.toLocaleString()}
                </button>
              ))}
            </div>
            <input
              type="number"
              placeholder="Custom amount (sats)"
              value={customAmount}
              onChange={e => { setCustomAmount(e.target.value); setAmountSats(Number(e.target.value) || 0); }}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 8,
                background: '#111', border: '1px solid #333',
                color: '#fff', fontFamily: 'var(--font-mono)', fontSize: 13,
                outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Note */}
          <div style={{ marginBottom: 24 }}>
            <span style={labelStyle}>MESSAGE (OPTIONAL)</span>
            <textarea
              placeholder="Happy Birthday! 🎂"
              value={senderNote}
              onChange={e => setSenderNote(e.target.value)}
              rows={2}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 8,
                background: '#111', border: '1px solid #333',
                color: '#fff', fontFamily: 'var(--font-display)', fontSize: 13,
                outline: 'none', resize: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Fee breakdown */}
          <div style={{
            background: '#111', border: '1px solid #222', borderRadius: 10,
            padding: '14px 16px', marginBottom: 20, fontFamily: 'var(--font-mono)', fontSize: 12,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#555', marginBottom: 6 }}>
              <span>Gift amount</span><span style={{ color: '#aaa' }}>{amountSats.toLocaleString()} sats</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#555', marginBottom: 6 }}>
              <span>Service fee (2%)</span><span style={{ color: '#aaa' }}>{feeSats.toLocaleString()} sats</span>
            </div>
            <div style={{ borderTop: '1px solid #222', paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#888' }}>Total to pay</span>
              <span style={{ color: design.accent, fontWeight: 700 }}>{totalSats.toLocaleString()} sats</span>
            </div>
            <div style={{ marginTop: 6, color: '#444', fontSize: 10 }}>≈ ฿{satsToTHB(totalSats)} THB</div>
          </div>

          {/* CTA */}
          {status === 'preview' && (
            <button onClick={handleGenerate} style={{
              width: '100%', padding: '14px', borderRadius: 10,
              background: design.accent, color: '#000',
              fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15,
              border: 'none', cursor: 'pointer', transition: 'opacity 0.2s',
            }}
              onMouseEnter={e => e.target.style.opacity = '0.85'}
              onMouseLeave={e => e.target.style.opacity = '1'}
            >
              Generate Invoice ⚡
            </button>
          )}

          {/* Invoice QR + countdown */}
          {status === 'pay' && invoice && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: design.accent, marginBottom: 12 }}>
                ⏱ {mins}:{secs} remaining
              </div>
              <div style={{ background: '#fff', padding: 12, borderRadius: 10, display: 'inline-block', marginBottom: 12 }}>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(invoice.invoice)}`}
                  alt="Lightning Invoice QR"
                  style={{ display: 'block', width: 180, height: 180 }}
                />
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#555', wordBreak: 'break-all', marginBottom: 12 }}>
                {invoice.invoice?.slice(0, 40)}...
              </div>
              <button onClick={() => { navigator.clipboard.writeText(invoice.invoice); showToast('Copied!'); }} style={{
                padding: '8px 20px', borderRadius: 8, background: '#1a1a1a', border: '1px solid #333',
                color: '#aaa', fontFamily: 'var(--font-mono)', fontSize: 12, cursor: 'pointer',
              }}>
                Copy Invoice
              </button>
            </div>
          )}

          {/* Export buttons */}
          {status === 'ready' && (
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button onClick={handleDownloadPNG} style={{
                flex: 1, padding: '12px', borderRadius: 10,
                background: design.accent, color: '#000',
                fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13,
                border: 'none', cursor: 'pointer',
              }}>
                ↓ Download PNG
              </button>
              <button onClick={handlePrint} style={{
                flex: 1, padding: '12px', borderRadius: 10,
                background: '#1a1a1a', color: '#aaa',
                fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13,
                border: '1px solid #333', cursor: 'pointer',
              }}>
                🖨 Print
              </button>
            </div>
          )}
        </div>

        {/* RIGHT — Card Preview 1:2 portrait */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span style={{ ...labelStyle, marginBottom: 14 }}>CARD PREVIEW</span>

          <div
            ref={cardRef}
            style={{
              width: 220,
              height: 440,
              borderRadius: 18,
              overflow: 'hidden',
              border: `1px solid ${design.borderColor}`,
              display: 'flex',
              flexDirection: 'column',
              boxShadow: `0 0 40px ${design.accent}15`,
              position: 'relative',
            }}
          >
            {/* TOP HALF — Design */}
            <div style={{
              flex: 1,
              background: design.bg,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              padding: '20px 18px 16px',
              position: 'relative',
              overflow: 'hidden',
            }}>
              {/* Subtle pattern */}
              <div style={{
                position: 'absolute', inset: 0,
                backgroundImage: `radial-gradient(circle, ${design.patternColor} 1px, transparent 1px)`,
                backgroundSize: '18px 18px',
                pointerEvents: 'none',
              }} />

              {/* Top row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative' }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: design.accent, letterSpacing: 2, marginBottom: 3 }}>GIFTSATS</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 12, color: '#fff' }}>{design.name}</div>
                </div>
                <div style={{ fontSize: 22 }}>{design.emoji}</div>
              </div>

              {/* Center — amount */}
              <div style={{ position: 'relative', textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 30, fontWeight: 800, color: '#fff', lineHeight: 1 }}>
                  {amountSats.toLocaleString()}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: design.accent, marginTop: 4, letterSpacing: 1 }}>SATS</div>
                {senderNote ? (
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 8, fontStyle: 'italic' }}>
                    "{senderNote.slice(0, 40)}"
                  </div>
                ) : null}
              </div>

              {/* Bottom row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'rgba(255,255,255,0.3)' }}>by {design.designer}</div>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 8,
                  color: isReady ? '#39ff14' : 'rgba(255,255,255,0.3)',
                }}>
                  {isReady ? '✓ READY' : 'PREVIEW'}
                </div>
              </div>
            </div>

            {/* BOTTOM HALF — QR + Redeem info (lighter for print/fold) */}
            <div style={{
              height: 220,
              background: '#f8f5f0',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px 14px',
              gap: 10,
              position: 'relative',
            }}>
              {/* Dashed fold line hint */}
              <div style={{
                position: 'absolute', top: 0, left: 16, right: 16,
                borderTop: '1px dashed #ddd',
              }} />

              {/* QR with blur overlay */}
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <canvas
                  ref={qrCanvasRef}
                  width={120}
                  height={120}
                  style={{
                    borderRadius: 8,
                    filter: isReady ? 'none' : 'blur(6px)',
                    transition: 'filter 0.6s ease',
                    display: 'block',
                  }}
                />
                {!isReady && (
                  <div style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    gap: 4,
                  }}>
                    <div style={{ fontSize: 20 }}>🔒</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#999', textAlign: 'center' }}>
                      {isPaying ? 'Waiting payment...' : 'Pay to reveal'}
                    </div>
                  </div>
                )}
              </div>

              {/* Redeem instructions */}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#888', lineHeight: 1.6 }}>
                  Scan QR or visit
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#F7931A', fontWeight: 700 }}>
                  giftsats.com
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#aaa', lineHeight: 1.6, marginTop: 2 }}>
                  Enter Lightning address<br />to receive your sats ⚡
                </div>
              </div>

              {/* Powered by */}
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 7,
                color: '#ccc', letterSpacing: 1,
                borderTop: '1px solid #e8e4de',
                paddingTop: 6, width: '100%', textAlign: 'center',
              }}>
                POWERED BY BITCOIN ⚡ CASHU
              </div>
            </div>
          </div>

          {/* Print hint */}
          <div style={{ marginTop: 10, fontFamily: 'var(--font-mono)', fontSize: 10, color: '#444', textAlign: 'center' }}>
            พับครึ่งได้ • ปริ้น • ส่ง social
          </div>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          [data-printable], [data-printable] * { visibility: visible; }
          body { margin: 0; }
        }
      `}</style>
    </div>
  );
}
