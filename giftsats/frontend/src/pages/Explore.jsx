import { useState, useEffect } from 'react';

const API = import.meta.env.VITE_API_URL || '';

const mockDesigns = [
  { id: 'default-orange', name: 'Bitcoin Classic', designer: 'GiftSats', priceSats: 0, colors: ['#F7931A', '#FF6B35'], emoji: '₿', free: true },
  { id: 'default-dark', name: 'Midnight Stack', designer: 'GiftSats', priceSats: 0, colors: ['#1a1a2e', '#16213e'], emoji: '⚡', free: true },
  { id: 'default-green', name: 'Sovereign Green', designer: 'GiftSats', priceSats: 0, colors: ['#00b09b', '#96c93d'], emoji: '🔑', free: true },
  { id: 'designer-neon', name: 'Neon Sats', designer: 'satoshi_art', priceSats: 21, colors: ['#0d0d0d', '#39ff14'], emoji: '🌐', free: false },
];

export default function Explore() {
  const [designs, setDesigns] = useState([]);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    fetch(`${API}/api/designs`)
      .then(r => r.json())
      .then(setDesigns)
      .catch(() => setDesigns(mockDesigns));
  }, []);

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, letterSpacing: '-1px' }}>
          Design <span style={{ color: '#F7931A' }}>Marketplace</span>
        </h2>
        <p style={{ color: '#555', fontFamily: 'var(--font-mono)', fontSize: 12, marginTop: 8 }}>
          Pay-per-use • sat goes directly to the designer
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
        {designs.map(d => {
          const [c1, c2] = d.colors || ['#333', '#555'];
          return (
            <div
              key={d.id}
              onClick={() => setSelected(d)}
              style={{
                borderRadius: 12,
                border: `1px solid ${selected?.id === d.id ? '#F7931A' : '#2a2a2a'}`,
                overflow: 'hidden', cursor: 'pointer',
                transition: 'all 0.2s',
                transform: selected?.id === d.id ? 'scale(1.02)' : 'scale(1)',
              }}
            >
              {/* Card visual */}
              <div style={{
                height: 120,
                background: `linear-gradient(135deg, ${c1}, ${c2})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 40,
              }}>
                {d.emoji}
              </div>

              {/* Info */}
              <div style={{ padding: '12px 14px', background: '#111' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14 }}>{d.name}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#555', marginTop: 2 }}>
                  by {d.designer}
                </div>
                <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 12,
                    color: d.priceSats === 0 ? '#39ff14' : '#F7931A',
                    fontWeight: 700,
                  }}>
                    {d.priceSats === 0 ? 'FREE' : `${d.priceSats} sats/use`}
                  </span>
                  {!d.free && (
                    <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#444' }}>
                      designer gets {Math.round(d.priceSats * 0.9)} sats
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Submit design CTA */}
        <div style={{
          borderRadius: 12, border: '1px dashed #2a2a2a',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: 24, gap: 8, minHeight: 200,
          color: '#333', cursor: 'pointer',
          transition: 'border-color 0.2s',
        }}
          onMouseEnter={e => e.currentTarget.style.borderColor = '#F7931A'}
          onMouseLeave={e => e.currentTarget.style.borderColor = '#2a2a2a'}
        >
          <div style={{ fontSize: 28 }}>+</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 600, color: '#444' }}>Submit your design</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#333', textAlign: 'center' }}>
            earn sats every time it's used
          </div>
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <div style={{
          marginTop: 32, padding: 24,
          background: '#111', border: '1px solid #2a2a2a', borderRadius: 12,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18 }}>{selected.name}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#555', marginTop: 4 }}>
                by {selected.designer} • {selected.priceSats === 0 ? 'free to use' : `${selected.priceSats} sats per gift card`}
              </div>
            </div>
            <button
              onClick={() => setSelected(null)}
              style={{ background: 'none', color: '#555', fontSize: 20, padding: '4px 8px' }}
            >×</button>
          </div>
          <p style={{ marginTop: 12, fontFamily: 'var(--font-mono)', fontSize: 12, color: '#444' }}>
            Use this design in the Create tab when making a gift card.
            {!selected.free && ` ${selected.priceSats} sats will be added to your total and sent to the designer automatically.`}
          </p>
        </div>
      )}
    </div>
  );
}
