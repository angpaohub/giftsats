import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

/**
 * A QR code drawn locally with the `qrcode` package. Nothing about the payload
 * — a bolt11 invoice or a card link — leaves the browser.
 */
export default function QR({ value, size = 160, dark = '#15120F', light = '#FFFDF8', style }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current || !value) return;
    let cancelled = false;
    QRCode.toCanvas(ref.current, String(value), {
      width: size,
      margin: 0,
      errorCorrectionLevel: 'M',
      color: { dark, light },
    }).catch(() => {
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
  }, [value, size, dark, light]);

  return (
    <canvas
      ref={ref}
      width={size}
      height={size}
      style={{ display: 'block', width: size, height: size, borderRadius: 4, ...style }}
    />
  );
}
