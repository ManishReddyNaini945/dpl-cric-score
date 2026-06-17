import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { makeEmptyInnings, addBatsmanToInnings } from '../utils/cricket';

const DEFAULT_OVERS = 6;
const DEFAULT_PLAYERS = 6;

function makePlayerArray(count) {
  return Array.from({ length: count }, (_, i) => `Player ${i + 1}`);
}

export default function NewMatch() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0); // 0=teams, 1=players, 2=toss
  const [saving, setSaving] = useState(false);

  const [team1, setTeam1] = useState('');
  const [team2, setTeam2] = useState('');
  const [overs, setOvers] = useState(DEFAULT_OVERS);
  const [playerCount, setPlayerCount] = useState(DEFAULT_PLAYERS);
  const [players1, setPlayers1] = useState(makePlayerArray(DEFAULT_PLAYERS));
  const [players2, setPlayers2] = useState(makePlayerArray(DEFAULT_PLAYERS));
  const [tossWinner, setTossWinner] = useState('');
  const [elected, setElected] = useState('');

  function handlePlayerChange(team, index, value) {
    if (team === 1) {
      const arr = [...players1];
      arr[index] = value;
      setPlayers1(arr);
    } else {
      const arr = [...players2];
      arr[index] = value;
      setPlayers2(arr);
    }
  }

  function handlePlayerCountChange(count) {
    setPlayerCount(count);
    setPlayers1(Array.from({ length: count }, (_, i) => players1[i] || `Player ${i + 1}`));
    setPlayers2(Array.from({ length: count }, (_, i) => players2[i] || `Player ${i + 1}`));
  }

  function canProceedStep0() {
    return team1.trim().length > 0 && team2.trim().length > 0;
  }

  function canProceedStep1() {
    return players1.every(p => p.trim()) && players2.every(p => p.trim());
  }

  function canProceedStep2() {
    return tossWinner !== '' && elected !== '';
  }

  async function startMatch() {
    if (!canProceedStep2() || saving) return;
    setSaving(true);

    const battingTeamKey = tossWinner === 'team1'
      ? (elected === 'bat' ? 'team1' : 'team2')
      : (elected === 'bat' ? 'team2' : 'team1');
    const bowlingTeamKey = battingTeamKey === 'team1' ? 'team2' : 'team1';

    const battingPlayers = battingTeamKey === 'team1' ? players1 : players2;

    let innings = makeEmptyInnings(battingTeamKey, bowlingTeamKey, playerCount);
    innings = addBatsmanToInnings(innings, battingPlayers[0]);
    innings = addBatsmanToInnings(innings, battingPlayers[1]);
    innings.striker = battingPlayers[0];
    innings.nonStriker = battingPlayers[1];

    const matchData = {
      meta: {
        team1: team1.trim(),
        team2: team2.trim(),
        players1,
        players2,
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
      alert('Error creating match. Check your Firebase config in src/firebase.js');
      console.error(err);
      setSaving(false);
    }
  }

  const stepLabels = ['Teams & Overs', 'Players', 'Toss'];

  return (
    <>
      <div className="app-header">
        <button className="back-btn" onClick={() => step === 0 ? navigate('/') : setStep(s => s - 1)}>←</button>
        <h1>New Match</h1>
      </div>

      <div className="page">
        {/* Step Indicator */}
        <div className="step-indicator">
          {stepLabels.map((label, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div className={`step-dot ${i < step ? 'done' : i === step ? 'active' : ''}`} />
              <span style={{ fontSize: '0.78rem', color: i === step ? 'var(--gold)' : 'var(--text-muted)' }}>
                {label}
              </span>
              {i < stepLabels.length - 1 && (
                <div style={{ width: 20, height: 1, background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />
              )}
            </div>
          ))}
        </div>

        {/* Step 0: Teams */}
        {step === 0 && (
          <div>
            <div className="form-group">
              <label>Team 1 Name</label>
              <input
                type="text"
                placeholder="e.g. DPL Warriors"
                value={team1}
                onChange={e => setTeam1(e.target.value)}
                autoFocus
              />
            </div>

            <div className="form-group">
              <label>Team 2 Name</label>
              <input
                type="text"
                placeholder="e.g. Office Strikers"
                value={team2}
                onChange={e => setTeam2(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Overs per Innings</label>
              <select value={overs} onChange={e => setOvers(Number(e.target.value))}>
                {[4, 5, 6, 7, 8, 10, 12].map(o => (
                  <option key={o} value={o}>{o} overs</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Players per Side</label>
              <select value={playerCount} onChange={e => handlePlayerCountChange(Number(e.target.value))}>
                {[4, 5, 6, 7, 8].map(n => (
                  <option key={n} value={n}>{n} players</option>
                ))}
              </select>
            </div>

            <button
              className="btn btn-primary btn-full mt-16"
              disabled={!canProceedStep0()}
              onClick={() => setStep(1)}
            >
              Next →
            </button>
          </div>
        )}

        {/* Step 1: Players */}
        {step === 1 && (
          <div>
            <div className="form-group">
              <label>{team1 || 'Team 1'} Players</label>
              <div className="players-grid">
                {players1.map((p, i) => (
                  <input
                    key={i}
                    className="player-input"
                    type="text"
                    placeholder={`Player ${i + 1}`}
                    value={p}
                    onChange={e => handlePlayerChange(1, i, e.target.value)}
                  />
                ))}
              </div>
            </div>

            <hr className="divider" />

            <div className="form-group">
              <label>{team2 || 'Team 2'} Players</label>
              <div className="players-grid">
                {players2.map((p, i) => (
                  <input
                    key={i}
                    className="player-input"
                    type="text"
                    placeholder={`Player ${i + 1}`}
                    value={p}
                    onChange={e => handlePlayerChange(2, i, e.target.value)}
                  />
                ))}
              </div>
            </div>

            <button
              className="btn btn-primary btn-full mt-16"
              disabled={!canProceedStep1()}
              onClick={() => setStep(2)}
            >
              Next →
            </button>
          </div>
        )}

        {/* Step 2: Toss */}
        {step === 2 && (
          <div>
            <div className="form-group">
              <label>Toss Won By</label>
              <div className="toss-options">
                <button
                  className={`toss-btn ${tossWinner === 'team1' ? 'selected' : ''}`}
                  onClick={() => setTossWinner('team1')}
                >
                  {team1}
                </button>
                <button
                  className={`toss-btn ${tossWinner === 'team2' ? 'selected' : ''}`}
                  onClick={() => setTossWinner('team2')}
                >
                  {team2}
                </button>
              </div>
            </div>

            {tossWinner && (
              <div className="form-group">
                <label>Elected To</label>
                <div className="toss-options">
                  <button
                    className={`toss-btn ${elected === 'bat' ? 'selected' : ''}`}
                    onClick={() => setElected('bat')}
                  >
                    🏏 Bat
                  </button>
                  <button
                    className={`toss-btn ${elected === 'bowl' ? 'selected' : ''}`}
                    onClick={() => setElected('bowl')}
                  >
                    🎳 Bowl
                  </button>
                </div>
              </div>
            )}

            {tossWinner && elected && (
              <div className="card mt-12" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                <span style={{ color: 'var(--gold)', fontWeight: 700 }}>
                  {tossWinner === 'team1' ? team1 : team2}
                </span>
                {' '}won the toss and elected to{' '}
                <span style={{ color: 'var(--gold)', fontWeight: 700 }}>{elected}</span> first
              </div>
            )}

            <button
              className="btn btn-primary btn-full mt-16"
              disabled={!canProceedStep2() || saving}
              onClick={startMatch}
            >
              {saving ? 'Starting…' : '🏏 Start Match!'}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
