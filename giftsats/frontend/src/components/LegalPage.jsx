import { Link } from 'react-router-dom';
import Page from './Page.jsx';
import { T, microLabel, headline } from './ui.jsx';

/**
 * Shared layout for Terms and Privacy: sticky contents beside a numbered
 * column. The copy itself is passed in — see the note in each page.
 */
export default function LegalPage({ title, updated, sections, other, disclaimer }) {
  return (
    <Page maxWidth={1180} title={title}>
      <div style={microLabel}>Legal</div>
      <h1 style={{ ...headline, marginTop: 14, fontWeight: 400 }}>{title}</h1>
      <div style={{ fontFamily: T.mono, fontSize: 11.5, letterSpacing: '0.14em', color: T.muted, marginTop: 16 }}>
        {updated}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'clamp(28px, 4vw, 56px)', marginTop: 44 }}>
        <nav style={{ flex: '0 1 240px', minWidth: 200 }}>
          <div style={{ position: 'sticky', top: 96 }}>
            <div style={{ ...microLabel, fontSize: 10, letterSpacing: '0.2em', marginBottom: 14 }}>Contents</div>
            {sections.map((s, i) => (
              <a
                key={s.title}
                href={`#sec-${String(i + 1).padStart(2, '0')}`}
                className="gs-link"
                style={{ display: 'block', fontSize: 14, color: T.text2, padding: '6px 0' }}
              >
                <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, marginRight: 8 }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                {s.title}
              </a>
            ))}
          </div>
        </nav>

        <div style={{ flex: '1 1 520px', minWidth: 0 }}>
          <div
            style={{
              border: `1px solid ${T.hair16}`,
              background: T.surface,
              borderRadius: 16,
              padding: '18px 20px',
              fontSize: 14.5,
              color: T.text2,
              lineHeight: 1.6,
            }}
          >
            {disclaimer}
          </div>

          {sections.map((s, i) => {
            const n = String(i + 1).padStart(2, '0');
            return (
              <section key={s.title} id={`sec-${n}`} style={{ marginTop: 'clamp(30px, 4vw, 44px)' }}>
                <div style={{ display: 'flex', gap: 16, alignItems: 'baseline' }}>
                  <span style={{ fontFamily: T.mono, fontSize: 14, color: T.orangeDeep }}>{n}</span>
                  <h2 style={{ fontFamily: T.serif, fontWeight: 400, fontSize: 26, lineHeight: 1.2 }}>{s.title}</h2>
                </div>
                <div style={{ paddingLeft: 'clamp(0px, 3vw, 34px)', marginTop: 14 }}>
                  {s.paragraphs.map((p, k) => (
                    <p key={k} style={{ fontSize: 15.5, lineHeight: 1.65, color: T.text2, marginBottom: 14 }}>
                      {p}
                    </p>
                  ))}
                </div>
              </section>
            );
          })}

          <div style={{ marginTop: 48, paddingTop: 24, borderTop: `1px solid ${T.hair}` }}>
            <Link to={other.to}>{other.label} →</Link>
          </div>
        </div>
      </div>
    </Page>
  );
}
