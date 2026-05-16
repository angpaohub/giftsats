import { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';

const API = import.meta.env.VITE_API_URL || '';
const PLATFORM_FEE_PERCENT = 0.5;
const INVOICE_TIMEOUT_SECONDS = 600;

const defaultDesigns = [
  { id: 'default-orange', name: 'Bitcoin Classic', designer: 'GiftSats', priceSats: 0, colors: ['#F7931A', '#FF6B35'], emoji: '₿' },
  { id: 'default-dark', name: 'Midnight Stack', designer: 'GiftSats', priceSats: 0, colors: ['#1a1a2e', '#16213e'], emoji: '⚡' },
  { id: 'default-green', name: 'Sovereign Green', designer: 'GiftSats', priceSats: 0, colors: ['#00b09b', '#96c93d'], emoji: '🔑' },
];

function calcFees(amountSats) {
  const platformFee = Math.ceil(amountSats * PLATFORM_FEE_PERCENT / 100);
  const networkFee = 2;
  const total = amountSats + platformFee + networkFee;
  return { platformFee, networkFee, total };
}

const labelStyle = { fontFamily: 'var(--font-mono)', fontSize: 11, color: '#666', letterSpacing: 2, display: 'block', marginBottom: 12 };

export default function CreateGift() {
  const [designs] = useState(defaultDesigns);
  const [selectedDesign, setSelectedDesign] = useState(defaultDesigns[0]);
  const [amountSats, setAmountSats] = useState(2100);
  const [senderNote, setSenderNote] = useState('');
  const [step, setStep] = useState('select');
  const [giftCard, setGiftCard] = useState(null);
  const [invoice, setInvoice] = useState(null);
  const [polling, setPolling] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState(null);
  const [timeLeft, setTimeLeft] = useState(INVOICE_TIMEOUT_SECONDS);
  const timerRef = useRef(null);
  const fees = calcFees(amountSats);

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  useEffect(() => {
    if (!polling || !giftCard) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API}/api/gift/${giftCard.id}`);
        const data = await res.json();
        if (data.status === 'minted') {
          setGiftCard(data);
          setStep('ready');
          setPolling(false);
          clearInterval(timerRef.current);
          showToast('Payment received! Gift card ready 🎉');
        }
      } catch {}
    }, 2000);
    return () => clearInterval(interval);
  }, [polling, giftCard]);

  useEffect(() => {
    if (step !== 'pay') return;
    setTimeLeft(INVOICE_TIMEOUT_SECONDS);
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          setStep('select');
          setGiftCard(null);
          setInvoice(null);
          setPolling(false);
          showToast('Invoice expired. Please generate a new one.', 'error');
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [step]);

  async function handleCreate() {
    try {
      const res = await fetch(`${API}/api/gift/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountSats, designId: selectedDesign?.id, senderNote }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setGiftCard({ id: data.giftCardId, ...data });
      setInvoice(data.paymentRequest);
      setStep('pay');
      setPolling(true);
    } catch (e) {
      showToast('Error: ' + e.message, 'error');
    }
  }

  function copyInvoice() {
    navigator.clipboard.writeText(invoice);
    setCopied(true);
    showToast('Invoice copied!');
    setTimeout(() => setCopied(false), 2000);
  }

  function formatTime(s) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  const design = selectedDesign;

  return (
    <div style={{ position: 'relative' }}>
      {toast && (
        <div style={{
          position: 'fixed', top: 24, right: 24, zIndex: 999,
          background: toast.type === 'error' ? '#2a0a0a' : '#0a2a0a',
          border: `1px solid ${toast.type === 'error' ? '#ff4444' : '#39ff14'}`,
          color: toast.type === 'error' ? '#ff4444' : '#39ff14',
          padding: '12px 20px', borderRadius: 10,
          fontFamily: 'var(--font-mono)', fontSize: 13,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}>
          {toast.msg}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          {step === 'select' && <>
            <section>
              <label style={labelStyle}>SELECT DESIGN</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {designs.map(d => (
                  <button key={d.id} onClick={() => setSelectedDesign(d)} style={{
                    padding: '12px', borderRadius: 8, textAlign: 'left', transition: 'all 0.15s', cursor: 'pointer',
                    background: selectedDesign?.id === d.id ? '#1a1a1a' : 'transparent',
                    border: `1px solid ${selectedDesign?.id === d.id ? '#F7931A' : '#2a2a2a'}`,
                    color: '#f0f0f0',
                  }}>
                    <div style={{ fontSize: 20, marginBottom: 4 }}>{d.emoji}</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13 }}>{d.name}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#555', marginTop: 2 }}>free</div>
                  </button>
                ))}
              </div>
            </section>

            <section>
              <label style={labelStyle}>AMOUNT (SATS)</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                {[1000, 2100, 5000, 10000, 21000].map(amt => (
                  <button key={amt} onClick={() => setAmountSats(amt)} style={{
                    padding: '8px 14px', borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    background: amountSats === amt ? '#F7931A' : '#1a1a1a',
                    color: amountSats === amt ? '#000' : '#f0f0f0',
                    border: '1px solid #2a2a2a', transition: 'all 0.15s',
                  }}>{amt.toLocaleString()}</button>
                ))}
              </div>
              <input type="number" value={amountSats} onChange={e => setAmountSats(Number(e.target.value))} min={100}
                style={{ width: '100%', padding: '12px 14px', background: '#111', border: '1px solid #2a2a2a', borderRadius: 8, color: '#F7931A', fontSize: 18, fontFamily: 'var(--font-mono)' }} />
            </section>

            <section>
              <label style={labelStyle}>NOTE (OPTIONAL)</label>
              <input type="text" value={senderNote} onChange={e => setSenderNote(e.target.value)}
                placeholder="Happy birthday! ⚡" maxLength={100}
                style={{ width: '100%', padding: '12px 14px', background: '#111', border: '1px solid #2a2a2a', borderRadius: 8, color: '#f0f0f0', fontSize: 14, fontFamily: 'var(--font-display)' }} />
            </section>

            <section style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 10, padding: 16 }}>
              <label style={labelStyle}>FEE BREAKDOWN</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { label: 'Gift amount', value: amountSats },
                  { label: `Platform fee (${PLATFORM_FEE_PERCENT}%)`, value: fees.platformFee },
                  { label: 'Network fee (est.)', value: fees.networkFee },
                ].map(row => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#555' }}>{row.label}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#888' }}>{row.value.toLocaleString()} sats</span>
                  </div>
                ))}
                <div style={{ borderTop: '1px solid #2a2a2a', paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: '#f0f0f0', fontWeight: 700 }}>Total</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: '#F7931A', fontWeight: 700 }}>{fees.total.toLocaleString()} sats</span>
                </div>
              </div>
            </section>

            <button onClick={handleCreate} style={{
              padding: '16px', borderRadius: 10, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16,
              background: 'linear-gradient(135deg, #F7931A, #FF6B35)', color: '#000',
              animation: 'pulse-glow 3s ease-in-out infinite', cursor: 'pointer', border: 'none',
            }}>Generate Gift Card ⚡</button>
          </>}

          {step === 'pay' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={labelStyle}>PAY LIGHTNING INVOICE</label>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: timeLeft < 60 ? '#ff4444' : '#F7931A', fontWeight: 700 }}>
                  ⏱ {formatTime(timeLeft)}
                </div>
              </div>
              <div style={{ background: '#fff', padding: 16, borderRadius: 12, display: 'inline-flex', alignSelf: 'flex-start' }}>
                <QRCodeSVG value={invoice || ''} size={200} />
              </div>
              <div style={{ background: '#111', border: '1px solid #2a2a2a', borderRadius: 8, padding: '12px 14px', fontFamily: 'var(--font-mono)', fontSize: 11, color: '#555', wordBreak: 'break-all', maxHeight: 80, overflow: 'hidden' }}>
                {invoice}
              </div>
              <div style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 8, padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#444' }}>You pay</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#F7931A', fontWeight: 700 }}>{fees.total.toLocaleString()} sats</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#444' }}>Recipient gets</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#39ff14', fontWeight: 700 }}>{amountSats.toLocaleString()} sats</span>
                </div>
              </div>
              <button onClick={copyInvoice} style={{ padding: '12px', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, color: copied ? '#39ff14' : '#f0f0f0', fontFamily: 'var(--font-display)', fontSize: 14, cursor: 'pointer' }}>
                {copied ? '✓ Copied!' : 'Copy Invoice'}
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#555', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#F7931A', animation: 'pulse-glow 1s ease-in-out infinite' }} />
                Waiting for payment...
              </div>
              <button onClick={() => { setStep('select'); setGiftCard(null); setInvoice(null); setPolling(false); clearInterval(timerRef.current); }}
                style={{ padding: '10px', background: 'none', border: '1px solid #1a1a1a', borderRadius: 8, color: '#444', fontFamily: 'var(--font-display)', fontSize: 13, cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          )}

          {step === 'ready' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ color: '#39ff14', fontFamily: 'var(--font-mono)', fontSize: 13 }}>✓ Payment received! Gift card is ready.</div>
              <div style={{ background: '#0d1a0d', border: '1px solid #1a3a1a', borderRadius: 10, padding: 16 }}>
                <label style={{ ...labelStyle, color: '#39ff14' }}>CASHU TOKEN</label>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#4a8a4a', wordBreak: 'break-all', maxHeight: 80, overflow: 'hidden' }}>
                  {giftCard?.cashuToken || ''}
                </div>
              </div>
              <button onClick={() => { navigator.clipboard.writeText(giftCard?.cashuToken || ''); showToast('Token copied!'); }}
                style={{ padding: '14px', background: '#0d1a0d', border: '1px solid #39ff14', borderRadius: 8, color: '#39ff14', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                Copy Cashu Token
              </button>
              <button onClick={() => { setStep('select'); setGiftCard(null); setInvoice(null); }}
                style={{ padding: '14px', background: 'none', border: '1px solid #2a2a2a', borderRadius: 8, color: '#555', fontFamily: 'var(--font-display)', fontSize: 14, cursor: 'pointer' }}>
                Create Another
              </button>
            </div>
          )}
        </div>

        {/* Right: Preview */}
        <div style={{ position: 'sticky', top: 100 }}>
          <label style={labelStyle}>PREVIEW</label>
          <GiftCardPreview design={design} amountSats={amountSats} senderNote={senderNote} status={step} giftCard={giftCard} />
        </div>
      </div>
    </div>
  );
}

