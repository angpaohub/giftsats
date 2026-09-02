import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Page from '../components/Page.jsx';
import CopyButton from '../components/CopyButton.jsx';
import { T, Bolt, Input, Pill, Notice, microLabel, headline } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { resolveArt } from '../lib/designs.js';
import { fmt } from '../lib/format.js';

const FILTERS = ['All', 'Minimal', 'Bold', 'Celebration', 'Seasonal', 'Free'];
const SORTS = [
  { id: 'used', label: 'Most used' },
  { id: 'new', label: 'Newest' },
  { id: 'fee', label: 'Lowest fee' },
];
const PER_PAGE = 10;
const NEW_DAYS = 14;

function isNew(design) {
  if (!design.createdAt) return false;
  return Date.now() - new Date(design.createdAt).getTime() < NEW_DAYS * 86400000;
}

function Tile({ design }) {
  const art = resolveArt(design.id, design);
  return (
    <div
      className="gs-tile"
      style={{
        border: `1px solid ${T.hair}`,
        background: T.surface,
        borderRadius: 16,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        transition: 'border-color .15s',
      }}
    >
      <div
        style={{
          position: 'relative',
          aspectRatio: '16 / 10',
          background: art.image ? `#15120F url(${art.image}) center/cover` : art.bg,
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        {art.scrim && <div style={{ position: 'absolute', inset: 0, background: art.scrim }} />}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: T.mono, fontSize: 8, letterSpacing: '0.24em', color: art.muted }}>
            GIFTSATS
          </span>
          <Bolt size={11} color={art.mark} />
        </div>
        <div style={{ position: 'relative', fontFamily: T.mono, fontSize: 20, fontWeight: 500, color: art.amount }}>
          21,000
        </div>
        {isNew(design) && (
          <span
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              fontFamily: T.mono,
              fontSize: 9,
              letterSpacing: '0.16em',
              background: T.orange,
              color: T.inkDeep,
              borderRadius: 999,
              padding: '4px 9px',
            }}
          >
            NEW
          </span>
        )}
      </div>

      <div style={{ padding: '16px 18px 18px', display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
        <div style={{ fontFamily: T.serif, fontSize: 22, lineHeight: 1.15 }}>{design.name}</div>
        <div style={{ fontFamily: T.mono, fontSize: 11, color: T.muted }}>
          by {design.handle || design.designerName}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 4 }}>
          <span style={{ fontSize: 14, color: design.priceSats > 0 ? T.orangeDeep : T.text2 }}>
            {design.priceSats > 0 ? `+${fmt(design.priceSats)} sats` : 'Free'}
          </span>
          <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted }}>{fmt(design.useCount)} uses</span>
        </div>

        <div
          style={{
            marginTop: 'auto',
            paddingTop: 14,
            borderTop: `1px solid ${T.hair}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <span style={{ fontFamily: T.mono, fontSize: 12, color: T.text2 }}>{design.id}</span>
          <CopyButton
            value={design.id}
            label="Copy code"
            style={{ padding: '8px 14px', fontSize: 12.5 }}
          />
        </div>
      </div>
    </div>
  );
}

export default function Explore() {
  const [designs, setDesigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('All');
  const [sort, setSort] = useState(0);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);

  useEffect(() => {
    api
      .designs()
      .then(setDesigns)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => setPage(0), [filter, sort, query]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = designs.filter((d) => {
      if (filter === 'Free' && d.priceSats > 0) return false;
      if (filter !== 'All' && filter !== 'Free' && (d.tag || 'Minimal') !== filter) return false;
      if (!q) return true;
      return [d.name, d.id, d.designerName, d.handle].filter(Boolean).join(' ').toLowerCase().includes(q);
    });
    const by = SORTS[sort].id;
    list = [...list].sort((a, b) => {
      if (by === 'new') return new Date(b.createdAt) - new Date(a.createdAt);
      if (by === 'fee') return a.priceSats - b.priceSats;
      return b.useCount - a.useCount;
    });
    return list;
  }, [designs, filter, sort, query]);

  const pages = Math.max(1, Math.ceil(results.length / PER_PAGE));
  const current = Math.min(page, pages - 1);
  const shown = results.slice(current * PER_PAGE, current * PER_PAGE + PER_PAGE);

  return (
    <Page title="Explore designs">
      <div style={microLabel}>Explore</div>
      <h1 style={{ ...headline, marginTop: 14, fontWeight: 400 }}>
        Fronts made by <em>people.</em>
      </h1>
      <p style={{ fontSize: 17, color: T.text2, marginTop: 18, maxWidth: 560, lineHeight: 1.55 }}>
        Every card front here was uploaded by a designer who set their own per-use fee. Copy a code and paste it
        into the create form.
      </p>

      {/* ── Designer banner ──────────────────────────────── */}
      <div
        style={{
          marginTop: 36,
          background: T.inkDeep,
          borderRadius: 20,
          padding: 'clamp(24px, 4vw, 36px)',
          color: '#F2EDE4',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 24,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ flex: '1 1 380px' }}>
          <div style={{ ...microLabel, color: T.orangeHover }}>For designers</div>
          <div style={{ fontFamily: T.serif, fontSize: 'clamp(24px, 4vw, 30px)', marginTop: 12, color: '#FFFDF8' }}>
            Set your own fee. Get paid per use.
          </div>
          <p style={{ fontSize: 15, color: '#C9BFB0', marginTop: 12, maxWidth: 520, lineHeight: 1.6 }}>
            Upload an image. Sats land in your Lightning address the moment a card using your front is minted.
          </p>
        </div>
        <div style={{ flex: '0 0 auto' }}>
          <Link
            to="/submit"
            className="gs-cta-btn"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 9,
              background: T.orange,
              color: T.inkDeep,
              padding: '15px 26px',
              borderRadius: 999,
              fontWeight: 600,
              fontSize: 15.5,
            }}
          >
            <Bolt size={14} />
            Submit a design
          </Link>
          <div style={{ fontFamily: T.mono, fontSize: 11, color: '#8C8070', marginTop: 10, textAlign: 'center' }}>
            No account needed
          </div>
        </div>
      </div>

      {/* ── Controls ─────────────────────────────────────── */}
      <div
        style={{
          marginTop: 36,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {FILTERS.map((f) => (
            <Pill key={f} active={filter === f} onClick={() => setFilter(f)}>
              {f}
            </Pill>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <Input
            placeholder="Search name, code or designer"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ width: 260, padding: '10px 14px', fontSize: 14 }}
          />
          <Pill onClick={() => setSort((s) => (s + 1) % SORTS.length)}>{SORTS[sort].label}</Pill>
        </div>
      </div>

      <div style={{ ...microLabel, fontSize: 11, marginTop: 20 }}>
        {loading ? 'Loading…' : `${results.length} design${results.length === 1 ? '' : 's'}`}
      </div>

      {error && (
        <div style={{ marginTop: 20 }}>
          <Notice tone="bad">{error}</Notice>
        </div>
      )}

      {!loading && !error && results.length === 0 && (
        <div style={{ marginTop: 20 }}>
          <Notice>
            Nothing matches that yet. <Link to="/submit">Submit the first one</Link>.
          </Notice>
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
          gap: 24,
          marginTop: 20,
        }}
      >
        {shown.map((d) => (
          <Tile key={d.id} design={d} />
        ))}
      </div>

      {pages > 1 && (
        <div style={{ marginTop: 36, textAlign: 'center' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
            <Pill onClick={() => setPage(Math.max(0, current - 1))}>Previous</Pill>
            {Array.from({ length: pages }, (_, i) => (
              <Pill key={i} active={i === current} onClick={() => setPage(i)}>
                {i + 1}
              </Pill>
            ))}
            <Pill onClick={() => setPage(Math.min(pages - 1, current + 1))}>Next</Pill>
          </div>
          <div style={{ ...microLabel, fontSize: 11, marginTop: 14 }}>
            Page {current + 1} of {pages}
          </div>
        </div>
      )}
    </Page>
  );
}
