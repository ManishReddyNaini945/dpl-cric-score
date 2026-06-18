import { useState } from 'react';

export default function BowlerSelectModal({ players, currentBowler, innings, maxOversPerBowler, onConfirm }) {
  const [selectedBowler, setSelectedBowler] = useState('');
  const [striker, setStriker] = useState(innings.striker);

  function bowlerOvers(name) {
    const b = innings.bowlers[name];
    return b ? Math.floor(b.balls / 6) : 0;
  }

  function isEligible(name) {
    return bowlerOvers(name) < maxOversPerBowler && name !== currentBowler;
  }

  function confirm() {
    if (!selectedBowler) return;
    onConfirm(selectedBowler, striker);
  }

  const batsmen = [innings.striker, innings.nonStriker].filter(Boolean);

  return (
    <div className="modal-overlay">
      <div className="modal-sheet" style={{ maxHeight: '85vh', overflowY: 'auto' }}>

        {/* Bowler selection */}
        <div className="modal-title">Select Next Bowler</div>
        <p className="text-muted text-center" style={{ marginBottom: 14, fontSize: '0.82rem' }}>
          Same bowler cannot bowl consecutive overs
        </p>
        <div className="option-list" style={{ marginBottom: 20 }}>
          {players.map(p => {
            const overs = bowlerOvers(p);
            const eligible = isEligible(p);
            const b = innings.bowlers[p];
            return (
              <button
                key={p}
                className={`option-btn ${selectedBowler === p ? 'selected' : ''} ${!eligible ? 'disabled' : ''}`}
                style={{ opacity: eligible ? 1 : 0.4 }}
                disabled={!eligible}
                onClick={() => setSelectedBowler(p)}
              >
                <span style={{ fontWeight: 600 }}>{p}</span>
                {b && (
                  <span style={{ float: 'right', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    {Math.floor(b.balls / 6)}.{b.balls % 6} ov · {b.runs} runs · {b.wickets}W
                  </span>
                )}
                {p === currentBowler && (
                  <span style={{ float: 'right', color: 'var(--danger-light)', fontSize: '0.78rem' }}>
                    {' '}(prev over)
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Striker selection */}
        {batsmen.length === 2 && (
          <>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', marginBottom: 8 }}>
              🏏 Who's on strike?
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              {batsmen.map(name => (
                <button
                  key={name}
                  onClick={() => setStriker(name)}
                  style={{
                    flex: 1, padding: '10px 8px', borderRadius: 10, cursor: 'pointer',
                    border: `2px solid ${striker === name ? 'var(--accent)' : 'rgba(255,255,255,0.1)'}`,
                    background: striker === name ? 'rgba(56,189,248,0.12)' : 'var(--surface)',
                    color: striker === name ? 'var(--accent)' : 'var(--white)',
                    fontWeight: 700, fontSize: '0.88rem', textAlign: 'center',
                  }}
                >
                  {name}
                  {striker === name && <div style={{ fontSize: '0.65rem', color: 'var(--accent)', marginTop: 2 }}>On Strike ●</div>}
                </button>
              ))}
            </div>
          </>
        )}

        <button
          className="btn btn-primary btn-full"
          disabled={!selectedBowler}
          onClick={confirm}
        >
          Confirm
        </button>
      </div>
    </div>
  );
}
