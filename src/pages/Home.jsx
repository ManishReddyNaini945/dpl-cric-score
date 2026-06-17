import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { formatOvers } from '../utils/cricket';

export default function Home() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

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

  return (
    <>
      <div className="app-header">
        <span style={{ fontSize: '1.4rem' }}>🏏</span>
        <h1>CrickBuxx Score</h1>
        <div className="header-actions">
          <button className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.9rem' }} onClick={() => navigate('/new')}>
            + New Match
          </button>
        </div>
      </div>

      <div className="page">
        <div className="home-hero">
          <div className="logo">🏟️</div>
          <h2>Box Cricket</h2>
          <p>Live scoring · Real-time sync · Free</p>
        </div>

        <button className="btn btn-primary btn-full mb-16" onClick={() => navigate('/new')}>
          + Start New Match
        </button>

        {loading ? (
          <div className="text-center text-muted" style={{ padding: '32px' }}>Loading matches…</div>
        ) : matches.length === 0 ? (
          <div className="empty-state">
            <div className="icon">📋</div>
            <p>No matches yet.<br />Start your first match above!</p>
          </div>
        ) : (
          <>
            <div className="section-title">Recent Matches</div>
            {matches.map(match => (
              <Link
                key={match.id}
                className="match-card"
                to={match.meta?.status === 'completed' ? `/match/${match.id}/scorecard` : `/match/${match.id}`}
              >
                <div className="match-teams">
                  {match.meta?.team1} <span>vs</span> {match.meta?.team2}
                </div>
                <div className="match-meta">
                  <span
                    className={`status-dot ${match.meta?.status === 'live' || match.meta?.status === 'innings_break' ? 'live' : ''}`}
                  />
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
            ))}
          </>
        )}
      </div>
    </>
  );
}
