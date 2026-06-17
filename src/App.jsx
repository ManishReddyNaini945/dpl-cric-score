import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Home from './pages/Home';
import NewMatch from './pages/NewMatch';
import Scoring from './pages/Scoring';
import Scorecard from './pages/Scorecard';
import Players from './pages/Players';
import Login from './pages/Login';
import EditSquad from './pages/EditSquad';

function LoadingScreen() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100dvh', flexDirection: 'column', gap: 12,
      background: 'var(--green-dark)', color: 'var(--text-muted)',
    }}>
      <div style={{ fontSize: '2.5rem' }}>🏏</div>
      <div>Loading Absy Digital Cric Score…</div>
    </div>
  );
}

export default function App() {
  const { ready } = useAuth();
  if (!ready) return <LoadingScreen />;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/admin" element={<Login />} />
        <Route path="/new" element={<NewMatch />} />
        <Route path="/players" element={<Players />} />
        <Route path="/match/:id" element={<Scoring />} />
        <Route path="/match/:id/scorecard" element={<Scorecard />} />
        <Route path="/match/:id/squad" element={<EditSquad />} />
      </Routes>
    </BrowserRouter>
  );
}
