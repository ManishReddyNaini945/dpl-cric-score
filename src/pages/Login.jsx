import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const navigate = useNavigate();
  const { isAdmin, signOut } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    if (!email || !password || loading) return;
    setError('');
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/');
    } catch (err) {
      setError(
        err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password'
          ? 'Wrong email or password.'
          : err.code === 'auth/user-not-found'
          ? 'No admin account found.'
          : err.code === 'auth/too-many-requests'
          ? 'Too many attempts. Try again later.'
          : 'Login failed. Check your credentials.'
      );
    }
    setLoading(false);
  }

  if (isAdmin) {
    return (
      <>
        <div className="app-header">
          <button className="back-btn" onClick={() => navigate('/')}>←</button>
          <h1>Admin</h1>
        </div>
        <div className="page" style={{ textAlign: 'center', paddingTop: 40 }}>
          <div style={{ fontSize: '3rem', marginBottom: 16 }}>👑</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 6 }}>
            Signed in as Admin
          </div>
          <div className="text-muted" style={{ marginBottom: 24, fontSize: '0.85rem' }}>
            {auth.currentUser?.email}
          </div>
          <button className="btn btn-danger btn-full" onClick={async () => { await signOut(); navigate('/'); }}>
            Sign Out (Switch to Viewer)
          </button>
          <button className="btn btn-ghost btn-full mt-8" onClick={() => navigate('/')}>
            ← Back to Home
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="app-header">
        <button className="back-btn" onClick={() => navigate('/')}>←</button>
        <h1>Admin Login</h1>
      </div>

      <div className="page">
        <div style={{ textAlign: 'center', padding: '24px 0 32px' }}>
          <div style={{ fontSize: '3rem', marginBottom: 10 }}>👑</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--gold)' }}>Admin Access</div>
          <div className="text-muted" style={{ fontSize: '0.82rem', marginTop: 4 }}>
            Sign in to score matches and manage players
          </div>
        </div>

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>Admin Email</label>
            <input
              type="email"
              placeholder="admin@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoFocus
              autoComplete="email"
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div style={{
              background: 'rgba(231,76,60,0.12)', border: '1px solid var(--danger)',
              borderRadius: 8, padding: '10px 14px', marginBottom: 14,
              color: 'var(--danger-light)', fontSize: '0.85rem',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary btn-full mt-8"
            disabled={!email || !password || loading}
          >
            {loading ? 'Signing in…' : '👑 Sign In as Admin'}
          </button>
        </form>

        <div className="card mt-16" style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          <div style={{ fontWeight: 700, color: 'var(--white)', marginBottom: 6 }}>Viewer Access</div>
          Just open the app — no login needed. Viewers can see live scores and scorecards automatically.
        </div>

        <button className="btn btn-ghost btn-full mt-12" onClick={() => navigate('/')}>
          ← Continue as Viewer
        </button>
      </div>
    </>
  );
}
