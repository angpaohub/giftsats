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

  return { card, design, art: card ? resolveArt(card.designId, design) : null, error, loading, setCard };
}
