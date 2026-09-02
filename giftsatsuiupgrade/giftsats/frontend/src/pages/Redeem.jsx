import { useCallback, useEffect, useRef, useState } from 'react';
import Page from '../components/Page.jsx';
import GiftCard from '../components/GiftCard.jsx';
import { T, Input, PrimaryButton, Notice, microLabel, headline } from '../components/ui.jsx';
import { api, resolveCard } from '../lib/api.js';
import { resolveArt } from '../lib/designs.js';
import { cardUrl, fmt, isLightningAddress } from '../lib/format.js';

const METHODS = [
  { id: 'scan', label: 'Scan' },
  { id: 'upload', label: 'Upload image' },
  { id: 'paste', label: 'Paste code' },
];

const WALLET_DOMAINS = ['@walletofsatoshi.com', '@phoenixwallet.me', '@getalby.com'];

let zxingCache = null;
async function loadZxing() {
  if (!zxingCache) {
    const { BrowserMultiFormatReader } = await import('@zxing/browser');
    zxingCache = BrowserMultiFormatReader;
  }
  return zxingCache;
}

export default function Redeem() {
  const [method, setMethod] = useState('scan');
  const [code, setCode] = useState('');
  const [card, setCard] = useState(null);
  const [design, setDesign] = useState(null);
  const [address, setAddress] = useState('');
  const [status, setStatus] = useState(null); // {tone, msg}
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [scanning, setScanning] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const readerRef = useRef(null);
  const fileRef = useRef(null);

  const stopCamera = useCallback(() => {
    try {
      readerRef.current?.reset();
    } catch {
      /* the reader is already torn down */
    }
    readerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  async function attach(raw) {
    setStatus({ tone: 'info', msg: 'Looking up that card…' });
    try {
      const data = await resolveCard(raw);
      if (!data) {
        setStatus({ tone: 'bad', msg: 'That does not look like a GiftSats card code.' });
        return;
      }
      setCard(data);
      setStatus(null);
      if (data.designId && !String(data.designId).startsWith('giftsats-')) {
        api.design(data.designId).then(setDesign).catch(() => {});
      }
    } catch (e) {
      setStatus({ tone: 'bad', msg: e.status === 404 ? 'No card with that code.' : e.message });
    }
  }

  async function startCamera() {
    setStatus(null);
    setScanning(true);
    try {
      const Reader = await loadZxing();
      const reader = new Reader();
      readerRef.current = reader;
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        reader.decodeFromVideoElement(videoRef.current, (result) => {
          if (result) {
            attach(result.getText());
            stopCamera();
          }
        });
      }
    } catch {
      setScanning(false);
      setStatus({ tone: 'bad', msg: 'Cannot open the camera. Allow camera access, or paste the code instead.' });
    }
  }

  async function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus({ tone: 'info', msg: 'Reading the image…' });
    try {
      const Reader = await loadZxing();
      const reader = new Reader();
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.src = url;
      await new Promise((res, rej) => {
        img.onload = res;
        img.onerror = rej;
      });
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext('2d').drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      const result = await reader.decodeFromCanvas(canvas);
      await attach(result.getText());
    } catch {
      setStatus({ tone: 'bad', msg: 'No QR code found in that image.' });
    } finally {
      e.target.value = '';
    }
  }

  async function redeem() {
    if (!card || !isLightningAddress(address)) return;
    setBusy(true);
    setStatus(null);
    try {
      const res = await api.redeem({
        cashuToken: card.cashuToken,
        lightningAddress: address.trim(),
        giftCardId: card.id,
      });
      setDone(true);
      setStatus({ tone: 'good', msg: `${fmt(res.amountSats)} sats sent to ${address.trim()}.` });
    } catch (e) {
      setStatus({
        tone: 'bad',
        msg:
          e.status === 409
            ? 'This card has already been redeemed.'
            : e.status === 410
              ? 'This card has expired.'
              : `${e.message} — the sats are still on the card, try another address.`,
      });
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setCard(null);
    setDesign(null);
    setAddress('');
    setCode('');
    setDone(false);
    setStatus(null);
  }

  const art = card ? resolveArt(card.designId, design) : null;
  const ready = !!card && isLightningAddress(address) && !busy;

  return (
    <Page maxWidth={980} title="Redeem">
      <div style={microLabel}>Redeem</div>
      <h1 style={{ ...headline, marginTop: 14, fontWeight: 400 }}>
        Claim your <em>sats.</em>
      </h1>
      <p style={{ fontSize: 17, color: T.text2, marginTop: 18, maxWidth: 520, lineHeight: 1.55 }}>
        Scan the QR on the card, upload a photo of it, or type the code printed on the back. Then give any
        Lightning address.
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'clamp(28px, 4vw, 48px)', marginTop: 40 }}>
        <div style={{ flex: '1 1 400px', minWidth: 0 }}>
          {!card && (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {METHODS.map((m) => {
                  const active = method === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      className={active ? undefined : 'gs-outline'}
                      onClick={() => {
                        stopCamera();
                        setMethod(m.id);
                        setStatus(null);
                      }}
                      style={{
                        padding: '12px 18px',
                        borderRadius: 10,
                        fontSize: 14.5,
                        background: active ? 'rgba(247,147,26,.1)' : 'transparent',
                        color: T.ink,
                        fontWeight: active ? 500 : 400,
                        border: `${active ? '1.5px' : '1px'} solid ${active ? T.orange : T.hair16}`,
                        transition: 'border-color .15s',
                      }}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>

              <div style={{ marginTop: 20 }}>
                {method === 'scan' &&
                  (scanning ? (
                    <div
                      style={{
                        position: 'relative',
                        borderRadius: 16,
                        overflow: 'hidden',
                        background: T.inkDeep,
                        aspectRatio: '1 / 1',
                      }}
                    >
                      <video
                        ref={videoRef}
                        playsInline
                        muted
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          pointerEvents: 'none',
                        }}
                      >
                        <div
                          style={{
                            width: '58%',
                            aspectRatio: '1 / 1',
                            border: `2px solid ${T.orange}`,
                            borderRadius: 16,
                            boxShadow: '0 0 0 9999px rgba(11,9,7,.45)',
                          }}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={stopCamera}
                        style={{
                          position: 'absolute',
                          top: 12,
                          right: 12,
                          background: 'rgba(11,9,7,.7)',
                          color: '#FBF9F4',
                          borderRadius: 999,
                          padding: '7px 14px',
                          fontSize: 13,
                        }}
                      >
                        Close
                      </button>
                    </div>
                  ) : (
                    <div
                      style={{
                        border: `1.5px dashed ${T.orange}`,
                        background: 'rgba(247,147,26,.05)',
                        borderRadius: 16,
                        padding: '48px 28px',
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ fontFamily: T.serif, fontSize: 22 }}>Scan the card</div>
                      <p style={{ fontSize: 14.5, color: T.text2, marginTop: 8 }}>
                        Point your camera at the QR on the back of the card.
                      </p>
                      <PrimaryButton onClick={startCamera} style={{ marginTop: 18 }}>
                        Open camera
                      </PrimaryButton>
                    </div>
                  ))}

                {method === 'upload' && (
                  <div
                    style={{
                      border: `1.5px dashed ${T.hair16}`,
                      background: T.surface,
                      borderRadius: 16,
                      padding: '48px 28px',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontFamily: T.serif, fontSize: 22 }}>Upload a photo</div>
                    <p style={{ fontSize: 14.5, color: T.text2, marginTop: 8 }}>
                      A screenshot or a photo of the card works, as long as the QR is readable.
                    </p>
                    <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{ display: 'none' }} />
                    <PrimaryButton onClick={() => fileRef.current?.click()} style={{ marginTop: 18 }}>
                      Choose image
                    </PrimaryButton>
                  </div>
                )}

                {method === 'paste' && (
                  <div>
                    <div style={{ ...microLabel, fontSize: 10.5, letterSpacing: '0.2em', marginBottom: 10 }}>
                      Card code
                    </div>
                    <Input
                      placeholder="51766A2D-954B-4858-B9F8-3672033BB81C"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      style={{ fontFamily: T.mono, fontSize: 14 }}
                    />
                    <p style={{ fontSize: 13.5, color: T.mutedWarm, marginTop: 10, lineHeight: 1.5 }}>
                      The code is printed on the back of the card. The first block on its own is enough.
                    </p>
                    <PrimaryButton
                      onClick={() => attach(code)}
                      disabled={code.replace(/[^0-9a-fA-F]/g, '').length < 12}
                      style={{ marginTop: 14 }}
                    >
                      Load card
                    </PrimaryButton>
                  </div>
                )}
              </div>
            </>
          )}

          {card && (
            <div>
              {done ? (
                <>
                  <Notice tone="good">{status?.msg}</Notice>
                  <button
                    type="button"
                    onClick={reset}
                    className="gs-link"
                    style={{
                      ...microLabel,
                      fontSize: 11,
                      letterSpacing: '0.16em',
                      marginTop: 20,
                      color: T.text2,
                    }}
                  >
                    Redeem another →
                  </button>
                </>
              ) : (
                <>
                  <div style={{ ...microLabel, fontSize: 10.5, letterSpacing: '0.2em', marginBottom: 10 }}>
                    Your Lightning address
                  </div>
                  <Input
                    placeholder="you@walletofsatoshi.com"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    style={{ fontFamily: T.mono, fontSize: 14.5 }}
                  />
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                    {WALLET_DOMAINS.map((d) => (
                      <button
                        key={d}
                        type="button"
                        className="gs-outline"
                        onClick={() => setAddress((a) => `${a.split('@')[0] || 'you'}${d}`)}
                        style={{
                          fontFamily: T.mono,
                          fontSize: 12,
                          padding: '7px 12px',
                          borderRadius: 999,
                          border: `1px solid ${T.hair16}`,
                          color: T.text2,
                          transition: 'border-color .15s',
                        }}
                      >
                        {d}
                      </button>
                    ))}
                  </div>

                  <PrimaryButton onClick={redeem} disabled={!ready} style={{ width: '100%', marginTop: 18 }}>
                    {busy ? 'Sending sats…' : 'Redeem to my wallet'}
                  </PrimaryButton>
                  <div style={{ marginTop: 12, fontSize: 13.5, color: T.mutedWarm, textAlign: 'center' }}>
                    {isLightningAddress(address)
                      ? 'Sats leave the card the moment you tap.'
                      : 'Enter a valid Lightning address.'}
                  </div>
                  <button
                    type="button"
                    onClick={reset}
                    className="gs-link"
                    style={{ fontSize: 13.5, color: T.mutedWarm, marginTop: 16 }}
                  >
                    ← Use a different card
                  </button>
                </>
              )}
            </div>
          )}

          {status && !done && (
            <div style={{ marginTop: 18 }}>
              <Notice tone={status.tone === 'info' ? 'info' : status.tone}>{status.msg}</Notice>
            </div>
          )}
        </div>

        <div style={{ flex: '1 1 330px', minWidth: 0 }}>
          {card && art && (
            <GiftCard
              amount={card.amountSats}
              message={card.senderNote}
              to={card.recipientName}
              from={card.senderName}
              art={art}
              code={card.id}
              expiresAt={card.expiresAt}
              qrValue={cardUrl(card.id)}
            />
          )}
        </div>
      </div>
    </Page>
  );
}
