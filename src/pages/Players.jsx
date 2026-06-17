import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';

const ROLES = [
  { id: 'batsman',    label: 'Batsman',     short: 'BAT',      color: '#3498db' },
  { id: 'bowler',     label: 'Bowler',      short: 'BOWL',     color: '#2ecc71' },
  { id: 'allrounder', label: 'All-rounder', short: 'BAT+BOWL', color: '#f0a500' },
];

export function RoleBadge({ role, small }) {
  const r = ROLES.find(x => x.id === role) || ROLES[2];
  return (
    <span style={{
      background: r.color + '22',
      color: r.color,
      border: `1px solid ${r.color}55`,
      borderRadius: 20,
      padding: small ? '2px 8px' : '3px 10px',
      fontSize: small ? '0.68rem' : '0.75rem',
      fontWeight: 800,
      whiteSpace: 'nowrap',
      letterSpacing: '0.3px',
    }}>
      {small ? r.short : r.label}
    </span>
  );
}

export default function Players() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [role, setRole] = useState('batsman');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'players'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, snap => {
      setPlayers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, err => {
      console.error('Players load error:', err);
      setLoading(false);
    });
    return unsub;
  }, []);

  async function addPlayer() {
    if (!name.trim() || saving) return;
    setSaving(true);
    await addDoc(collection(db, 'players'), {
      name: name.trim(),
      role,
      createdAt: Date.now(),
    });
    setName('');
    setSaving(false);
  }

  async function removePlayer(id) {
    if (!window.confirm('Remove this player?')) return;
    await deleteDoc(doc(db, 'players', id));
  }

  const grouped = {
    batsman:    players.filter(p => p.role === 'batsman'),
    bowler:     players.filter(p => p.role === 'bowler'),
    allrounder: players.filter(p => p.role === 'allrounder'),
  };

  return (
    <>
      <div className="app-header">
        <button className="back-btn" onClick={() => navigate('/')}>←</button>
        <h1>Players</h1>
      </div>

      <div className="page">
        {/* Add Player — admin only */}
        {!isAdmin && (
          <div style={{
            padding: '12px 14px', marginBottom: 16,
            background: 'rgba(52,152,219,0.06)', borderRadius: 12,
            border: '1px solid rgba(52,152,219,0.15)',
            color: '#5dade2', fontSize: '0.82rem',
          }}>
            👁️ Viewer — Player list (read only)
          </div>
        )}
        {isAdmin && <div className="card mb-16">
          <div className="section-title" style={{ marginBottom: 12 }}>Add New Player</div>
          <div className="form-group">
            <label>Player Name</label>
            <input
              type="text"
              placeholder="Enter name"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addPlayer()}
            />
          </div>
          <div className="form-group">
            <label>Role</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {ROLES.map(r => (
                <button
                  key={r.id}
                  onClick={() => setRole(r.id)}
                  style={{
                    flex: 1,
                    padding: '10px 6px',
                    borderRadius: 8,
                    border: `2px solid ${role === r.id ? r.color : 'rgba(255,255,255,0.1)'}`,
                    background: role === r.id ? r.color + '22' : 'var(--surface)',
                    color: role === r.id ? r.color : 'var(--text-muted)',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    textAlign: 'center',
                  }}
                >
                  {r.short}<br /><span style={{ fontWeight: 400, fontSize: '0.72rem' }}>{r.label}</span>
                </button>
              ))}
            </div>
          </div>
          <button
            className="btn btn-primary btn-full"
            disabled={!name.trim() || saving}
            onClick={addPlayer}
          >
            {saving ? 'Adding…' : '+ Add Player'}
          </button>
        </div>}

        {loading ? (
          <div className="text-center text-muted">Loading…</div>
        ) : players.length === 0 ? (
          <div className="empty-state">
            <div className="icon">👤</div>
            <p>No players yet.<br />Add your team members above!</p>
          </div>
        ) : (
          ROLES.map(r => grouped[r.id].length > 0 && (
            <div key={r.id} style={{ marginBottom: 16 }}>
              <div className="section-title" style={{ color: r.color, marginBottom: 8 }}>
                {r.label}s ({grouped[r.id].length})
              </div>
              {grouped[r.id].map(p => (
                <div key={p.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', marginBottom: 8 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: r.color + '33', color: r.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, fontSize: '1rem', flexShrink: 0,
                  }}>
                    {p.name[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{p.name}</div>
                    <RoleBadge role={p.role} small />
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => removePlayer(p.id)}
                      style={{ background: 'none', border: 'none', color: 'var(--danger-light)', fontSize: '1.1rem', cursor: 'pointer', padding: 4 }}
                    >
                      🗑️
                    </button>
                  )}
                </div>
              ))}
            </div>
          ))
        )}

        <div style={{ height: 24 }} />
      </div>
    </>
  );
}
