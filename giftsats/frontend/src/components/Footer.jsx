import { Link, useLocation } from 'react-router-dom';
import { T, gutter } from './ui.jsx';

const LINKS = [
  { to: '/terms', label: 'Terms & Conditions' },
  { to: '/privacy', label: 'Privacy Policy' },
  { to: '/submit', label: 'Submit a design' },
];

export default function Footer() {
  const { pathname } = useLocation();

  return (
    <footer
      className="gs-no-print"
      style={{
        borderTop: `1px solid ${T.hair}`,
        padding: `clamp(24px,4vw,34px) ${gutter} clamp(28px,4vw,38px)`,
        marginTop: 'auto',
      }}
    >
      <div
        style={{
          maxWidth: 1300,
          margin: '0 auto',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '14px 24px',
        }}
      >
        <div
          style={{
            fontFamily: T.mono,
            fontSize: 11,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: T.muted,
          }}
        >
          © 2026 Giftsats
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'clamp(14px,2.4vw,26px)' }}>
          {LINKS.map((l) =>
            pathname === l.to ? (
              <span key={l.to} style={{ fontSize: 14, color: T.ink, fontWeight: 500 }}>
                {l.label}
              </span>
            ) : (
              <Link key={l.to} to={l.to} className="gs-link" style={{ fontSize: 14, color: T.text2 }}>
                {l.label}
              </Link>
            )
          )}
          <a className="gs-link" href="mailto:hello@giftsats.org" style={{ fontSize: 14, color: T.text2 }}>
            Contact
          </a>
        </div>
      </div>
    </footer>
  );
}
