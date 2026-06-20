import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import {
  formatOvers, getRunRate, getRequiredRunRate,
  getCurrentOverBalls, ballLabel, ballClass,
  makeEmptyInnings, addBatsmanToInnings, ensureBowler,
  applyDelivery, isInningsComplete, getWinnerMessage, rebuildInnings, retireBatsman, getLastBowler,
} from '../utils/cricket';
import WicketModal from '../components/WicketModal';
import BowlerSelectModal from '../components/BowlerSelectModal';
import MatchInsights from '../components/MatchInsights';

const EXTRA_MODES = { NONE: 'none', WIDE: 'wide', NOBALL: 'noball', BYE: 'bye', LEGBYE: 'legbye' };

function TossScreen({ match, matchId, navigate, isAdmin }) {
  const meta = match.meta;
  // Restore state if toss was already flipped (admin refreshed page)
  const [tossState, setTossState] = useState(meta.tossWinner ? 'done' : 'idle');
  const [tossWinner, setTossWinner] = useState(meta.tossWinner || '');
  const [elected, setElected] = useState('');
  const [opener1, setOpener1] = useState('');
  const [opener2, setOpener2] = useState('');
  const [saving, setSaving] = useState(false);

  function flipCoin() {
    if (tossState !== 'idle') return;
    setTossState('flipping');
    setElected('');
    const winner = Math.random() < 0.5 ? 'team1' : 'team2';
    setTimeout(() => {
      setTossWinner(winner);
      setTossState('done');
      // Immediately broadcast toss winner to all users via Firestore
      updateDoc(doc(db, 'matches', matchId), { 'meta.tossWinner': winner }).catch(console.error);
    }, 2200);
  }

  const battingTeamKey = tossWinner
    ? (tossWinner === 'team1' ? (elected === 'bat' ? 'team1' : 'team2') : (elected === 'bat' ? 'team2' : 'team1'))
    : '';
  const battingNames = battingTeamKey === 'team1' ? meta.players1 : meta.players2;

  async function startMatch() {
    if (!elected || !opener1 || !opener2 || saving) return;
    setSaving(true);
    const bowlingTeamKey = battingTeamKey === 'team1' ? 'team2' : 'team1';

    let innings = makeEmptyInnings(battingTeamKey, bowlingTeamKey, meta.playerCount);
    innings = addBatsmanToInnings(innings, opener1);
    innings = addBatsmanToInnings(innings, opener2);
    innings.striker = opener1;
    innings.nonStriker = opener2;

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
      <div style={{ minHeight: '100dvh', background: 'var(--green-dark)' }}>
        <div className="app-header">
          <button className="back-btn" onClick={() => navigate('/')}>←</button>
          <h1>{meta.team1} vs {meta.team2}</h1>
        </div>
        <div className="page" style={{ textAlign: 'center', paddingTop: 32 }}>
          {tossWinner ? (
            <>
              <div style={{ fontSize: '3rem', marginBottom: 12 }}>🏆</div>
              <div style={{ fontWeight: 800, fontSize: '1.3rem', color: 'var(--accent)', marginBottom: 6 }}>
                {tossWinner === 'team1' ? meta.team1 : meta.team2} won the toss!
              </div>
              <div className="text-muted" style={{ fontSize: '0.88rem', marginBottom: 24 }}>
                Choosing to bat or bowl…
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: '3rem', marginBottom: 12, animation: 'spin 3s linear infinite' }}>🪙</div>
              <style>{`@keyframes spin{from{transform:rotateY(0)}to{transform:rotateY(360deg)}}`}</style>
              <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--white)', marginBottom: 6 }}>Toss in progress…</div>
              <div className="text-muted" style={{ fontSize: '0.88rem', marginBottom: 24 }}>Waiting for the coin toss</div>
            </>
          )}
          <div className="card" style={{ textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1rem', marginBottom: 4 }}>
              <span style={{ color: 'var(--accent)' }}>{meta.team1}</span>
              <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>vs</span>
              <span style={{ color: '#a78bfa' }}>{meta.team2}</span>
            </div>
            <div className="text-muted" style={{ fontSize: '0.8rem' }}>{meta.overs} Overs · Box Cricket</div>
          </div>
          <Link to="/" className="btn btn-ghost mt-16">← Back to Home</Link>
        </div>
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
                <button key={choice} onClick={() => { setElected(choice); setOpener1(''); setOpener2(''); }} style={{
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

            {/* Opening batsmen selection */}
            {elected && battingNames?.length > 0 && (
              <div style={{ textAlign: 'left', marginBottom: 20 }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', marginBottom: 10 }}>
                  🏏 Select Opening Batsmen
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {battingNames.map(name => {
                    const isO1 = opener1 === name;
                    const isO2 = opener2 === name;
                    return (
                      <button key={name} onClick={() => {
                        if (isO1) { setOpener1(''); return; }
                        if (isO2) { setOpener2(''); return; }
                        if (!opener1) { setOpener1(name); return; }
                        if (!opener2) { setOpener2(name); return; }
                      }} style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                        borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                        border: `2px solid ${isO1 ? 'var(--accent)' : isO2 ? '#a78bfa' : 'rgba(255,255,255,0.1)'}`,
                        background: isO1 ? 'rgba(56,189,248,0.1)' : isO2 ? 'rgba(167,139,250,0.1)' : 'var(--surface)',
                        color: 'var(--white)',
                      }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                          background: isO1 ? 'var(--accent)' : isO2 ? '#a78bfa' : 'rgba(255,255,255,0.1)',
                          color: (isO1 || isO2) ? '#0c1a28' : 'var(--white)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 800, fontSize: '0.75rem',
                        }}>
                          {isO1 ? '1' : isO2 ? '2' : name[0].toUpperCase()}
                        </div>
                        <span style={{ fontWeight: 600, flex: 1 }}>{name}</span>
                        {isO1 && <span style={{ fontSize: '0.68rem', color: 'var(--accent)', fontWeight: 700 }}>STRIKER</span>}
                        {isO2 && <span style={{ fontSize: '0.68rem', color: '#a78bfa', fontWeight: 700 }}>NON-STRIKER</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => { setTossState('idle'); setTossWinner(''); setElected(''); setOpener1(''); setOpener2(''); }}>Reflip</button>
              <button className="btn btn-primary" style={{ flex: 2 }} disabled={!elected || !opener1 || !opener2 || saving} onClick={startMatch}>
                {saving ? 'Starting…' : !elected ? '🏏 Pick bat/bowl' : (!opener1 || !opener2) ? `🏏 Select openers (${[opener1,opener2].filter(Boolean).length}/2)` : '🏏 Start Match!'}
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
  const [showPOTM, setShowPOTM] = useState(false);
  const [showOpenerPick, setShowOpenerPick] = useState(false);
  const [retireTarget, setRetireTarget] = useState(null); // name of batsman retiring
  const [showMidOverBowler, setShowMidOverBowler] = useState(false);

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
  const inn1Target = match?.currentInnings === 1 && match?.innings?.length >= 1
    ? match.innings[0].runs + 1 : null;
  const needsBowler = innings && !innings.bowler && !isInningsComplete(innings, meta?.overs, inn1Target);

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
    let delivery = { type, runs, overIndex, isWicket: false, wicket: null, bowler: innings.bowler };

    if (type === 'wide' && runs === 0) delivery.runs = 0;

    let updated = ensureBowler(innings, innings.bowler);
    updated = applyDelivery(updated, delivery);

    setExtraMode(EXTRA_MODES.NONE);

    const inn2Target = match.currentInnings === 1 && match.innings?.length >= 1
      ? match.innings[0].runs + 1 : null;
    const complete = isInningsComplete(updated, meta.overs, inn2Target);
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

  async function handleUndo() {
    if (!innings || saving || !innings.deliveries?.length) return;
    const last = innings.deliveries[innings.deliveries.length - 1];
    if (!last.bowler) return; // old data without bowler field — can't undo
    setSaving(true);
    const rebuilt = rebuildInnings(innings, innings.deliveries.slice(0, -1));
    await saveInnings(rebuilt);
    setSaving(false);
  }

  async function handleMidOverBowler(newBowler) {
    setShowMidOverBowler(false);
    const updated = ensureBowler({ ...innings, bowler: newBowler }, newBowler);
    await saveInnings(updated);
  }

  async function handleRetireConfirm(newBatsmanName) {
    if (!innings || !retireTarget) return;
    setRetireTarget(null);
    const updated = retireBatsman(innings, retireTarget, newBatsmanName);
    await saveInnings(updated);
  }

  function handleWicketClick() {
    if (!innings || saving || needsBowler) return;
    setShowWicket(true);
  }

  async function handleWicketConfirm(wicketInfo) {
    setShowWicket(false);
    const overIndex = currentOverIndex();
    const type = extraMode === EXTRA_MODES.NOBALL ? 'noball' : 'normal';
    const delivery = { type, runs: 0, overIndex, isWicket: true, wicket: wicketInfo, bowler: innings.bowler };

    let updated = ensureBowler(innings, innings.bowler);
    updated = applyDelivery(updated, delivery);
    setExtraMode(EXTRA_MODES.NONE);

    const inn2Target = match.currentInnings === 1 && match.innings?.length >= 1
      ? match.innings[0].runs + 1 : null;
    const complete = isInningsComplete(updated, meta.overs, inn2Target);
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
      // Save first innings, then let admin pick openers for 2nd
      const newInnings = [updatedInnings];
      await updateDoc(doc(db, 'matches', id), {
        innings: newInnings,
        currentInnings: 1,
        'meta.status': 'innings_break',
      });
      if (isAdmin) setShowOpenerPick(true);
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
      if (isAdmin) setShowPOTM(true);
    }
  }

  async function handleBowlerPicked(name, striker) {
    setShowBowlerPick(false);
    const updated = { ...innings, bowler: name, striker: striker || innings.striker, nonStriker: striker && striker !== innings.striker ? innings.striker : innings.nonStriker };
    await saveInnings(updated);
  }

  async function handleFirstBowlerPicked(name, striker) {
    setShowBowlerPick(false);
    const updated = { ...innings, bowler: name, striker: striker || innings.striker, nonStriker: striker && striker !== innings.striker ? innings.striker : innings.nonStriker };
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

  // Innings break — admin needs to pick 2nd innings openers
  if (meta?.status === 'innings_break' && match.innings?.length === 1 && isAdmin) {
    return (
      <OpenerPickModal
        players={match.innings[0].bowlingTeam === 'team1' ? meta.players1 : meta.players2}
        onConfirm={async (o1, o2) => {
          const bat2 = match.innings[0].bowlingTeam;
          const bowl2 = match.innings[0].battingTeam;
          let inn2 = makeEmptyInnings(bat2, bowl2, meta.playerCount);
          inn2 = addBatsmanToInnings(inn2, o1);
          inn2 = addBatsmanToInnings(inn2, o2);
          inn2.striker = o1;
          inn2.nonStriker = o2;
          await updateDoc(doc(db, 'matches', id), {
            innings: [match.innings[0], inn2],
            currentInnings: 1,
            'meta.status': 'live',
          });
        }}
      />
    );
  }

  // Innings break screen
  if (match.currentInnings === 1 && match.innings?.length >= 2) {
    const inn1 = match.innings[0];
    const inn2 = match.innings[1];
    const bat1Name = inn1.battingTeam === 'team1' ? meta.team1 : meta.team2;
    const bat2Name = inn2.battingTeam === 'team1' ? meta.team1 : meta.team2;
    const target = inn1.runs + 1;
    const inn2Complete = isInningsComplete(inn2, meta.overs, target);
    const isCompleted = meta.status === 'completed';

    if (isCompleted && !showPOTM) {
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
          {!inn2Complete && inn2.legalBalls >= 6 && (
            <MatchInsights innings={inn2} meta={meta} target={target} inn1={inn1} />
          )}
          {!inn2Complete && (() => {
            const inn2NeedsBowler = !inn2.bowler;
            const inn2BowlingPlayers = inn2.bowlingTeam === 'team1' ? meta.players1 : meta.players2;
            if (isAdmin && (inn2NeedsBowler || showBowlerPick)) {
              return (
                <div className="bowler-select">
                  <div className="label">Select Bowler</div>
                  <BowlerSelectModal
                    players={inn2BowlingPlayers}
                    currentBowler={inn2.bowler || getLastBowler(inn2)}
                    innings={inn2}
                    maxOversPerBowler={Math.ceil(meta.overs / 2)}
                    onConfirm={inn2NeedsBowler ? handleFirstBowlerPicked : handleBowlerPicked}
                  />
                </div>
              );
            }
            if (!inn2NeedsBowler && !showBowlerPick) return renderActionPad();
            return null;
          })()}
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
    const battingPlayers = inn.battingTeam === 'team1' ? meta.players1 : meta.players2;
    const usedPlayers = inn.battingOrder || [];
    const availableForRetire = battingPlayers.filter(n => !usedPlayers.includes(n));
    const canRetire = isAdmin && availableForRetire.length > 0;

    return (
      <div className="batsmen-table">
        <div className="table-header">
          <div>Batsman</div>
          <div style={{ textAlign: 'right' }}>R</div>
          <div style={{ textAlign: 'right' }}>B</div>
          <div style={{ textAlign: 'right' }}>4s</div>
          <div style={{ textAlign: 'right' }}>6s</div>
          {canRetire && <div />}
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
              {canRetire && (
                <div style={{ textAlign: 'right' }}>
                  <button
                    onClick={() => setRetireTarget(name)}
                    style={{ background: 'rgba(250,204,21,0.12)', border: '1px solid rgba(250,204,21,0.3)', borderRadius: 6, color: '#facc15', fontSize: '0.62rem', fontWeight: 800, padding: '2px 6px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    RET
                  </button>
                </div>
              )}
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
          {isAdmin && (
            <button
              className="extra-btn"
              onClick={handleUndo}
              disabled={saving || !innings?.deliveries?.length || !innings?.deliveries?.[innings.deliveries.length - 1]?.bowler}
              style={{ color: 'var(--danger-light)', fontWeight: 700 }}
            >
              ↩ Undo
            </button>
          )}
          {isAdmin && (
            <button
              className="extra-btn"
              onClick={() => setShowMidOverBowler(true)}
              disabled={saving}
              style={{ color: '#fb923c', fontWeight: 700 }}
            >
              🚑 Injury
            </button>
          )}
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
        {innings && !isInningsComplete(innings, meta.overs) && innings.legalBalls >= 6 && (
          <MatchInsights innings={innings} meta={meta} target={target} />
        )}

        {/* Bowler pick — admin only */}
        {isAdmin && (needsBowler || showBowlerPick) && (
          <div className="bowler-select">
            <div className="label">Select Bowler</div>
            <BowlerSelectModal
              players={bowlingPlayers}
              currentBowler={innings?.bowler || getLastBowler(innings)}
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

      {/* Mid-over bowler change (injury) */}
      {showMidOverBowler && innings && (
        <MidOverBowlerModal
          players={bowlingPlayers}
          currentBowler={innings.bowler}
          innings={innings}
          maxOversPerBowler={Math.ceil(meta.overs / 2)}
          onConfirm={handleMidOverBowler}
          onCancel={() => setShowMidOverBowler(false)}
        />
      )}

      {/* Retire Out modal */}
      {retireTarget && innings && (
        <RetireModal
          retiringName={retireTarget}
          available={
            (innings.battingTeam === 'team1' ? meta.players1 : meta.players2)
              .filter(n => !(innings.battingOrder || []).includes(n))
          }
          onConfirm={handleRetireConfirm}
          onCancel={() => setRetireTarget(null)}
        />
      )}

      {/* 2nd innings opener selection */}
      {showOpenerPick && meta && (
        <OpenerPickModal
          players={match?.innings?.[0]?.bowlingTeam === 'team1' ? meta.players1 : meta.players2}
          onConfirm={async (o1, o2) => {
            setShowOpenerPick(false);
            const bat2 = match.innings[0].bowlingTeam;
            const bowl2 = match.innings[0].battingTeam;
            let inn2 = makeEmptyInnings(bat2, bowl2, meta.playerCount);
            inn2 = addBatsmanToInnings(inn2, o1);
            inn2 = addBatsmanToInnings(inn2, o2);
            inn2.striker = o1;
            inn2.nonStriker = o2;
            const newInnings = [match.innings[0], inn2];
            await updateDoc(doc(db, 'matches', id), {
              innings: newInnings,
              currentInnings: 1,
              'meta.status': 'live',
            });
          }}
        />
      )}

      {/* Player of the Match modal */}
      {showPOTM && (
        <POTMModal
          meta={meta}
          innings={match?.innings || []}
          matchId={id}
          onDone={() => { setShowPOTM(false); navigate(`/match/${id}/scorecard`); }}
        />
      )}
    </>
  );
}

function MidOverBowlerModal({ players, currentBowler, innings, maxOversPerBowler, onConfirm, onCancel }) {
  const [selected, setSelected] = useState('');

  function bowlerOvers(name) {
    const b = innings.bowlers[name];
    return b ? Math.floor(b.balls / 6) : 0;
  }

  // Injury replacement: any bowler except the injured one is eligible
  // (no consecutive-over restriction since it's a special case)
  const eligible = players.filter(p => p !== currentBowler);

  return (
    <div className="modal-overlay">
      <div className="modal-sheet" style={{ maxHeight: '80vh', overflowY: 'auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: '1.8rem', marginBottom: 6 }}>🚑</div>
          <div className="modal-title" style={{ margin: 0 }}>Bowler Injury</div>
          <div className="text-muted" style={{ fontSize: '0.8rem', marginTop: 4 }}>
            <span style={{ color: '#fb923c', fontWeight: 700 }}>{currentBowler}</span> is injured — select replacement to complete this over
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
          {eligible.map(name => {
            const overs = bowlerOvers(name);
            const b = innings.bowlers[name];
            const atLimit = overs >= maxOversPerBowler;
            return (
              <button key={name} onClick={() => !atLimit && setSelected(name)} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px',
                borderRadius: 10, cursor: atLimit ? 'not-allowed' : 'pointer',
                border: `2px solid ${selected === name ? '#fb923c' : 'rgba(255,255,255,0.1)'}`,
                background: selected === name ? 'rgba(251,146,60,0.1)' : 'var(--surface)',
                opacity: atLimit ? 0.45 : 1,
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                  background: selected === name ? '#fb923c' : 'rgba(255,255,255,0.1)',
                  color: selected === name ? '#0c1a28' : 'var(--white)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 900, fontSize: '0.85rem',
                }}>
                  {name[0].toUpperCase()}
                </div>
                <span style={{ fontWeight: 600, color: 'var(--white)', flex: 1 }}>{name}</span>
                {b && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{Math.floor(b.balls/6)}.{b.balls%6} ov · {b.runs}R · {b.wickets}W</span>}
                {atLimit && <span style={{ fontSize: '0.68rem', color: 'var(--danger-light)' }}>quota full</span>}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary" style={{ flex: 2, background: '#fb923c', borderColor: '#fb923c' }} disabled={!selected} onClick={() => onConfirm(selected)}>
            🚑 Replace Bowler
          </button>
        </div>
      </div>
    </div>
  );
}

function RetireModal({ retiringName, available, onConfirm, onCancel }) {
  const [selected, setSelected] = useState('');

  return (
    <div className="modal-overlay">
      <div className="modal-sheet">
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: '1.8rem', marginBottom: 6 }}>🏏</div>
          <div className="modal-title" style={{ margin: 0 }}>Retire Out</div>
          <div className="text-muted" style={{ fontSize: '0.8rem', marginTop: 4 }}>
            <span style={{ color: '#facc15', fontWeight: 700 }}>{retiringName}</span> retires — select new batsman
          </div>
        </div>

        {available.length === 0 ? (
          <div className="text-muted text-center" style={{ padding: '16px 0', fontSize: '0.85rem' }}>
            No more batsmen available
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
            {available.map(name => (
              <button key={name} onClick={() => setSelected(name)} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px',
                borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                border: `2px solid ${selected === name ? 'var(--accent)' : 'rgba(255,255,255,0.1)'}`,
                background: selected === name ? 'rgba(56,189,248,0.1)' : 'var(--surface)',
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                  background: selected === name ? 'var(--accent)' : 'rgba(255,255,255,0.1)',
                  color: selected === name ? '#0c1a28' : 'var(--white)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 900, fontSize: '0.85rem',
                }}>
                  {name[0].toUpperCase()}
                </div>
                <span style={{ fontWeight: 600, color: 'var(--white)' }}>{name}</span>
              </button>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary" style={{ flex: 2 }} disabled={!selected} onClick={() => onConfirm(selected)}>
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

function OpenerPickModal({ players, onConfirm }) {
  const [o1, setO1] = useState('');
  const [o2, setO2] = useState('');

  return (
    <div className="modal-overlay">
      <div className="modal-sheet" style={{ maxHeight: '85vh', overflowY: 'auto' }}>
        <div className="modal-title">Select Opening Batsmen</div>
        <p className="text-muted text-center" style={{ marginBottom: 16, fontSize: '0.82rem' }}>
          Tap to select Striker (1) then Non-Striker (2)
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
          {players.map(name => {
            const isO1 = o1 === name;
            const isO2 = o2 === name;
            return (
              <button key={name} onClick={() => {
                if (isO1) { setO1(''); return; }
                if (isO2) { setO2(''); return; }
                if (!o1) { setO1(name); return; }
                if (!o2) { setO2(name); return; }
              }} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px',
                borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                border: `2px solid ${isO1 ? 'var(--accent)' : isO2 ? '#a78bfa' : 'rgba(255,255,255,0.1)'}`,
                background: isO1 ? 'rgba(56,189,248,0.1)' : isO2 ? 'rgba(167,139,250,0.1)' : 'var(--surface)',
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                  background: isO1 ? 'var(--accent)' : isO2 ? '#a78bfa' : 'rgba(255,255,255,0.1)',
                  color: (isO1 || isO2) ? '#0c1a28' : 'var(--white)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 900, fontSize: '0.8rem',
                }}>
                  {isO1 ? '1' : isO2 ? '2' : name[0].toUpperCase()}
                </div>
                <span style={{ fontWeight: 600, color: 'var(--white)', flex: 1 }}>{name}</span>
                {isO1 && <span style={{ fontSize: '0.68rem', color: 'var(--accent)', fontWeight: 700 }}>STRIKER</span>}
                {isO2 && <span style={{ fontSize: '0.68rem', color: '#a78bfa', fontWeight: 700 }}>NON-STRIKER</span>}
              </button>
            );
          })}
        </div>
        <button
          className="btn btn-primary btn-full"
          disabled={!o1 || !o2}
          onClick={() => onConfirm(o1, o2)}
        >
          {(!o1 || !o2) ? `Select openers (${[o1,o2].filter(Boolean).length}/2)` : '🏏 Start Innings'}
        </button>
      </div>
    </div>
  );
}

function calcPOTMScores(innings) {
  const scores = {};
  for (const inn of innings) {
    // Batting points: 1 per run, 2 per six, 0.5 per four, bonus for 50+/30+
    for (const [name, b] of Object.entries(inn.batsmen || {})) {
      if (!inn.battingOrder?.includes(name)) continue;
      const pts = b.runs + b.sixes * 2 + b.fours * 0.5 + (b.runs >= 50 ? 15 : b.runs >= 30 ? 8 : 0);
      scores[name] = (scores[name] || 0) + pts;
    }
    // Bowling points: 20 per wicket, bonus for 2-fer/3-fer, -1 per extra run conceded
    for (const [name, b] of Object.entries(inn.bowlers || {})) {
      const pts = b.wickets * 20 + (b.wickets >= 3 ? 10 : b.wickets >= 2 ? 5 : 0);
      scores[name] = (scores[name] || 0) + pts;
    }
  }
  return scores;
}

function POTMModal({ meta, matchId, innings, onDone }) {
  const allPlayers = [...(meta.players1 || []), ...(meta.players2 || [])];
  const scores = calcPOTMScores(innings);
  const autoSuggested = allPlayers.reduce((best, p) => (scores[p] || 0) > (scores[best] || 0) ? p : best, allPlayers[0] || '');
  const [selected, setSelected] = useState(autoSuggested);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!selected || saving) return;
    setSaving(true);
    await updateDoc(doc(db, 'matches', matchId), { 'meta.potm': selected });
    onDone();
  }

  return (
    <div className="modal-overlay">
      <div className="modal-sheet" style={{ maxHeight: '80vh', overflowY: 'auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🏆</div>
          <div className="modal-title" style={{ margin: 0 }}>Player of the Match</div>
          <div className="text-muted" style={{ fontSize: '0.82rem', marginTop: 4 }}>Auto-suggested based on performance · tap to change</div>
        </div>

        {autoSuggested && (
          <div style={{ margin: '0 0 16px', padding: '8px 12px', borderRadius: 8, background: 'rgba(250,204,21,0.08)', border: '1px solid rgba(250,204,21,0.25)', fontSize: '0.78rem', color: '#facc15' }}>
            ⭐ Suggested: <strong>{autoSuggested}</strong>
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>{meta.team1}</div>
          {(meta.players1 || []).map(name => (
            <PlayerRow key={name} name={name} selected={selected === name} isSuggested={name === autoSuggested} score={scores[name] || 0} onSelect={() => setSelected(name)} />
          ))}
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>{meta.team2}</div>
          {(meta.players2 || []).map(name => (
            <PlayerRow key={name} name={name} selected={selected === name} isSuggested={name === autoSuggested} score={scores[name] || 0} onSelect={() => setSelected(name)} />
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onDone}>Skip</button>
          <button className="btn btn-primary" style={{ flex: 2 }} disabled={!selected || saving} onClick={save}>
            {saving ? 'Saving…' : '🏆 Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PlayerRow({ name, selected, isSuggested, score, onSelect }) {
  return (
    <div onClick={onSelect} style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
      borderRadius: 10, marginBottom: 6, cursor: 'pointer',
      border: `2px solid ${selected ? '#facc15' : isSuggested ? 'rgba(250,204,21,0.3)' : 'rgba(255,255,255,0.07)'}`,
      background: selected ? 'rgba(250,204,21,0.08)' : 'var(--card-bg)',
      transition: 'all 0.15s',
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
        background: selected ? '#facc15' : 'var(--surface)',
        color: selected ? '#0c1a28' : 'var(--white)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 800, fontSize: '0.9rem',
      }}>
        {selected ? '★' : name[0].toUpperCase()}
      </div>
      <span style={{ fontWeight: 600, flex: 1 }}>{name}</span>
      {score > 0 && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginRight: 4 }}>{Math.round(score)} pts</span>}
      {isSuggested && !selected && <span style={{ fontSize: '0.68rem', color: '#facc15', fontWeight: 700, background: 'rgba(250,204,21,0.15)', borderRadius: 4, padding: '1px 5px' }}>⭐ AI Pick</span>}
      {selected && <span style={{ color: '#facc15', fontWeight: 800, fontSize: '0.9rem' }}>🏆</span>}
    </div>
  );
}
