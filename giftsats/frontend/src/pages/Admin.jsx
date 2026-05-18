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
                    const c = statusColors[card.status] || '#555';
                    // override if expired
                    const displayStatus = isExpiredRow ? 'EXPIRED' : card.status?.toUpperCase();
                    const displayColor = isExpiredRow ? '#ff4444' : c;
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

export default function Admin() {
  const [stats, setStats] = useState(null);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');
  const [lastRefresh, setLastRefresh] = useState(null);
  const [filter, setFilter] = useState('all');
  const [channelBalance, setChannelBalance] = useState(null);

  async function fetchData() {
    setLoading(true);
    try {
      const [statsRes, cardsRes, balanceRes] = await Promise.all([
        fetch(`${BACKEND}/api/stats`),
        fetch(`${BACKEND}/api/admin/cards`),
        fetch(`${BACKEND}/api/channel-balance`),
      ]);
      const statsData = await statsRes.json();
      const cardsData = cardsRes.ok ? await cardsRes.json() : [];
      const balanceData = balanceRes.ok ? await balanceRes.json() : null;
      setStats(statsData);
      setCards(Array.isArray(cardsData) ? cardsData : []);
      setChannelBalance(balanceData);
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
  const mintedCount    = cards.filter(c => c.status === 'minted').length;
  const redeemedCount  = cards.filter(c => c.status === 'redeemed').length;
  const expiredCount   = cards.filter(c => c.status === 'minted' && c.expiresAt && new Date(c.expiresAt) < now).length;
  const expiringCount  = cards.filter(c => c.status === 'minted' && c.expiresAt && new Date(c.expiresAt) > now && Math.ceil((new Date(c.expiresAt) - now) / (1000*60*60*24)) <= 7).length;
  const forfeitableSats = cards.filter(c => c.status === 'minted' && c.expiresAt && new Date(c.expiresAt) < now && !c.senderLightningAddress).reduce((s, c) => s + (c.amountSats || 0), 0);
  const refundableSats  = cards.filter(c => c.status === 'minted' && c.expiresAt && new Date(c.expiresAt) < now && c.senderLightningAddress).reduce((s, c) => s + (c.amountSats || 0), 0);

  // Filtered cards for table
  const filteredCards = (() => {
    if (filter === 'expired') return cards.filter(c => c.status === 'minted' && c.expiresAt && new Date(c.expiresAt) < now);
    if (filter === 'expiring') return cards.filter(c => c.status === 'minted' && c.expiresAt && new Date(c.expiresAt) > now && Math.ceil((new Date(c.expiresAt) - now) / (1000*60*60*24)) <= 7);
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
          <NavTab label="Marketplace" active={tab === 'marketplace'} onClick={() => setTab('marketplace')} badge="soon" />
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

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 40 }}>
              <StatCard label="Total Redeemed" value={stats?.redeemed_count ?? 0} sub="gift cards" accent="#39ff14" animate />
              <StatCard label="Sats Redeemed" value={stats?.redeemed_sats ?? 0} sub={`≈ $${(((parseInt(stats?.redeemed_sats) || 0) / 100_000_000) * 103000).toFixed(2)} USD`} accent="#F7931A" animate />
              <StatCard label="Active Cards" value={stats?.minted_count ?? 0} sub="awaiting redemption" accent="#00C97A" animate />
              <StatCard label="Expired (pending)" value={expiredCount} sub="processing refund/forfeit" accent="#ff4444" animate />
            </div>

            {/* Status breakdown */}
            <div style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 12, padding: '24px', marginBottom: 20 }}>
              <div style={{ fontFamily: mono, fontSize: 10, color: '#333', letterSpacing: 3, marginBottom: 20 }}>CARD STATUS BREAKDOWN</div>
              <div style={{ display: 'flex', gap: 0, flexWrap: 'wrap' }}>
                {[
                  { label: 'PENDING', count: pendingCount, color: '#555' },
                  { label: 'MINTED', count: mintedCount, color: '#F7931A' },
                  { label: 'REDEEMED', count: redeemedCount, color: '#39ff14' },
                  { label: 'EXPIRED', count: expiredCount, color: '#ff4444' },
                  { label: 'EXPIRING 7D', count: expiringCount, color: '#F7931A' },
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
          <div style={{ border: '1px dashed #1a1a1a', borderRadius: 12, padding: '80px 40px', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🛍️</div>
            <div style={{ fontFamily: display, fontSize: 24, fontWeight: 800, color: '#222', marginBottom: 8 }}>Marketplace Coming Soon</div>
            <div style={{ fontFamily: mono, fontSize: 11, color: '#2a2a2a', letterSpacing: 1 }}>DESIGNER STATS, REVENUE SPLITS, AND LISTINGS WILL APPEAR HERE</div>
          </div>
        )}
      </div>
    </div>
  );
}
