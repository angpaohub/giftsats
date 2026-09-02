// Shared style objects and small primitives. The design is expressed in inline
// styles (as the rest of this codebase is) with tokens kept in one place.

export const T = {
  canvas: '#F5F1EA',
  surface: '#FBF9F4',
  surfaceWarm: '#FBF7EE',
  surfaceBright: '#FFFDF8',
  ink: '#1B1714',
  inkDeep: '#15120F',
  text2: '#5C5349',
  text3: '#3A332C',
  muted: '#9A8E7C',
  mutedWarm: '#8C8070',
  orange: '#F7931A',
  orangeHover: '#FFA729',
  orangeDeep: '#C77A12',
  success: '#3F7D3B',
  successFill: 'rgba(79,174,106,.14)',
  successText: '#3C8752',
  successBorder: 'rgba(79,174,106,.45)',
  hair: 'rgba(27,23,20,.10)',
  hair16: 'rgba(27,23,20,.16)',
  serif: "'Newsreader', Georgia, serif",
  sans: "'Schibsted Grotesk', system-ui, sans-serif",
  mono: "'Azeret Mono', ui-monospace, monospace",
};

export const gutter = 'clamp(16px, 4vw, 48px)';

export const microLabel = {
  fontFamily: T.mono,
  fontSize: 11,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: T.muted,
};

export const sectionTitle = {
  fontFamily: T.serif,
  fontSize: 'clamp(24px, 4.4vw, 30px)',
  lineHeight: 1.1,
  letterSpacing: '-0.01em',
  color: T.ink,
};

export const headline = {
  fontFamily: T.serif,
  fontSize: 'clamp(34px, 7vw, 52px)',
  lineHeight: 1.02,
  letterSpacing: '-0.02em',
  color: T.ink,
};

export const body = {
  fontSize: 15.5,
  lineHeight: 1.6,
  color: T.text2,
};

export const panel = {
  background: T.surface,
  border: `1px solid ${T.hair}`,
  borderRadius: 16,
  padding: 'clamp(18px, 3vw, 24px)',
};

export const inputStyle = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 10,
  background: T.surface,
  border: `1px solid ${T.hair16}`,
  color: T.ink,
  fontSize: 15,
  transition: 'border-color .15s, background .15s',
};

export function Bolt({ size = 18, color = 'currentColor' }) {
  return (
    <span style={{ width: size, height: size, display: 'block', color, flex: '0 0 auto' }}>
      <svg viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor" aria-hidden="true">
        <path d="M13.4 2 L5 13.4 H10.3 L9.1 22 L19 9.2 H13.2 L14.6 2 Z" />
      </svg>
    </span>
  );
}

export function Label({ children, hint }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 9 }}>
      <span style={{ ...microLabel, fontSize: 10.5, letterSpacing: '0.2em' }}>{children}</span>
      {hint && <span style={{ fontSize: 13, color: T.mutedWarm }}>{hint}</span>}
    </div>
  );
}

export function Input(props) {
  return <input {...props} className="gs-input" style={{ ...inputStyle, ...(props.style || {}) }} />;
}

export function Textarea(props) {
  return (
    <textarea
      {...props}
      className="gs-input"
      style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5, ...(props.style || {}) }}
    />
  );
}

export function PrimaryButton({ children, disabled, style, ...rest }) {
  return (
    <button
      {...rest}
      disabled={disabled}
      className={disabled ? undefined : 'gs-cta-btn'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 9,
        padding: '16px 28px',
        borderRadius: 999,
        fontWeight: 600,
        fontSize: 16,
        color: disabled ? 'rgba(27,23,20,.4)' : T.ink,
        background: disabled ? 'rgba(27,23,20,.07)' : T.orange,
        boxShadow: disabled ? 'none' : '0 12px 24px -10px rgba(247,147,26,.5)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background .15s',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function GhostButton({ children, style, ...rest }) {
  return (
    <button
      {...rest}
      className="gs-outline"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: '13px 20px',
        borderRadius: 999,
        border: `1px solid ${'rgba(27,23,20,.2)'}`,
        color: T.text3,
        fontWeight: 500,
        fontSize: 14.5,
        background: 'transparent',
        transition: 'border-color .15s',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function Pill({ active, children, ...rest }) {
  return (
    <button
      {...rest}
      className={active ? undefined : 'gs-outline'}
      style={{
        padding: '10px 17px',
        borderRadius: 999,
        fontSize: 14,
        fontFamily: T.mono,
        cursor: 'pointer',
        background: active ? T.ink : 'transparent',
        color: active ? T.canvas : T.text2,
        border: active ? '1px solid transparent' : `1px solid ${T.hair16}`,
        transition: 'border-color .15s',
      }}
    >
      {children}
    </button>
  );
}

export function Notice({ tone = 'info', children }) {
  const tones = {
    info: { bg: T.surface, border: T.hair16, color: T.text2 },
    good: { bg: T.successFill, border: T.successBorder, color: T.successText },
    bad: { bg: 'rgba(179,52,30,.08)', border: 'rgba(179,52,30,.3)', color: '#B3341E' },
  };
  const t = tones[tone] || tones.info;
  return (
    <div
      style={{
        background: t.bg,
        border: `1px solid ${t.border}`,
        color: t.color,
        borderRadius: 12,
        padding: '13px 16px',
        fontSize: 14.5,
        lineHeight: 1.5,
      }}
    >
      {children}
    </div>
  );
}
