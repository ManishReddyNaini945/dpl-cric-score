import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { formatOvers } from '../utils/cricket';
import { useAuth } from '../context/AuthContext';
import { RoleBadge } from './Players';

function LogoutIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  );
}

function CaptainBadge({ label }) {
  const isC = label === 'C';
  return (
    <span style={{
      fontSize: '0.65rem', fontWeight: 800,
      color: isC ? '#facc15' : '#94a3b8',
      background: isC ? 'rgba(250,204,21,0.12)' : 'rgba(148,163,184,0.12)',
      border: `1px solid ${isC ? 'rgba(250,204,21,0.35)' : 'rgba(148,163,184,0.3)'}`,
      borderRadius: 4, padding: '1px 5px', marginLeft: 5,
    }}>
      {label}
    </span>
  );
}

function SquadModal({ match, onClose }) {
  const { meta } = match;
  const renderTeam = (players, roles, cap, vc, name) => (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        fontWeight: 700, fontSize: '0.9rem', padding: '8px 0',
        borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 10,
        color: 'var(--accent)',
      }}>
        {name} — {players.length} players
      </div>
      {players.map(p => (
        <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
            background: 'var(--surface)', color: 'var(--white)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: '0.85rem',
          }}>
            {p[0].toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{p}</span>
            {p === cap && <CaptainBadge label="C" />}
            {p === vc  && <CaptainBadge label="VC" />}
          </div>
          <RoleBadge role={roles?.[p] || 'allrounder'} small />
        </div>
      ))}
    </div>
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" style={{ maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div className="modal-title" style={{ margin: 0 }}>{meta.team1} vs {meta.team2}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.3rem', cursor: 'pointer' }}>✕</button>
        </div>
        {renderTeam(meta.players1 || [], meta.playerRoles1, meta.captain1, meta.vc1, meta.team1)}
        {renderTeam(meta.players2 || [], meta.playerRoles2, meta.captain2, meta.vc2, meta.team2)}
      </div>
    </div>
  );
}

