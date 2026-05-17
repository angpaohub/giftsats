import { useState } from 'react';
import CreateGift from './pages/CreateGift.jsx';
import Wallet from './pages/Wallet.jsx';
import HowToRedeem from './pages/HowToRedeem.jsx';
import Admin from './pages/Admin.jsx';

const tabs = [
  { id: 'create', label: '⚡ Create Gift Sats' },
  { id: 'wallet', label: '💼 Your Wallet' },
  { id: 'redeem', label: '📖 How to Redeem' },
];

const isAdmin = window.location.pathname === '/admin';

export default function App() {
  const [activeTab, setActiveTab] = useState('create');

  if (isAdmin) return <Admin />;

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
            <span style={{
              marginLeft: 8, fontSize: 10, fontFamily: 'var(--font-mono)',
              background: '#1a1a1a', border: '1px solid #2a2a2a',
              padding: '2px 8px', borderRadius: 4, color: '#666',
            }}>TESTNET</span>
          </div>
          <div style={{ display: 'flex', gap: 0 }}>
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
        {activeTab === 'redeem' && <HowToRedeem />}
      </main>
      <footer style={{ padding: '16px 24px', textAlign: 'center', color: '#333', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
        giftsats • powered by Lightning & Cashu • not your keys, not your coins
      </footer>
    </div>
  );
}
