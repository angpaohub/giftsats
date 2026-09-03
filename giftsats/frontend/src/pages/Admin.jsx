import { useState, useEffect, useCallback } from 'react';
import QR from '../components/QR.jsx';

const BACKEND = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || 'http://localhost:3001';

// The admin key lives only in sessionStorage: it survives a page refresh
// (so you don't retype it on every reload) but disappears the moment this
// tab/window closes — it never lingers on disk the way localStorage would.
const ADMIN_KEY_STORAGE = 'giftsats_admin_key';

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
      background: '#0d0d0d', border: `1px solid #1a1a1a`,
      borderTop: `2px solid ${accent}`, borderRadius: 12,
      padding: '28px 24px', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 0, right: 0, width: 80, height: 80, background: `radial-gradient(circle at top right, ${accent}15, transparent 70%)`, pointerEvents: 'none' }} />
      <div style={{ fontFamily: mono, fontSize: 10, color: '#444', letterSpacing: 3, marginBottom: 12, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontFamily: display, fontSize: 38, fontWeight: 800, color: '#fff', letterSpacing: '-1px', lineHeight: 1 }}>{displayValue}</div>
      {sub && <div style={{ fontFamily: mono, fontSize: 11, color: '#444', marginTop: 8 }}>{sub}</div>}
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
        <span style={{ background: active ? '#F7931A' : '#1a1a1a', color: active ? '#000' : '#444', borderRadius: 4, padding: '1px 6px', fontSize: 9 }}>
          {badge}
        </span>
      )}
    </button>
  );
}

// ── Expiry badge helper ──────────────────────────────────
function expiryInfo(card) {
  if (!card.expiresAt) return null;
  const now = new Date();
  const exp = new Date(card.expiresAt);
  const diffDays = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
  // Final outcomes take priority — these are done, not "expiring"
  if (card.refundStatus === 'refunded' || card.refundStatus === 'forfeited') return null;
  if (card.status === 'redeemed') return null;
  if (now > exp) return { label: 'EXPIRED', color: '#ff4444', urgent: true };
  if (diffDays <= 3) return { label: `${diffDays}d left`, color: '#ff6b35', urgent: true };
  if (diffDays <= 7) return { label: `${diffDays}d left`, color: '#F7931A', urgent: false };
  return { label: `${diffDays}d left`, color: '#444', urgent: false };
}

