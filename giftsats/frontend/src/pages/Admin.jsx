import { useState, useEffect } from 'react';

const BACKEND = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || 'http://localhost:3001';

const mono = "'JetBrains Mono', 'Fira Code', monospace";
const display = "'Syne', 'Space Grotesk', sans-serif";

function StatCard({ label, value, sub, accent = '#F7931A', animate = false }) {
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    if (!animate || !value) return;
    const target = parseInt(value) || 0;
    const duration = 1200;
    const steps = 40;
    const increment = target / steps;
    let current = 0;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      current = Math.min(Math.round(increment * step), target);
      setDisplayed(current);
      if (step >= steps) clearInterval(timer);
    }, duration / steps);
    return () => clearInterval(timer);
  }, [value, animate]);

  const displayValue = animate ? displayed.toLocaleString() : (parseInt(value) || 0).toLocaleString();

  return (
    <div style={{
      background: '#0d0d0d',
      border: `1px solid #1a1a1a`,
      borderTop: `2px solid ${accent}`,
      borderRadius: 12,
      padding: '28px 24px',
      position: 'relative',
      overflow: 'hidden',
      transition: 'border-color 0.3s',
    }}
      onMouseEnter={e => e.currentTarget.style.borderColor = accent}
      onMouseLeave={e => e.currentTarget.style.borderTopColor = accent}
    >
      <div style={{
        position: 'absolute', top: 0, right: 0, width: 80, height: 80,
        background: `radial-gradient(circle at top right, ${accent}15, transparent 70%)`,
        pointerEvents: 'none',
      }} />
      <div style={{ fontFamily: mono, fontSize: 10, color: '#444', letterSpacing: 3, marginBottom: 12, textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ fontFamily: display, fontSize: 38, fontWeight: 800, color: '#fff', letterSpacing: '-1px', lineHeight: 1 }}>
        {displayValue}
      </div>
      {sub && (
        <div style={{ fontFamily: mono, fontSize: 11, color: '#444', marginTop: 8 }}>{sub}</div>
      )}
    </div>
  );
}