function GiftCardPreview({ design, amountSats, senderNote, status, giftCard }) {
  if (!design) return null;
  const [c1, c2] = design.colors || ['#F7931A', '#FF6B35'];
  const isReady = status === 'ready';

  return (
    <div>
      <div style={{
        width: '100%', aspectRatio: '1.6', borderRadius: 16,
        background: `linear-gradient(135deg, ${c1}, ${c2})`,
        padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        animation: 'float 4s ease-in-out infinite',
        boxShadow: `0 20px 60px ${c1}44`, position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', right: -40, top: -40, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,0.07)' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.6)', letterSpacing: 2 }}>GIFT SATS</div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, color: '#fff', marginTop: 4 }}>{design.name}</div>
          </div>
          <div style={{ fontSize: 32 }}>{design.emoji}</div>
        </div>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 32, fontWeight: 700, color: '#fff' }}>
            {amountSats.toLocaleString()}<span style={{ fontSize: 14, marginLeft: 6, opacity: 0.7 }}>sats</span>
          </div>
          {senderNote && <div style={{ fontFamily: 'var(--font-display)', fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 6, fontStyle: 'italic' }}>"{senderNote}"</div>}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>by {design.designer}</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{isReady ? '✓ READY' : 'PREVIEW'}</div>
        </div>
      </div>

      {(status === 'pay' || status === 'ready') && (
        <div style={{ marginTop: 16, background: '#111', border: '1px solid #2a2a2a', borderRadius: 12, padding: 16, textAlign: 'center' }}>
          <label style={labelStyle}>CASHU REDEEM QR</label>
          <div style={{ marginTop: 12, position: 'relative', display: 'inline-block' }}>
            <div style={{ filter: isReady ? 'none' : 'blur(8px)', transition: 'filter 0.5s ease', background: '#fff', padding: 12, borderRadius: 8 }}>
              <QRCodeSVG value={isReady && giftCard?.cashuToken ? giftCard.cashuToken : 'cashuA_placeholder'} size={140} />
            </div>
            {!isReady && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <div style={{ fontSize: 24 }}>🔒</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#555' }}>Pay to reveal</div>
              </div>
            )}
          </div>
          {isReady && <div style={{ marginTop: 8, fontFamily: 'var(--font-mono)', fontSize: 10, color: '#39ff14' }}>Scan with Minibits or any Cashu wallet</div>}
        </div>
      )}
    </div>
  );
}
