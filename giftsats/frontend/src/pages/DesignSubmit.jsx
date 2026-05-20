import { useState, useRef } from 'react';

const API = import.meta.env.VITE_API_URL || '';

const mono = "'JetBrains Mono', 'Fira Code', monospace";
const display = "'Syne', 'Space Grotesk', sans-serif";

// Gift card aspect ratio: 856x540px (standard credit card ~16:10)
const CARD_W = 856;
const CARD_H = 540;

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap');

  .submit-root {
    min-height: 100vh;
    background: #0a0a0a;
    color: #f0ece4;
    font-family: ${mono};
    display: grid;
    grid-template-columns: 1fr 1fr;
    min-height: 100vh;
  }

  /* ── LEFT: form ─────────── */
  .submit-form-col {
    padding: 56px 48px;
    border-right: 1px solid #1a1a1a;
    overflow-y: auto;
  }

  .submit-eyebrow {
    font-size: 11px;
    letter-spacing: 0.2em;
    color: #F7931A;
    text-transform: uppercase;
    margin-bottom: 16px;
  }

  .submit-title {
    font-family: ${display};
    font-size: clamp(28px, 3vw, 48px);
    font-weight: 800;
    line-height: 1.05;
    margin: 0 0 8px;
  }

  .submit-sub {
    font-size: 13px;
    color: #555;
    margin-bottom: 40px;
    line-height: 1.6;
  }

  .field {
    margin-bottom: 24px;
  }

  .field label {
    display: block;
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #666;
    margin-bottom: 8px;
  }

  .field input, .field textarea {
    width: 100%;
    background: #111;
    border: 1px solid #222;
    border-radius: 4px;
    color: #f0ece4;
    font-family: ${mono};
    font-size: 14px;
    padding: 12px 14px;
    outline: none;
    box-sizing: border-box;
    transition: border-color 0.15s;
  }
  .field input:focus, .field textarea:focus { border-color: #F7931A; }
  .field textarea { resize: vertical; min-height: 80px; }

  .field-hint {
    font-size: 11px;
    color: #444;
    margin-top: 6px;
  }

  .drop-zone {
    border: 2px dashed #2a2a2a;
    border-radius: 8px;
    aspect-ratio: ${CARD_W}/${CARD_H};
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: border-color 0.2s, background 0.2s;
    position: relative;
    overflow: hidden;
    background: #111;
  }
  .drop-zone:hover, .drop-zone.dragover {
    border-color: #F7931A;
    background: #F7931A08;
  }

  .drop-zone input[type="file"] {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
    width: 100%;
    height: 100%;
  }

  .drop-icon { font-size: 32px; margin-bottom: 12px; }
  .drop-label { font-size: 13px; color: #666; }
  .drop-sub { font-size: 11px; color: #444; margin-top: 6px; }

  .drop-preview {
    position: absolute;
    inset: 0;
    object-fit: cover;
    width: 100%;
    height: 100%;
  }

  .drop-clear {
    position: absolute;
    top: 8px;
    right: 8px;
    background: rgba(0,0,0,0.8);
    border: 1px solid #333;
    color: #f0ece4;
    border-radius: 4px;
    padding: 4px 10px;
    font-size: 11px;
    cursor: pointer;
    font-family: ${mono};
    z-index: 10;
  }

  .fee-box {
    background: #111;
    border: 1px solid #1e1e1e;
    border-radius: 6px;
    padding: 16px;
    margin-bottom: 24px;
  }

  .fee-row {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    color: #888;
    margin-bottom: 6px;
  }
  .fee-row.total {
    color: #f0ece4;
    font-weight: 700;
    padding-top: 8px;
    border-top: 1px solid #222;
    margin-top: 4px;
    margin-bottom: 0;
  }
  .fee-highlight { color: #4ade80; }

  .submit-btn {
    width: 100%;
    padding: 16px;
    background: #F7931A;
    color: #000;
    border: none;
    border-radius: 4px;
    font-family: ${mono};
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.05em;
    cursor: pointer;
    transition: opacity 0.15s;
  }
  .submit-btn:hover:not(:disabled) { opacity: 0.85; }
  .submit-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  .error-msg {
    color: #ef4444;
    font-size: 13px;
    margin-bottom: 16px;
    padding: 10px 14px;
    background: #ef444411;
    border: 1px solid #ef444433;
    border-radius: 4px;
  }

  /* ── RIGHT: preview + spec ─── */
  .submit-preview-col {
    padding: 56px 48px;
    display: flex;
    flex-direction: column;
    gap: 40px;
    position: sticky;
    top: 0;
    height: 100vh;
    overflow-y: auto;
  }

  .preview-label {
    font-size: 11px;
    letter-spacing: 0.15em;
    color: #444;
    text-transform: uppercase;
    margin-bottom: 16px;
  }

  .card-preview {
    width: 100%;
    aspect-ratio: ${CARD_W}/${CARD_H};
    border-radius: 10px;
    overflow: hidden;
    border: 1px solid #222;
    position: relative;
    background: #1a1a1a;
  }

  .card-preview img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .card-preview-empty {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    gap: 12px;
    color: #333;
    font-size: 13px;
  }
  .card-preview-empty .ph { font-size: 40px; }

  .card-overlay-demo {
    position: absolute;
    inset: 0;
    padding: 20px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    background: linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.7));
    pointer-events: none;
  }

  .card-overlay-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }

  .card-chip {
    width: 32px;
    height: 24px;
    background: linear-gradient(135deg, #d4af37, #f5d769);
    border-radius: 4px;
    opacity: 0.9;
  }

  .card-logo {
    font-size: 18px;
    font-weight: 800;
    color: white;
    opacity: 0.9;
    font-family: ${display};
    text-shadow: 0 1px 3px rgba(0,0,0,0.5);
  }

  .card-overlay-bottom {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
  }

  .card-amount {
    font-family: ${mono};
    font-size: 22px;
    font-weight: 700;
    color: white;
    text-shadow: 0 1px 3px rgba(0,0,0,0.5);
  }

  .card-name-preview {
    font-family: ${display};
    font-size: 14px;
    font-weight: 600;
    color: rgba(255,255,255,0.8);
    text-shadow: 0 1px 3px rgba(0,0,0,0.5);
  }

  .spec-box {
    background: #111;
    border: 1px solid #1e1e1e;
    border-radius: 6px;
    padding: 20px;
  }

  .spec-title {
    font-size: 11px;
    letter-spacing: 0.15em;
    color: #555;
    text-transform: uppercase;
    margin-bottom: 14px;
  }

  .spec-row {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    padding: 7px 0;
    border-bottom: 1px solid #1a1a1a;
  }
  .spec-row:last-child { border-bottom: none; }
  .spec-key { color: #555; }
  .spec-val { color: #f0ece4; font-weight: 500; }

  .canva-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    background: #7c3aed11;
    border: 1px solid #7c3aed44;
    border-radius: 6px;
    color: #a78bfa;
    font-family: ${mono};
    font-size: 12px;
    cursor: pointer;
    text-decoration: none;
    transition: background 0.15s;
  }
  .canva-btn:hover { background: #7c3aed22; }

  /* ── Success state ───────── */
  .success-screen {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    background: #0a0a0a;
    color: #f0ece4;
    font-family: ${mono};
    text-align: center;
    padding: 40px;
  }

  .success-icon { font-size: 64px; margin-bottom: 24px; }

  .success-title {
    font-family: ${display};
    font-size: 36px;
    font-weight: 800;
    margin-bottom: 12px;
  }

  .success-sub {
    font-size: 14px;
    color: #666;
    margin-bottom: 32px;
    max-width: 400px;
    line-height: 1.6;
  }

  .code-reveal {
    background: #111;
    border: 1px solid #F7931A44;
    border-radius: 8px;
    padding: 24px 32px;
    margin-bottom: 32px;
    min-width: 320px;
  }

  .code-label {
    font-size: 11px;
    color: #555;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    margin-bottom: 12px;
  }

  .code-value {
    font-size: 28px;
    color: #F7931A;
    font-weight: 700;
    letter-spacing: 0.1em;
    margin-bottom: 16px;
  }

  .code-copy-btn {
    padding: 10px 24px;
    background: #F7931A;
    color: #000;
    border: none;
    border-radius: 4px;
    font-family: ${mono};
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
  }

  .success-links {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
    justify-content: center;
  }

  .link-btn {
    padding: 10px 20px;
    background: transparent;
    border: 1px solid #333;
    border-radius: 4px;
    color: #888;
    font-family: ${mono};
    font-size: 12px;
    cursor: pointer;
    text-decoration: none;
  }
  .link-btn:hover { border-color: #555; color: #f0ece4; }

  @media (max-width: 900px) {
    .submit-root { grid-template-columns: 1fr; }
    .submit-preview-col { position: static; height: auto; border-top: 1px solid #1a1a1a; }
    .submit-form-col, .submit-preview-col { padding: 32px 24px; }
  }
`;

export default function DesignSubmit() {
  const [form, setForm] = useState({
    name: '',
    designerName: '',
    lightningAddress: '',
    priceSats: '',
    description: '',
  });
  const [imageFile, setImageFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [dragover, setDragover] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const fileRef = useRef();

  const price = parseInt(form.priceSats) || 0;
  const designerEarns = Math.floor(price * 0.80);

  function handleFile(file) {
    if (!file) return;
    setImageFile(file);
    const url = URL.createObjectURL(file);
    setPreview(url);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragover(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function clearImage(e) {
    e.stopPropagation();
    setImageFile(null);
    setPreview(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function handleSubmit() {
    setError('');
    if (!imageFile) return setError('Please upload a design image');
    if (!form.name.trim()) return setError('Design name is required');
    if (!form.lightningAddress.trim()) return setError('Lightning address is required');
    const lnOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.lightningAddress);
    if (!lnOk) return setError('Invalid Lightning address format (e.g. you@wallet.com)');

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('image', imageFile);
      fd.append('name', form.name);
      fd.append('designerName', form.designerName || 'Anonymous');
      fd.append('lightningAddress', form.lightningAddress);
      fd.append('priceSats', String(price));
      fd.append('description', form.description);

      const res = await fetch(`${API}/api/designs`, { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submit failed');
      setSuccess(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function copyCode() {
    navigator.clipboard.writeText(success.id).then(() => {
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    });
  }

  if (success) {
    return (
      <>
        <style>{css}</style>
        <div className="success-screen">
          <div className="success-icon">🎨</div>
          <div className="success-title">Design Published!</div>
          <div className="success-sub">
            Your design is now live on the marketplace. Share the code so people can use it when creating gifts.
          </div>
          <div className="code-reveal">
            <div className="code-label">Your Design Code</div>
            <div className="code-value">{success.id}</div>
            <button className="code-copy-btn" onClick={copyCode}>
              {codeCopied ? '✓ Copied!' : 'Copy Code'}
            </button>
          </div>
          <div className="success-links">
            <a href="/explore" className="link-btn">Browse Marketplace</a>
            <a href="/design" className="link-btn" onClick={() => setSuccess(null)}>Submit Another</a>
            <a href="/create" className="link-btn">Create a Gift</a>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{css}</style>
      <div className="submit-root">

        {/* ── LEFT: Form ──────────────────── */}
        <div className="submit-form-col">
          <div className="submit-eyebrow">⚡ GiftSats Marketplace</div>
          <h1 className="submit-title">Submit Your Design</h1>
          <p className="submit-sub">
            Upload your gift card design, set a price in sats, and earn every time someone uses it.
          </p>

          {/* Image upload */}
          <div className="field">
            <label>Design Image *</label>
            <div
              className={`drop-zone${dragover ? ' dragover' : ''}`}
              onDragOver={e => { e.preventDefault(); setDragover(true); }}
              onDragLeave={() => setDragover(false)}
              onDrop={handleDrop}
            >
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={e => handleFile(e.target.files[0])}
              />
              {preview ? (
                <>
                  <img className="drop-preview" src={preview} alt="preview" />
                  <button className="drop-clear" onClick={clearImage}>✕ Remove</button>
                </>
              ) : (
                <>
                  <div className="drop-icon">🖼️</div>
                  <div className="drop-label">Drop image here or click to browse</div>
                  <div className="drop-sub">PNG, JPG, WEBP · Max 5MB</div>
                </>
              )}
            </div>
            <div className="field-hint">Recommended: {CARD_W}×{CARD_H}px (16:10 ratio)</div>
          </div>

          <div className="field">
            <label>Design Name *</label>
            <input
              placeholder="e.g. Tropical Vibes"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            />
          </div>

          <div className="field">
            <label>Your Name / Handle</label>
            <input
              placeholder="Anonymous"
              value={form.designerName}
              onChange={e => setForm(f => ({ ...f, designerName: e.target.value }))}
            />
          </div>

          <div className="field">
            <label>Lightning Address * (payments go here)</label>
            <input
              placeholder="you@wallet.com"
              value={form.lightningAddress}
              onChange={e => setForm(f => ({ ...f, lightningAddress: e.target.value }))}
            />
            <div className="field-hint">e.g. yourname@getalby.com — you'll receive sats here automatically</div>
          </div>

          <div className="field">
            <label>Design Fee (sats) — 0 = free</label>
            <input
              type="number"
              min="0"
              placeholder="0"
              value={form.priceSats}
              onChange={e => setForm(f => ({ ...f, priceSats: e.target.value }))}
            />
          </div>

          <div className="field">
            <label>Description (optional)</label>
            <textarea
              placeholder="Describe your design..."
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>

          {price > 0 && (
            <div className="fee-box">
              <div className="fee-row"><span>Design fee charged to user</span><span>{price.toLocaleString()} sats</span></div>
              <div className="fee-row"><span>Platform cut (20%)</span><span>−{Math.ceil(price * 0.2).toLocaleString()} sats</span></div>
              <div className="fee-row total"><span>You earn per use</span><span className="fee-highlight">+{designerEarns.toLocaleString()} sats</span></div>
            </div>
          )}

          {error && <div className="error-msg">{error}</div>}

          <button className="submit-btn" disabled={loading} onClick={handleSubmit}>
            {loading ? 'Submitting...' : 'Publish Design →'}
          </button>
        </div>

        {/* ── RIGHT: Preview + Spec ────────── */}
        <div className="submit-preview-col">
          <div>
            <div className="preview-label">Card Preview</div>
            <div className="card-preview">
              {preview
                ? <img src={preview} alt="Design preview" />
                : <div className="card-preview-empty"><div className="ph">🎨</div><span>Upload image to preview</span></div>
              }
              {preview && (
                <div className="card-overlay-demo">
                  <div className="card-overlay-top">
                    <div className="card-chip" />
                    <div className="card-logo">GiftSats</div>
                  </div>
                  <div className="card-overlay-bottom">
                    <div className="card-amount">⚡ 21,000</div>
                    <div className="card-name-preview">{form.name || 'Your Design'}</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="spec-box">
            <div className="spec-title">Template Specs</div>
            <div className="spec-row"><span className="spec-key">Size</span><span className="spec-val">{CARD_W} × {CARD_H} px</span></div>
            <div className="spec-row"><span className="spec-key">Ratio</span><span className="spec-val">16:10 (credit card)</span></div>
            <div className="spec-row"><span className="spec-key">Format</span><span className="spec-val">PNG, JPG, WEBP</span></div>
            <div className="spec-row"><span className="spec-key">Max size</span><span className="spec-val">5 MB</span></div>
            <div className="spec-row"><span className="spec-key">Safe zone</span><span className="spec-val">40px from edges</span></div>
            <div className="spec-row"><span className="spec-key">Overlay</span><span className="spec-val">GiftSats logo + amount</span></div>
          </div>

          <a
            className="canva-btn"
            href={`https://www.canva.com/design?width=${CARD_W}&height=${CARD_H}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span>🎨</span>
            <span>Open template in Canva ({CARD_W}×{CARD_H})</span>
          </a>
        </div>

      </div>
    </>
  );
}
