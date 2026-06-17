import { useState } from 'react';

const DISMISSAL_TYPES = [
  { id: 'bowled', label: 'Bowled', needsFielder: false },
  { id: 'caught', label: 'Caught', needsFielder: true },
  { id: 'lbw', label: 'LBW', needsFielder: false },
  { id: 'runout', label: 'Run Out', needsFielder: true },
  { id: 'stumped', label: 'Stumped', needsFielder: true },
  { id: 'hitwicket', label: 'Hit Wicket', needsFielder: false },
];

export default function WicketModal({ innings, players, onConfirm, onCancel }) {
  const { striker, nonStriker, battingTeam } = innings;
  const availablePlayers = players.filter(p => !innings.battingOrder.includes(p));

  const [dismissedBatsman, setDismissedBatsman] = useState(striker);
  const [dismissalType, setDismissalType] = useState('');
  const [fielder, setFielder] = useState('');
  const [newBatsman, setNewBatsman] = useState(availablePlayers[0] || '');

  const allOut = innings.wickets + 1 >= innings.players - 1;
  const selectedDismissal = DISMISSAL_TYPES.find(d => d.id === dismissalType);

  function buildDismissal() {
    if (!selectedDismissal) return dismissalType;
    if (selectedDismissal.needsFielder && fielder) {
      if (dismissalType === 'caught') return `c ${fielder} b ${innings.bowler}`;
      if (dismissalType === 'stumped') return `st ${fielder} b ${innings.bowler}`;
      if (dismissalType === 'runout') return `run out (${fielder})`;
    }
    if (dismissalType === 'bowled') return `b ${innings.bowler}`;
    if (dismissalType === 'lbw') return `lbw b ${innings.bowler}`;
    if (dismissalType === 'hitwicket') return `hit wicket b ${innings.bowler}`;
    return dismissalType;
  }

  function canConfirm() {
    if (!dismissalType) return false;
    if (selectedDismissal?.needsFielder && !fielder.trim()) return false;
    if (!allOut && !newBatsman) return false;
    return true;
  }

  function handleConfirm() {
    onConfirm({
      batsman: dismissedBatsman,
      dismissal: buildDismissal(),
      newBatsman: allOut ? null : newBatsman,
    });
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="modal-sheet">
        <div className="modal-title">Wicket!</div>

        <div className="modal-section-label">Who is out?</div>
        <div className="option-list" style={{ flexDirection: 'row', gap: 8 }}>
          {[striker, nonStriker].map(b => (
            <button
              key={b}
              className={`option-btn ${dismissedBatsman === b ? 'selected' : ''}`}
              style={{ flex: 1 }}
              onClick={() => setDismissedBatsman(b)}
            >
              {b}{b === striker ? ' *' : ''}
            </button>
          ))}
        </div>

        <div className="modal-section-label">How?</div>
        <div className="dismissal-grid">
          {DISMISSAL_TYPES.map(d => (
            <button
              key={d.id}
              className={`option-btn ${dismissalType === d.id ? 'selected' : ''}`}
              onClick={() => setDismissalType(d.id)}
            >
              {d.label}
            </button>
          ))}
        </div>

        {selectedDismissal?.needsFielder && (
          <>
            <div className="modal-section-label">
              {dismissalType === 'caught' ? 'Caught by' :
               dismissalType === 'stumped' ? 'Stumped by' : 'Run out by'}
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <input
                type="text"
                placeholder="Fielder name"
                value={fielder}
                onChange={e => setFielder(e.target.value)}
              />
            </div>
          </>
        )}

        {!allOut && (
          <>
            <div className="modal-section-label">Next Batsman</div>
            <div className="option-list">
              {availablePlayers.length === 0 ? (
                <div className="text-muted text-center">No more batsmen</div>
              ) : (
                availablePlayers.map(p => (
                  <button
                    key={p}
                    className={`option-btn ${newBatsman === p ? 'selected' : ''}`}
                    onClick={() => setNewBatsman(p)}
                  >
                    {p}
                  </button>
                ))
              )}
            </div>
          </>
        )}

        {allOut && (
          <div className="card mt-12 text-center" style={{ color: 'var(--gold)' }}>
            All Out!
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onCancel}>
            Cancel
          </button>
          <button
            className="btn btn-danger"
            style={{ flex: 2 }}
            disabled={!canConfirm()}
            onClick={handleConfirm}
          >
            Confirm Wicket
          </button>
        </div>
      </div>
    </div>
  );
}
