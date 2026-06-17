import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { formatOvers } from '../utils/cricket';
import { useAuth } from '../context/AuthContext';

function LogoutIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  );
}

export default function Home() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const navigate = useNavigate();
  const { isAdmin, signOut } = useAuth();

  useEffect(() => {
    const q = query(collection(db, 'matches'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setMatches(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, []);

  function getMatchSummary(match) {
    const { innings = [], meta = {} } = match;
    if (!innings.length) return `${meta.overs || 6} overs`;
    const inn1 = innings[0];
    const inn2 = innings[1];
    if (meta.status === 'completed' && inn2) {
      return `${teamName(match, inn1.battingTeam)} ${inn1.runs}/${inn1.wickets} · ${teamName(match, inn2.battingTeam)} ${inn2.runs}/${inn2.wickets}`;
    }
    if (inn2) {
      return `${teamName(match, inn1.battingTeam)} ${inn1.runs}/${inn1.wickets} | ${teamName(match, inn2.battingTeam)} ${inn2.runs}/${inn2.wickets} (${formatOvers(inn2.legalBalls)})`;
    }
    return `${teamName(match, inn1.battingTeam)} ${inn1.runs}/${inn1.wickets} (${formatOvers(inn1.legalBalls)})`;
  }

  function teamName(match, key) {
    return key === 'team1' ? match.meta.team1 : match.meta.team2;
  }

  async function handleDelete(e, matchId) {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm('Delete this match? This cannot be undone.')) return;
    await deleteDoc(doc(db, 'matches', matchId));
  }

  return (
    <>
      <div className="app-header">
        <span style={{ fontSize: '1.4rem' }}>🏏</span>
        <h1>Absy Digital Cric Score</h1>
        <div className="header-actions">
          {isAdmin && (
            <>
              <button className="btn btn-secondary" style={{ padding: '8px 12px', fontSize: '0.85rem' }} onClick={() => navigate('/players')}>
                👤 Players
              </button>
              <button
                onClick={() => setShowLogoutConfirm(true)}
                title="Sign out"
                style={{
                  background: 'none', border: '1px solid #4b5563',
                  borderRadius: 8, padding: '8px 11px',
                  color: 'var(--text-muted)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'border-color 0.15s, color 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--danger-light)'; e.currentTarget.style.color = 'var(--danger-light)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#4b5563'; e.currentTarget.style.color = 'var(--text-muted)'; }}
              >
                <LogoutIcon />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="page">
        {/* Admin indicator pill */}
        {isAdmin && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)',
            borderRadius: 20, padding: '4px 12px', marginBottom: 14,
            fontSize: '0.78rem', color: 'var(--accent)',
          }}>
            👑 Admin Mode
          </div>
        )}

        <div className="home-hero">
          <div className="logo">🏟️</div>
          <h2>Box Cricket</h2>
          <p>Live scoring · Real-time sync · Free</p>
        </div>

        {isAdmin && (
          <button className="btn btn-primary btn-full mb-16" onClick={() => navigate('/new')}>
            + Start New Match
          </button>
        )}

        {loading ? (
          <div className="text-center text-muted" style={{ padding: '32px' }}>Loading matches…</div>
        ) : matches.length === 0 ? (
          <div className="empty-state">
            <div className="icon">📋</div>
            <p>No matches yet.{isAdmin ? <><br />Start your first match above!</> : ''}</p>
          </div>
        ) : (
          <>
            <div className="section-title">Recent Matches</div>
            {matches.map(match => (
              <div key={match.id} style={{ position: 'relative' }}>
                <Link
                  className="match-card"
                  to={match.meta?.status === 'completed' ? `/match/${match.id}/scorecard` : `/match/${match.id}`}
                  style={{ paddingRight: isAdmin ? 48 : 16 }}
                >
                  <div className="match-teams">
                    {match.meta?.team1} <span>vs</span> {match.meta?.team2}
                  </div>
                  <div className="match-meta">
                    <span className={`status-dot ${match.meta?.status === 'live' || match.meta?.status === 'innings_break' ? 'live' : ''}`} />
                    <span>{getMatchSummary(match)}</span>
                  </div>
                  <div className="match-meta" style={{ marginTop: 2 }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                      {match.meta?.status === 'live' ? 'LIVE' :
                       match.meta?.status === 'innings_break' ? 'INNINGS BREAK' :
                       match.meta?.status === 'completed' ? 'COMPLETED' : 'SETUP'}
                      {' · '}{match.meta?.overs} overs
                    </span>
                  </div>
                </Link>
                {isAdmin && (
                  <button
                    onClick={e => handleDelete(e, match.id)}
                    style={{
                      position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', color: 'var(--danger-light)',
                      fontSize: '1.1rem', cursor: 'pointer', padding: '6px',
                    }}
                  >
                    🗑️
                  </button>
                )}
              </div>
            ))}
          </>
        )}
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div
          className="modal-overlay"
          onClick={() => setShowLogoutConfirm(false)}
        >
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 12px', color: 'var(--danger-light)',
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 6 }}>
                Sign Out?
              </div>
              <div className="text-muted" style={{ fontSize: '0.85rem' }}>
                You will be switched back to viewer mode.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="btn btn-secondary"
                style={{ flex: 1 }}
                onClick={() => setShowLogoutConfirm(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger"
                style={{ flex: 1 }}
                onClick={async () => { setShowLogoutConfirm(false); await signOut(); }}
              >
                Yes, Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
