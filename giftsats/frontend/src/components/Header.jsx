import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { T, Bolt, MenuIcon, CloseIcon } from './ui.jsx';

const NAV = [
  { to: '/how-it-works', label: 'How it works' },
  { to: '/redeem', label: 'Redeem' },
  { to: '/explore', label: 'Explore Design' },
  { to: '/about', label: 'About Us' },
];

function Logo() {
  return (
    <Link
      to="/"
      style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'inherit', flex: '0 0 auto' }}
    >
      <span
        style={{
          position: 'relative',
          borderRadius: 12,
          background: T.inkDeep,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          height: 40,
          width: 40,
          flex: '0 0 40px',
        }}
      >
        <span style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 1.5, background: 'rgba(247,147,26,.5)' }} />
        <span style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: 1.5, background: 'rgba(247,147,26,.5)' }} />
        <span style={{ position: 'relative' }}>
          <Bolt size={18} color={T.orange} />
        </span>
      </span>
      <span
        style={{
          fontFamily: T.serif,
          fontWeight: 500,
          fontSize: 'clamp(26px, 6vw, 30px)',
          letterSpacing: '-0.02em',
          lineHeight: 1,
          color: T.ink,
        }}
      >
        Gift<span style={{ color: T.orangeDeep }}>sats</span>
      </span>
    </Link>
  );
}

export default function Header() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  // Close the dropdown on every navigation.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // While open: close on a tap/click outside the header, on Escape, or if
  // the viewport grows past the mobile breakpoint (rotating a tablet,
  // resizing a browser window) — the dropdown is mobile-only, so it
  // shouldn't be left open behind the desktop nav links.
  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onResize = () => {
      if (window.innerWidth > 720) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className="gs-no-print"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        background: 'rgba(245,241,234,.94)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        borderBottom: `1px solid ${T.hair}`,
        padding: '14px clamp(16px, 4vw, calc((100% - 1280px) / 2 + 48px))',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '10px 18px',
      }}
    >
      <Logo />

      <Link
        to="/create"
        className="gs-cta gs-cta-btn"
        style={{
          color: T.inkDeep,
          padding: '11px 21px',
          borderRadius: 999,
          fontWeight: 500,
          fontSize: 14,
          background: T.orange,
          boxShadow: '0 0 0 3px rgba(247,147,26,.22)',
          whiteSpace: 'nowrap',
        }}
      >
        Create a gift
      </Link>

      <button
        type="button"
        className="gs-menu-btn"
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <CloseIcon size={18} color={T.ink} /> : <MenuIcon size={18} color={T.ink} />}
      </button>

      <div
        className={`gs-navlinks${open ? ' gs-navlinks-open' : ''}`}
        style={{ flexWrap: 'wrap', alignItems: 'center', gap: '10px clamp(12px, 2.2vw, 28px)' }}
      >
        {NAV.map((item) => {
          const active = pathname === item.to;
          return active ? (
            <span
              key={item.to}
              style={{
                fontSize: 15,
                color: T.ink,
                fontWeight: 500,
                borderBottom: `1.5px solid ${T.orange}`,
                paddingBottom: 3,
              }}
            >
              {item.label}
            </span>
          ) : (
            <Link key={item.to} to={item.to} className="gs-link" style={{ fontSize: 15, color: T.text2 }}>
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
