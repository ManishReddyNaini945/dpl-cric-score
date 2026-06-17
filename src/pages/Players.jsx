import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';

const ROLES = [
  { id: 'batsman',    label: 'Batsman',     short: 'BAT',  color: '#3498db' },
  { id: 'bowler',     label: 'Bowler',      short: 'BOWL', color: '#2ecc71' },
  { id: 'allrounder', label: 'All-rounder', short: 'AR',   color: '#f0a500' },
];

export function RoleBadge({ role, small }) {
  const r = ROLES.find(x => x.id === role) || ROLES[2];
  return (
    <span style={{
      background: r.color + '22',
      color: r.color,
      border: `1px solid ${r.color}55`,
      borderRadius: 4,
      padding: small ? '1px 6px' : '2px 8px',
      fontSize: small ? '0.68rem' : '0.75rem',
      fontWeight: 800,
      whiteSpace: 'nowrap',
      letterSpacing: '0.5px',
      textTransform: 'uppercase',
    }}>
      {small ? r.short : r.label}
    </span>
  );
}

function RoleAccordion({ grouped, isAdmin, removePlayer }) {
  const [open, setOpen] = useState(() => ROLES.reduce((acc, r) => ({ ...acc, [r.id]: true }), {}));

  function toggle(id) {
    setOpen(prev => ({ ...prev, [id]: !prev[id] }));
  }

  return ROLES.map(r => grouped[r.id].length > 0 && (
    <div key={r.id} style={{ marginBottom: 10 }}>
      <button
        onClick={() => toggle(r.id)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          background: r.color + '11', border: `1px solid ${r.color}33`,
          borderRadius: open[r.id] ? '10px 10px 0 0' : 10,
          padding: '10px 14px', cursor: 'pointer', transition: 'border-radius 0.2s',
        }}
      >
        <span style={{ color: r.color, fontWeight: 800, fontSize: '0.78rem', letterSpacing: '0.5px' }}>
          {r.short}
        </span>
        <span style={{ color: r.color, fontWeight: 700, fontSize: '0.78rem', flex: 1, textAlign: 'left' }}>
          {r.label}s
        </span>
        <span style={{ background: r.color + '22', color: r.color, borderRadius: 20, padding: '1px 9px', fontSize: '0.72rem', fontWeight: 800 }}>
          {grouped[r.id].length}
        </span>
        <span style={{ color: r.color, fontSize: '0.75rem', marginLeft: 4, transition: 'transform 0.2s', display: 'inline-block', transform: open[r.id] ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
      </button>

      {open[r.id] && (
        <div style={{ border: `1px solid ${r.color}22`, borderTop: 'none', borderRadius: '0 0 10px 10px', overflow: 'hidden' }}>
          {grouped[r.id].map((p, idx) => (
            <div key={p.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px',
              background: idx % 2 === 0 ? 'var(--card-bg)' : 'rgba(255,255,255,0.02)',
              borderTop: idx > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none',
            }}>
              <div style={{
                width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                background: r.color + '22', color: r.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: '0.9rem',
              }}>
                {p.name[0].toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{p.name}</div>
              </div>
              {isAdmin && (
                <button onClick={() => removePlayer(p.id)} style={{ background: 'none', border: 'none', color: 'var(--danger-light)', fontSize: '1rem', cursor: 'pointer', padding: 4 }}>
                  🗑️
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  ));
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
                  <span style={{ fontWeight: 800, fontSize: '0.85rem' }}>{r.short}</span><br /><span style={{ fontWeight: 400, fontSize: '0.7rem' }}>{r.label}</span>
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
          <RoleAccordion grouped={grouped} isAdmin={isAdmin} removePlayer={removePlayer} />
        )}

        <div style={{ height: 24 }} />
      </div>
    </>
  );
}
