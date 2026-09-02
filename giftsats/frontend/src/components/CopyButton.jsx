import { useEffect, useRef, useState } from 'react';
import { T } from './ui.jsx';
import { copy } from '../lib/format.js';

/**
 * Copy-to-clipboard with the shared "Copied" state: label swaps, fill turns
 * green, reverts after 1.6s.
 */
export default function CopyButton({ value, label = 'Copy', copiedLabel = 'Copied', style, block }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function onClick() {
    const ok = await copy(value);
    if (!ok) return;
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1600);
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={copied ? undefined : 'gs-outline'}
      style={{
        display: block ? 'flex' : 'inline-flex',
        width: block ? '100%' : undefined,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: '13px 20px',
        borderRadius: 999,
        fontWeight: 500,
        fontSize: 14.5,
        transition: 'border-color .15s, background .15s',
        background: copied ? T.successFill : 'transparent',
        color: copied ? T.successText : T.text3,
        border: `1px solid ${copied ? T.successBorder : 'rgba(27,23,20,.2)'}`,
        ...style,
      }}
    >
      {copied ? copiedLabel : label}
    </button>
  );
}
