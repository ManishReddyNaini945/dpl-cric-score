import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import {
  formatOvers, getRunRate, getRequiredRunRate,
  getCurrentOverBalls, ballLabel, ballClass,
  makeEmptyInnings, addBatsmanToInnings, ensureBowler,
  applyDelivery, isInningsComplete, getWinnerMessage,
} from '../utils/cricket';
import WicketModal from '../components/WicketModal';
import BowlerSelectModal from '../components/BowlerSelectModal';

const EXTRA_MODES = { NONE: 'none', WIDE: 'wide', NOBALL: 'noball', BYE: 'bye', LEGBYE: 'legbye' };

function TossScreen({ match, matchId, navigate, isAdmin }) {
  const meta = match.meta;
  const [tossState, setTossState] = useState('idle');
  const [tossWinner, setTossWinner] = useState('');
  const [elected, setElected] = useState('');
  const [saving, setSaving] = useState(false);

  function flipCoin() {
    if (tossState !== 'idle') return;
    setTossState('flipping');
    setElected('');
    const winner = Math.random() < 0.5 ? 'team1' : 'team2';
    setTimeout(() => { setTossWinner(winner); setTossState('done'); }, 2200);
  }

  async function startMatch() {
    if (!elected || saving) return;
    setSaving(true);
    const battingTeamKey = tossWinner === 'team1'
      ? (elected === 'bat' ? 'team1' : 'team2')
      : (elected === 'bat' ? 'team2' : 'team1');
    const bowlingTeamKey = battingTeamKey === 'team1' ? 'team2' : 'team1';
    const battingNames = battingTeamKey === 'team1' ? meta.players1 : meta.players2;

    let innings = makeEmptyInnings(battingTeamKey, bowlingTeamKey, meta.playerCount);
    innings = addBatsmanToInnings(innings, battingNames[0]);
    innings = addBatsmanToInnings(innings, battingNames[1]);
    innings.striker = battingNames[0];
    innings.nonStriker = battingNames[1];

    try {
      await updateDoc(doc(db, 'matches', matchId), {
        'meta.status': 'live',
        'meta.tossWinner': tossWinner,
        'meta.elected': elected,
        innings: [innings],
        currentInnings: 0,
      });
    } catch (err) { console.error(err); setSaving(false); }
  }

  if (!isAdmin) {
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--green-dark)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 }}>
        <div style={{ fontSize: '3rem' }}>📅</div>
        <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--white)' }}>{meta.team1} vs {meta.team2}</div>
        <div className="text-muted" style={{ fontSize: '0.88rem' }}>Match hasn't started yet</div>
        <Link to="/" className="btn btn-ghost mt-16">← Back</Link>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--green-dark)' }}>
      <div className="app-header">
        <button className="back-btn" onClick={() => navigate('/')}>←</button>
        <h1>Toss</h1>
      </div>
      <div className="page" style={{ textAlign: 'center' }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>
            {meta.team1} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>vs</span> {meta.team2}
          </div>
          <div className="text-muted" style={{ fontSize: '0.82rem', marginTop: 4 }}>{meta.overs} overs</div>
        </div>

        <div style={{ marginBottom: 28 }}>
          <div
            onClick={tossState === 'idle' ? flipCoin : undefined}
            style={{
              width: 100, height: 100, borderRadius: '50%', margin: '0 auto',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '2.8rem', cursor: tossState === 'idle' ? 'pointer' : 'default',
              background: tossState === 'done' ? 'linear-gradient(135deg, var(--accent), #0284c7)' : 'var(--surface)',
              border: '3px solid var(--accent)', boxShadow: '0 4px 20px rgba(56,189,248,0.3)',
              animation: tossState === 'flipping' ? 'coinSpin 2.2s ease-out forwards' : 'none',
            }}
          >
            {tossState === 'done' ? '🏆' : '🪙'}
          </div>
          <style>{`@keyframes coinSpin{0%{transform:rotateY(0deg) scale(1)}20%{transform:rotateY(360deg) scale(1.1)}60%{transform:rotateY(1080deg) scale(1)}100%{transform:rotateY(1800deg) scale(1)}}`}</style>
        </div>

        {tossState === 'idle' && <button className="btn btn-primary" style={{ padding: '14px 40px', fontSize: '1.1rem' }} onClick={flipCoin}>🪙 Flip Coin</button>}
        {tossState === 'flipping' && <div style={{ color: 'var(--accent)', fontWeight: 700, fontSize: '1.1rem' }}>Flipping…</div>}

        {tossState === 'done' && (
          <div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent)', marginBottom: 6 }}>
              {tossWinner === 'team1' ? meta.team1 : meta.team2} won the toss!
            </div>
            <div className="text-muted" style={{ marginBottom: 20, fontSize: '0.85rem' }}>Choose to bat or bowl first</div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 20 }}>
              {['bat', 'bowl'].map(choice => (
                <button key={choice} onClick={() => setElected(choice)} style={{
                  padding: '14px 28px', borderRadius: 12, cursor: 'pointer', fontWeight: 700, fontSize: '1rem',
                  border: `2px solid ${elected === choice ? (choice === 'bat' ? 'var(--accent)' : '#a78bfa') : 'rgba(255,255,255,0.15)'}`,
                  background: elected === choice ? (choice === 'bat' ? 'rgba(56,189,248,0.15)' : 'rgba(167,139,250,0.15)') : 'var(--surface)',
                  color: elected === choice ? (choice === 'bat' ? 'var(--accent)' : '#a78bfa') : 'var(--white)',
                }}>
                  {choice === 'bat' ? '🏏 Bat' : '🎳 Bowl'}
                </button>
              ))}
            </div>
            {elected && (
              <div className="card mt-12" style={{ textAlign: 'center', marginBottom: 16, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{tossWinner === 'team1' ? meta.team1 : meta.team2}</span>
                {' '}elected to <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{elected}</span> first
              </div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => { setTossState('idle'); setTossWinner(''); setElected(''); }}>Reflip</button>
              <button className="btn btn-primary" style={{ flex: 2 }} disabled={!elected || saving} onClick={startMatch}>
                {saving ? 'Starting…' : '🏏 Start Match!'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Scoring() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [extraMode, setExtraMode] = useState(EXTRA_MODES.NONE);
  const [showWicket, setShowWicket] = useState(false);
  const [showBowlerPick, setShowBowlerPick] = useState(false);
  const [pendingWicketDelivery, setPendingWicketDelivery] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'matches', id), snap => {
      if (snap.exists()) setMatch({ id: snap.id, ...snap.data() });
      setLoading(false);
    });
    return unsub;
  }, [id]);

  const innings = match?.innings?.[match?.currentInnings];
  const meta = match?.meta;

  // Need bowler selection
  const needsBowler = innings && !innings.bowler && !isInningsComplete(innings, meta?.overs);

  function currentOverIndex() {
    if (!innings) return 0;
    return Math.floor(innings.legalBalls / 6);
  }

  function currentOverBalls() {
    if (!innings) return [];
    return getCurrentOverBalls(innings.deliveries, currentOverIndex());
  }

  async function saveInnings(updatedInnings, updatedMatch) {
    setSaving(true);
    const newInnings = [...(match.innings || [])];
    newInnings[match.currentInnings] = updatedInnings;
    try {
      await updateDoc(doc(db, 'matches', id), {
        innings: newInnings,
        ...(updatedMatch || {}),
      });
    } catch (err) {
      console.error('Save error', err);
    }
    setSaving(false);
  }

  async function handleRun(runs) {
    if (!innings || saving || needsBowler) return;
    const type = extraMode === EXTRA_MODES.NONE ? 'normal' :
                 extraMode === EXTRA_MODES.WIDE ? 'wide' :
                 extraMode === EXTRA_MODES.NOBALL ? 'noball' :
                 extraMode === EXTRA_MODES.BYE ? 'bye' : 'legbye';

    const overIndex = currentOverIndex();
    let delivery = { type, runs, overIndex, isWicket: false, wicket: null };

    if (type === 'wide' && runs === 0) delivery.runs = 0;

    let updated = ensureBowler(innings, innings.bowler);
    updated = applyDelivery(updated, delivery);

    setExtraMode(EXTRA_MODES.NONE);

    const complete = isInningsComplete(updated, meta.overs);
    if (complete) updated.complete = true;

    // End of over — need new bowler
    const endedOver = updated.legalBalls % 6 === 0 && updated.legalBalls > 0 && !complete;

    if (complete) {
      await handleInningsEnd(updated);
    } else {
      await saveInnings(updated);
      if (endedOver) setShowBowlerPick(true);
    }
  }

  function handleWicketClick() {
    if (!innings || saving || needsBowler) return;
    setShowWicket(true);
  }

  async function handleWicketConfirm(wicketInfo) {
    setShowWicket(false);
    const overIndex = currentOverIndex();
    const type = extraMode === EXTRA_MODES.NOBALL ? 'noball' : 'normal';
    const delivery = { type, runs: 0, overIndex, isWicket: true, wicket: wicketInfo };

    let updated = ensureBowler(innings, innings.bowler);
    updated = applyDelivery(updated, delivery);
    setExtraMode(EXTRA_MODES.NONE);

    const complete = isInningsComplete(updated, meta.overs);
    if (complete) updated.complete = true;

    const endedOver = updated.legalBalls % 6 === 0 && updated.legalBalls > 0 && !complete;

    if (complete) {
      await handleInningsEnd(updated);
    } else {
      await saveInnings(updated);
      if (endedOver) setShowBowlerPick(true);
    }
  }

  async function handleInningsEnd(updatedInnings) {
    const isFirstInnings = match.currentInnings === 0;

    if (isFirstInnings) {
      // Set up second innings
      const bat2 = updatedInnings.bowlingTeam;
      const bowl2 = updatedInnings.battingTeam;
      const players2 = bat2 === 'team1' ? meta.players1 : meta.players2;

      let inn2 = makeEmptyInnings(bat2, bowl2, meta.playerCount);
      inn2 = addBatsmanToInnings(inn2, players2[0]);
      inn2 = addBatsmanToInnings(inn2, players2[1]);
      inn2.striker = players2[0];
      inn2.nonStriker = players2[1];

      const newInnings = [updatedInnings, inn2];
      await updateDoc(doc(db, 'matches', id), {
        innings: newInnings,
        currentInnings: 1,
        'meta.status': 'live',
      });
    } else {
      // Match complete
      const updatedMatch = { ...match, innings: [...match.innings] };
      updatedMatch.innings[1] = updatedInnings;
      const result = getWinnerMessage(updatedMatch);
      const newInnings = [...match.innings];
      newInnings[1] = updatedInnings;
      await updateDoc(doc(db, 'matches', id), {
        innings: newInnings,
        'meta.status': 'completed',
        'meta.result': result,
      });
    }
  }

  async function handleBowlerPicked(name) {
    setShowBowlerPick(false);
    const updated = { ...innings, bowler: name };
    await saveInnings(updated);
  }

  async function handleFirstBowlerPicked(name) {
    const updated = { ...innings, bowler: name };
    await saveInnings(updated);
  }

  function toggleExtra(mode) {
    setExtraMode(prev => prev === mode ? EXTRA_MODES.NONE : mode);
  }

  async function shareLink() {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: `${meta.team1} vs ${meta.team2} - Live Score`, url });
    } else {
      await navigator.clipboard.writeText(url);
      alert('Link copied! Share it with your team.');
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh' }}>
        <div className="text-muted">Loading match…</div>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="page text-center" style={{ paddingTop: 40 }}>
        <div className="text-muted">Match not found.</div>
        <Link to="/" className="btn btn-ghost mt-16">← Back</Link>
      </div>
    );
  }

  // Upcoming match — show toss for admin
  if (meta?.status === 'upcoming') {
    return <TossScreen match={match} matchId={id} navigate={navigate} isAdmin={isAdmin} />;
  }

  // Innings break screen
  if (match.currentInnings === 1 && match.innings?.length >= 2) {
    const inn1 = match.innings[0];
    const inn2 = match.innings[1];
    const bat1Name = inn1.battingTeam === 'team1' ? meta.team1 : meta.team2;
    const bat2Name = inn2.battingTeam === 'team1' ? meta.team1 : meta.team2;
    const target = inn1.runs + 1;
    const inn2Complete = isInningsComplete(inn2, meta.overs);
    const isCompleted = meta.status === 'completed';

    if (isCompleted) {
      return navigate(`/match/${id}/scorecard`);
    }

    return (
      <>
        <div className="app-header">
          <button className="back-btn" onClick={() => navigate('/')}>←</button>
          <h1>{meta.team1} vs {meta.team2}</h1>
          <div className="header-actions">
            <button className="share-btn" onClick={shareLink}>📤 Share</button>
          </div>
        </div>
        <div className="page">
          {renderScoreHeader(inn2, meta, inn1, bat2Name, bat1Name, target)}
          {renderCurrentOver(inn2)}
          {renderBatsmen(inn2)}
          {renderBowler(inn2)}
          {inn2Complete ? null : renderActionPad()}
        </div>
      </>
    );
  }

  const inn1ForTarget = match.currentInnings === 1 ? match.innings[0] : null;
  const target = inn1ForTarget ? inn1ForTarget.runs + 1 : null;
  const battingTeamName = innings?.battingTeam === 'team1' ? meta.team1 : meta.team2;
  const bowlingTeamName = innings?.bowlingTeam === 'team1' ? meta.team1 : meta.team2;

  function renderScoreHeader(inn, m, prevInn, batName, bowlName, tgt) {
    const ovsDisplay = formatOvers(inn.legalBalls);
    const crr = getRunRate(inn.runs, inn.legalBalls);
    return (
      <div className="score-header">
        <div className="innings-label">{batName} batting · {bowlName} bowling</div>
        <div className="score-display">
          {inn.runs}<span className="sep">/</span>{inn.wickets}
        </div>
        <div className="overs-display">{ovsDisplay} Overs · CRR: {crr}</div>
        {tgt && (
          <div className="crr-display">
            Need {tgt - inn.runs} off {m.overs * 6 - inn.legalBalls} balls ·
            RRR: {getRequiredRunRate(tgt, inn.runs, inn.legalBalls, m.overs * 6)}
          </div>
        )}
        {tgt && (
          <div className="target-banner" style={{ marginTop: 8 }}>
            Target: {tgt} · {prevInn.battingTeam === 'team1' ? m.team1 : m.team2} scored {prevInn.runs}/{prevInn.wickets}
          </div>
        )}
      </div>
    );
  }

  function renderCurrentOver(inn) {
    const overBalls = getCurrentOverBalls(inn.deliveries, Math.floor(inn.legalBalls / 6));
    return (
      <div className="current-over">
        <div className="label">This Over</div>
        <div className="over-balls">
          {overBalls.length === 0 && <span className="text-muted" style={{ fontSize: '0.82rem' }}>No balls bowled yet</span>}
          {overBalls.map((b, i) => (
            <div key={i} className={`ball-chip ${ballClass(b)}`}>{ballLabel(b)}</div>
          ))}
        </div>
      </div>
    );
  }

  function renderBatsmen(inn) {
    return (
      <div className="batsmen-table">
        <div className="table-header">
          <div>Batsman</div>
          <div style={{ textAlign: 'right' }}>R</div>
          <div style={{ textAlign: 'right' }}>B</div>
          <div style={{ textAlign: 'right' }}>4s</div>
          <div style={{ textAlign: 'right' }}>6s</div>
        </div>
        {[inn.striker, inn.nonStriker].filter(Boolean).map(name => {
          const b = inn.batsmen[name] || { runs: 0, balls: 0, fours: 0, sixes: 0 };
          return (
            <div key={name} className="table-row">
              <div className="name">
                {name}{name === inn.striker ? <span className="striker-mark"> *</span> : ''}
              </div>
              <div className="runs">{b.runs}</div>
              <div className="stat">{b.balls}</div>
              <div className="stat">{b.fours}</div>
              <div className="stat">{b.sixes}</div>
            </div>
          );
        })}
      </div>
    );
  }

  function renderBowler(inn) {
    if (!inn.bowler) return null;
    const b = inn.bowlers[inn.bowler] || { balls: 0, runs: 0, wickets: 0 };
    return (
      <div className="bowler-line">
        <div className="bowler-grid">
          <div style={{ gridColumn: '1/-1', display: 'grid', gridTemplateColumns: '1fr 40px 40px 28px 28px', gap: 4 }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', borderBottom: '1px solid rgba(255,255,255,0.07)', paddingBottom: 6, marginBottom: 4 }}>Bowler</div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', textAlign: 'right', borderBottom: '1px solid rgba(255,255,255,0.07)', paddingBottom: 6, marginBottom: 4 }}>O</div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', textAlign: 'right', borderBottom: '1px solid rgba(255,255,255,0.07)', paddingBottom: 6, marginBottom: 4 }}>R</div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', textAlign: 'right', borderBottom: '1px solid rgba(255,255,255,0.07)', paddingBottom: 6, marginBottom: 4 }}>W</div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', textAlign: 'right', borderBottom: '1px solid rgba(255,255,255,0.07)', paddingBottom: 6, marginBottom: 4 }}>Eco</div>
            <div className="b-name">{inn.bowler}</div>
            <div className="b-stat" style={{ textAlign: 'right' }}>{Math.floor(b.balls / 6)}.{b.balls % 6}</div>
            <div className="b-runs" style={{ textAlign: 'right' }}>{b.runs}</div>
            <div className="b-stat" style={{ textAlign: 'right' }}>{b.wickets}</div>
            <div className="b-stat" style={{ textAlign: 'right', color: 'var(--gold)' }}>
              {b.balls > 0 ? ((b.runs / b.balls) * 6).toFixed(1) : '-'}
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderActionPad() {
    return (
      <div className="action-pad">
        <div className="run-buttons">
          {[0, 1, 2, 3, 4, 6].map(r => (
            <button
              key={r}
              className={`run-btn r${r}`}
              onClick={() => handleRun(r)}
              disabled={saving}
            >
              {r}
            </button>
          ))}
        </div>

        {/* Extra run picker for wide/noball/bye/legbye */}
        {(extraMode === EXTRA_MODES.WIDE || extraMode === EXTRA_MODES.NOBALL ||
          extraMode === EXTRA_MODES.BYE || extraMode === EXTRA_MODES.LEGBYE) && (
          <div className="extra-run-row">
            <span className="label">
              {extraMode === EXTRA_MODES.WIDE && 'Wide +'}
              {extraMode === EXTRA_MODES.NOBALL && 'No Ball +'}
              {extraMode === EXTRA_MODES.BYE && 'Bye runs:'}
              {extraMode === EXTRA_MODES.LEGBYE && 'Leg Bye runs:'}
            </span>
            <div className="mini-btns">
              {[0, 1, 2, 3, 4, 6].map(r => (
                <button key={r} className={`mini-run-btn ${r === 4 ? 'r4' : r === 6 ? 'r6' : ''}`}
                  onClick={() => handleRun(r)} disabled={saving}>
                  {r}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="extra-buttons" style={{ marginTop: 8 }}>
          <button
            className={`extra-btn wide ${extraMode === EXTRA_MODES.WIDE ? 'selected' : ''}`}
            onClick={() => toggleExtra(EXTRA_MODES.WIDE)}
            style={extraMode === EXTRA_MODES.WIDE ? { background: 'rgba(138,138,255,0.15)' } : {}}
          >
            Wide
          </button>
          <button
            className={`extra-btn noball ${extraMode === EXTRA_MODES.NOBALL ? 'selected' : ''}`}
            onClick={() => toggleExtra(EXTRA_MODES.NOBALL)}
            style={extraMode === EXTRA_MODES.NOBALL ? { background: 'rgba(255,159,67,0.15)' } : {}}
          >
            No Ball
          </button>
          <button
            className="extra-btn wicket"
            onClick={handleWicketClick}
            disabled={saving}
          >
            Wicket!
          </button>
          <button
            className={`extra-btn bye ${extraMode === EXTRA_MODES.BYE ? 'selected' : ''}`}
            onClick={() => toggleExtra(EXTRA_MODES.BYE)}
            style={extraMode === EXTRA_MODES.BYE ? { background: 'rgba(255,255,255,0.05)' } : {}}
          >
            Bye
          </button>
          <button
            className={`extra-btn legbye ${extraMode === EXTRA_MODES.LEGBYE ? 'selected' : ''}`}
            onClick={() => toggleExtra(EXTRA_MODES.LEGBYE)}
            style={extraMode === EXTRA_MODES.LEGBYE ? { background: 'rgba(255,255,255,0.05)' } : {}}
          >
            Leg Bye
          </button>
          <Link to={`/match/${id}/scorecard`} className="extra-btn" style={{ textDecoration: 'none', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            Scorecard
          </Link>
        </div>
      </div>
    );
  }

  const bowlingPlayers = innings?.bowlingTeam === 'team1' ? meta.players1 : meta.players2;

  return (
    <>
      <div className="app-header">
        <button className="back-btn" onClick={() => navigate('/')}>←</button>
        <h1 style={{ fontSize: '0.95rem' }}>{meta.team1} vs {meta.team2}</h1>
        <div className="header-actions">
          <button className="share-btn" onClick={shareLink}>📤</button>
        </div>
      </div>

      <div className="page">
        {innings && renderScoreHeader(innings, meta, inn1ForTarget, battingTeamName, bowlingTeamName, target)}
        {innings && renderCurrentOver(innings)}
        {innings && renderBatsmen(innings)}
        {innings && renderBowler(innings)}

        {/* Bowler pick — admin only */}
        {isAdmin && (needsBowler || showBowlerPick) && (
          <div className="bowler-select">
            <div className="label">Select Bowler</div>
            <BowlerSelectModal
              players={bowlingPlayers}
              currentBowler={innings?.bowler}
              innings={innings}
              maxOversPerBowler={Math.ceil(meta.overs / 2)}
              onConfirm={needsBowler ? handleFirstBowlerPicked : handleBowlerPicked}
            />
          </div>
        )}

        {isAdmin && !needsBowler && !showBowlerPick && innings && !isInningsComplete(innings, meta.overs) && renderActionPad()}

        {!isAdmin && innings && !isInningsComplete(innings, meta.overs) && (
          <div style={{
            textAlign: 'center', padding: '16px',
            background: 'rgba(52,152,219,0.06)', borderRadius: 12,
            border: '1px solid rgba(52,152,219,0.15)', marginBottom: 10,
          }}>
            <div style={{ color: '#5dade2', fontSize: '0.82rem' }}>👁️ Live — Watching in real-time</div>
          </div>
        )}

        {innings && isInningsComplete(innings, meta.overs) && match.currentInnings === 0 && (
          <div className="innings-break-screen">
            <div className="icon">⏸️</div>
            <h2>Innings Over!</h2>
            <p>
              {battingTeamName} scored {innings.runs}/{innings.wickets} ({formatOvers(innings.legalBalls)} overs)
            </p>
            <p style={{ color: 'var(--gold)', fontWeight: 700, marginBottom: 20 }}>
              {bowlingTeamName} needs {innings.runs + 1} runs in {meta.overs} overs
            </p>
            <p className="text-muted" style={{ fontSize: '0.82rem' }}>
              Second innings will start automatically — refresh if needed
            </p>
          </div>
        )}
      </div>

      {showWicket && innings && (
        <WicketModal
          innings={innings}
          players={innings.battingTeam === 'team1' ? meta.players1 : meta.players2}
          onConfirm={handleWicketConfirm}
          onCancel={() => setShowWicket(false)}
        />
      )}

      {showBowlerPick && !needsBowler && (
        <BowlerSelectModal
          players={bowlingPlayers}
          currentBowler={innings?.bowler}
          innings={innings}
          maxOversPerBowler={Math.ceil(meta.overs / 2)}
          onConfirm={handleBowlerPicked}
        />
      )}
    </>
  );
}