function Table({ rows }) {
  if (!rows || rows.length === 0) {
    return (
      <div style={{ fontFamily: mono, fontSize: 12, color: '#333', padding: '40px', textAlign: 'center', border: '1px dashed #1a1a1a', borderRadius: 10 }}>
        NO DATA YET
      </div>
    );
  }

  const cols = Object.keys(rows[0]);

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: mono, fontSize: 11 }}>
        <thead>
          <tr>
            {cols.map(col => (
              <th key={col} style={{
                textAlign: 'left', padding: '10px 14px',
                color: '#444', letterSpacing: 2, fontSize: 10,
                borderBottom: '1px solid #1a1a1a', whiteSpace: 'nowrap',
              }}>
                {col.replace(/_/g, ' ').toUpperCase()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #111' }}
              onMouseEnter={e => e.currentTarget.style.background = '#0f0f0f'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {cols.map(col => {
                const val = row[col];
                let color = '#666';
                let display = val ?? '—';

                if (col === 'status') {
                  const colors = { minted: '#F7931A', redeemed: '#39ff14', pending: '#555' };
                  color = colors[val] || '#555';
                } else if (col === 'id') {
                  color = '#333';
                  display = val ? val.slice(0, 8) + '...' : '—';
                } else if (typeof val === 'number') {
                  color = '#888';
                  display = val.toLocaleString();
                } else if (val && (col.includes('at') || col.includes('created'))) {
                  color = '#444';
                  display = new Date(val).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });
                }

                return (
                  <td key={col} style={{ padding: '12px 14px', color, whiteSpace: 'nowrap' }}>
                    {col === 'status' ? (
                      <span style={{
                        background: color + '15', border: `1px solid ${color}44`,
                        color, borderRadius: 4, padding: '2px 8px', fontSize: 10, letterSpacing: 1,
                      }}>
                        {String(display).toUpperCase()}
                      </span>
                    ) : String(display)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NavTab({ label, active, onClick, badge }) {
  return (
    <button onClick={onClick} style={{
      background: 'none', border: 'none', cursor: 'pointer',
      fontFamily: mono, fontSize: 11, letterSpacing: 2,
      color: active ? '#F7931A' : '#333',
      borderBottom: active ? '1px solid #F7931A' : '1px solid transparent',
      paddingBottom: 8, paddingLeft: 0, paddingRight: 0,
      marginRight: 28, transition: 'color 0.2s',
      display: 'flex', alignItems: 'center', gap: 6,
    }}>
      {label.toUpperCase()}
      {badge != null && (
        <span style={{
          background: active ? '#F7931A' : '#1a1a1a',
          color: active ? '#000' : '#444',
          borderRadius: 4, padding: '1px 6px', fontSize: 9,
        }}>{badge}</span>
      )}
    </button>
  );
}

export default function Admin() {
  const [stats, setStats] = useState(null);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');
  const [lastRefresh, setLastRefresh] = useState(null);
  const [filter, setFilter] = useState('all');

  async function fetchData() {
    setLoading(true);
    try {
      const [statsRes, cardsRes] = await Promise.all([
        fetch(`${BACKEND}/api/stats`),
        fetch(`${BACKEND}/api/admin/cards`),
      ]);
      const statsData = await statsRes.json();
      const cardsData = cardsRes.ok ? await cardsRes.json() : [];
      setStats(statsData);
      setCards(Array.isArray(cardsData) ? cardsData : []);
      setLastRefresh(new Date());
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, []);

  const filteredCards = filter === 'all' ? cards : cards.filter(c => c.status === filter);

  const pendingCount = cards.filter(c => c.status === 'pending').length;
  const mintedCount = cards.filter(c => c.status === 'minted').length;
  const redeemedCount = cards.filter(c => c.status === 'redeemed').length;

  return (
    <div style={{ minHeight: '100vh', background: '#080808', color: '#fff', padding: '0' }}>
      {/* Top bar */}
      <div style={{
        borderBottom: '1px solid #111',
        padding: '0 40px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: 56,
        position: 'sticky', top: 0, background: '#080808', zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontFamily: display, fontWeight: 800, fontSize: 16, color: '#F7931A' }}>GiftSats</span>
          <span style={{ fontFamily: mono, fontSize: 10, color: '#222', letterSpacing: 2 }}>/ ADMIN</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {lastRefresh && (
            <span style={{ fontFamily: mono, fontSize: 10, color: '#2a2a2a' }}>
              UPDATED {lastRefresh.toLocaleTimeString('th-TH')}
            </span>
          )}
          <button onClick={fetchData} style={{
            background: '#111', border: '1px solid #1a1a1a', borderRadius: 6,
            color: '#444', fontFamily: mono, fontSize: 10, letterSpacing: 2,
            padding: '6px 14px', cursor: 'pointer', transition: 'all 0.2s',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#F7931A33'; e.currentTarget.style.color = '#F7931A'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#1a1a1a'; e.currentTarget.style.color = '#444'; }}
          >
            ↻ REFRESH
          </button>
        </div>
      </div>

      <div style={{ padding: '40px' }}>
        {/* Nav tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #111', marginBottom: 40 }}>
          <NavTab label="Overview" active={tab === 'overview'} onClick={() => setTab('overview')} />
          <NavTab label="Cards" active={tab === 'cards'} onClick={() => setTab('cards')} badge={cards.length} />
          <NavTab label="Marketplace" active={tab === 'marketplace'} onClick={() => setTab('marketplace')} badge="soon" />
        </div>

        {/* OVERVIEW TAB */}
        {tab === 'overview' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 40 }}>
              <StatCard
                label="Total Redeemed"
                value={stats?.redeemed_count ?? 0}
                sub="gift cards"
                accent="#39ff14"
                animate
              />
              <StatCard
                label="Sats Redeemed"
                value={stats?.redeemed_sats ?? 0}
                sub={`≈ ${(((parseInt(stats?.redeemed_sats) || 0) / 100000000) * 3500000).toFixed(0)} THB`}
                accent="#F7931A"
                animate
              />
              <StatCard
                label="Total Minted"
                value={stats?.total_sats ?? 0}
                sub="sats issued"
                accent="#7B61FF"
                animate
              />
              <StatCard
                label="Active Cards"
                value={stats?.minted_count ?? 0}
                sub="awaiting redemption"
                accent="#00C97A"
                animate
              />
            </div>

            {/* Quick status breakdown */}
            <div style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 12, padding: '24px' }}>
              <div style={{ fontFamily: mono, fontSize: 10, color: '#333', letterSpacing: 3, marginBottom: 20 }}>CARD STATUS BREAKDOWN</div>
              <div style={{ display: 'flex', gap: 0 }}>
                {[
                  { label: 'PENDING', count: pendingCount, color: '#555', total: cards.length },
                  { label: 'MINTED', count: mintedCount, color: '#F7931A', total: cards.length },
                  { label: 'REDEEMED', count: redeemedCount, color: '#39ff14', total: cards.length },
                ].map(({ label, count, color, total }) => {
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                  return (
                    <div key={label} style={{ flex: 1, borderLeft: `2px solid ${color}`, paddingLeft: 16, marginRight: 32 }}>
                      <div style={{ fontFamily: mono, fontSize: 9, color: color, letterSpacing: 2, marginBottom: 6 }}>{label}</div>
                      <div style={{ fontFamily: display, fontSize: 28, fontWeight: 800, color: '#fff' }}>{count}</div>
                      <div style={{ fontFamily: mono, fontSize: 10, color: '#333', marginTop: 4 }}>{pct}% of total</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* CARDS TAB */}
        {tab === 'cards' && (
          <>
            {/* Filter */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              {['all', 'pending', 'minted', 'redeemed'].map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{
                  background: filter === f ? '#F7931A' : '#111',
                  border: `1px solid ${filter === f ? '#F7931A' : '#1a1a1a'}`,
                  color: filter === f ? '#000' : '#444',
                  borderRadius: 6, padding: '6px 14px',
                  fontFamily: mono, fontSize: 10, letterSpacing: 2,
                  cursor: 'pointer', transition: 'all 0.15s',
                  textTransform: 'uppercase',
                }}>
                  {f} {f === 'all' ? `(${cards.length})` : `(${cards.filter(c => c.status === f).length})`}
                </button>
              ))}
            </div>

            <div style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 12, overflow: 'hidden' }}>
              {loading ? (
                <div style={{ padding: 40, textAlign: 'center', fontFamily: mono, fontSize: 11, color: '#333' }}>
                  LOADING...
                </div>
              ) : (
                <Table rows={filteredCards.map(c => ({
                  id: c.id,
                  status: c.status,
                  amount_sats: c.amountSats,
                  design: c.designId,
                  redeemed_to: c.redeemedTo || '—',
                  redeemed_at: c.redeemedAt || null,
                  created_at: c.createdAt,
                }))} />
              )}
            </div>
          </>
        )}

        {/* MARKETPLACE TAB */}
        {tab === 'marketplace' && (
          <div style={{
            border: '1px dashed #1a1a1a', borderRadius: 12,
            padding: '80px 40px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🛍️</div>
            <div style={{ fontFamily: display, fontSize: 24, fontWeight: 800, color: '#222', marginBottom: 8 }}>
              Marketplace Coming Soon
            </div>
            <div style={{ fontFamily: mono, fontSize: 11, color: '#2a2a2a', letterSpacing: 1 }}>
              DESIGNER STATS, REVENUE SPLITS, AND LISTINGS WILL APPEAR HERE
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
