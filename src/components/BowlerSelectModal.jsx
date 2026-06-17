import { useState } from 'react';

export default function BowlerSelectModal({ players, currentBowler, innings, maxOversPerBowler, onConfirm }) {
  const [selected, setSelected] = useState('');

  function bowlerOvers(name) {
    const b = innings.bowlers[name];
    if (!b) return 0;
    return Math.floor(b.balls / 6);
  }

  function isEligible(name) {
    return bowlerOvers(name) < maxOversPerBowler && name !== currentBowler;
  }

  return (
    <div className="modal-overlay">
      <div className="modal-sheet">
        <div className="modal-title">Select Next Bowler</div>
        <p className="text-muted text-center" style={{ marginBottom: 14, fontSize: '0.82rem' }}>
          Same bowler cannot bowl consecutive overs
        </p>

        <div className="option-list">
          {players.map(p => {
            const overs = bowlerOvers(p);
            const eligible = isEligible(p);
            const b = innings.bowlers[p];
            return (
              <button
                key={p}
                className={`option-btn ${selected === p ? 'selected' : ''} ${!eligible ? 'disabled' : ''}`}
                style={{ opacity: eligible ? 1 : 0.4 }}
                disabled={!eligible}
                onClick={() => setSelected(p)}
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

        <button
          className="btn btn-primary btn-full mt-16"
          disabled={!selected}
          onClick={() => onConfirm(selected)}
        >
          Confirm Bowler
        </button>
      </div>
    </div>
  );
}
