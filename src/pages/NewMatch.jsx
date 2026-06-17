import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { makeEmptyInnings, addBatsmanToInnings } from '../utils/cricket';
import { RoleBadge } from './Players';

// Auto-balance players into 2 teams equally by role
function autoBalance(players) {
  const byRole = {
    batsman:    players.filter(p => p.role === 'batsman').sort(() => Math.random() - 0.5),
    allrounder: players.filter(p => p.role === 'allrounder').sort(() => Math.random() - 0.5),
    bowler:     players.filter(p => p.role === 'bowler').sort(() => Math.random() - 0.5),
  };

  const team1 = [], team2 = [];

  // Snake-draft each role group into the two teams
  Object.values(byRole).forEach(group => {
    group.forEach((player, idx) => {
      if (idx % 2 === 0) team1.push(player);
      else team2.push(player);
    });
  });

  // Re-balance if sizes differ by more than 1
  while (team1.length > team2.length + 1) team2.push(team1.pop());
  while (team2.length > team1.length + 1) team1.push(team2.pop());

  return { team1, team2 };
}

const ROLE_ORDER = { batsman: 0, allrounder: 1, bowler: 2 };

export default function NewMatch() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Step 0
  const [team1Name, setTeam1Name] = useState('');
  const [team2Name, setTeam2Name] = useState('');
  const [overs, setOvers] = useState(6);

  // Step 1 — player selection
  const [allPlayers, setAllPlayers] = useState([]);
  const [loadingPlayers, setLoadingPlayers] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);

  // Step 2 — balanced teams (can swap) + captain/VC
  const [team1, setTeam1] = useState([]);
  const [team2, setTeam2] = useState([]);
  const [swapFrom, setSwapFrom] = useState(null);
  const [captain1, setCaptain1] = useState('');
  const [vc1, setVc1] = useState('');
  const [captain2, setCaptain2] = useState('');
  const [vc2, setVc2] = useState('');

  // Step 3 — toss
  const [tossState, setTossState] = useState('idle');
  const [tossWinner, setTossWinner] = useState('');
  const [elected, setElected] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'players'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, snap => {
      setAllPlayers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoadingPlayers(false);
    }, () => setLoadingPlayers(false));
    return unsub;
  }, []);

  const sortedPlayers = [...allPlayers].sort(
    (a, b) => (ROLE_ORDER[a.role] ?? 3) - (ROLE_ORDER[b.role] ?? 3)
  );

  function toggleSelect(id) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function doAutoBalance() {
    const selected = allPlayers.filter(p => selectedIds.includes(p.id));
    const { team1, team2 } = autoBalance(selected);
    setTeam1(team1);
    setTeam2(team2);
    setStep(2);
  }

  // Swap a player between teams
  function handlePlayerTap(player, fromTeam) {
    if (!swapFrom) {
      setSwapFrom({ player, fromTeam });
      return;
    }
    // Swap the two selected players
    const a = swapFrom;
    if (a.player.id === player.id) { setSwapFrom(null); return; }

    setTeam1(prev => {
      let t = [...prev];
      if (a.fromTeam === 1) t = t.filter(p => p.id !== a.player.id);
      if (fromTeam === 2) t = [...t, player];
      if (fromTeam === 1 && a.fromTeam === 2) t = t.map(p => p.id === player.id ? a.player : p);
      return t;
    });
    setTeam2(prev => {
      let t = [...prev];
      if (a.fromTeam === 2) t = t.filter(p => p.id !== a.player.id);
      if (fromTeam === 1) t = [...t, player];
      if (fromTeam === 2 && a.fromTeam === 1) t = t.map(p => p.id === player.id ? a.player : p);
      return t;
    });
    setSwapFrom(null);
  }

  function reshuffleTeams() {
    const selected = allPlayers.filter(p => selectedIds.includes(p.id));
    const { team1, team2 } = autoBalance(selected);
    setTeam1(team1);
    setTeam2(team2);
    setSwapFrom(null);
    setCaptain1(''); setVc1(''); setCaptain2(''); setVc2('');
  }

  // Cycle through: none → C → VC → none
  function cycleRole(playerId, teamNum) {
    const cap = teamNum === 1 ? captain1 : captain2;
    const vc  = teamNum === 1 ? vc1 : vc2;
    const setCap = teamNum === 1 ? setCaptain1 : setCaptain2;
    const setVc  = teamNum === 1 ? setVc1 : setVc2;

    if (cap === playerId) {
      setCap('');
      setVc(playerId); // C → VC
    } else if (vc === playerId) {
      setVc('');       // VC → none
    } else {
      if (cap) {
        // someone else is already C, set as VC
        setVc(playerId);
      } else {
        setCap(playerId); // none → C
      }
    }
  }

  function getBadge(playerId, teamNum) {
    if ((teamNum === 1 ? captain1 : captain2) === playerId) return 'C';
    if ((teamNum === 1 ? vc1 : vc2) === playerId) return 'VC';
    return null;
  }

  function flipCoin() {
    if (tossState !== 'idle') return;
    setTossState('flipping');
    setElected('');
    const winner = Math.random() < 0.5 ? 'team1' : 'team2';
    setTimeout(() => { setTossWinner(winner); setTossState('done'); }, 2200);
  }

  function reflip() { setTossState('idle'); setTossWinner(''); setElected(''); }

  async function startMatch() {
    if (!elected || saving) return;
    setSaving(true);

    const battingTeamKey = tossWinner === 'team1'
      ? (elected === 'bat' ? 'team1' : 'team2')
      : (elected === 'bat' ? 'team2' : 'team1');
    const bowlingTeamKey = battingTeamKey === 'team1' ? 'team2' : 'team1';

    const p1 = team1, p2 = team2;
    const battingNames = battingTeamKey === 'team1' ? p1.map(p => p.name) : p2.map(p => p.name);

    let innings = makeEmptyInnings(battingTeamKey, bowlingTeamKey, Math.max(p1.length, p2.length));
    innings = addBatsmanToInnings(innings, battingNames[0]);
    innings = addBatsmanToInnings(innings, battingNames[1]);
    innings.striker = battingNames[0];
    innings.nonStriker = battingNames[1];

    try {
      const ref = await addDoc(collection(db, 'matches'), {
        meta: {
          team1: team1Name.trim() || 'Team 1',
          team2: team2Name.trim() || 'Team 2',
          players1: p1.map(p => p.name),
          players2: p2.map(p => p.name),
          playerRoles1: Object.fromEntries(p1.map(p => [p.name, p.role])),
          playerRoles2: Object.fromEntries(p2.map(p => [p.name, p.role])),
          captain1: p1.find(p => p.id === captain1)?.name || '',
          vc1: p1.find(p => p.id === vc1)?.name || '',
          captain2: p2.find(p => p.id === captain2)?.name || '',
          vc2: p2.find(p => p.id === vc2)?.name || '',
          overs,
          playerCount: Math.max(p1.length, p2.length),
          tossWinner,
          elected,
          status: 'live',
          result: null,
        },
        innings: [innings],
        currentInnings: 0,
        createdAt: serverTimestamp(),
      });
      navigate(`/match/${ref.id}`);
    } catch (err) {
      alert('Error creating match.');
      console.error(err);
      setSaving(false);
    }
  }

  const stepLabels = ['Settings', 'Select Players', 'Teams', 'Toss'];

  return (
    <>
      <div className="app-header">
        <button className="back-btn" onClick={() => step === 0 ? navigate('/') : setStep(s => s - 1)}>←</button>
        <h1>New Match</h1>
      </div>

      <div className="page">
        {/* Step dots */}
        <div className="step-indicator" style={{ marginBottom: 20 }}>
          {stepLabels.map((label, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div className={`step-dot ${i < step ? 'done' : i === step ? 'active' : ''}`} />
              <span style={{ fontSize: '0.72rem', color: i === step ? 'var(--gold)' : 'var(--text-muted)' }}>
                {label}
              </span>
              {i < stepLabels.length - 1 && (
                <div style={{ width: 12, height: 1, background: 'rgba(255,255,255,0.1)', margin: '0 2px' }} />
              )}
            </div>
          ))}
        </div>

        {/* ── Step 0: Settings ── */}
        {step === 0 && (
          <div>
            <div className="form-group">
              <label>Team 1 Name</label>
              <input type="text" placeholder="e.g. DPL Warriors" value={team1Name} onChange={e => setTeam1Name(e.target.value)} autoFocus />
            </div>
            <div className="form-group">
              <label>Team 2 Name</label>
              <input type="text" placeholder="e.g. Office Strikers" value={team2Name} onChange={e => setTeam2Name(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Overs per Innings</label>
              <select value={overs} onChange={e => setOvers(Number(e.target.value))}>
                {[4, 5, 6, 7, 8, 10, 12].map(o => <option key={o} value={o}>{o} overs</option>)}
              </select>
            </div>
            <button
              className="btn btn-primary btn-full mt-16"
              disabled={!team1Name.trim() || !team2Name.trim()}
              onClick={() => setStep(1)}
            >
              Next →
            </button>
          </div>
        )}

        {/* ── Step 1: Select Players ── */}
        {step === 1 && (
          <div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: '1rem' }}>Who's playing today?</div>
              <div className="text-muted" style={{ fontSize: '0.82rem', marginTop: 2 }}>
                Select all players → app auto-balances teams by role · {selectedIds.length} selected
              </div>
            </div>

            {loadingPlayers ? (
              <div className="text-muted text-center" style={{ padding: 32 }}>Loading players…</div>
            ) : allPlayers.length === 0 ? (
              <div className="card text-center" style={{ padding: 24 }}>
                <p className="text-muted" style={{ marginBottom: 12 }}>No players saved yet.</p>
                <button className="btn btn-ghost" onClick={() => navigate('/players')}>+ Add Players First</button>
              </div>
            ) : (
              <>
                {/* Select All / Clear */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <button
                    className="btn btn-secondary"
                    style={{ flex: 1, padding: '8px', fontSize: '0.82rem' }}
                    onClick={() => setSelectedIds(allPlayers.map(p => p.id))}
                  >
                    Select All
                  </button>
                  <button
                    className="btn btn-secondary"
                    style={{ flex: 1, padding: '8px', fontSize: '0.82rem' }}
                    onClick={() => setSelectedIds([])}
                  >
                    Clear
                  </button>
                </div>

                {sortedPlayers.map(p => {
                  const sel = selectedIds.includes(p.id);
                  return (
                    <div
                      key={p.id}
                      onClick={() => toggleSelect(p.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '11px 14px', borderRadius: 10, marginBottom: 8,
                        border: `2px solid ${sel ? 'var(--accent)' : 'rgba(255,255,255,0.07)'}`,
                        background: sel ? 'rgba(56,189,248,0.08)' : 'var(--card-bg)',
                        cursor: 'pointer', transition: 'all 0.15s',
                      }}
                    >
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                        background: sel ? 'var(--accent)' : 'var(--surface)',
                        color: sel ? '#0c1a28' : 'var(--white)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 800, fontSize: '0.95rem',
                      }}>
                        {sel ? '✓' : p.name[0].toUpperCase()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600 }}>{p.name}</div>
                        <RoleBadge role={p.role} small />
                      </div>
                    </div>
                  );
                })}
              </>
            )}

            <button
              className="btn btn-primary btn-full mt-16"
              disabled={selectedIds.length < 4 || selectedIds.length % 2 !== 0}
              onClick={doAutoBalance}
            >
              {selectedIds.length < 4
                ? `Select at least 4 players (${selectedIds.length} selected)`
                : selectedIds.length % 2 !== 0
                ? `Need even number of players (${selectedIds.length} selected)`
                : `⚡ Auto-Balance ${selectedIds.length} Players →`}
            </button>
          </div>
        )}

        {/* ── Step 2: Review Teams ── */}
        {step === 2 && (
          <div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: '1rem' }}>Teams Auto-Balanced</div>
              <div className="text-muted" style={{ fontSize: '0.82rem', marginTop: 2 }}>
                Tap a player from each team to swap them
              </div>
            </div>

            {swapFrom && (
              <div style={{
                background: 'rgba(56,189,248,0.12)', border: '1px solid var(--accent)',
                borderRadius: 10, padding: '8px 14px', marginBottom: 12,
                fontSize: '0.82rem', color: 'var(--accent)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span>Tap another player to swap with <strong>{swapFrom.player.name}</strong></span>
                <button onClick={() => setSwapFrom(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              {/* Team 1 */}
              <div>
                <div style={{
                  fontWeight: 700, fontSize: '0.85rem', color: 'var(--accent)',
                  marginBottom: 8, padding: '6px 10px',
                  background: 'rgba(56,189,248,0.1)', borderRadius: 8, textAlign: 'center',
                }}>
                  {team1Name || 'Team 1'} ({team1.length})
                </div>
                {team1.map(p => {
                  const isSelected = swapFrom?.player.id === p.id;
                  const badge = getBadge(p.id, 1);
                  return (
                    <div
                      key={p.id}
                      style={{
                        padding: '9px 10px', borderRadius: 8, marginBottom: 6,
                        border: `1.5px solid ${isSelected ? 'var(--accent)' : badge ? 'rgba(250,204,21,0.4)' : 'rgba(255,255,255,0.08)'}`,
                        background: isSelected ? 'rgba(56,189,248,0.15)' : badge ? 'rgba(250,204,21,0.06)' : 'var(--card-bg)',
                        transition: 'all 0.15s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                        <div
                          style={{ fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', flex: 1 }}
                          onClick={() => handlePlayerTap(p, 1)}
                        >
                          {p.name}
                        </div>
                        <button
                          onClick={() => cycleRole(p.id, 1)}
                          style={{
                            minWidth: 28, height: 22, borderRadius: 6, fontSize: '0.68rem', fontWeight: 800,
                            border: `1.5px solid ${badge === 'C' ? '#facc15' : badge === 'VC' ? '#94a3b8' : 'rgba(255,255,255,0.15)'}`,
                            background: badge === 'C' ? 'rgba(250,204,21,0.15)' : badge === 'VC' ? 'rgba(148,163,184,0.12)' : 'transparent',
                            color: badge === 'C' ? '#facc15' : badge === 'VC' ? '#94a3b8' : 'rgba(255,255,255,0.25)',
                            cursor: 'pointer', padding: '0 4px',
                          }}
                        >
                          {badge || 'C'}
                        </button>
                      </div>
                      <RoleBadge role={p.role} small />
                    </div>
                  );
                })}
              </div>

              {/* Team 2 */}
              <div>
                <div style={{
                  fontWeight: 700, fontSize: '0.85rem', color: '#a78bfa',
                  marginBottom: 8, padding: '6px 10px',
                  background: 'rgba(167,139,250,0.1)', borderRadius: 8, textAlign: 'center',
                }}>
                  {team2Name || 'Team 2'} ({team2.length})
                </div>
                {team2.map(p => {
                  const isSelected = swapFrom?.player.id === p.id;
                  const badge = getBadge(p.id, 2);
                  return (
                    <div
                      key={p.id}
                      style={{
                        padding: '9px 10px', borderRadius: 8, marginBottom: 6,
                        border: `1.5px solid ${isSelected ? '#a78bfa' : badge ? 'rgba(250,204,21,0.4)' : 'rgba(255,255,255,0.08)'}`,
                        background: isSelected ? 'rgba(167,139,250,0.15)' : badge ? 'rgba(250,204,21,0.06)' : 'var(--card-bg)',
                        transition: 'all 0.15s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                        <div
                          style={{ fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', flex: 1 }}
                          onClick={() => handlePlayerTap(p, 2)}
                        >
                          {p.name}
                        </div>
                        <button
                          onClick={() => cycleRole(p.id, 2)}
                          style={{
                            minWidth: 28, height: 22, borderRadius: 6, fontSize: '0.68rem', fontWeight: 800,
                            border: `1.5px solid ${badge === 'C' ? '#facc15' : badge === 'VC' ? '#94a3b8' : 'rgba(255,255,255,0.15)'}`,
                            background: badge === 'C' ? 'rgba(250,204,21,0.15)' : badge === 'VC' ? 'rgba(148,163,184,0.12)' : 'transparent',
                            color: badge === 'C' ? '#facc15' : badge === 'VC' ? '#94a3b8' : 'rgba(255,255,255,0.25)',
                            cursor: 'pointer', padding: '0 4px',
                          }}
                        >
                          {badge || 'C'}
                        </button>
                      </div>
                      <RoleBadge role={p.role} small />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Role summary */}
            <div className="card" style={{ marginBottom: 14 }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8 }}>
                Role Balance
              </div>
              {['batsman', 'allrounder', 'bowler'].map(role => {
                const t1c = team1.filter(p => p.role === role).length;
                const t2c = team2.filter(p => p.role === role).length;
                const label = role === 'batsman' ? '🏏 Batsmen' : role === 'bowler' ? '🎳 Bowlers' : '⭐ All-rounders';
                return (
                  <div key={role} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, fontSize: '0.82rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                    <span>
                      <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{t1c}</span>
                      <span style={{ color: 'var(--text-muted)', margin: '0 6px' }}>vs</span>
                      <span style={{ color: '#a78bfa', fontWeight: 700 }}>{t2c}</span>
                    </span>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={reshuffleTeams}>
                🔀 Reshuffle
              </button>
              <button className="btn btn-primary" style={{ flex: 2 }} onClick={() => setStep(3)}>
                Proceed to Toss →
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Toss ── */}
        {step === 3 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>
                {team1Name} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>vs</span> {team2Name}
              </div>
              <div className="text-muted" style={{ fontSize: '0.82rem', marginTop: 4 }}>
                {team1.length + team2.length} players · {overs} overs
              </div>
            </div>

            <div style={{ marginBottom: 28 }}>
              <div
                onClick={tossState === 'idle' ? flipCoin : undefined}
                style={{
                  width: 100, height: 100, borderRadius: '50%',
                  margin: '0 auto',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '2.8rem',
                  cursor: tossState === 'idle' ? 'pointer' : 'default',
                  background: tossState === 'done' ? 'linear-gradient(135deg, var(--accent), #0284c7)' : 'var(--surface)',
                  border: '3px solid var(--accent)',
                  boxShadow: '0 4px 20px rgba(56,189,248,0.3)',
                  animation: tossState === 'flipping' ? 'coinSpin 2.2s ease-out forwards' : 'none',
                }}
              >
                {tossState === 'done' ? '🏆' : '🪙'}
              </div>
              <style>{`@keyframes coinSpin { 0%{transform:rotateY(0deg) scale(1)} 20%{transform:rotateY(360deg) scale(1.1)} 60%{transform:rotateY(1080deg) scale(1)} 100%{transform:rotateY(1800deg) scale(1)} }`}</style>
            </div>

            {tossState === 'idle' && (
              <button className="btn btn-primary" style={{ padding: '14px 40px', fontSize: '1.1rem' }} onClick={flipCoin}>
                🪙 Flip Coin
              </button>
            )}

            {tossState === 'flipping' && (
              <div style={{ color: 'var(--accent)', fontWeight: 700, fontSize: '1.1rem' }}>Flipping…</div>
            )}

            {tossState === 'done' && (
              <div style={{ animation: 'fadeIn 0.4s ease' }}>
                <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent)', marginBottom: 6 }}>
                  {tossWinner === 'team1' ? team1Name : team2Name} won the toss!
                </div>
                <div className="text-muted" style={{ marginBottom: 20, fontSize: '0.85rem' }}>Choose to bat or bowl first</div>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 20 }}>
                  <button
                    onClick={() => setElected('bat')}
                    style={{
                      padding: '14px 28px', borderRadius: 12, cursor: 'pointer',
                      border: `2px solid ${elected === 'bat' ? 'var(--accent)' : 'rgba(255,255,255,0.15)'}`,
                      background: elected === 'bat' ? 'rgba(56,189,248,0.15)' : 'var(--surface)',
                      color: elected === 'bat' ? 'var(--accent)' : 'var(--white)',
                      fontSize: '1rem', fontWeight: 700,
                    }}
                  >
                    🏏 Bat
                  </button>
                  <button
                    onClick={() => setElected('bowl')}
                    style={{
                      padding: '14px 28px', borderRadius: 12, cursor: 'pointer',
                      border: `2px solid ${elected === 'bowl' ? '#a78bfa' : 'rgba(255,255,255,0.15)'}`,
                      background: elected === 'bowl' ? 'rgba(167,139,250,0.15)' : 'var(--surface)',
                      color: elected === 'bowl' ? '#a78bfa' : 'var(--white)',
                      fontSize: '1rem', fontWeight: 700,
                    }}
                  >
                    🎳 Bowl
                  </button>
                </div>
                {elected && (
                  <div className="card mt-12" style={{ textAlign: 'center', marginBottom: 16, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--accent)', fontWeight: 700 }}>
                      {tossWinner === 'team1' ? team1Name : team2Name}
                    </span>{' '}elected to <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{elected}</span> first
                  </div>
                )}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn btn-ghost" style={{ flex: 1 }} onClick={reflip}>Reflip</button>
                  <button className="btn btn-primary" style={{ flex: 2 }} disabled={!elected || saving} onClick={startMatch}>
                    {saving ? 'Starting…' : '🏏 Start Match!'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
