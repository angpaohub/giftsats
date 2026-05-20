import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const API = import.meta.env.VITE_API_URL || '';

const mono = "'JetBrains Mono', 'Fira Code', monospace";
const display = "'Syne', 'Space Grotesk', sans-serif";

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap');

  .explore-root {
    min-height: 100vh;
    background: #0a0a0a;
    color: #f0ece4;
    font-family: ${mono};
  }

  .explore-header {
    padding: 48px 40px 0;
    max-width: 1200px;
    margin: 0 auto;
  }

  .explore-eyebrow {
    font-family: ${mono};
    font-size: 11px;
    letter-spacing: 0.2em;
    color: #F7931A;
    text-transform: uppercase;
    margin-bottom: 16px;
  }

  .explore-title {
    font-family: ${display};
    font-size: clamp(36px, 5vw, 64px);
    font-weight: 800;
    line-height: 1;
    margin: 0 0 12px;
    color: #f0ece4;
  }

  .explore-subtitle {
    color: #888;
    font-size: 14px;
    line-height: 1.6;
    max-width: 480px;
    margin-bottom: 40px;
  }

  .explore-actions {
    display: flex;
    gap: 12px;
    align-items: center;
    flex-wrap: wrap;
    margin-bottom: 48px;
  }

  .btn-create {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 12px 24px;
    background: #F7931A;
    color: #0a0a0a;
    border: none;
    border-radius: 4px;
    font-family: ${mono};
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.05em;
    cursor: pointer;
    text-decoration: none;
    transition: opacity 0.15s;
  }
  .btn-create:hover { opacity: 0.85; }

  .explore-hint {
    font-size: 12px;
    color: #555;
  }

  .grid-controls {
    padding: 0 40px;
    max-width: 1200px;
    margin: 0 auto 32px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 16px;
  }

  .count-label {
    font-size: 12px;
    color: #555;
    letter-spacing: 0.1em;
  }

  .sort-select {
    background: #141414;
    border: 1px solid #2a2a2a;
    color: #f0ece4;
    font-family: ${mono};
    font-size: 12px;
    padding: 8px 12px;
    border-radius: 4px;
    outline: none;
    cursor: pointer;
  }

  .designs-grid {
    padding: 0 40px 80px;
    max-width: 1200px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 24px;
  }

  .design-card {
    background: #111;
    border: 1px solid #1e1e1e;
    border-radius: 8px;
    overflow: hidden;
    cursor: pointer;
    transition: transform 0.2s, border-color 0.2s;
    position: relative;
  }
  .design-card:hover {
    transform: translateY(-4px);
    border-color: #F7931A44;
  }

  .design-img-wrap {
    width: 100%;
    aspect-ratio: 16/10;
    background: #1a1a1a;
    overflow: hidden;
    position: relative;
  }

  .design-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .design-img-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 48px;
    background: linear-gradient(135deg, #1a1a2e, #16213e);
  }

  .design-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0,0,0,0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.2s;
  }
  .design-card:hover .design-overlay { opacity: 1; }

  .overlay-copy-btn {
    padding: 10px 20px;
    background: #F7931A;
    color: #000;
    border: none;
    border-radius: 4px;
    font-family: ${mono};
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    letter-spacing: 0.05em;
  }

  .design-info {
    padding: 16px;
  }

  .design-name {
    font-family: ${display};
    font-size: 16px;
    font-weight: 700;
    margin: 0 0 4px;
    color: #f0ece4;
  }

  .design-by {
    font-size: 11px;
    color: #555;
    margin-bottom: 12px;
  }

  .design-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .design-price {
    font-size: 13px;
    color: #F7931A;
    font-weight: 700;
  }

  .design-uses {
    font-size: 11px;
    color: #444;
  }

  .design-code-badge {
    position: absolute;
    top: 10px;
    right: 10px;
    background: rgba(0,0,0,0.85);
    border: 1px solid #333;
    border-radius: 4px;
    padding: 4px 8px;
    font-size: 10px;
    color: #888;
    letter-spacing: 0.05em;
    font-family: ${mono};
  }

  .free-badge {
    font-size: 11px;
    color: #4ade80;
    background: #4ade8011;
    border: 1px solid #4ade8033;
    padding: 2px 8px;
    border-radius: 3px;
  }

  .copied-toast {
    position: fixed;
    bottom: 32px;
    left: 50%;
    transform: translateX(-50%) translateY(0);
    background: #F7931A;
    color: #000;
    padding: 12px 24px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 700;
    pointer-events: none;
    animation: slideUp 0.3s ease;
    z-index: 999;
  }

  @keyframes slideUp {
    from { transform: translateX(-50%) translateY(20px); opacity: 0; }
    to   { transform: translateX(-50%) translateY(0);    opacity: 1; }
  }

  .empty-state {
    grid-column: 1/-1;
    text-align: center;
    padding: 80px 20px;
    color: #444;
  }
  .empty-state .big-icon { font-size: 48px; margin-bottom: 16px; }
  .empty-state p { font-size: 14px; }

  .skeleton {
    background: linear-gradient(90deg, #1a1a1a 25%, #222 50%, #1a1a1a 75%);
    background-size: 200% 100%;
    animation: shimmer 1.4s infinite;
    border-radius: 4px;
  }
  @keyframes shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }

  @media (max-width: 600px) {
    .explore-header, .grid-controls, .designs-grid { padding-left: 20px; padding-right: 20px; }
    .designs-grid { grid-template-columns: 1fr; }
  }
