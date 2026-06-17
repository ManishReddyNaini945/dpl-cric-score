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
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [squadMatch, setSquadMatch] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null); // full match doc
  const [editFields, setEditFields] = useState({});
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

  // A scheduled upcoming match whose time has passed moves to the Live tab
  function isTimePassed(m) {
    return m.meta?.scheduledAt && m.meta.scheduledAt <= now;
  }

  const liveMatches = matches.filter(m =>
    m.meta?.status === 'live' || m.meta?.status === 'innings_break' ||
    (m.meta?.status === 'upcoming' && isTimePassed(m))
  );
  const upcomingMatches = matches.filter(m =>
    m.meta?.status === 'upcoming' && !isTimePassed(m)
  );
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

  function handleDelete(e, match) {
    e.preventDefault(); e.stopPropagation();
    setDeleteTarget({ id: match.id, name: `${match.meta?.team1} vs ${match.meta?.team2}` });
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    await deleteDoc(doc(db, 'matches', deleteTarget.id));
    setDeleteTarget(null);
  }

  function handleEdit(e, match) {
    e.preventDefault(); e.stopPropagation();
    const m = match.meta || {};
    const scheduledVal = m.scheduledAt
      ? new Date(m.scheduledAt - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)
      : '';
    setEditFields({
      team1: m.team1 || '',
      team2: m.team2 || '',
      overs: m.overs || 6,
      venue: m.venue || '',
      scheduledAt: scheduledVal,
    });
    setEditTarget(match);
  }

  async function saveEdit() {
    if (!editTarget) return;
    const updated = {
      'meta.team1': editFields.team1.trim() || editTarget.meta.team1,
      'meta.team2': editFields.team2.trim() || editTarget.meta.team2,
      'meta.overs': Number(editFields.overs),
      'meta.venue': editFields.venue.trim(),
      'meta.scheduledAt': editFields.scheduledAt ? new Date(editFields.scheduledAt).getTime() : null,
    };
    await updateDoc(doc(db, 'matches', editTarget.id), updated);
    setEditTarget(null);
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
    const diffMs = d - now;

    const dateStr = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
    const timeStr = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

    let countdown = '';
    if (diffMs <= 0) {
      countdown = 'Starting soon';
    } else {
      const totalSecs = Math.floor(diffMs / 1000);
      const days  = Math.floor(totalSecs / 86400);
      const hours = Math.floor((totalSecs % 86400) / 3600);
      const mins  = Math.floor((totalSecs % 3600) / 60);
      const secs  = totalSecs % 60;

      if (days > 0)       countdown = `${days}d ${hours}h ${mins}m`;
      else if (hours > 0) countdown = `${hours}h ${mins}m ${secs}s`;
      else if (mins > 0)  countdown = `${mins}m ${secs}s`;
      else                countdown = `${secs}s`;
    }

    return { dateStr, timeStr, countdown, isPast: diffMs <= 0 };
  }

  function SquadList({ players, roles, cap, vc, color }) {
    return (players || []).map(name => {
      const role = roles?.[name] || 'allrounder';
      const roleColor = role === 'batsman' ? '#3498db' : role === 'bowler' ? '#2ecc71' : '#f0a500';
      return (
        <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
            background: color + '22', color, fontWeight: 800, fontSize: '0.75rem',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {name[0].toUpperCase()}
          </div>
          <div style={{ flex: 1, fontSize: '0.82rem', fontWeight: 600, lineHeight: 1.2 }}>
            {name}
            {name === cap && <span style={{ marginLeft: 4, fontSize: '0.6rem', fontWeight: 900, color: '#facc15', background: 'rgba(250,204,21,0.15)', border: '1px solid rgba(250,204,21,0.35)', borderRadius: 3, padding: '1px 4px' }}>C</span>}
            {name === vc  && <span style={{ marginLeft: 4, fontSize: '0.6rem', fontWeight: 900, color: '#94a3b8', background: 'rgba(148,163,184,0.12)', border: '1px solid rgba(148,163,184,0.3)', borderRadius: 3, padding: '1px 4px' }}>VC</span>}
          </div>
          <RoleBadge role={role} small />
        </div>
      );
    });
  }

  function renderMatchCard(match) {
    const summary = getMatchSummary(match);
    const m = match.meta || {};
    const isLive = m.status === 'live' || m.status === 'innings_break';
    const isUpcoming = m.status === 'upcoming';
    const isCompleted = m.status === 'completed';
    // Upcoming match whose scheduled time has passed → show in Live tab as toss-pending
    const isTossPending = isUpcoming && isTimePassed(match);
    const hasTossResult = isTossPending && !!m.tossWinner;
    const scheduled = (isUpcoming && !isTossPending) ? formatScheduled(m.scheduledAt) : null;
    const matchLink = isCompleted ? `/match/${match.id}/scorecard` : `/match/${match.id}`;

    return (
      <div key={match.id} style={{ marginBottom: 14, borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', background: 'var(--card-bg)' }}>

        {/* ── Top strip: status + match info ── */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '10px 14px',
          background: isLive ? 'rgba(74,222,128,0.06)' : isUpcoming ? 'rgba(56,189,248,0.06)' : 'rgba(255,255,255,0.03)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {(isLive || isTossPending) && <span style={{ width: 8, height: 8, borderRadius: '50%', background: isTossPending ? '#facc15' : '#4ade80', display: 'inline-block', boxShadow: `0 0 6px ${isTossPending ? '#facc15' : '#4ade80'}`, animation: 'pulse 1.5s infinite' }} />}
            <span style={{
              fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px',
              color: isLive ? '#4ade80' : isTossPending ? '#facc15' : isUpcoming ? 'var(--accent)' : 'var(--text-muted)',
            }}>
              {isLive ? '● Live' : isTossPending ? (hasTossResult ? '🏆 Toss Done' : '🪙 Toss Pending') : isUpcoming ? 'Upcoming' : 'Completed'}
            </span>
            <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: '0.7rem' }}>|</span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              Box Cricket · {m.overs} Overs
            </span>
          </div>
          {isAdmin && (
            <div style={{ display: 'flex', gap: 4 }}>
              {isUpcoming && (
                <button onClick={e => { e.preventDefault(); e.stopPropagation(); navigate(`/match/${match.id}/squad`); }} style={{ background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.25)', borderRadius: 6, color: 'var(--accent)', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700, padding: '2px 7px' }}>👥 Squad</button>
              )}
              <button onClick={e => handleEdit(e, match)} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, padding: '2px 6px' }}>✏️</button>
              <button onClick={e => handleDelete(e, match)} style={{ background: 'none', border: 'none', color: 'var(--danger-light)', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, padding: '2px 6px' }}>🗑️</button>
            </div>
          )}
        </div>

        {/* ── Venue + time ── */}
        <div style={{ padding: '8px 14px 0', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {m.venue && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <span>📍</span><span>{m.venue}</span>
            </div>
          )}
          {isUpcoming && scheduled && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <span>🗓</span><span>{scheduled.dateStr} · {scheduled.timeStr}</span>
            </div>
          )}
        </div>

        {/* ── Countdown for upcoming ── */}
        {isUpcoming && scheduled && (
          <div style={{
            margin: '8px 14px',
            background: scheduled.isPast ? 'rgba(250,204,21,0.08)' : 'rgba(56,189,248,0.08)',
            border: `1px solid ${scheduled.isPast ? 'rgba(250,204,21,0.25)' : 'rgba(56,189,248,0.2)'}`,
            borderRadius: 8, padding: '6px 12px',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ fontSize: '0.85rem' }}>⏱</span>
            <span style={{
              fontSize: '0.92rem', fontWeight: 800,
              color: scheduled.isPast ? '#facc15' : 'var(--accent)',
              fontVariantNumeric: 'tabular-nums', letterSpacing: '0.3px',
            }}>
              {scheduled.isPast ? 'Starting soon' : `Starts in ${scheduled.countdown}`}
            </span>
          </div>
        )}
        {isUpcoming && !m.scheduledAt && (
          <div style={{ margin: '8px 14px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>📅 Time not set</div>
        )}

        {/* ── Teams & Score ── */}
        <Link to={matchLink} onClick={isUpcoming ? e => e.preventDefault() : undefined} style={{ display: 'block', padding: '10px 14px', textDecoration: 'none' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 36px 1fr', alignItems: 'center', gap: 4 }}>
            {/* Team 1 */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: 'linear-gradient(135deg,rgba(56,189,248,0.3),rgba(56,189,248,0.1))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '1rem', color: 'var(--accent)', flexShrink: 0 }}>
                  {(m.team1||'T')[0].toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', lineHeight: 1.2, color: 'var(--white)' }}>{m.team1}</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{m.players1?.length || 0} players</div>
                </div>
              </div>
              {summary?.line1 && (
                <div style={{ fontSize: '1.3rem', fontWeight: 900, color: 'var(--white)', letterSpacing: '-0.5px' }}>
                  {summary.line1.split(': ')[1] || summary.line1}
                </div>
              )}
            </div>

            {/* VS */}
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 700 }}>VS</div>

            {/* Team 2 */}
            <div style={{ textAlign: 'right' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexDirection: 'row-reverse' }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: 'linear-gradient(135deg,rgba(167,139,250,0.3),rgba(167,139,250,0.1))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '1rem', color: '#a78bfa', flexShrink: 0 }}>
                  {(m.team2||'T')[0].toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', lineHeight: 1.2, color: 'var(--white)' }}>{m.team2}</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{m.players2?.length || 0} players</div>
                </div>
              </div>
              {summary?.line2 && (
                <div style={{ fontSize: '1.3rem', fontWeight: 900, color: 'var(--white)', letterSpacing: '-0.5px' }}>
                  {summary.line2.split(': ')[1] || summary.line2}
                </div>
              )}
            </div>
          </div>

          {/* Toss status strip */}
          {isTossPending && (
            <div style={{
              marginTop: 10, borderRadius: 8, padding: '8px 12px', textAlign: 'center',
              background: hasTossResult ? 'rgba(250,204,21,0.08)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${hasTossResult ? 'rgba(250,204,21,0.25)' : 'rgba(255,255,255,0.08)'}`,
            }}>
              {hasTossResult ? (
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#facc15' }}>
                  🏆 {m.tossWinner === 'team1' ? m.team1 : m.team2} won the toss! Choosing to bat/bowl…
                </div>
              ) : (
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  🪙 Toss is pending…
                </div>
              )}
            </div>
          )}

          {/* Result / chase strip */}
          {(summary?.result || summary?.chase) && (
            <div style={{
              marginTop: 10, borderRadius: 6, padding: '6px 10px', textAlign: 'center',
              fontSize: '0.8rem', fontWeight: 700,
              background: summary?.result ? 'rgba(56,189,248,0.08)' : 'rgba(250,204,21,0.07)',
              color: summary?.result ? 'var(--accent)' : '#facc15',
              border: `1px solid ${summary?.result ? 'rgba(56,189,248,0.2)' : 'rgba(250,204,21,0.2)'}`,
            }}>
              {summary.result || summary.chase}
            </div>
          )}

          {/* Player of the Match */}
          {isCompleted && m.potm && (
            <div style={{
              marginTop: 8, borderRadius: 8, padding: '8px 12px',
              background: 'rgba(250,204,21,0.07)', border: '1px solid rgba(250,204,21,0.2)',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{ fontSize: '1rem' }}>🏆</span>
              <div>
                <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#facc15', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Player of the Match</div>
                <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#facc15' }}>{m.potm}</div>
              </div>
            </div>
          )}
        </Link>

        {/* ── Playing XI section ── */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '0 14px 12px' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', padding: '10px 0 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>👥</span> Playing XI
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1px 1fr', gap: '0 12px' }}>
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{m.team1}</div>
              <SquadList players={m.players1} roles={m.playerRoles1} cap={m.captain1} vc={m.vc1} color="var(--accent)" />
            </div>
            <div style={{ background: 'rgba(255,255,255,0.07)' }} />
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#a78bfa', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{m.team2}</div>
              <SquadList players={m.players2} roles={m.playerRoles2} cap={m.captain2} vc={m.vc2} color="#a78bfa" />
            </div>
          </div>
        </div>

        {/* ── Bottom action bar ── */}
        {isUpcoming && isAdmin && !isTossPending && (
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '10px 14px' }}>
            <button
              onClick={() => navigate(`/match/${match.id}`)}
              className="btn btn-primary btn-full"
              style={{ padding: '9px', fontSize: '0.85rem' }}
            >
              🏏 Start Match
            </button>
          </div>
        )}
        {isTossPending && isAdmin && (
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '10px 14px' }}>
            <button
              onClick={() => navigate(`/match/${match.id}`)}
              className="btn btn-primary btn-full"
              style={{ padding: '9px', fontSize: '0.85rem', background: 'linear-gradient(135deg,#ca8a04,#facc15)', color: '#000' }}
            >
              🪙 Do Toss
            </button>
          </div>
        )}
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

      {/* Edit Match Modal */}
      {editTarget && (
        <div className="modal-overlay" onClick={() => setEditTarget(null)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div className="modal-title" style={{ margin: 0 }}>✏️ Edit Match</div>
              <button onClick={() => setEditTarget(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.3rem', cursor: 'pointer' }}>✕</button>
            </div>

            <div className="form-group">
              <label>Team 1 Name</label>
              <input
                type="text"
                value={editFields.team1}
                onChange={e => setEditFields(f => ({ ...f, team1: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label>Team 2 Name</label>
              <input
                type="text"
                value={editFields.team2}
                onChange={e => setEditFields(f => ({ ...f, team2: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label>Overs per Innings</label>
              <select
                value={editFields.overs}
                onChange={e => setEditFields(f => ({ ...f, overs: e.target.value }))}
              >
                {[4, 5, 6, 7, 8, 10, 12].map(o => <option key={o} value={o}>{o} overs</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>📍 Venue</label>
              <input type="text" placeholder="e.g. DPL Office Ground" value={editFields.venue || ''} onChange={e => setEditFields(f => ({ ...f, venue: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>📅 Match Date & Time <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(upcoming)</span></label>
              <input
                type="datetime-local"
                value={editFields.scheduledAt}
                onChange={e => setEditFields(f => ({ ...f, scheduledAt: e.target.value }))}
                style={{ colorScheme: 'dark' }}
              />
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setEditTarget(null)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 2 }} onClick={saveEdit}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 12px', fontSize: '1.6rem',
              }}>
                🗑️
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 6 }}>Delete Match?</div>
              <div className="text-muted" style={{ fontSize: '0.85rem' }}>
                <strong style={{ color: 'var(--white)' }}>{deleteTarget.name}</strong>
                <br />This will permanently delete the match and all scores.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={confirmDelete}>Yes, Delete</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
