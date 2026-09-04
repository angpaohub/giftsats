import { useEffect, useState } from 'react';
import { api } from './api.js';
import { resolveArt } from './designs.js';

/**
 * Load a card by id, plus its catalogue design when the front is an upload.
 * While the card is still pending, keep polling — the backend settles it on read.
 */
export function useCard(id, { poll = false } = {}) {
  const [card, setCard] = useState(null);
  const [design, setDesign] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setError('Invalid link');
      setLoading(false);
      return undefined;
    }
    let alive = true;
    let timer = null;

    async function load() {
      try {
        const data = await api.gift(id);
        if (!alive) return;
        setCard(data);
        setError('');
        if (data.designId && !String(data.designId).startsWith('giftsats-')) {
          api
            .design(data.designId)
            .then((d) => alive && setDesign(d))
            .catch(() => {});
        }
        if (poll && data.status === 'pending') timer = setTimeout(load, 3000);
      } catch (e) {
        if (alive) setError(e.status === 404 ? 'Gift card not found' : e.message);
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [id, poll]);

  // A card made with "your own design/pic" carries customImageUrl instead of
  // a catalogue design — without this check the card-ready and share-link
  // pages (both built on this hook) would silently fall back to default art.
  const art = card
    ? card.customImageUrl
      ? resolveArt(card.designId, { imageUrl: card.customImageUrl })
      : resolveArt(card.designId, design)
    : null;

  return { card, design, art, error, loading, setCard };
}