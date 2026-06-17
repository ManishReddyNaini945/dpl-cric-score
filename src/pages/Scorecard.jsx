import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { formatOvers, formatBowlerOvers, getWinnerMessage } from '../utils/cricket';

export default function Scorecard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'matches', id), snap => {
      if (snap.exists()) setMatch({ id: snap.id, ...snap.data() });
      setLoading(false);
    });
    return unsub;
  }, [id]);

  if (loading) return <div className="text-center text-muted" style={{ padding: 40 }}>Loading…</div>;
  if (!match) return <div className="page"><Link to="/" className="btn btn-ghost">← Home</Link></div>;

  const { meta, innings = [] } = match;
  const isCompleted = meta.status === 'completed';

  function teamName(key) {
    return key === 'team1' ? meta.team1 : meta.team2;
  }

  function renderBattingCard(inn, inningsNum) {
    const players = inn.battingTeam === 'team1' ? meta.players1 : meta.players2;
    const batsmen = players.map(name => ({
      name,
      ...(inn.batsmen[name] || { runs: 0, balls: 0, fours: 0, sixes: 0, out: false, dismissal: '' }),
    })).sort((a, b) => {
      const ai = inn.battingOrder.indexOf(a.name);
      const bi = inn.battingOrder.indexOf(b.name);
      if (ai === -1 && bi === -1) return 0;
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });

    const extras = inn.extras || { wides: 0, noBalls: 0, byes: 0, legByes: 0 };
    const totalExtras = extras.wides + extras.noBalls + extras.byes + extras.legByes;

    return (
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="scorecard-team-header" style={{ background: 'transparent', padding: 0, marginBottom: 12 }}>
          <div>
            <div className="team-name">{teamName(inn.battingTeam)}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Innings {inningsNum}</div>
          </div>
          <div className="score-big">
            {inn.runs}/{inn.wickets}
            <span style={{ fontSize: '0.9rem', fontWeight: 400, color: 'var(--text-muted)', marginLeft: 6 }}>
              ({formatOvers(inn.legalBalls)} ov)
            </span>
          </div>
        </div>

        <table className="scorecard-table">
          <thead>
            <tr>
              <th>Batsman</th>
              <th>R</th>
              <th>B</th>
              <th>4s</th>
              <th>6s</th>
              <th>SR</th>
            </tr>
          </thead>
          <tbody>
            {batsmen.map(b => {
              const isTeam1 = inn.battingTeam === 'team1';
              const cap = isTeam1 ? meta.captain1 : meta.captain2;
              const vc  = isTeam1 ? meta.vc1 : meta.vc2;
              return (
              <tr key={b.name}>
                <td>
                  <span style={{ fontWeight: 600 }}>
                    {b.name}
                    {b.name === inn.striker && !inn.complete ? ' *' : ''}
                    {b.name === cap && <span style={{ marginLeft: 4, fontSize: '0.68rem', fontWeight: 800, color: '#facc15', background: 'rgba(250,204,21,0.12)', border: '1px solid rgba(250,204,21,0.35)', borderRadius: 4, padding: '1px 4px' }}>C</span>}
                    {b.name === vc  && <span style={{ marginLeft: 4, fontSize: '0.68rem', fontWeight: 800, color: '#94a3b8', background: 'rgba(148,163,184,0.12)', border: '1px solid rgba(148,163,184,0.3)', borderRadius: 4, padding: '1px 4px' }}>VC</span>}
                  </span>
                  {b.out && <span className="dismissal-text">{b.dismissal}</span>}
                  {!b.out && inn.battingOrder.includes(b.name) && !inn.complete && (
                    <span className="dismissal-text">not out</span>
                  )}
                  {!inn.battingOrder.includes(b.name) && (
                    <span className="dismissal-text" style={{ color: 'rgba(255,255,255,0.2)' }}>dnb</span>
                  )}
                </td>
                <td className="highlight">{inn.battingOrder.includes(b.name) ? b.runs : '-'}</td>
                <td>{inn.battingOrder.includes(b.name) ? b.balls : '-'}</td>
                <td>{inn.battingOrder.includes(b.name) ? b.fours : '-'}</td>
                <td>{inn.battingOrder.includes(b.name) ? b.sixes : '-'}</td>
                <td>
                  {inn.battingOrder.includes(b.name) && b.balls > 0
                    ? ((b.runs / b.balls) * 100).toFixed(0)
                    : '-'}
                </td>
              </tr>
            );})}
            <tr>
              <td colSpan={6}>
                <div className="extras-row">
                  Extras: {totalExtras}
                  <span style={{ fontSize: '0.72rem', marginLeft: 6 }}>
                    (Wd {extras.wides}, Nb {extras.noBalls}, B {extras.byes}, Lb {extras.legByes})
                  </span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <div style={{ marginTop: 16 }}>
          <div className="section-title" style={{ marginBottom: 8 }}>Bowling</div>
          <table className="scorecard-table">
            <thead>
              <tr>
                <th>Bowler</th>
                <th>O</th>
                <th>R</th>
                <th>W</th>
                <th>Eco</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(inn.bowlers || {}).map(([name, b]) => (
                <tr key={name}>
                  <td>{name}</td>
                  <td>{formatBowlerOvers(b.balls)}</td>
                  <td className="highlight">{b.runs}</td>
                  <td className="highlight">{b.wickets}</td>
                  <td>
                    {b.balls > 0 ? ((b.runs / b.balls) * 6).toFixed(1) : '-'}
                  </td>
                </tr>
              ))}
              {Object.keys(inn.bowlers || {}).length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No bowlers yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  async function shareLink() {
    const url = `${window.location.origin}/match/${id}`;
    if (navigator.share) {
      await navigator.share({ title: `${meta.team1} vs ${meta.team2} - Scorecard`, url });
    } else {
      await navigator.clipboard.writeText(url);
      alert('Link copied!');
    }
  }

  return (
    <>
      <div className="app-header">
        <button className="back-btn" onClick={() => navigate(isCompleted ? '/' : `/match/${id}`)}>←</button>
        <h1 style={{ fontSize: '0.95rem' }}>Scorecard</h1>
        <div className="header-actions">
          <button className="share-btn" onClick={shareLink}>📤</button>
        </div>
      </div>

      <div className="page">
        {/* Match header */}
        <div className="card mb-16" style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>
            {meta.team1} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>vs</span> {meta.team2}
          </div>
          <div className="text-muted mt-8" style={{ fontSize: '0.82rem' }}>
            {meta.overs} overs · {meta.playerCount} players
          </div>
          {isCompleted && meta.result && (
            <div className="result-banner" style={{ marginTop: 12 }}>
              <div className="result-text">{meta.result}</div>
            </div>
          )}
          {!isCompleted && (
            <div style={{ marginTop: 10 }}>
              <span className="status-dot live" style={{ display: 'inline-block', marginRight: 6 }} />
              <span style={{ color: '#2ecc71', fontSize: '0.82rem', fontWeight: 600 }}>LIVE</span>
            </div>
          )}
        </div>

        {innings[0] && renderBattingCard(innings[0], 1)}
        {innings[1] && renderBattingCard(innings[1], 2)}

        {!isCompleted && (
          <Link to={`/match/${id}`} className="btn btn-primary btn-full mt-16">
            ← Back to Scoring
          </Link>
        )}

        <Link to="/" className="btn btn-ghost btn-full mt-8">
          Home
        </Link>
      </div>
    </>
  );
}