`;

export default function Explore() {
  const navigate = useNavigate();
  const [designs, setDesigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(null);
  const [sort, setSort] = useState('popular');

  useEffect(() => {
    fetch(`${API}/api/designs`)
      .then(r => r.json())
      .then(data => { setDesigns(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const sorted = [...designs].sort((a, b) => {
    if (sort === 'popular') return b.useCount - a.useCount;
    if (sort === 'newest') return new Date(b.createdAt) - new Date(a.createdAt);
    if (sort === 'price-low') return a.priceSats - b.priceSats;
    if (sort === 'price-high') return b.priceSats - a.priceSats;
    return 0;
  });

  function copyCode(e, id) {
    e.stopPropagation();
    navigator.clipboard.writeText(id).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  return (
    <>
      <style>{css}</style>
      <div className="explore-root">
        <div className="explore-header">
          <div className="explore-eyebrow">⚡ GiftSats Marketplace</div>
          <h1 className="explore-title">Explore Designs</h1>
          <p className="explore-subtitle">
            Browse community-made gift card designs. Copy a design code and use it when creating your gift.
          </p>
          <div className="explore-actions">
            <a href="/design" className="btn-create">
              + Create Your Design
            </a>
            <span className="explore-hint">Earn sats every time your design is used</span>
          </div>
        </div>

        <div className="grid-controls">
          <span className="count-label">{designs.length} DESIGNS AVAILABLE</span>
          <select className="sort-select" value={sort} onChange={e => setSort(e.target.value)}>
            <option value="popular">Most Popular</option>
            <option value="newest">Newest</option>
            <option value="price-low">Price: Low → High</option>
            <option value="price-high">Price: High → Low</option>
          </select>
        </div>

        <div className="designs-grid">
          {loading && Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="design-card" style={{ pointerEvents: 'none' }}>
              <div className="design-img-wrap skeleton" />
              <div className="design-info">
                <div className="skeleton" style={{ height: 18, width: '60%', marginBottom: 8 }} />
                <div className="skeleton" style={{ height: 12, width: '40%' }} />
              </div>
            </div>
          ))}

          {!loading && sorted.length === 0 && (
            <div className="empty-state">
              <div className="big-icon">🎨</div>
              <p>No designs yet. Be the first to create one!</p>
            </div>
          )}

          {!loading && sorted.map(d => (
            <div key={d.id} className="design-card" onClick={() => navigate(`/create?design=${d.id}`)}>
              <div className="design-img-wrap">
                {d.imageUrl
                  ? <img className="design-img" src={`${API}${d.imageUrl}`} alt={d.name} />
                  : <div className="design-img-placeholder">🎨</div>
                }
                <div className="design-overlay">
                  <button className="overlay-copy-btn" onClick={e => copyCode(e, d.id)}>
                    {copied === d.id ? '✓ Copied!' : 'Copy Code'}
                  </button>
                </div>
                <div className="design-code-badge">{d.id}</div>
              </div>
              <div className="design-info">
                <div className="design-name">{d.name}</div>
                <div className="design-by">by {d.designerName}</div>
                <div className="design-footer">
                  {d.priceSats === 0
                    ? <span className="free-badge">FREE</span>
                    : <span className="design-price">+{d.priceSats.toLocaleString()} sats</span>
                  }
                  <span className="design-uses">{d.useCount} uses</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {copied && <div className="copied-toast">✓ Code copied — paste it in Create Gift</div>}
    </>
  );
}
