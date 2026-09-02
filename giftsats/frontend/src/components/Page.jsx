import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Header from './Header.jsx';
import Footer from './Footer.jsx';
import { gutter } from './ui.jsx';

/**
 * Page shell. `footer` is off for the focused task flows (Create, Pay Invoice,
 * Card Ready, Gift Link, Submit) and on for everything else.
 */
export default function Page({ children, footer = true, maxWidth = 1300, title }) {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  useEffect(() => {
    document.title = title ? `${title} — GiftSats` : 'GiftSats — Bitcoin gift cards';
  }, [title]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main
        style={{
          flex: 1,
          width: '100%',
          maxWidth,
          margin: '0 auto',
          padding: `clamp(26px, 5vw, 56px) ${gutter} 96px`,
        }}
      >
        {children}
      </main>
      {footer && <Footer />}
    </div>
  );
}
