import { forwardRef } from 'react';
import QR from './QR.jsx';
import { T, Bolt } from './ui.jsx';
import { fmt, formatDate } from '../lib/format.js';

/**
 * The gift card object — one rounded, overflow-hidden container holding the
 * designer front and the printed back. Used on Create, Pay Invoice, Card Ready,
 * Gift Link and Redeem.
 */
const GiftCard = forwardRef(function GiftCard(
  {
    amount,
    message,
    to,
    from,
    art,
    code,
    expiresAt,
    qrValue,
    locked = false,
    style,
    // `variant="simple"` swaps the printed QR back for a slim status strip —
    // used on Gift Link, where the full card-back is one tap away instead
    // (see `onShowQr`). Every other page keeps the default front+back card.
    variant = 'full',
    statusLabel,
    statusColor,
    onShowQr,
  },
  ref
) {
  const credit = [to && `For ${to}`, from && `from ${from}`].filter(Boolean).join(' · ');

  return (
    <div
      ref={ref}
      style={{
        width: 'min(510px, 100%)',
        // The card sets its own alignment so a centred page (Gift Link) does
        // not centre the amount, message and card-back copy.
        textAlign: 'left',
        borderRadius: 20,
        overflow: 'hidden',
        boxShadow: '0 34px 64px -26px rgba(40,30,18,.5)',
        ...style,
      }}
    >
      {/* ── Front: designer artwork ─────────────────────── */}
      <div
        style={{
          position: 'relative',
          minHeight: 322,
          background: art.bg,
          padding: 'clamp(22px,5vw,31px) clamp(22px,5vw,33px)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        {art.image && (
          <img
            src={art.image}
            alt=""
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )}
        {art.scrim && <div style={{ position: 'absolute', inset: 0, background: art.scrim }} />}
        <div
          style={{
            position: 'absolute',
            right: -56,
            top: -56,
            width: 222,
            height: 222,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${art.glow}, transparent 70%)`,
          }}
        />

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: T.mono, fontSize: 12, letterSpacing: '0.24em', color: art.muted }}>
            GIFTSATS
          </span>
          <Bolt size={20} color={art.mark} />
        </div>

        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <span
              style={{
                fontFamily: T.mono,
                fontWeight: 500,
                fontSize: 'clamp(36px, 9vw, 52px)',
                letterSpacing: '-0.02em',
                color: art.amount,
                lineHeight: 1,
              }}
            >
              {fmt(amount)}
            </span>
            <span style={{ fontFamily: T.mono, fontSize: 17, color: art.unit }}>sats</span>
          </div>
          {message && (
            <div
              style={{
                fontFamily: T.serif,
                fontStyle: 'italic',
                fontSize: 16,
                color: art.body,
                marginTop: 14,
                lineHeight: 1.35,
              }}
            >
              “{message}”
            </div>
          )}
          {credit && (
            <div style={{ fontFamily: T.serif, fontSize: 15, color: art.body, marginTop: 12, opacity: 0.85 }}>
              {credit}
            </div>
          )}
        </div>
      </div>

      {/* ── Back: printed side ──────────────────────────── */}
      {variant === 'simple' ? (
        <div
          style={{
            background: T.surfaceWarm,
            color: T.ink,
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 14,
            borderTop: `1px solid ${T.hair}`,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: T.mono, fontSize: 9, letterSpacing: '0.2em', color: '#A2957F' }}>STATUS</div>
            <div style={{ fontFamily: T.mono, fontSize: 12, color: statusColor || T.ink, marginTop: 5 }}>
              {statusLabel}
            </div>
          </div>
          {onShowQr && (
            <button
              type="button"
              onClick={onShowQr}
              className="gs-outline"
              style={{
                fontFamily: T.mono,
                fontSize: 11,
                letterSpacing: '0.06em',
                padding: '9px 15px',
                borderRadius: 999,
                border: `1px solid ${T.hair16}`,
                background: T.surfaceBright,
                color: T.orangeDeep,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flex: '0 0 auto',
              }}
            >
              Show QR
            </button>
          )}
          <div style={{ textAlign: 'right', whiteSpace: 'nowrap', flex: '0 0 auto' }}>
            <div style={{ fontFamily: T.mono, fontSize: 9, letterSpacing: '0.2em', color: '#A2957F' }}>REDEEM BY</div>
            <div style={{ fontFamily: T.mono, fontSize: 12, color: T.ink, marginTop: 5 }}>
              {formatDate(expiresAt) || '—'}
            </div>
          </div>
        </div>
      ) : (
      <div
        style={{
          position: 'relative',
          background: T.surfaceWarm,
          color: T.ink,
          padding: 'clamp(20px,4.4vw,26px)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 'clamp(10px,2.4vw,13px)',
            border: `1px solid ${T.hair}`,
            borderRadius: 14,
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            gap: 'clamp(15px,3.2vw,21px)',
            padding: 'clamp(8px,2.2vw,13px) clamp(7px,2.4vw,15px)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ flex: 1, borderTop: '1px solid rgba(199,122,18,.35)' }} />
            <span style={{ fontFamily: T.mono, fontSize: 10.5, letterSpacing: '0.26em', color: T.orangeDeep }}>
              REDEEM QR
            </span>
            <div style={{ flex: 1, borderTop: '1px solid rgba(199,122,18,.35)' }} />
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'clamp(13px,3vw,18px)' }}>
            <div
              style={{
                position: 'relative',
                padding: 9,
                background: T.surfaceBright,
                borderRadius: 12,
                border: `1px solid ${T.hair}`,
                boxShadow: '0 4px 12px rgba(40,30,18,.09)',
                flex: '0 0 auto',
              }}
            >
              <div style={{ filter: locked ? 'blur(6px)' : 'none', transition: 'filter .5s ease' }}>
                <QR value={qrValue || 'giftsats'} size={105} light={T.surfaceBright} logo="/qrmark.png" />
              </div>
              {locked && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 8,
                  }}
                >
                  <span
                    style={{
                      fontFamily: T.mono,
                      fontSize: 8.5,
                      letterSpacing: '0.16em',
                      color: T.mutedWarm,
                      background: 'rgba(251,247,238,.92)',
                      border: `1px solid ${T.hair}`,
                      borderRadius: 999,
                      padding: '4px 9px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    LOCKED
                  </span>
                </div>
              )}
            </div>
            <div style={{ flex: '1 1 230px', minWidth: 210 }}>
              <div style={{ fontFamily: T.serif, fontSize: 'clamp(20px,4.6vw,23px)', lineHeight: 1.15 }}>
                Scan to redeem
              </div>
              <div style={{ fontSize: 13, color: T.text3, lineHeight: 1.4, marginTop: 8, whiteSpace: 'nowrap' }}>
                Enter your lightning address to receive sats
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'center', fontFamily: T.serif, fontSize: 12.5, color: '#8A7A5E' }}>
            For more information please visit giftsats.org
          </div>

          <div
            style={{
              borderTop: `1px solid ${T.hair}`,
              paddingTop: 13,
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              gap: 16,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: T.mono, fontSize: 9.5, letterSpacing: '0.2em', color: '#A2957F' }}>CODE</div>
              <div
                style={{
                  fontFamily: T.mono,
                  fontSize: code ? 10 : 10.5,
                  color: code ? T.ink : '#A2957F',
                  marginTop: 5,
                  wordBreak: 'break-all',
                  lineHeight: 1.35,
                }}
              >
                {code || 'issued when the invoice settles'}
              </div>
            </div>
            <div style={{ textAlign: 'right', whiteSpace: 'nowrap', flex: '0 0 auto' }}>
              <div style={{ fontFamily: T.mono, fontSize: 9.5, letterSpacing: '0.2em', color: '#A2957F' }}>
                REDEEM BY
              </div>
              <div style={{ fontFamily: T.mono, fontSize: 12, color: T.ink, marginTop: 5 }}>
                {formatDate(expiresAt) || '—'}
              </div>
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
});

export default GiftCard;
