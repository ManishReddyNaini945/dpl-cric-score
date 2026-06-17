import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { makeEmptyInnings, addBatsmanToInnings } from '../utils/cricket';
import { RoleBadge } from './Players';

const ROLE_ORDER = { batsman: 0, allrounder: 1, bowler: 2 };

export default function NewMatch() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Step 0 — settings
  const [team1, setTeam1] = useState('');
  const [team2, setTeam2] = useState('');
  const [overs, setOvers] = useState(6);

  // Step 1 & 2 — player selection
  const [allPlayers, setAllPlayers] = useState([]);
  const [loadingPlayers, setLoadingPlayers] = useState(true);
  const [selected1, setSelected1] = useState([]); // team1 player ids
  const [selected2, setSelected2] = useState([]); // team2 player ids

  // Step 3 — toss
  const [tossState, setTossState] = useState('idle'); // idle | flipping | done
  const [tossWinner, setTossWinner] = useState(''); // 'team1' | 'team2'
  const [elected, setElected] = useState('');
  const coinRef = useRef(null);

  useEffect(() => {
    const q = query(collection(db, 'players'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, snap => {
      setAllPlayers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoadingPlayers(false);
    });
    return unsub;
  }, []);

  const sortedPlayers = [...allPlayers].sort(
    (a, b) => (ROLE_ORDER[a.role] ?? 3) - (ROLE_ORDER[b.role] ?? 3)
  );

  // Players not yet picked by team1
  const availableForTeam2 = sortedPlayers.filter(p => !selected1.includes(p.id));

  function toggleTeam1(id) {
    setSelected1(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
    // remove from team2 if somehow there
    setSelected2(prev => prev.filter(x => x !== id));
  }

  function toggleTeam2(id) {
    setSelected2(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  function flipCoin() {
    if (tossState !== 'idle') return;
    setTossState('flipping');
    setElected('');
    const winner = Math.random() < 0.5 ? 'team1' : 'team2';

    // After animation ends reveal winner
    setTimeout(() => {
      setTossWinner(winner);
      setTossState('done');
    }, 2200);
  }

  function reflip() {
    setTossState('idle');
    setTossWinner('');
    setElected('');
  }

  async function startMatch() {
    if (!elected || saving) return;
    setSaving(true);

    const p1 = selected1.map(id => allPlayers.find(p => p.id === id)).filter(Boolean);
    const p2 = selected2.map(id => allPlayers.find(p => p.id === id)).filter(Boolean);

    const battingTeamKey = tossWinner === 'team1'
      ? (elected === 'bat' ? 'team1' : 'team2')
      : (elected === 'bat' ? 'team2' : 'team1');
    const bowlingTeamKey = battingTeamKey === 'team1' ? 'team2' : 'team1';

    const battingNames = battingTeamKey === 'team1' ? p1.map(p => p.name) : p2.map(p => p.name);
    const playerCount = Math.max(p1.length, p2.length);

    let innings = makeEmptyInnings(battingTeamKey, bowlingTeamKey, playerCount);
    innings = addBatsmanToInnings(innings, battingNames[0]);
    innings = addBatsmanToInnings(innings, battingNames[1]);
    innings.striker = battingNames[0];
    innings.nonStriker = battingNames[1];

    const matchData = {
      meta: {
        team1: team1.trim() || 'Team 1',
        team2: team2.trim() || 'Team 2',
        players1: p1.map(p => p.name),
        players2: p2.map(p => p.name),
        playerRoles1: Object.fromEntries(p1.map(p => [p.name, p.role])),
        playerRoles2: Object.fromEntries(p2.map(p => [p.name, p.role])),
        overs,
        playerCount,
        tossWinner,
        elected,
        status: 'live',
        result: null,
      },
      innings: [innings],
      currentInnings: 0,
      createdAt: serverTimestamp(),
    };

    try {
      const ref = await addDoc(collection(db, 'matches'), matchData);
      navigate(`/match/${ref.id}`);
    } catch (err) {
      alert('Error creating match. Check Firebase config.');
      console.error(err);
      setSaving(false);
    }
  }

  const stepLabels = ['Settings', 'Team 1', 'Team 2', 'Toss'];
  const minPlayers = 2;

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
              <span style={{ fontSize: '0.75rem', color: i === step ? 'var(--gold)' : 'var(--text-muted)' }}>
                {label}
              </span>
              {i < stepLabels.length - 1 && (
                <div style={{ width: 14, height: 1, background: 'rgba(255,255,255,0.1)', margin: '0 2px' }} />
              )}
            </div>
          ))}
        </div>

        {/* ── Step 0: Settings ── */}
        {step === 0 && (
          <div>
            <div className="form-group">
              <label>Team 1 Name</label>
              <input type="text" placeholder="e.g. DPL Warriors" value={team1} onChange={e => setTeam1(e.target.value)} autoFocus />
            </div>
            <div className="form-group">
              <label>Team 2 Name</label>
              <input type="text" placeholder="e.g. Office Strikers" value={team2} onChange={e => setTeam2(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Overs per Innings</label>
              <select value={overs} onChange={e => setOvers(Number(e.target.value))}>
                {[4, 5, 6, 7, 8, 10, 12].map(o => <option key={o} value={o}>{o} overs</option>)}
              </select>
            </div>
            <button
              className="btn btn-primary btn-full mt-16"
              disabled={!team1.trim() || !team2.trim()}
              onClick={() => setStep(1)}
            >
              Next →
            </button>
          </div>
        )}

        {/* ── Step 1: Team 1 Players ── */}
        {step === 1 && (
          <div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--gold)' }}>
                {team1} Players
              </div>
              <div className="text-muted" style={{ fontSize: '0.82rem' }}>
                Tap to select · {selected1.length} selected
              </div>
            </div>

            {loadingPlayers ? (
              <div className="text-muted text-center" style={{ padding: 32 }}>Loading players…</div>
            ) : allPlayers.length === 0 ? (
              <div className="card text-center" style={{ padding: 24 }}>
                <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>👤</div>
                <p className="text-muted" style={{ marginBottom: 12 }}>No players saved yet.</p>
                <button className="btn btn-ghost" onClick={() => navigate('/players')}>
                  + Add Players First
                </button>
              </div>
            ) : (
              sortedPlayers.map(p => {
                const sel = selected1.includes(p.id);
                return (
                  <div
                    key={p.id}
                    onClick={() => toggleTeam1(p.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 14px', borderRadius: 10, marginBottom: 8,
                      border: `2px solid ${sel ? 'var(--gold)' : 'rgba(255,255,255,0.07)'}`,
                      background: sel ? 'rgba(240,165,0,0.08)' : 'var(--card-bg)',
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    <div style={{
                      width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                      background: sel ? 'var(--gold)' : 'var(--surface)',
                      color: sel ? 'var(--green-dark)' : 'var(--white)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 800, fontSize: '1rem',
                    }}>
                      {sel ? '✓' : p.name[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>{p.name}</div>
                      <RoleBadge role={p.role} small />
                    </div>
                  </div>
                );
              })
            )}

            <button
              className="btn btn-primary btn-full mt-16"
              disabled={selected1.length < minPlayers}
              onClick={() => setStep(2)}
            >
              Next → ({selected1.length} players selected)
            </button>
          </div>
        )}

        {/* ── Step 2: Team 2 Players ── */}
        {step === 2 && (
          <div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--gold)' }}>
                {team2} Players
              </div>
              <div className="text-muted" style={{ fontSize: '0.82rem' }}>
                Select from remaining players · {selected2.length} selected
              </div>
            </div>

            {availableForTeam2.length === 0 ? (
              <div className="card text-center" style={{ padding: 20 }}>
                <p className="text-muted">All players already in {team1}. Add more players first.</p>
              </div>
            ) : (
              availableForTeam2.map(p => {
                const sel = selected2.includes(p.id);
                return (
                  <div
                    key={p.id}
                    onClick={() => toggleTeam2(p.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 14px', borderRadius: 10, marginBottom: 8,
                      border: `2px solid ${sel ? '#3498db' : 'rgba(255,255,255,0.07)'}`,
                      background: sel ? 'rgba(52,152,219,0.08)' : 'var(--card-bg)',
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    <div style={{
                      width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                      background: sel ? '#3498db' : 'var(--surface)',
                      color: 'var(--white)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 800, fontSize: '1rem',
                    }}>
                      {sel ? '✓' : p.name[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>{p.name}</div>
                      <RoleBadge role={p.role} small />
                    </div>
                  </div>
                );
              })
            )}

            <button
              className="btn btn-primary btn-full mt-16"
              disabled={selected2.length < minPlayers}
              onClick={() => setStep(3)}
            >
              Next → ({selected2.length} players selected)
            </button>
          </div>
        )}

        {/* ── Step 3: Auto Toss ── */}
        {step === 3 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>
                {team1} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>vs</span> {team2}
              </div>
              <div className="text-muted" style={{ fontSize: '0.82rem', marginTop: 4 }}>
                {selected1.length + selected2.length} players · {overs} overs
              </div>
            </div>

            {/* Coin */}
            <div style={{ marginBottom: 28 }}>
              <div
                ref={coinRef}
                onClick={tossState === 'idle' ? flipCoin : undefined}
                style={{
                  width: 100, height: 100,
                  borderRadius: '50%',
                  margin: '0 auto',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '2.8rem',
                  cursor: tossState === 'idle' ? 'pointer' : 'default',
                  background: tossState === 'done'
                    ? 'linear-gradient(135deg, var(--gold), #e67e00)'
                    : 'var(--surface)',
                  border: '3px solid var(--gold)',
                  boxShadow: '0 4px 20px rgba(240,165,0,0.3)',
                  animation: tossState === 'flipping' ? 'coinSpin 2.2s ease-out forwards' : 'none',
                  transition: 'background 0.4s',
                }}
              >
                {tossState === 'idle' && '🪙'}
                {tossState === 'flipping' && '🪙'}
                {tossState === 'done' && '🏆'}
              </div>

              <style>{`
                @keyframes coinSpin {
                  0%   { transform: rotateY(0deg) scale(1); }
                  20%  { transform: rotateY(360deg) scale(1.1); }
                  40%  { transform: rotateY(720deg) scale(1); }
                  60%  { transform: rotateY(1080deg) scale(1.1); }
                  80%  { transform: rotateY(1440deg) scale(1); }
                  100% { transform: rotateY(1800deg) scale(1); }
                }
              `}</style>
            </div>

            {tossState === 'idle' && (
              <>
                <div className="text-muted" style={{ marginBottom: 16 }}>Tap the coin to flip!</div>
                <button className="btn btn-primary" style={{ padding: '14px 40px', fontSize: '1.1rem' }} onClick={flipCoin}>
                  🪙 Flip Coin
                </button>
              </>
            )}

            {tossState === 'flipping' && (
              <div style={{ color: 'var(--gold)', fontWeight: 700, fontSize: '1.1rem', marginTop: 8 }}>
                Flipping…
              </div>
            )}

            {tossState === 'done' && (
              <div style={{ animation: 'fadeIn 0.4s ease' }}>
                <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>

                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--gold)', marginBottom: 6 }}>
                  {tossWinner === 'team1' ? team1 : team2} won the toss!
                </div>
                <div className="text-muted" style={{ marginBottom: 20, fontSize: '0.85rem' }}>
                  Choose to bat or bowl first
                </div>

                <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 20 }}>
                  <button
                    onClick={() => setElected('bat')}
                    style={{
                      padding: '14px 28px',
                      borderRadius: 12,
                      border: `2px solid ${elected === 'bat' ? 'var(--gold)' : 'rgba(255,255,255,0.15)'}`,
                      background: elected === 'bat' ? 'rgba(240,165,0,0.15)' : 'var(--surface)',
                      color: elected === 'bat' ? 'var(--gold)' : 'var(--white)',
                      fontSize: '1rem', fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    🏏 Bat
                  </button>
                  <button
                    onClick={() => setElected('bowl')}
                    style={{
                      padding: '14px 28px',
                      borderRadius: 12,
                      border: `2px solid ${elected === 'bowl' ? '#3498db' : 'rgba(255,255,255,0.15)'}`,
                      background: elected === 'bowl' ? 'rgba(52,152,219,0.15)' : 'var(--surface)',
                      color: elected === 'bowl' ? '#3498db' : 'var(--white)',
                      fontSize: '1rem', fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    🎳 Bowl
                  </button>
                </div>

                {elected && (
                  <div className="card" style={{ textAlign: 'center', marginBottom: 16, color: 'var(--text-muted)' }}>
                    <span style={{ color: 'var(--gold)', fontWeight: 700 }}>
                      {tossWinner === 'team1' ? team1 : team2}
                    </span>{' '}
                    elected to{' '}
                    <span style={{ color: 'var(--gold)', fontWeight: 700 }}>{elected}</span> first.{' '}
                    <span style={{ color: 'var(--white)', fontWeight: 700 }}>
                      {elected === 'bat'
                        ? (tossWinner === 'team1' ? team2 : team1)
                        : (tossWinner === 'team1' ? team2 : team1)
                      }
                    </span>{' '}
                    will {elected === 'bat' ? 'bowl' : 'bat'}.
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn btn-ghost" style={{ flex: 1 }} onClick={reflip}>
                    Reflip
                  </button>
                  <button
                    className="btn btn-primary"
                    style={{ flex: 2 }}
                    disabled={!elected || saving}
                    onClick={startMatch}
                  >
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