export default function Home() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('live');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [squadMatch, setSquadMatch] = useState(null);
  const navigate = useNavigate();
  const { isAdmin, signOut } = useAuth();

  useEffect(() => {
    const q = query(collection(db, 'matches'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      setMatches(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, err => {
      console.error('Firestore read failed:', err.code, err.message);
      setLoading(false);
    });
    return unsub;
  }, []);

  const liveMatches = matches.filter(m => m.meta?.status === 'live' || m.meta?.status === 'innings_break');
  const upcomingMatches = matches.filter(m => m.meta?.status === 'upcoming');
  const completedMatches = matches.filter(m => m.meta?.status === 'completed');

  const tabMatches = tab === 'live' ? liveMatches : tab === 'upcoming' ? upcomingMatches : completedMatches;

  function getMatchSummary(match) {
    const { innings = [], meta = {} } = match;
    if (!innings.length) return null;
    const inn1 = innings[0];
    const inn2 = innings[1];
    if (meta.status === 'completed' && inn2) {
      return {
        line1: `${teamName(match, inn1.battingTeam)}: ${inn1.runs}/${inn1.wickets} (${formatOvers(inn1.legalBalls)})`,
        line2: `${teamName(match, inn2.battingTeam)}: ${inn2.runs}/${inn2.wickets} (${formatOvers(inn2.legalBalls)})`,
        result: meta.result,
      };
    }
    if (inn2) {
      const needed = inn1.runs + 1 - inn2.runs;
      const ballsLeft = meta.overs * 6 - inn2.legalBalls;
      return {
        line1: `${teamName(match, inn1.battingTeam)}: ${inn1.runs}/${inn1.wickets}`,
        line2: `${teamName(match, inn2.battingTeam)}: ${inn2.runs}/${inn2.wickets} (${formatOvers(inn2.legalBalls)})`,
        chase: needed > 0 ? `Need ${needed} off ${ballsLeft} balls` : null,
      };
    }
    return {
      line1: `${teamName(match, inn1.battingTeam)}: ${inn1.runs}/${inn1.wickets} (${formatOvers(inn1.legalBalls)})`,
      line2: null,
    };
  }

  function teamName(match, key) {
    return key === 'team1' ? match.meta.team1 : match.meta.team2;
  }

  async function handleDelete(e, matchId) {
    e.preventDefault(); e.stopPropagation();
    if (!window.confirm('Delete this match?')) return;
    await deleteDoc(doc(db, 'matches', matchId));
  }

  async function startUpcoming(e, match) {
    e.preventDefault(); e.stopPropagation();
    navigate(`/match/${match.id}/start`);
  }

  const TABS = [
    { id: 'live',      label: 'Live',      count: liveMatches.length },
    { id: 'upcoming',  label: 'Upcoming',  count: upcomingMatches.length },
    { id: 'completed', label: 'Results',   count: completedMatches.length },
  ];

  function formatScheduled(ts) {
    if (!ts) return null;
    const d = new Date(ts);
    const now = new Date();
    const diffMs = d - now;
    const diffH = Math.round(diffMs / 3600000);
    const diffD = Math.floor(diffMs / 86400000);

    const dateStr = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
    const timeStr = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

    let countdown = '';
    if (diffMs < 0) countdown = 'Starting soon';
    else if (diffH < 1) countdown = 'Less than 1 hr away';
    else if (diffH < 24) countdown = `${diffH}h away`;
    else countdown = `${diffD}d away`;

    return { dateStr, timeStr, countdown };
  }

  function renderSquadInline(players, roles, cap, vc, teamName, accentColor) {
    return (
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: accentColor, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {teamName}
        </div>
        {(players || []).map(name => (
          <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <div style={{
              width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
              background: accentColor + '22', color: accentColor,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: '0.72rem',
            }}>
              {name[0].toUpperCase()}
            </div>
            <div style={{ flex: 1, fontSize: '0.82rem', fontWeight: 600 }}>
              {name}
              {name === cap && <span style={{ marginLeft: 4, fontSize: '0.6rem', fontWeight: 800, color: '#facc15', background: 'rgba(250,204,21,0.12)', border: '1px solid rgba(250,204,21,0.3)', borderRadius: 3, padding: '1px 4px' }}>C</span>}
              {name === vc  && <span style={{ marginLeft: 4, fontSize: '0.6rem', fontWeight: 800, color: '#94a3b8', background: 'rgba(148,163,184,0.1)', border: '1px solid rgba(148,163,184,0.25)', borderRadius: 3, padding: '1px 4px' }}>VC</span>}
            </div>
            <RoleBadge role={roles?.[name] || 'allrounder'} small />
          </div>
        ))}
      </div>
    );
  }

  function renderMatchCard(match) {
    const summary = getMatchSummary(match);
    const isLive = match.meta?.status === 'live' || match.meta?.status === 'innings_break';
    const isUpcoming = match.meta?.status === 'upcoming';
    const scheduled = isUpcoming ? formatScheduled(match.meta?.scheduledAt) : null;

    return (
      <div key={match.id} style={{ position: 'relative', marginBottom: 12 }}>
        <Link
          className="match-card"
          to={isUpcoming ? '#' : match.meta?.status === 'completed' ? `/match/${match.id}/scorecard` : `/match/${match.id}`}
          onClick={isUpcoming ? e => e.preventDefault() : undefined}
          style={{ display: 'block', paddingBottom: 12 }}
        >
          {/* Header row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              Box Cricket · {match.meta?.overs} overs
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              {isLive && <span className="status-dot live" />}
              <span style={{
                fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase',
                color: isLive ? '#4ade80' : isUpcoming ? 'var(--accent)' : 'var(--text-muted)',
              }}>
                {isLive ? 'Live' : isUpcoming ? 'Upcoming' : 'Completed'}
              </span>
            </div>
          </div>

          {/* Scheduled time banner for upcoming */}
          {isUpcoming && scheduled && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
              background: 'rgba(56,189,248,0.07)', border: '1px solid rgba(56,189,248,0.18)',
              borderRadius: 8, padding: '7px 12px',
            }}>
              <span style={{ fontSize: '1.1rem' }}>📅</span>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--white)' }}>
                  {scheduled.dateStr} · {scheduled.timeStr}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--accent)', fontWeight: 600 }}>
                  {scheduled.countdown}
                </div>
              </div>
            </div>
          )}
          {isUpcoming && !scheduled && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10,
              fontSize: '0.78rem', color: 'var(--text-muted)',
            }}>
              📅 Time not set
            </div>
          )}

          {/* Teams */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, alignItems: 'center', marginBottom: 10 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{match.meta?.team1}</div>
              {summary?.line1 && <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--white)', marginTop: 2 }}>{summary.line1.split(': ')[1]}</div>}
              {!summary && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>{(match.meta?.players1?.length || 0)} players</div>}
            </div>
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>vs</div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{match.meta?.team2}</div>
              {summary?.line2 && <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--white)', marginTop: 2 }}>{summary.line2.split(': ')[1]}</div>}
              {!summary && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>{(match.meta?.players2?.length || 0)} players</div>}
            </div>
          </div>

          {/* Inline squads for upcoming */}
          {isUpcoming && (
            <div style={{
              borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12, marginBottom: 10,
              display: 'flex', gap: 16,
            }}>
              {renderSquadInline(match.meta?.players1, match.meta?.playerRoles1, match.meta?.captain1, match.meta?.vc1, match.meta?.team1, 'var(--accent)')}
              <div style={{ width: 1, background: 'rgba(255,255,255,0.07)', flexShrink: 0 }} />
              {renderSquadInline(match.meta?.players2, match.meta?.playerRoles2, match.meta?.captain2, match.meta?.vc2, match.meta?.team2, '#a78bfa')}
            </div>
          )}

          {/* Result / chase */}
          {(summary?.result || summary?.chase) && (
            <div style={{
              background: summary?.result ? 'rgba(56,189,248,0.08)' : 'rgba(250,204,21,0.06)',
              border: `1px solid ${summary?.result ? 'rgba(56,189,248,0.2)' : 'rgba(250,204,21,0.2)'}`,
              borderRadius: 8, padding: '5px 10px', fontSize: '0.8rem', fontWeight: 600,
              color: summary?.result ? 'var(--accent)' : '#facc15', marginBottom: 8,
            }}>
              {summary.result || summary.chase}
            </div>
          )}

          {/* Action buttons row */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {!isUpcoming && (
              <button
                onClick={e => { e.preventDefault(); e.stopPropagation(); setSquadMatch(match); }}
                style={{
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 6, padding: '5px 12px', fontSize: '0.75rem', fontWeight: 600,
                  color: 'var(--text-muted)', cursor: 'pointer',
                }}
              >
                👥 Squads
              </button>
            )}

            {isUpcoming && isAdmin && (
              <button
                onClick={e => { e.preventDefault(); e.stopPropagation(); navigate(`/match/${match.id}`); }}
                style={{
                  background: 'rgba(56,189,248,0.12)', border: '1px solid rgba(56,189,248,0.3)',
                  borderRadius: 6, padding: '5px 12px', fontSize: '0.75rem', fontWeight: 700,
                  color: 'var(--accent)', cursor: 'pointer',
                }}
              >
                🏏 Start Match
              </button>
            )}

            {isAdmin && (
              <button
                onClick={e => { e.preventDefault(); e.stopPropagation(); handleDelete(e, match.id); }}
                style={{
                  marginLeft: 'auto',
                  background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
                  borderRadius: 6, padding: '5px 12px', fontSize: '0.75rem', fontWeight: 700,
                  color: 'var(--danger-light)', cursor: 'pointer',
                }}
              >
                🗑️ Delete
              </button>
            )}
          </div>
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="app-header">
        <span style={{ fontSize: '1.2rem' }}>🏏</span>
        <h1>Absy Digital Cric Score</h1>
        <div className="header-actions">
          {isAdmin && (
            <>
              <button className="btn btn-secondary" style={{ padding: '7px 12px', fontSize: '0.82rem' }} onClick={() => navigate('/players')}>
                👤 Players
              </button>
              <button
                onClick={() => setShowLogoutConfirm(true)}
                title="Sign out"
                style={{
                  background: 'none', border: '1px solid #4b5563', borderRadius: 8,
                  padding: '7px 10px', color: 'var(--text-muted)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center',
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

      <div className="page" style={{ paddingTop: 12 }}>
        {isAdmin && (
          <>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)',
              borderRadius: 20, padding: '4px 12px', marginBottom: 12,
              fontSize: '0.78rem', color: 'var(--accent)',
            }}>
              👑 Admin Mode
            </div>
            <button className="btn btn-primary btn-full mb-16" onClick={() => navigate('/new')}>
              + New Match
            </button>
          </>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 16, background: 'var(--card-bg)', borderRadius: 10, padding: 4 }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flex: 1, padding: '8px 4px', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontWeight: 700, fontSize: '0.82rem', transition: 'all 0.15s',
                background: tab === t.id ? 'var(--surface)' : 'transparent',
                color: tab === t.id ? 'var(--white)' : 'var(--text-muted)',
              }}
            >
              {t.id === 'live' && t.count > 0 && <span style={{ color: '#4ade80', marginRight: 4 }}>●</span>}
              {t.label}
              {t.count > 0 && (
                <span style={{
                  marginLeft: 6, background: tab === t.id ? 'var(--accent)' : 'rgba(255,255,255,0.1)',
                  color: tab === t.id ? '#0c1a28' : 'var(--text-muted)',
                  borderRadius: 10, padding: '1px 6px', fontSize: '0.7rem', fontWeight: 800,
                }}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center text-muted" style={{ padding: '40px' }}>Loading…</div>
        ) : tabMatches.length === 0 ? (
          <div className="empty-state">
            <div className="icon">{tab === 'live' ? '📡' : tab === 'upcoming' ? '📅' : '🏆'}</div>
            <p>
              {tab === 'live' ? 'No live matches right now.' : tab === 'upcoming' ? 'No upcoming matches.' : 'No completed matches yet.'}
            </p>
          </div>
        ) : (
          tabMatches.map(match => renderMatchCard(match))
        )}
      </div>

      {/* Squad Modal */}
      {squadMatch && <SquadModal match={squadMatch} onClose={() => setSquadMatch(null)} />}

      {/* Logout Confirm */}
      {showLogoutConfirm && (
        <div className="modal-overlay" onClick={() => setShowLogoutConfirm(false)}>
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
              <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 6 }}>Sign Out?</div>
              <div className="text-muted" style={{ fontSize: '0.85rem' }}>You will be switched back to viewer mode.</div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowLogoutConfirm(false)}>Cancel</button>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={async () => { setShowLogoutConfirm(false); await signOut(); }}>Yes, Sign Out</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
