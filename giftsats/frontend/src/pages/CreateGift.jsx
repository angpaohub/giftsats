import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';

const API = import.meta.env.VITE_API_URL || '';

export default function CreateGift() {
  const [designs, setDesigns] = useState([]);
  const [selectedDesign, setSelectedDesign] = useState(null);
  const [amountSats, setAmountSats] = useState(2100);
  const [senderNote, setSenderNote] = useState('');
  const [step, setStep] = useState('select'); // select | pay | ready
  const [giftCard, setGiftCard] = useState(null);
  const [invoice, setInvoice] = useState(null);
  const [polling, setPolling] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`${API}/api/designs`)
      .then(r => r.json())
      .then(data => { setDesigns(data); setSelectedDesign(data[0]); })
      .catch(() => setDesigns(mockDesigns));
  }, []);

  // Poll for payment
  useEffect(() => {
    if (!polling || !giftCard) return;
    const interval = setInterval(async () => {
      const res = await fetch(`${API}/api/gift/${giftCard.id}`);
      const data = await res.json();
      if (data.status === 'minted') {
        setGiftCard(data);
        setStep('ready');
        setPolling(false);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [polling, giftCard]);

  async function handleCreate() {
    try {
      const res = await fetch(`${API}/api/gift/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountSats, designId: selectedDesign?.id, senderNote }),
      });
      const data = await res.json();
      setGiftCard({ id: data.giftCardId, ...data });
      setInvoice(data.paymentRequest);
      setStep('pay');
      setPolling(true);
    } catch (e) {
      alert('Error: ' + e.message);
    }
  }

  function copyInvoice() {
    navigator.clipboard.writeText(invoice);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function downloadCard() {
    const data = JSON.stringify({ token: giftCard.cashuToken, amount: giftCard.amountSats, note: senderNote }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `giftsats-${giftCard.amountSats}sats.json`; a.click();
  }

  const design = selectedDesign;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, alignItems: 'start' }}>

      {/* Left: Controls */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        {step === 'select' && <>
          {/* Design picker */}
          <section>
            <label style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#666', letterSpacing: 2, display: 'block', marginBottom: 12 }}>
              SELECT DESIGN
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {designs.map(d => (
                <button
                  key={d.id}
                  onClick={() => setSelectedDesign(d)}
                  style={{
                    padding: '12px',
                    background: selectedDesign?.id === d.id ? '#1a1a1a' : 'transparent',
                    border: `1px solid ${selectedDesign?.id === d.id ? '#F7931A' : '#2a2a2a'}`,
                    borderRadius: 8,
                    color: '#f0f0f0',
                    textAlign: 'left',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ fontSize: 20, marginBottom: 4 }}>{d.emoji}</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13 }}>{d.name}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#555', marginTop: 2 }}>
                    {d.priceSats === 0 ? 'free' : `${d.priceSats} sats`}
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* Amount */}
          <section>
            <label style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#666', letterSpacing: 2, display: 'block', marginBottom: 12 }}>
              AMOUNT (SATS)
            </label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              {[1000, 2100, 5000, 10000, 21000].map(amt => (
                <button
                  key={amt}
                  onClick={() => setAmountSats(amt)}
                  style={{
                    padding: '8px 14px',
                    background: amountSats === amt ? '#F7931A' : '#1a1a1a',
                    color: amountSats === amt ? '#000' : '#f0f0f0',
                    border: '1px solid #2a2a2a',
                    borderRadius: 6,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    fontWeight: 600,
                    transition: 'all 0.15s',
                  }}
                >
                  {amt.toLocaleString()}
                </button>
              ))}
            </div>
            <input
              type="number"
              value={amountSats}
              onChange={e => setAmountSats(Number(e.target.value))}
              min={100}
              style={{
                width: '100%', padding: '12px 14px',
                background: '#111', border: '1px solid #2a2a2a',
                borderRadius: 8, color: '#F7931A',
                fontSize: 18, fontFamily: 'var(--font-mono)',
              }}
            />
          </section>

          {/* Note */}
          <section>
            <label style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#666', letterSpacing: 2, display: 'block', marginBottom: 12 }}>
              NOTE (OPTIONAL)
            </label>
            <input
              type="text"
              value={senderNote}
              onChange={e => setSenderNote(e.target.value)}
              placeholder="Happy birthday! ⚡"
              maxLength={100}
              style={{
                width: '100%', padding: '12px 14px',
                background: '#111', border: '1px solid #2a2a2a',
                borderRadius: 8, color: '#f0f0f0', fontSize: 14,
                fontFamily: 'var(--font-display)',
              }}
            />
          </section>

          <button
            onClick={handleCreate}
            style={{
              padding: '16px',
              background: 'linear-gradient(135deg, #F7931A, #FF6B35)',
              color: '#000', borderRadius: 10,
              fontFamily: 'var(--font-display)', fontWeight: 800,
              fontSize: 16, letterSpacing: '-0.3px',
              animation: 'pulse-glow 3s ease-in-out infinite',
            }}
          >
            Generate Gift Card ⚡
          </button>
        </>}

        {step === 'pay' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#666', letterSpacing: 2 }}>PAY LIGHTNING INVOICE</div>
            <div style={{ background: '#fff', padding: 16, borderRadius: 12, display: 'inline-flex', alignSelf: 'flex-start' }}>
              <QRCodeSVG value={invoice || ''} size={200} />
            </div>
            <div style={{
              background: '#111', border: '1px solid #2a2a2a',
              borderRadius: 8, padding: '12px 14px',
              fontFamily: 'var(--font-mono)', fontSize: 11,
              color: '#555', wordBreak: 'break-all',
              maxHeight: 80, overflow: 'hidden',
            }}>
              {invoice}
            </div>
            <button onClick={copyInvoice} style={{
              padding: '12px', background: '#1a1a1a', border: '1px solid #2a2a2a',
              borderRadius: 8, color: copied ? '#39ff14' : '#f0f0f0',
              fontFamily: 'var(--font-display)', fontSize: 14,
            }}>
              {copied ? '✓ Copied!' : 'Copy Invoice'}
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#555', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%', background: '#F7931A',
                animation: 'pulse-glow 1s ease-in-out infinite',
              }} />
              Waiting for payment...
            </div>
          </div>
        )}

        {step === 'ready' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ color: '#39ff14', fontFamily: 'var(--font-mono)', fontSize: 13 }}>✓ Payment received! Gift card ready.</div>
            <button onClick={downloadCard} style={{
              padding: '14px', background: '#1a1a1a', border: '1px solid #39ff14',
              borderRadius: 8, color: '#39ff14',
              fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14,
            }}>
              Download Gift Card Token
            </button>
            <button onClick={() => { setStep('select'); setGiftCard(null); setInvoice(null); }} style={{
              padding: '14px', background: 'none', border: '1px solid #2a2a2a',
              borderRadius: 8, color: '#555',
              fontFamily: 'var(--font-display)', fontSize: 14,
            }}>
              Create Another
            </button>
          </div>
        )}
      </div>

      {/* Right: Card Preview */}
      <div style={{ position: 'sticky', top: 100 }}>
        <label style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#666', letterSpacing: 2, display: 'block', marginBottom: 12 }}>
          PREVIEW
        </label>
        <GiftCardPreview
          design={design}
          amountSats={amountSats}
          senderNote={senderNote}
          status={step}
        />
      </div>
    </div>
  );
}

function GiftCardPreview({ design, amountSats, senderNote, status }) {
  if (!design) return null;
  const [c1, c2] = design.colors || ['#F7931A', '#FF6B35'];
  return (
    <div style={{
      width: '100%', aspectRatio: '1.6',
      borderRadius: 16,
      background: `linear-gradient(135deg, ${c1}, ${c2})`,
      padding: 24,
      display: 'flex', flexDirection: 'column',
      justifyContent: 'space-between',
      animation: 'float 4s ease-in-out infinite',
      boxShadow: `0 20px 60px ${c1}44`,
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Decorative circle */}
      <div style={{
        position: 'absolute', right: -40, top: -40,
        width: 180, height: 180, borderRadius: '50%',
        background: 'rgba(255,255,255,0.07)',
      }} />
      <div style={{
        position: 'absolute', right: 20, bottom: -60,
        width: 140, height: 140, borderRadius: '50%',
        background: 'rgba(255,255,255,0.05)',
      }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.6)', letterSpacing: 2 }}>GIFT SATS</div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, color: '#fff', marginTop: 4 }}>{design.name}</div>
        </div>
        <div style={{ fontSize: 32 }}>{design.emoji}</div>
      </div>

      <div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 32, fontWeight: 700, color: '#fff' }}>
          {amountSats.toLocaleString()}
          <span style={{ fontSize: 14, marginLeft: 6, opacity: 0.7 }}>sats</span>
        </div>
        {senderNote && (
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 6, fontStyle: 'italic' }}>
            "{senderNote}"
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
          by {design.designer}
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
          {status === 'ready' ? '✓ READY TO SEND' : 'PREVIEW'}
        </div>
      </div>
    </div>
  );
}

const mockDesigns = [
  { id: 'default-orange', name: 'Bitcoin Classic', designer: 'GiftSats', priceSats: 0, colors: ['#F7931A', '#FF6B35'], emoji: '₿', free: true },
  { id: 'default-dark', name: 'Midnight Stack', designer: 'GiftSats', priceSats: 0, colors: ['#1a1a2e', '#16213e'], emoji: '⚡', free: true },
  { id: 'default-green', name: 'Sovereign Green', designer: 'GiftSats', priceSats: 0, colors: ['#00b09b', '#96c93d'], emoji: '🔑', free: true },
  { id: 'designer-neon', name: 'Neon Sats', designer: 'satoshi_art', priceSats: 21, colors: ['#0d0d0d', '#39ff14'], emoji: '🌐', free: false },
];
