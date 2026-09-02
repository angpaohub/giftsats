import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

/**
 * A QR code drawn locally with the `qrcode` package. Nothing about the payload
 * — a bolt11 invoice or a card link — leaves the browser.
 */
export default function QR({ value, size = 160, dark = '#15120F', light = '#FFFDF8', logo, style }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current || !value) return;
    let cancelled = false;
    // A center logo covers real modules, so we need the high-redundancy
    // error-correction level (~30% recoverable) to keep the code scannable.
    QRCode.toCanvas(ref.current, String(value), {
      width: size,
      margin: 0,
      errorCorrectionLevel: logo ? 'H' : 'M',
      color: { dark, light },
    })
      .then(() => {
        if (cancelled || !logo || !ref.current) return;
        const img = new Image();
        img.onload = () => {
          if (cancelled || !ref.current) return;
          const ctx = ref.current.getContext('2d');
          if (!ctx) return;
          const mark = size * 0.2; // logo footprint, well under the ~30% H budget
          const pad = size * 0.028;
          const x = (size - mark) / 2;
          const y = (size - mark) / 2;
          ctx.fillStyle = light;
          roundRect(ctx, x - pad, y - pad, mark + pad * 2, mark + pad * 2, mark * 0.18);
          ctx.fill();
          ctx.drawImage(img, x, y, mark, mark);
        };
        img.src = logo;
      })
      .catch(() => {
        if (cancelled) return;
        const ctx = ref.current?.getContext('2d');
        if (ctx) {
          ctx.fillStyle = light;
          ctx.fillRect(0, 0, size, size);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [value, size, dark, light, logo]);

  return (
    <canvas
      ref={ref}
      width={size}
      height={size}
      style={{ display: 'block', width: size, height: size, borderRadius: 4, ...style }}
    />
  );
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
