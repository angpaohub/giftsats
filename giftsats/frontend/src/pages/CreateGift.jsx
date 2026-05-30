import { useState, useRef, useEffect, useCallback } from 'react';
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

const SAT_PRESETS = [1000, 2100, 5000, 10000, 21000];
const MIN_SATS = 1000;
const BTC_USD_RATE = 103000; // approx, update periodically
const FEE_PERCENT = 0.02;

const labelStyle = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  color: '#555',
  letterSpacing: 2,
  display: 'block',
  marginBottom: 10,
};

function satsToUSD(sats) {
  return ((sats / 100_000_000) * BTC_USD_RATE).toFixed(2);
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
  const [amountSats, setAmountSats] = useState(1000);
  const [customAmount, setCustomAmount] = useState('');
  const [senderNote, setSenderNote] = useState('');
  const [senderName, setSenderName] = useState('');
  const [senderLightningAddress, setSenderLightningAddress] = useState('');
  const [networkFee, setNetworkFee] = useState(2);
  const [expiresAt, setExpiresAt] = useState(null);
  const [status, setStatus] = useState('preview');
  const [invoice, setInvoice] = useState(null);
  const [giftCard, setGiftCard] = useState(null);
  const [countdown, setCountdown] = useState(600);
  const [toast, setToast] = useState(null);

  const [designCode, setDesignCode] = useState('');
  const [designPreview, setDesignPreview] = useState(null);
  const [designLoading, setDesignLoading] = useState(false);
  const [designError, setDesignError] = useState('');
  const [platformStats, setPlatformStats] = useState(null);

  const cardRef = useRef(null);
  const qrCanvasRef = useRef(null);
  const timerRef = useRef(null);
  const pollRef = useRef(null);

  const isMobile = useIsMobile();
  const design = designs[selectedDesign];

  useEffect(() => {
    fetch(`${BACKEND}/api/stats`)
      .then(r => r.json())
      .then(data => setPlatformStats(data))
      .catch(() => {});
  }, []);

  // ── Save form draft while user is filling it in ──
  useEffect(() => {
    if (status !== 'preview') return;
    localStorage.setItem('giftsats_form', JSON.stringify({
      amountSats, selectedDesign, designCode,
      senderNote, senderName, senderLightningAddress,
      savedAt: Date.now(),
    }));
  }, [amountSats, selectedDesign, designCode, senderNote, senderName, senderLightningAddress, status]);

  // ── Restore form draft if no pending invoice ──
  useEffect(() => {
    if (localStorage.getItem('giftsats_pending')) return;
    const raw = localStorage.getItem('giftsats_form');
    if (!raw) return;
    try {
      const f = JSON.parse(raw);
      // Drop if older than 10 minutes
      if (f.savedAt && Date.now() - f.savedAt > 10 * 60 * 1000) {
        localStorage.removeItem('giftsats_form');
        return;
      }
      setAmountSats(f.amountSats ?? 1000);
      setSelectedDesign(f.selectedDesign ?? 0);
      setDesignCode(f.designCode ?? '');
      setSenderNote(f.senderNote ?? '');
      setSenderName(f.senderName ?? '');
      setSenderLightningAddress(f.senderLightningAddress ?? '');
    } catch {
      localStorage.removeItem('giftsats_form');
    }
  }, []);

  // ── Restore pending invoice if user left to pay in wallet ──
  useEffect(() => {
    const raw = localStorage.getItem('giftsats_pending');
    if (!raw) return;
    try {
      const p = JSON.parse(raw);
      // Drop if invoice expired (use invoiceExpiresAt, not card expiresAt)
      const invoiceExpiry = p.invoiceExpiresAt ?? (p.savedAt + 10 * 60 * 1000);
      if (Date.now() > invoiceExpiry) {
        localStorage.removeItem('giftsats_pending');
        return;
      }
      // Restore all form + invoice state
      setInvoice(p.invoice);
      setAmountSats(p.amountSats);
      setNetworkFee(p.networkFee ?? 2);
      setExpiresAt(p.expiresAt ?? null);
      setSelectedDesign(p.selectedDesign ?? 0);
      setDesignCode(p.designCode ?? '');
      setSenderNote(p.senderNote ?? '');
      setSenderName(p.senderName ?? '');
      setSenderLightningAddress(p.senderLightningAddress ?? '');
      setDesignPreview(p.designPreview ?? null);
      setStatus('pay');
      startPolling(p.giftCardId);
    } catch {
      localStorage.removeItem('giftsats_pending');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const isReady = status === 'ready';
  const isPaying = status === 'pay';
  const feeSats = Math.ceil(amountSats * FEE_PERCENT);
  const designFee = designPreview?.priceSats || 0;
  const totalSats = amountSats + feeSats + networkFee + designFee;

  useEffect(() => {
    if (!qrCanvasRef.current) return;
    const token = isReady && giftCard?.cashuToken ? giftCard.cashuToken : 'giftsats_placeholder';
    drawQRWithLogo(qrCanvasRef.current, token, LOGO_URL);
  }, [isReady, giftCard, selectedDesign]);

  useEffect(() => {
    if (status !== 'pay') return;
    // Calculate remaining seconds from invoiceExpiresAt (10 min window), fallback to 600
    const pending = localStorage.getItem('giftsats_pending');
    const invoiceExpiry = pending ? (JSON.parse(pending).invoiceExpiresAt ?? null) : null;
    const remaining = invoiceExpiry
      ? Math.max(0, Math.floor((invoiceExpiry - Date.now()) / 1000))
      : 600;
    setCountdown(remaining);
    timerRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(timerRef.current);
          localStorage.removeItem('giftsats_pending');
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
        body: JSON.stringify({ amountSats, senderNote, designCode: designCode.trim() || `giftsats-${designs[selectedDesign].id}`, senderLightningAddress: senderLightningAddress || undefined }),
      });
      const data = await res.json();
      if (data.paymentRequest) {
        setInvoice(data);
        setNetworkFee(data.networkFee ?? 2);
        setExpiresAt(data.expiresAt ?? null);
        setStatus('pay');
        // ── Persist so user can return after paying in wallet app ──
        localStorage.removeItem('giftsats_form');
        localStorage.setItem('giftsats_pending', JSON.stringify({
          giftCardId: data.giftCardId,
          invoice: data,
          amountSats,
          networkFee: data.networkFee ?? 2,
          expiresAt: data.expiresAt ?? null,
          invoiceExpiresAt: Date.now() + 10 * 60 * 1000,
          selectedDesign,
          designCode: designCode.trim(),
          senderNote,
          senderName,
          senderLightningAddress,
          designPreview,
        }));
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
          localStorage.removeItem('giftsats_pending');
          localStorage.removeItem('giftsats_form');
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

  useEffect(() => {
    const code = designCode.trim();
    if (!code) { setDesignPreview(null); setDesignError(''); return; }
    const timer = setTimeout(async () => {
      setDesignLoading(true);
      setDesignError('');
      try {
        const res = await fetch(`${BACKEND}/api/designs/${code}`);
        if (!res.ok) throw new Error('not found');
        const data = await res.json();
        setDesignPreview(data);
      } catch {
        setDesignPreview(null);
        setDesignError('Design code not found');
      } finally {
        setDesignLoading(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [designCode]);

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

  async function handleShare() {
    if (!cardRef.current || !giftCard) return;
    const link = `${window.location.origin}/card/${giftCard.id}`;
    try {
      const { default: html2canvas } = await import('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.esm.js');
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null, scale: 3, useCORS: true, allowTaint: true,
      });
      const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
      const file = new File([blob], `giftsats-${amountSats}sats.png`, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `🎁 ${amountSats.toLocaleString()} sats Gift Card`,
          text: `I'm sending you a Bitcoin gift card worth ${amountSats.toLocaleString()} sats! Redeem it here:`,
          url: link,
          files: [file],
        });
      } else if (navigator.share) {
        await navigator.share({
          title: `🎁 ${amountSats.toLocaleString()} sats Gift Card`,
          text: `I'm sending you a Bitcoin gift card worth ${amountSats.toLocaleString()} sats! Redeem it here:`,
          url: link,
        });
      } else {
        await navigator.clipboard.writeText(link);
        showToast('Link copied!');
      }
    } catch (e) {
      if (e.name !== 'AbortError') showToast('Could not share. Link copied instead.');
      await navigator.clipboard.writeText(link).catch(() => {});
    }
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 8 }}>
          <p style={{ color: '#555', fontFamily: 'var(--font-mono)', fontSize: 12, margin: 0 }}>
            Bitcoin gift cards powered by Lightning ⚡
          </p>
          {platformStats && parseInt(platformStats.total_sats) > 0 && (
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 11,
              color: '#F7931A', background: '#F7931A11',
              border: '1px solid #F7931A33',
              borderRadius: 20, padding: '3px 10px', whiteSpace: 'nowrap',
            }}>
              ⚡ {parseInt(platformStats.total_sats).toLocaleString()} sats gifted
            </div>
          )}
        </div>
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

            {/* Design Code from Marketplace */}
            <div style={{ marginBottom: 24 }}>
              <span style={labelStyle}>MARKETPLACE DESIGN CODE (OPTIONAL)</span>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="e.g. gfts-a3x9k — paste code from Explore"
                  value={designCode}
                  onChange={e => setDesignCode(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 40px 10px 14px',
                    borderRadius: 8, background: '#111',
                    border: `1px solid ${designError ? '#ff6b6b' : designPreview ? '#39ff14' : '#333'}`,
                    color: '#fff', fontFamily: 'var(--font-mono)', fontSize: 12,
                    outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s',
                  }}
                />
                <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14 }}>
                  {designLoading ? '⏳' : designPreview ? '✓' : designError ? '✕' : ''}
                </div>
              </div>
              {designError && (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#ff6b6b', marginTop: 6 }}>{designError}</div>
              )}
              {!designPreview && !designError && (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#333', marginTop: 6 }}>
                  Browse designs at{' '}
                  <a href="/explore" style={{ color: '#F7931A', textDecoration: 'none' }}>giftsats.org/explore</a>
                </div>
              )}
              {/* Design preview card */}
              {designPreview && (
                <div style={{
                  marginTop: 10, background: '#0d0d0d', border: '1px solid #1e1e1e',
                  borderRadius: 10, overflow: 'hidden', display: 'flex',
                }}>
                  {designPreview.imageUrl && (
                    <img
                      src={designPreview.imageUrl}
                      alt={designPreview.name}
                      style={{ width: 100, objectFit: 'cover', flexShrink: 0 }}
                    />
                  )}
                  <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: '#f0ece4' }}>{designPreview.name}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#555' }}>by {designPreview.designerName}</div>
                    {designPreview.priceSats === 0
                      ? <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#39ff14' }}>Free</div>
                      : <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#F7931A' }}>+{designPreview.priceSats.toLocaleString()} sats design fee</div>
                    }
                  </div>
                  <button
                    onClick={() => { setDesignCode(''); setDesignPreview(null); }}
                    style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#333', cursor: 'pointer', padding: '0 14px', fontSize: 16 }}
                  >✕</button>
                </div>
              )}
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
                min={1000}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 8, background: '#111', border: '1px solid #333', color: '#fff', fontFamily: 'var(--font-mono)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
              />
              {customAmount && amountSats < MIN_SATS && (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#ff6b6b', marginTop: 6 }}>
                  Minimum 1,000 sats
                </div>
              )}
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

            {/* Refund address (optional) */}
            <div style={{ marginBottom: 24 }}>
              <span style={labelStyle}>REFUND ADDRESS (OPTIONAL)</span>
              <input
                type="text"
                placeholder="your@lightning.address — for refund if card expires"
                value={senderLightningAddress}
                onChange={e => setSenderLightningAddress(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 8, background: '#111', border: '1px solid #333', color: '#fff', fontFamily: 'var(--font-mono)', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
              />
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#444', marginTop: 6 }}>
                If not redeemed within 30 days, sats will be refunded here. Leave blank to forfeit to platform.
              </div>
            </div>

            <div style={{ background: '#111', border: '1px solid #222', borderRadius: 10, padding: '14px 16px', marginBottom: 20, fontFamily: 'var(--font-mono)', fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#555', marginBottom: 6 }}>
                <span>Gift amount</span><span style={{ color: '#aaa' }}>{amountSats.toLocaleString()} sats</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#555', marginBottom: 6 }}>
                <span>Service fee (2%)</span><span style={{ color: '#aaa' }}>{feeSats.toLocaleString()} sats</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#555', marginBottom: 6 }}>
                <span>Network fee</span><span style={{ color: '#aaa' }}>{networkFee} sats</span>
              </div>
              {designFee > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#555', marginBottom: 6 }}>
                  <span>Design fee ({designPreview?.name})</span><span style={{ color: '#aaa' }}>{designFee.toLocaleString()} sats</span>
                </div>
              )}
              <div style={{ borderTop: '1px solid #222', paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#888' }}>Total to pay</span>
                <span style={{ color: design.borderColor, fontWeight: 700 }}>{totalSats.toLocaleString()} sats</span>
              </div>
              <div style={{ marginTop: 6, color: '#444', fontSize: 10 }}>≈ ${satsToUSD(totalSats)} USD</div>
            </div>

            <button onClick={handleGenerate} disabled={amountSats < MIN_SATS} style={{
              width: '100%', padding: '14px', borderRadius: 10,
              background: amountSats >= MIN_SATS ? design.borderColor : '#1a1a1a',
              color: amountSats >= MIN_SATS ? '#000' : '#444',
              fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15,
              border: 'none', cursor: amountSats >= MIN_SATS ? 'pointer' : 'not-allowed',
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
                  <span>Gift amount</span><span style={{ color: '#aaa' }}>{amountSats.toLocaleString()} sats</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#555', marginBottom: 6 }}>
                  <span>Service fee (2%)</span><span style={{ color: '#aaa' }}>{feeSats.toLocaleString()} sats</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#555', marginBottom: 6 }}>
                  <span>Network fee</span><span style={{ color: '#aaa' }}>{networkFee} sats</span>
                </div>
                {designFee > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#555', marginBottom: 6 }}>
                    <span>Design fee ({designPreview?.name})</span><span style={{ color: '#aaa' }}>{designFee.toLocaleString()} sats</span>
                  </div>
                )}
                <div style={{ borderTop: '1px solid #222', paddingTop: 8, display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: '#888' }}>You pay</span>
                  <span style={{ color: design.borderColor, fontWeight: 700 }}>{totalSats.toLocaleString()} sats</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#555' }}>
                  <span>Recipient gets</span><span style={{ color: '#39ff14' }}>{amountSats.toLocaleString()} sats</span>
                </div>
                {expiresAt && (
                  <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid #222', color: '#444', fontSize: 10 }}>
                    ⏳ Card expires {new Date(expiresAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </div>
                )}
              </div>
              <button onClick={() => { navigator.clipboard.writeText(invoice.paymentRequest); showToast('Copied!'); }} style={{
                width: '100%', padding: '12px', borderRadius: 10,
                background: '#1a1a1a', border: '1px solid #333',
                color: '#aaa', fontFamily: 'var(--font-mono)', fontSize: 13, cursor: 'pointer', marginBottom: 12,
              }}>Copy Invoice</button>
              <button onClick={() => {
                clearInterval(pollRef.current);
                clearInterval(timerRef.current);
                localStorage.removeItem('giftsats_pending');
                setInvoice(null);
                setStatus('preview');
              }} style={{
                width: '100%', padding: '10px', borderRadius: 10,
                background: 'transparent', border: '1px solid #2a2a2a',
                color: '#555', fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer', marginBottom: 12,
              }}>✕ Cancel & Edit Details</button>
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
                <button onClick={() => {
                  const link = `${window.location.origin}/card/${giftCard.id}`;
                  const text = `🎁 I'm sending you a Bitcoin gift card worth ${amountSats.toLocaleString()} sats!\n\nRedeem it here: ${link}`;
                  navigator.clipboard.writeText(text);
                  showToast('Copied! Ready to paste and send.');
                }} style={{
                  width: '100%', padding: '14px', borderRadius: 10,
                  background: design.borderColor, color: '#000',
                  fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15,
                  border: 'none', cursor: 'pointer',
                }}>🔗 Copy Gift Link</button>
                <button onClick={handleDownloadPNG} style={{
                  width: '100%', padding: '14px', borderRadius: 10,
                  background: '#1a1a1a', color: '#aaa',
                  fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14,
                  border: '1px solid #333', cursor: 'pointer',
                }}>↓ Download PNG</button>
                <button onClick={() => window.print()} style={{
                  width: '100%', padding: '14px', borderRadius: 10,
                  background: '#1a1a1a', color: '#aaa',
                  fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14,
                  border: '1px solid #333', cursor: 'pointer',
                }}>🖨 Print</button>
                <button onClick={handleShare} style={{
                  width: '100%', padding: '14px', borderRadius: 10,
                  background: '#1a1a1a', color: '#aaa',
                  fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14,
                  border: '1px solid #333', cursor: 'pointer',
                }}>↗ Share to Recipient</button>
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
              background: designPreview?.imageUrl ? 'transparent' : design.bg,
              padding: '28px 24px 24px',
              display: 'flex', flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: 220, position: 'relative', overflow: 'hidden',
            }}>
              {/* Marketplace design image background */}
              {designPreview?.imageUrl && (
                <img
                  src={designPreview.imageUrl}
                  alt={designPreview.name}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }}
                />
              )}
              {/* Dark overlay for readability when using image */}
              {designPreview?.imageUrl && (
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.55) 100%)', pointerEvents: 'none' }} />
              )}
              {!designPreview?.imageUrl && (
                <div style={{ position: 'absolute', inset: 0, backgroundImage: `radial-gradient(circle, ${design.patternColor} 1.5px, transparent 1.5px)`, backgroundSize: '20px 20px', pointerEvents: 'none' }} />
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative' }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: designPreview?.imageUrl ? 'rgba(255,255,255,0.7)' : design.accentAlt, letterSpacing: 3, marginBottom: 4 }}>GIFT SATS</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, color: '#fff' }}>{designPreview ? designPreview.name : design.name}</div>
                </div>
                <div style={{ fontSize: 28 }}>{designPreview?.imageUrl ? '🎨' : design.emoji}</div>
              </div>
              <div style={{ position: 'relative', padding: '16px 0' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 48, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{amountSats.toLocaleString()}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: designPreview?.imageUrl ? 'rgba(255,255,255,0.7)' : design.accentAlt, marginTop: 4, letterSpacing: 2 }}>sats</div>
                {senderNote && <div style={{ fontFamily: 'var(--font-display)', fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 10, fontStyle: 'italic' }}>"{senderNote.slice(0, 50)}"</div>}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(255,255,255,0.6)' }}>{senderName ? `from ${senderName}` : 'by GiftSats'}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: isReady ? '#39ff14' : 'rgba(255,255,255,0.6)' }}>{isReady ? '✓ READY TO SEND' : isPaying ? '⏳ AWAITING PAYMENT' : 'PREVIEW'}</div>
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
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: design.qrAccent, letterSpacing: 2 }}>REDEEM QR</span>
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
              <div style={{
                background: '#161616',
                border: '1px solid #2a2a2a',
                borderRadius: 8, padding: '10px 16px',
                textAlign: 'center', width: '100%', boxSizing: 'border-box',
              }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#444', marginBottom: 4, letterSpacing: 1 }}>TO REDEEM, PLEASE VISIT</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: '#e0e0e0', fontWeight: 700, letterSpacing: 1 }}>giftsats.org</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#3a3a3a', marginTop: 4, letterSpacing: 0.5 }}>Enter Lightning address to receive sats ⚡</div>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#333', letterSpacing: 1, borderTop: `1px solid ${design.qrBorder}`, paddingTop: 10, width: '100%', textAlign: 'center' }}>
                {isReady && giftCard?.id ? giftCard.id : 'POWERED BY BITCOIN ⚡ LIGHTNING'}
              </div>
              {expiresAt && (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#555', marginTop: 4, textAlign: 'center', letterSpacing: 1 }}>
                  REDEEM BY {new Date(expiresAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()}
                </div>
              )}
            </div>
          </div>
          <div style={{ marginTop: 12, fontFamily: 'var(--font-mono)', fontSize: 10, color: '#444', textAlign: 'center' }}>
      
          </div>
        </div>

      </div>
    </div>
  );
}
