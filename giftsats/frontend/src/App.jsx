import { useState } from 'react';
import CreateGift from './pages/CreateGift.jsx';
import Wallet from './pages/Wallet.jsx';
import HowItWorks from './pages/HowItWorks.jsx';
import Donate from './pages/Donate.jsx';
import Admin from './pages/Admin.jsx';
import Explore from './pages/Explore.jsx';
import DesignSubmit from './pages/DesignSubmit.jsx';

const tabs = [
  { id: 'create', label: '⚡ Create Gift Sats' },
  { id: 'wallet', label: '💼 Redeem' },
  { id: 'explore', label: '🎨 Explore Designs' },
  { id: 'howto', label: '📖 How It Works' },
  { id: 'support', label: '🧡 Support Us' },
];

const path = window.location.pathname;
const isAdmin = path === '/admin';
const isExplore = path === '/explore';
const isDesign = path === '/design';

export default function App() {
  const [activeTab, setActiveTab] = useState('create');

  if (isAdmin) return <Admin />;
  if (isExplore) return <Explore />;
  if (isDesign) return <DesignSubmit />;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{
        padding: '20px 24px 0', borderBottom: '1px solid #1a1a1a',
        background: '#0a0a0a', position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: 'linear-gradient(135deg, #F7931A, #FF6B35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, animation: 'pulse-glow 3s ease-in-out infinite',
            }}>₿</div>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, letterSpacing: '-0.5px' }}>
              Gift<span style={{ color: '#F7931A' }}>Sats</span>
            </span>
          </div>
          <div style={{ display: 'flex', gap: 0, overflowX: 'auto' }}>
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                padding: '10px 20px', background: 'none', cursor: 'pointer',
                color: activeTab === tab.id ? '#F7931A' : '#555',
                fontFamily: 'var(--font-display)', fontWeight: activeTab === tab.id ? 600 : 400,
                fontSize: 13, border: 'none',
                borderBottom: activeTab === tab.id ? '2px solid #F7931A' : '2px solid transparent',
                transition: 'all 0.2s', whiteSpace: 'nowrap',
              }}>{tab.label}</button>
            ))}
          </div>
        </div>
      </header>
      <main style={{ flex: 1, maxWidth: 900, margin: '0 auto', width: '100%', padding: '32px 24px' }}>
        {activeTab === 'create' && <CreateGift />}
        {activeTab === 'wallet' && <Wallet />}
        {activeTab === 'howto' && <HowItWorks />}
        {activeTab === 'support' && <Donate />}
        {activeTab === 'explore' && <Explore />}
      </main>
      <footer style={{ padding: '16px 24px', textAlign: 'center', color: '#333', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
        giftsats • powered by Lightning • not your keys, not your coins
      </footer>
    </div>
  );
}