// ── Cards table with expiry column ──────────────────────
function CardsTable({ rows, allCards }) {
  if (!rows || rows.length === 0) {
    return (
      <div style={{ fontFamily: mono, fontSize: 12, color: '#333', padding: '40px', textAlign: 'center', border: '1px dashed #1a1a1a', borderRadius: 10 }}>
        NO DATA YET
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: mono, fontSize: 11 }}>
        <thead>
          <tr>
            {['ID', 'STATUS', 'AMOUNT', 'DESIGN', 'EXPIRES', 'REFUND ADDR', 'REDEEMED TO', 'CREATED'].map(col => (
              <th key={col} style={{ textAlign: 'left', padding: '10px 14px', color: '#444', letterSpacing: 2, fontSize: 10, borderBottom: '1px solid #1a1a1a', whiteSpace: 'nowrap' }}>
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((card, i) => {
            const exp = expiryInfo(card);
            const isExpiredRow = exp?.label === 'EXPIRED';
            return (
              <tr key={i}
                style={{ borderBottom: '1px solid #111', background: isExpiredRow ? '#1a0808' : 'transparent' }}
                onMouseEnter={e => e.currentTarget.style.background = isExpiredRow ? '#220a0a' : '#0f0f0f'}
                onMouseLeave={e => e.currentTarget.style.background = isExpiredRow ? '#1a0808' : 'transparent'}
              >
                {/* ID */}
                <td style={{ padding: '12px 14px', color: '#333', whiteSpace: 'nowrap' }}>
                  {card.id ? card.id.slice(0, 8) + '...' : '—'}
                </td>

                {/* STATUS */}
                <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                  {(() => {
                    const statusColors = { minted: '#F7931A', redeemed: '#39ff14', pending: '#555' };
                    let displayStatus = card.status?.toUpperCase();
                    let displayColor = statusColors[card.status] || '#555';
                    // Final refund outcomes override raw status
                    if (card.refundStatus === 'refunded') {
                      displayStatus = 'REFUNDED'; displayColor = '#3b9eff';
                    } else if (card.refundStatus === 'forfeited') {
                      displayStatus = 'FORFEITED'; displayColor = '#9b6dff';
                    } else if (isExpiredRow) {
                      displayStatus = 'EXPIRED'; displayColor = '#ff4444';
                    }
                    return (
                      <span style={{ background: displayColor + '15', border: `1px solid ${displayColor}44`, color: displayColor, borderRadius: 4, padding: '2px 8px', fontSize: 10, letterSpacing: 1 }}>
                        {displayStatus}
                      </span>
                    );
                  })()}
                </td>

                {/* AMOUNT */}
                <td style={{ padding: '12px 14px', color: '#888', whiteSpace: 'nowrap' }}>
                  {card.amountSats?.toLocaleString()} sats
                </td>

                {/* DESIGN */}
                <td style={{ padding: '12px 14px', color: '#555', whiteSpace: 'nowrap' }}>
                  {card.designId || '—'}
                </td>

                {/* EXPIRES */}
                <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                  {card.expiresAt ? (
                    <div>
                      <div style={{ color: exp?.color || '#444', fontSize: 10 }}>
                        {exp?.urgent && '⚠ '}{exp?.label || ''}
                      </div>
                      <div style={{ color: '#333', fontSize: 10, marginTop: 2 }}>
                        {new Date(card.expiresAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </div>
                    </div>
                  ) : '—'}
                </td>

                {/* REFUND ADDR */}
                <td style={{ padding: '12px 14px', color: '#444', whiteSpace: 'nowrap', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {card.senderLightningAddress ? (
                    <span style={{ color: '#39ff14', opacity: 0.6 }} title={card.senderLightningAddress}>
                      ✓ {card.senderLightningAddress.slice(0, 20)}{card.senderLightningAddress.length > 20 ? '...' : ''}
                    </span>
                  ) : (
                    <span style={{ color: '#2a2a2a' }}>none (forfeit)</span>
                  )}
                </td>

                {/* REDEEMED TO */}
                <td style={{ padding: '12px 14px', color: '#444', whiteSpace: 'nowrap' }}>
                  {card.redeemedTo ? card.redeemedTo.slice(0, 20) + '...' : '—'}
                </td>

                {/* CREATED */}
                <td style={{ padding: '12px 14px', color: '#333', whiteSpace: 'nowrap' }}>
                  {card.createdAt ? new Date(card.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Admin key gate ───────────────────────────────────────
// /api/admin/* and /api/channel-balance now require an X-Admin-Key header
// (see requireAdminKey in the backend), so this screen collects the key and
// verifies it against a real gated endpoint before showing the dashboard.
function AdminLogin({ onSubmit }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!value.trim() || checking) return;
    setChecking(true);
    setError('');
    const result = await onSubmit(value.trim());
    setChecking(false);
    if (!result.ok) {
      setError(
        result.reason === 'wrong'
          ? 'Wrong admin key'
          : 'Could not reach the server — check your connection and try again (this is not necessarily a wrong key)'
      );
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#080808', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <form onSubmit={handleSubmit} style={{ width: 320, background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 12, padding: 32 }}>
        <div style={{ fontFamily: display, fontWeight: 800, fontSize: 18, color: '#F7931A', marginBottom: 4 }}>GiftSats</div>
        <div style={{ fontFamily: mono, fontSize: 10, color: '#444', letterSpacing: 2, marginBottom: 24 }}>/ ADMIN LOGIN</div>
        <input
          type="password"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Admin key"
          style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', background: '#000', border: '1px solid #222', borderRadius: 6, color: '#fff', fontFamily: mono, fontSize: 13, marginBottom: 12 }}
        />
        {error && <div style={{ fontFamily: mono, fontSize: 11, color: '#ff4444', marginBottom: 12 }}>{error}</div>}
        <button type="submit" disabled={checking} style={{ width: '100%', padding: '10px', background: '#F7931A', border: 'none', borderRadius: 6, color: '#000', fontFamily: mono, fontWeight: 700, fontSize: 11, letterSpacing: 1, cursor: checking ? 'default' : 'pointer', opacity: checking ? 0.6 : 1 }}>
          {checking ? 'CHECKING…' : 'ENTER'}
        </button>
      </form>
    </div>
  );
}

export default function Admin() {
  const [adminKey, setAdminKeyState] = useState(() => {
    try { return sessionStorage.getItem(ADMIN_KEY_STORAGE) || ''; } catch { return ''; }
  });

  function persistKey(key) {
    setAdminKeyState(key);
    try { sessionStorage.setItem(ADMIN_KEY_STORAGE, key); } catch { /* private-browsing etc — key just won't survive a refresh */ }
  }

  function clearKey() {
    setAdminKeyState('');
    try { sessionStorage.removeItem(ADMIN_KEY_STORAGE); } catch {}
  }

  // Verifies the key against /api/admin/ping — a check-only endpoint that
  // touches nothing but the header (no LND/DB/R2 call), so a temporary
  // node or database hiccup can never masquerade as "wrong key" here.
  async function handleLogin(key) {
    try {
      const res = await fetch(`${BACKEND}/api/admin/ping`, { headers: { 'X-Admin-Key': key } });
      if (res.status === 403) return { ok: false, reason: 'wrong' };
      if (!res.ok) return { ok: false, reason: 'server' };
      persistKey(key);
      return { ok: true };
    } catch {
      return { ok: false, reason: 'network' };
    }
  }

  if (!adminKey) {
    return <AdminLogin onSubmit={handleLogin} />;
  }

  return <AdminDashboard adminKey={adminKey} onAuthError={clearKey} />;
}

function AdminDashboard({ adminKey, onAuthError }) {
  const [stats, setStats] = useState(null);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');
  const [lastRefresh, setLastRefresh] = useState(null);
  const [filter, setFilter] = useState('all');
  const [channelBalance, setChannelBalance] = useState(null);
  const [r2Stats, setR2Stats] = useState(null);

  // Every admin-gated request goes through here so a wrong/revoked key
  // bounces back to the login screen instead of silently rendering empty
  // data. /api/stats is not gated (public), so it's called with plain fetch.
  const adminFetch = useCallback(async (path, options = {}) => {
    const res = await fetch(`${BACKEND}${path}`, {
      ...options,
      headers: { ...(options.headers || {}), 'X-Admin-Key': adminKey },
    });
    if (res.status === 401 || res.status === 403) onAuthError();
    return res;
  }, [adminKey, onAuthError]);

  async function fetchData() {
    setLoading(true);
    try {
      const [statsRes, cardsRes, balanceRes, r2Res] = await Promise.all([
        fetch(`${BACKEND}/api/stats`),
        adminFetch('/api/admin/cards'),
        adminFetch('/api/channel-balance'),
        adminFetch('/api/admin/r2-stats'),
      ]);
      const statsData = await statsRes.json();
      const cardsData = cardsRes.ok ? await cardsRes.json() : [];
      const balanceData = balanceRes.ok ? await balanceRes.json() : null;
      const r2Data = r2Res.ok ? await r2Res.json() : null;
      setStats(statsData);
      setCards(Array.isArray(cardsData) ? cardsData : []);
      setChannelBalance(balanceData);
      setR2Stats(r2Data);
      setLastRefresh(new Date());
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, []);

  // Derived counts
  const now = new Date();
  const pendingCount   = cards.filter(c => c.status === 'pending').length;
  const mintedCount    = cards.filter(c => c.status === 'minted' && c.refundStatus === 'none' && c.expiresAt && new Date(c.expiresAt) >= now).length;
  const redeemedCount  = cards.filter(c => c.status === 'redeemed' && c.refundStatus === 'none').length;
  // Expired but cron hasn't processed yet (still refund_status none)
  const expiredCount   = cards.filter(c => c.status === 'minted' && c.refundStatus === 'none' && c.expiresAt && new Date(c.expiresAt) < now).length;
  const expiringCount  = cards.filter(c => c.status === 'minted' && c.refundStatus === 'none' && c.expiresAt && new Date(c.expiresAt) > now && Math.ceil((new Date(c.expiresAt) - now) / (1000*60*60*24)) <= 7).length;
  // Final outcomes (cron has processed)
  const refundedCount  = cards.filter(c => c.refundStatus === 'refunded').length;
  const forfeitedCount = cards.filter(c => c.refundStatus === 'forfeited').length;
  const forfeitableSats = cards.filter(c => c.status === 'minted' && c.refundStatus === 'none' && c.expiresAt && new Date(c.expiresAt) < now && !c.senderLightningAddress).reduce((s, c) => s + (c.amountSats || 0), 0);
  const refundableSats  = cards.filter(c => c.status === 'minted' && c.refundStatus === 'none' && c.expiresAt && new Date(c.expiresAt) < now && c.senderLightningAddress).reduce((s, c) => s + (c.amountSats || 0), 0);

  // Filtered cards for table
  const filteredCards = (() => {
    if (filter === 'expired') return cards.filter(c => c.status === 'minted' && c.refundStatus === 'none' && c.expiresAt && new Date(c.expiresAt) < now);
    if (filter === 'expiring') return cards.filter(c => c.status === 'minted' && c.refundStatus === 'none' && c.expiresAt && new Date(c.expiresAt) > now && Math.ceil((new Date(c.expiresAt) - now) / (1000*60*60*24)) <= 7);
    if (filter === 'minted') return cards.filter(c => c.status === 'minted' && c.refundStatus === 'none' && c.expiresAt && new Date(c.expiresAt) >= now);
    if (filter === 'redeemed') return cards.filter(c => c.status === 'redeemed' && c.refundStatus === 'none');
    if (filter === 'refunded') return cards.filter(c => c.refundStatus === 'refunded');
    if (filter === 'forfeited') return cards.filter(c => c.refundStatus === 'forfeited');
    if (filter === 'all') return cards;
    return cards.filter(c => c.status === filter);
  })();

  return (
    <div style={{ minHeight: '100vh', background: '#080808', color: '#fff', padding: 0 }}>
      {/* Top bar */}
      <div style={{ borderBottom: '1px solid #111', padding: '0 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56, position: 'sticky', top: 0, background: '#080808', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontFamily: display, fontWeight: 800, fontSize: 16, color: '#F7931A' }}>GiftSats</span>
          <span style={{ fontFamily: mono, fontSize: 10, color: '#222', letterSpacing: 2 }}>/ ADMIN</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {lastRefresh && <span style={{ fontFamily: mono, fontSize: 10, color: '#2a2a2a' }}>UPDATED {lastRefresh.toLocaleTimeString('en-GB')}</span>}
          <button onClick={fetchData} style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 6, color: '#444', fontFamily: mono, fontSize: 10, letterSpacing: 2, padding: '6px 14px', cursor: 'pointer' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#F7931A33'; e.currentTarget.style.color = '#F7931A'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#1a1a1a'; e.currentTarget.style.color = '#444'; }}
          >↻ REFRESH</button>
        </div>
      </div>

      <div style={{ padding: '40px' }}>
        {/* Nav tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #111', marginBottom: 40 }}>
          <NavTab label="Overview" active={tab === 'overview'} onClick={() => setTab('overview')} />
          <NavTab label="Cards" active={tab === 'cards'} onClick={() => setTab('cards')} badge={cards.length} />
          <NavTab label="Expiry" active={tab === 'expiry'} onClick={() => setTab('expiry')} badge={expiredCount > 0 ? expiredCount : expiringCount > 0 ? `${expiringCount}⚠` : null} />
          <NavTab label="Marketplace" active={tab === 'marketplace'} onClick={() => setTab('marketplace')} />
          <NavTab label="Node" active={tab === 'node'} onClick={() => setTab('node')} />
        </div>

        {/* OVERVIEW TAB */}
        {tab === 'overview' && (
          <>
            {/* Node capacity banner */}
            {channelBalance && (
              <div style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 12, padding: '20px 24px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                <div>
                  <div style={{ fontFamily: mono, fontSize: 10, color: '#333', letterSpacing: 3, marginBottom: 8 }}>NODE CAPACITY — LIVE</div>
                  <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontFamily: mono, fontSize: 10, color: '#555', marginBottom: 4 }}>MAX MINTABLE NOW</div>
                      <div style={{ fontFamily: display, fontSize: 28, fontWeight: 800, color: '#39ff14' }}>{(channelBalance.remoteSats || 0).toLocaleString()}</div>
                      <div style={{ fontFamily: mono, fontSize: 10, color: '#333', marginTop: 2 }}>sats inbound</div>
                    </div>
                    <div>
                      <div style={{ fontFamily: mono, fontSize: 10, color: '#555', marginBottom: 4 }}>MAX REDEEMABLE NOW</div>
                      <div style={{ fontFamily: display, fontSize: 28, fontWeight: 800, color: '#F7931A' }}>{(channelBalance.localSats || 0).toLocaleString()}</div>
                      <div style={{ fontFamily: mono, fontSize: 10, color: '#333', marginTop: 2 }}>sats outbound</div>
                    </div>
                  </div>
                </div>
                {/* Capacity bar */}
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontFamily: mono, fontSize: 10, color: '#333', marginBottom: 8 }}>INBOUND / OUTBOUND RATIO</div>
                  {(() => {
                    const total = (channelBalance.remoteSats || 0) + (channelBalance.localSats || 0);
                    const inPct = total > 0 ? Math.round((channelBalance.remoteSats / total) * 100) : 0;
                    return (
                      <div>
                        <div style={{ height: 8, background: '#1a1a1a', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${inPct}%`, background: 'linear-gradient(90deg, #39ff14, #F7931A)', borderRadius: 4, transition: 'width 0.6s ease' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontFamily: mono, fontSize: 10, color: '#444' }}>
                          <span style={{ color: '#39ff14' }}>IN {inPct}%</span>
                          <span style={{ color: '#F7931A' }}>OUT {100 - inPct}%</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* R2 Storage banner */}
            {r2Stats && (
              <div style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 12, padding: '20px 24px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                <div>
                  <div style={{ fontFamily: mono, fontSize: 10, color: '#333', letterSpacing: 3, marginBottom: 8 }}>R2 STORAGE — DESIGNS</div>
                  <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontFamily: mono, fontSize: 10, color: '#555', marginBottom: 4 }}>USED</div>
                      <div style={{ fontFamily: display, fontSize: 28, fontWeight: 800, color: '#a78bfa' }}>{r2Stats.usedGB.toFixed(3)}</div>
                      <div style={{ fontFamily: mono, fontSize: 10, color: '#333', marginTop: 2 }}>GB</div>
                    </div>
                    <div>
                      <div style={{ fontFamily: mono, fontSize: 10, color: '#555', marginBottom: 4 }}>FREE REMAINING</div>
                      <div style={{ fontFamily: display, fontSize: 28, fontWeight: 800, color: '#39ff14' }}>{(10 - r2Stats.usedGB).toFixed(3)}</div>
                      <div style={{ fontFamily: mono, fontSize: 10, color: '#333', marginTop: 2 }}>GB of 10 GB</div>
                    </div>
                    <div>
                      <div style={{ fontFamily: mono, fontSize: 10, color: '#555', marginBottom: 4 }}>FILES</div>
                      <div style={{ fontFamily: display, fontSize: 28, fontWeight: 800, color: '#F7931A' }}>{r2Stats.objectCount}</div>
                      <div style={{ fontFamily: mono, fontSize: 10, color: '#333', marginTop: 2 }}>design images</div>
                    </div>
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontFamily: mono, fontSize: 10, color: '#333', marginBottom: 8 }}>STORAGE USAGE</div>
                  {(() => {
                    const pct = Math.min((r2Stats.usedGB / 10) * 100, 100);
                    const color = pct > 80 ? '#ff4444' : pct > 50 ? '#F7931A' : '#39ff14';
                    return (
                      <div>
                        <div style={{ height: 8, background: '#1a1a1a', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4, transition: 'width 0.6s ease' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontFamily: mono, fontSize: 10, color: '#444' }}>
                          <span style={{ color }}>{pct.toFixed(1)}% used</span>
                          <span>10 GB free tier</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 40 }}>
              <StatCard label="Total Redeemed" value={redeemedCount} sub="claimed by recipient" accent="#39ff14" animate />
              <StatCard label="Sats Redeemed" value={stats?.redeemed_sats ?? 0} sub={`≈ $${(((parseInt(stats?.redeemed_sats) || 0) / 100_000_000) * 103000).toFixed(2)} USD`} accent="#F7931A" animate />
              <StatCard label="Active Cards" value={mintedCount} sub="awaiting redemption" accent="#00C97A" animate />
              <StatCard label="Refunded" value={refundedCount} sub={`${stats?.refunded_sats ?? 0} sats → senders`} accent="#3b9eff" animate />
              <StatCard label="Forfeited" value={forfeitedCount} sub={`${stats?.forfeited_sats ?? 0} sats kept`} accent="#9b6dff" animate />
              <StatCard label="Pending Refund/Forfeit" value={expiredCount} sub="expired, awaiting cron" accent="#ff4444" animate />
            </div>

            {/* Status breakdown */}
            <div style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 12, padding: '24px', marginBottom: 20 }}>
              <div style={{ fontFamily: mono, fontSize: 10, color: '#333', letterSpacing: 3, marginBottom: 20 }}>CARD STATUS BREAKDOWN</div>
              <div style={{ display: 'flex', gap: 0, flexWrap: 'wrap' }}>
                {[
                  { label: 'PENDING', count: pendingCount, color: '#555' },
                  { label: 'MINTED', count: mintedCount, color: '#F7931A' },
                  { label: 'REDEEMED', count: redeemedCount, color: '#39ff14' },
                  { label: 'EXPIRING 7D', count: expiringCount, color: '#F7931A' },
                  { label: 'EXPIRED', count: expiredCount, color: '#ff4444' },
                  { label: 'REFUNDED', count: refundedCount, color: '#3b9eff' },
                  { label: 'FORFEITED', count: forfeitedCount, color: '#9b6dff' },
                ].map(({ label, count, color }) => {
                  const pct = cards.length > 0 ? Math.round((count / cards.length) * 100) : 0;
                  return (
                    <div key={label} style={{ flex: 1, minWidth: 120, borderLeft: `2px solid ${color}`, paddingLeft: 16, marginRight: 32, marginBottom: 16 }}>
                      <div style={{ fontFamily: mono, fontSize: 9, color, letterSpacing: 2, marginBottom: 6 }}>{label}</div>
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
            <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
              {[
                { key: 'all', label: `ALL (${cards.length})` },
                { key: 'pending', label: `PENDING (${pendingCount})` },
                { key: 'minted', label: `MINTED (${mintedCount})` },
                { key: 'redeemed', label: `REDEEMED (${redeemedCount})` },
                { key: 'expired', label: `EXPIRED (${expiredCount})`, accent: '#ff4444' },
                { key: 'expiring', label: `EXPIRING ≤7D (${expiringCount})`, accent: '#F7931A' },
                { key: 'refunded', label: `REFUNDED (${refundedCount})`, accent: '#3b9eff' },
                { key: 'forfeited', label: `FORFEITED (${forfeitedCount})`, accent: '#9b6dff' },
              ].map(({ key, label, accent }) => (
                <button key={key} onClick={() => setFilter(key)} style={{
                  background: filter === key ? (accent || '#F7931A') : '#111',
                  border: `1px solid ${filter === key ? (accent || '#F7931A') : '#1a1a1a'}`,
                  color: filter === key ? '#000' : (accent || '#444'),
                  borderRadius: 6, padding: '6px 14px',
                  fontFamily: mono, fontSize: 10, letterSpacing: 2,
                  cursor: 'pointer', transition: 'all 0.15s',
                }}>
                  {label}
                </button>
              ))}
            </div>

            <div style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 12, overflow: 'hidden' }}>
              {loading ? (
                <div style={{ padding: 40, textAlign: 'center', fontFamily: mono, fontSize: 11, color: '#333' }}>LOADING...</div>
              ) : (
                <CardsTable rows={filteredCards} allCards={cards} />
              )}
            </div>
          </>
        )}

        {/* EXPIRY TAB */}
        {tab === 'expiry' && (
          <>
            {/* Expiry summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 32 }}>
              <StatCard label="Expired Cards" value={expiredCount} sub="awaiting cron job" accent="#ff4444" animate />
              <StatCard label="Expiring ≤7 Days" value={expiringCount} sub="active cards at risk" accent="#F7931A" animate />
              <StatCard label="Refundable Sats" value={refundableSats} sub="will be returned to sender" accent="#39ff14" animate />
              <StatCard label="Forfeitable Sats" value={forfeitableSats} sub="no refund address (platform)" accent="#7B61FF" animate />
            </div>

            {/* Expiry timeline — cards expiring soonest first */}
            <div style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 12, padding: '24px', marginBottom: 24 }}>
              <div style={{ fontFamily: mono, fontSize: 10, color: '#333', letterSpacing: 3, marginBottom: 20 }}>
                EXPIRY PIPELINE — ACTIVE CARDS SORTED BY EXPIRY
              </div>
              {(() => {
                const activeSorted = cards
                  .filter(c => c.status === 'minted' && c.expiresAt)
                  .sort((a, b) => new Date(a.expiresAt) - new Date(b.expiresAt));

                if (activeSorted.length === 0) {
                  return <div style={{ fontFamily: mono, fontSize: 11, color: '#222', padding: '20px 0' }}>No active cards with expiry data.</div>;
                }

                return (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: mono, fontSize: 11 }}>
                      <thead>
                        <tr>
                          {['ID', 'AMOUNT', 'EXPIRES', 'TIME LEFT', 'REFUND ADDR', 'OUTCOME'].map(col => (
                            <th key={col} style={{ textAlign: 'left', padding: '8px 14px', color: '#333', letterSpacing: 2, fontSize: 10, borderBottom: '1px solid #1a1a1a', whiteSpace: 'nowrap' }}>{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {activeSorted.map((card, i) => {
                          const exp = expiryInfo(card);
                          const isExp = exp?.label === 'EXPIRED';
                          return (
                            <tr key={i} style={{ borderBottom: '1px solid #0d0d0d', background: isExp ? '#1a080855' : 'transparent' }}>
                              <td style={{ padding: '10px 14px', color: '#333' }}>{card.id?.slice(0, 8)}...</td>
                              <td style={{ padding: '10px 14px', color: '#888' }}>{card.amountSats?.toLocaleString()} sats</td>
                              <td style={{ padding: '10px 14px', color: '#444' }}>
                                {new Date(card.expiresAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </td>
                              <td style={{ padding: '10px 14px' }}>
                                <span style={{ color: exp?.color || '#555', fontWeight: exp?.urgent ? 700 : 400 }}>
                                  {exp?.urgent && '⚠ '}{exp?.label}
                                </span>
                              </td>
                              <td style={{ padding: '10px 14px' }}>
                                {card.senderLightningAddress
                                  ? <span style={{ color: '#39ff14', opacity: 0.7 }}>✓ {card.senderLightningAddress.slice(0, 22)}{card.senderLightningAddress.length > 22 ? '...' : ''}</span>
                                  : <span style={{ color: '#2a2a2a' }}>none</span>
                                }
                              </td>
                              <td style={{ padding: '10px 14px' }}>
                                {isExp ? (
                                  card.senderLightningAddress
                                    ? <span style={{ color: '#F7931A', fontSize: 10 }}>→ REFUND</span>
                                    : <span style={{ color: '#7B61FF', fontSize: 10 }}>→ FORFEIT</span>
                                ) : (
                                  <span style={{ color: '#222', fontSize: 10 }}>pending</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          </>
        )}

        {/* MARKETPLACE TAB */}
        {tab === 'marketplace' && (
          <DesignsTab BACKEND={BACKEND} mono={mono} display={display} adminFetch={adminFetch} />
        )}

        {/* NODE TAB */}
        {tab === 'node' && (
          <NodeTab adminFetch={adminFetch} mono={mono} display={display} />
        )}
      </div>
    </div>
  );
}

function DesignsTab({ BACKEND, mono, display, adminFetch }) {
  const [designs, setDesigns] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await adminFetch('/api/admin/designs');
      const data = res.ok ? await res.json() : [];
      setDesigns(Array.isArray(data) ? data : []);
    } catch {}
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function takedown(id, name) {
    if (!confirm(`Take down "${name}"? It will be hidden from the marketplace.`)) return;
    await adminFetch(`/api/admin/designs/${id}/takedown`, { method: 'PATCH' });
    load();
  }

  async function restore(id) {
    await adminFetch(`/api/admin/designs/${id}/restore`, { method: 'PATCH' });
    load();
  }

  const active = designs.filter(d => d.active);
  const hidden = designs.filter(d => !d.active);

  const thumb = (d) => (
    <div style={{ width: 90, height: 56, borderRadius: 6, overflow: 'hidden', flexShrink: 0, background: '#1a1a1a' }}>
      {d.imageUrl
        ? <img src={d.imageUrl} alt={d.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🎨</div>
      }
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <div style={{ fontFamily: display, fontSize: 20, fontWeight: 700, color: '#fff' }}>Marketplace Designs</div>
          <div style={{ fontFamily: mono, fontSize: 11, color: '#444', marginTop: 4, letterSpacing: 1 }}>
            {active.length} ACTIVE · {hidden.length} HIDDEN
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <a href="/explore" target="_blank" style={{ fontFamily: mono, fontSize: 11, color: '#F7931A', textDecoration: 'none', border: '1px solid #F7931A33', padding: '8px 16px', borderRadius: 6, letterSpacing: 1 }}>VIEW MARKETPLACE ↗</a>
          <a href="/design" target="_blank" style={{ fontFamily: mono, fontSize: 11, color: '#888', textDecoration: 'none', border: '1px solid #2a2a2a', padding: '8px 16px', borderRadius: 6, letterSpacing: 1 }}>SUBMIT DESIGN ↗</a>
        </div>
      </div>

      {loading && <div style={{ fontFamily: mono, fontSize: 12, color: '#333', padding: '40px', textAlign: 'center' }}>LOADING...</div>}

      {!loading && designs.length === 0 && (
        <div style={{ fontFamily: mono, fontSize: 12, color: '#2a2a2a', padding: '80px 40px', textAlign: 'center', border: '1px dashed #1a1a1a', borderRadius: 12 }}>NO DESIGNS SUBMITTED YET</div>
      )}

      {!loading && active.map(d => (
        <div key={d.id} style={{ display: 'flex', gap: 16, alignItems: 'center', background: '#111', border: '1px solid #1e1e1e', borderRadius: 8, padding: '12px 16px', marginBottom: 10 }}>
          {thumb(d)}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: display, fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 3 }}>{d.name}</div>
            <div style={{ fontFamily: mono, fontSize: 11, color: '#555', marginBottom: 3 }}>by {d.designerName} · <span style={{ color: '#F7931A' }}>{d.id}</span></div>
            <div style={{ fontFamily: mono, fontSize: 10, color: '#444' }}>
              {d.priceSats === 0 ? 'Free' : `${d.priceSats.toLocaleString()} sats/use`} · {d.useCount} uses · <span style={{ color: '#39ff1460' }}>{d.lightningAddress}</span>
            </div>
          </div>
          <button onClick={() => takedown(d.id, d.name)} style={{ padding: '7px 14px', background: 'transparent', border: '1px solid #ef444433', borderRadius: 6, color: '#ef4444', fontFamily: mono, fontSize: 10, letterSpacing: 1, cursor: 'pointer', flexShrink: 0 }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#ef4444'}
            onMouseLeave={e => e.currentTarget.style.borderColor = '#ef444433'}
          >TAKE DOWN</button>
        </div>
      ))}

      {!loading && hidden.length > 0 && (
        <>
          <div style={{ fontFamily: mono, fontSize: 10, color: '#2a2a2a', letterSpacing: 3, margin: '28px 0 14px' }}>HIDDEN DESIGNS</div>
          {hidden.map(d => (
            <div key={d.id} style={{ display: 'flex', gap: 16, alignItems: 'center', background: '#0d0d0d', border: '1px solid #141414', borderRadius: 8, padding: '12px 16px', marginBottom: 10, opacity: 0.55 }}>
              {thumb(d)}
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: display, fontSize: 14, fontWeight: 700, color: '#555', marginBottom: 3 }}>{d.name}</div>
                <div style={{ fontFamily: mono, fontSize: 11, color: '#333' }}>by {d.designerName} · <span style={{ color: '#444' }}>{d.id}</span></div>
              </div>
              <button onClick={() => restore(d.id)} style={{ padding: '7px 14px', background: 'transparent', border: '1px solid #4ade8033', borderRadius: 6, color: '#4ade80', fontFamily: mono, fontSize: 10, letterSpacing: 1, cursor: 'pointer', flexShrink: 0 }}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#4ade80'}
                onMouseLeave={e => e.currentTarget.style.borderColor = '#4ade8033'}
              >RESTORE</button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ── Node tab — merges what used to be the standalone /admin/node page ───
// Loads lazily (only once this tab is opened), matching DesignsTab, so
// switching to other tabs and hitting REFRESH doesn't add extra LND round
// trips for data nobody's looking at.
//
// /admin/node itself is left running as-is — same route, same ?key= auth,
// untouched — so there's a working fallback if this tab ever has a problem.
function NodeTab({ adminFetch, mono, display }) {
  const [nodeInfo, setNodeInfo] = useState(null); // { info, balance, channels }
  const [nodeTxs, setNodeTxs] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [infoRes, txRes] = await Promise.all([
        adminFetch('/api/admin/node-info'),
        adminFetch('/api/admin/node-transactions'),
      ]);
      setNodeInfo(infoRes.ok ? await infoRes.json() : null);
      const txData = txRes.ok ? await txRes.json() : [];
      setNodeTxs(Array.isArray(txData) ? txData : []);
    } catch {
      setNodeInfo(null);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  // ── Receive ──────────────────────────────────────────
  const [recvAmt, setRecvAmt] = useState('');
  const [recvInvoice, setRecvInvoice] = useState('');
  const [recvError, setRecvError] = useState('');
  const [recvBusy, setRecvBusy] = useState(false);

  async function createInvoice() {
    const amt = parseInt(recvAmt);
    if (!amt || amt < 1) { setRecvError('Enter an amount'); return; }
    setRecvBusy(true);
    setRecvError('');
    setRecvInvoice('');
    try {
      const res = await adminFetch('/admin/action/create-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountSats: amt, memo: 'Admin receive' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create invoice');
      setRecvInvoice(data.paymentRequest);
    } catch (e) {
      setRecvError(e.message);
    }
    setRecvBusy(false);
  }

  // ── Send ─────────────────────────────────────────────
  // payKey lives only in this component's local state — never persisted
  // (not sessionStorage, not the parent's adminKey) — so a payment always
  // requires typing the Pay Authorization Key fresh, same as /admin/node.
  const [sendDest, setSendDest] = useState('');
  const [sendAmt, setSendAmt] = useState('');
  const [payKey, setPayKey] = useState('');
  const [sendResult, setSendResult] = useState(null); // { ok, msg }
  const [sendBusy, setSendBusy] = useState(false);

  async function sendPay() {
    if (!sendDest.trim() || !payKey) {
      setSendResult({ ok: false, msg: 'Destination and Pay Authorization Key are required' });
      return;
    }
    setSendBusy(true);
    setSendResult(null);
    try {
      const res = await adminFetch('/admin/action/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destination: sendDest.trim(), amountSats: sendAmt || undefined, payKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Payment failed');
      setSendResult({ ok: true, msg: `Sent — preimage: ${data.preimage}` });
      // Clear the form (payKey included) after a successful send so the
      // next payment can't be fired off by accident with a stale key.
      setSendDest('');
      setSendAmt('');
      setPayKey('');
    } catch (e) {
      setSendResult({ ok: false, msg: e.message });
    }
    setSendBusy(false);
  }

  if (loading) {
    return <div style={{ fontFamily: mono, fontSize: 12, color: '#333', padding: '40px', textAlign: 'center' }}>LOADING NODE STATUS...</div>;
  }

  if (!nodeInfo) {
    return (
      <div style={{ fontFamily: mono, fontSize: 12, color: '#ff4444', padding: '40px', textAlign: 'center', border: '1px dashed #331111', borderRadius: 12 }}>
        Could not load node status. The LND node may be unreachable right now — try REFRESH, or use /admin/node directly.
      </div>
    );
  }

  const { info, balance, channels } = nodeInfo;
  const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', marginBottom: 8, background: '#000', border: '1px solid #222', borderRadius: 6, color: '#fff', fontFamily: mono, fontSize: 12 };
  const buttonStyle = (busy) => ({ width: '100%', padding: 8, background: '#F7931A', border: 'none', borderRadius: 6, color: '#000', fontFamily: mono, fontWeight: 700, fontSize: 11, letterSpacing: 1, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 });

  return (
    <div>
      <div style={{ fontFamily: mono, fontSize: 11, color: '#666', marginBottom: 24 }}>
        {info?.alias || '(no alias)'} · {info?.identity_pubkey?.slice(0, 16)}...
        · block {info?.block_height?.toLocaleString()}
        · synced: <span style={{ color: info?.synced_to_chain ? '#39ff14' : '#ff6b6b' }}>{info?.synced_to_chain ? 'yes' : 'no'}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 32 }}>
        <StatCard label="Local Balance" value={balance?.localSats || 0} sub="sats — max redeemable" accent="#F7931A" />
        <StatCard label="Remote Balance" value={balance?.remoteSats || 0} sub="sats — max mintable" accent="#39ff14" />
        <StatCard label="Active Channels" value={channels.filter(c => c.active).length} sub={`of ${channels.length}`} accent="#3b9eff" />
        <StatCard label="Peers" value={info?.num_peers || 0} accent="#9b6dff" />
      </div>

      {/* Receive / Send */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 32 }}>
        <div style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 12, padding: 20, minWidth: 280, flex: 1 }}>
          <div style={{ fontFamily: mono, fontSize: 10, color: '#666', letterSpacing: 2, marginBottom: 14 }}>RECEIVE — CREATE INVOICE</div>
          <input type="number" placeholder="Amount (sats)" value={recvAmt} onChange={(e) => setRecvAmt(e.target.value)} style={inputStyle} />
          <button onClick={createInvoice} disabled={recvBusy} style={buttonStyle(recvBusy)}>
            {recvBusy ? 'CREATING…' : 'CREATE INVOICE'}
          </button>
          {recvError && <div style={{ fontFamily: mono, fontSize: 11, color: '#ff4444', marginTop: 10 }}>{recvError}</div>}
          {recvInvoice && (
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              {/* Drawn locally with the same QR component used on the redeem
                  flow — nothing about the invoice is sent to a third party
                  the way the old /admin/node page sent it to api.qrserver.com. */}
              <QR value={recvInvoice} size={180} dark="#000" light="#fff" />
              <div style={{ fontFamily: mono, fontSize: 10, color: '#666', wordBreak: 'break-all', textAlign: 'center' }}>{recvInvoice}</div>
            </div>
          )}
        </div>

        <div style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 12, padding: 20, minWidth: 280, flex: 1 }}>
          <div style={{ fontFamily: mono, fontSize: 10, color: '#666', letterSpacing: 2, marginBottom: 14 }}>SEND — BOLT11 OR LIGHTNING ADDRESS</div>
          <input type="text" placeholder="lnbc... or name@domain.com" value={sendDest} onChange={(e) => setSendDest(e.target.value)} style={inputStyle} />
          <input type="number" placeholder="Amount in sats (Lightning address only)" value={sendAmt} onChange={(e) => setSendAmt(e.target.value)} style={inputStyle} />
          <div style={{ fontFamily: mono, fontSize: 10, color: '#555', marginBottom: 6 }}>Requires a separate Pay Authorization Key — not remembered between payments.</div>
          <input type="password" placeholder="Pay Authorization Key" value={payKey} onChange={(e) => setPayKey(e.target.value)} style={inputStyle} />
          <button onClick={sendPay} disabled={sendBusy} style={buttonStyle(sendBusy)}>
            {sendBusy ? 'SENDING…' : 'PAY'}
          </button>
          {sendResult && (
            <div style={{ fontFamily: mono, fontSize: 11, marginTop: 10, wordBreak: 'break-all', color: sendResult.ok ? '#39ff14' : '#ff4444' }}>
              {sendResult.ok ? '✓ ' : '✕ '}{sendResult.msg}
            </div>
          )}
        </div>
      </div>

      {/* Channels */}
      <div style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 12, padding: 24, marginBottom: 24, overflowX: 'auto' }}>
        <div style={{ fontFamily: mono, fontSize: 10, color: '#333', letterSpacing: 3, marginBottom: 16 }}>CHANNELS</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: mono, fontSize: 11 }}>
          <thead>
            <tr>
              {['Peer', 'Status', 'Capacity', 'Local', 'Remote', 'Reserve', 'Spendable', 'Type'].map((col) => (
                <th key={col} style={{ textAlign: 'left', padding: '8px 12px', color: '#444', letterSpacing: 1, fontSize: 10, borderBottom: '1px solid #1a1a1a', whiteSpace: 'nowrap' }}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {channels.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: 20, color: '#333', textAlign: 'center' }}>No channels yet</td></tr>
            ) : channels.map((ch, i) => {
              const cap = parseInt(ch.capacity);
              const local = parseInt(ch.local_balance);
              const remote = parseInt(ch.remote_balance);
              const reserve = parseInt(ch.local_chan_reserve_sat || 0);
              const spendable = Math.max(0, local - reserve);
              return (
                <tr key={i} style={{ borderBottom: '1px solid #111' }}>
                  <td style={{ padding: '8px 12px', color: '#888' }}>{ch.peer_alias || '(unknown)'}</td>
                  <td style={{ padding: '8px 12px' }}>{ch.active ? '🟢 active' : '🔴 inactive'}</td>
                  <td style={{ padding: '8px 12px', color: '#666' }}>{cap.toLocaleString()}</td>
                  <td style={{ padding: '8px 12px', color: '#666' }}>{local.toLocaleString()}</td>
                  <td style={{ padding: '8px 12px', color: '#666' }}>{remote.toLocaleString()}</td>
                  <td style={{ padding: '8px 12px', color: '#666' }}>{reserve.toLocaleString()}</td>
                  <td style={{ padding: '8px 12px', color: spendable > 0 ? '#39ff14' : '#ff6b6b' }}>{spendable.toLocaleString()}</td>
                  <td style={{ padding: '8px 12px', color: '#666' }}>{ch.private ? 'private' : 'public'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Transactions */}
      <div style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 12, padding: 24, overflowX: 'auto' }}>
        <div style={{ fontFamily: mono, fontSize: 10, color: '#333', letterSpacing: 3, marginBottom: 16 }}>RECENT TRANSACTIONS (LAST 50)</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: mono, fontSize: 11 }}>
          <thead>
            <tr>
              {['Time', 'Direction', 'Amount', 'Status', 'Fee', 'Details'].map((col) => (
                <th key={col} style={{ textAlign: 'left', padding: '8px 12px', color: '#444', letterSpacing: 1, fontSize: 10, borderBottom: '1px solid #1a1a1a', whiteSpace: 'nowrap' }}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {nodeTxs.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 20, color: '#333', textAlign: 'center' }}>No transactions yet</td></tr>
            ) : nodeTxs.map((tx, i) => {
              const dateStr = new Date(tx.time).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
              const dirColor = tx.direction === 'in' ? '#39ff14' : '#F7931A';
              const statusColor = tx.status === 'failed' ? '#ff6b6b' : (tx.status === 'succeeded' || tx.status === 'settled' ? '#39ff14' : '#888');
              return (
                <tr key={i} style={{ borderBottom: '1px solid #111' }}>
                  <td style={{ padding: '8px 12px', color: '#666' }}>{dateStr}</td>
                  <td style={{ padding: '8px 12px', color: dirColor }}>{tx.direction === 'in' ? '⬇ Received' : '⬆ Sent'}</td>
                  <td style={{ padding: '8px 12px', color: '#888' }}>{tx.amount.toLocaleString()} sats</td>
                  <td style={{ padding: '8px 12px', color: statusColor }}>{tx.status}</td>
                  <td style={{ padding: '8px 12px', color: '#555' }}>{tx.fee ? tx.fee.toLocaleString() + ' sats' : '—'}</td>
                  <td style={{ padding: '8px 12px', color: '#666', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.memo}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
