import { Navigate, Route, Routes } from 'react-router-dom';

import Landing from './pages/Landing.jsx';
import Create from './pages/Create.jsx';
import PayInvoice from './pages/PayInvoice.jsx';
import CardReady from './pages/CardReady.jsx';
import GiftLink from './pages/GiftLink.jsx';
import Redeem from './pages/Redeem.jsx';
import Explore from './pages/Explore.jsx';
import Submit from './pages/Submit.jsx';
import HowItWorks from './pages/HowItWorks.jsx';
import About from './pages/About.jsx';
import Terms from './pages/Terms.jsx';
import Privacy from './pages/Privacy.jsx';
import Admin from './pages/Admin.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/create" element={<Create />} />
      <Route path="/pay/:id" element={<PayInvoice />} />
      <Route path="/ready/:id" element={<CardReady />} />

      {/* The share link is /card/:id. Netlify proxies that path to the backend
          so link previews get OG tags; the backend then bounces humans to /g/:id,
          which is the same screen served by the SPA. */}
      <Route path="/card/:id" element={<GiftLink />} />
      <Route path="/g/:id" element={<GiftLink />} />

      <Route path="/redeem" element={<Redeem />} />
      <Route path="/explore" element={<Explore />} />
      <Route path="/submit" element={<Submit />} />
      <Route path="/design" element={<Navigate to="/submit" replace />} />

      <Route path="/how-it-works" element={<HowItWorks />} />
      <Route path="/about" element={<About />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />

      <Route path="/admin" element={<Admin />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
