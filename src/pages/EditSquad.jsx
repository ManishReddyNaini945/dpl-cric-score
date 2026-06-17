import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, onSnapshot, updateDoc, collection, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { RoleBadge } from './Players';
import { useAuth } from '../context/AuthContext';

const ROLE_ORDER = { batsman: 0, allrounder: 1, bowler: 2 };

function autoBalance(players) {
  const byRole = {
    batsman:    players.filter(p => p.role === 'batsman').sort(() => Math.random() - 0.5),
    allrounder: players.filter(p => p.role === 'allrounder').sort(() => Math.random() - 0.5),
    bowler:     players.filter(p => p.role === 'bowler').sort(() => Math.random() - 0.5),
  };
  const team1 = [], team2 = [];
  Object.values(byRole).forEach(group => {
    group.forEach((p, i) => (i % 2 === 0 ? team1 : team2).push(p));
  });
  while (team1.length > team2.length + 1) team2.push(team1.pop());
  while (team2.length > team1.length + 1) team1.push(team2.pop());
  return { team1, team2 };
}

export default function EditSquad() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  const [match, setMatch] = useState(null);
  const [allPlayers, setAllPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Step 0 = select players, Step 1 = review/assign teams
  const [step, setStep] = useState(0);
  const [selectedIds, setSelectedIds] = useState([]);
  const [team1, setTeam1] = useState([]);
  const [team2, setTeam2] = useState([]);
  const [captain1, setCaptain1] = useState('');
  const [vc1, setVc1] = useState('');
  const [captain2, setCaptain2] = useState('');
  const [vc2, setVc2] = useState('');
  const [swapFrom, setSwapFrom] = useState(null);
  const [swapError, setSwapError] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'matches', id), snap => {
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() };
        setMatch(data);
        // Pre-select current players
        setLoading(false);
      }
    });
    return unsub;
  }, [id]);

  useEffect(() => {
    const q = query(collection(db, 'players'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, snap => {
      setAllPlayers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  // Pre-fill selections from current match when data loads
  useEffect(() => {
    if (!match || !allPlayers.length) return;
    const meta = match.meta || {};
    const currentNames = [...(meta.players1 || []), ...(meta.players2 || [])];
    const ids = allPlayers.filter(p => currentNames.includes(p.name)).map(p => p.id);
    setSelectedIds(ids);

    // Pre-fill teams
    const t1 = allPlayers.filter(p => (meta.players1 || []).includes(p.name));
    const t2 = allPlayers.filter(p => (meta.players2 || []).includes(p.name));
    setTeam1(t1);
    setTeam2(t2);
    setCaptain1(allPlayers.find(p => p.name === meta.captain1)?.id || '');
    setVc1(allPlayers.find(p => p.name === meta.vc1)?.id || '');
    setCaptain2(allPlayers.find(p => p.name === meta.captain2)?.id || '');
    setVc2(allPlayers.find(p => p.name === meta.vc2)?.id || '');
  }, [match?.id, allPlayers.length]);

  if (!isAdmin) return null;
  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh', color: 'var(--text-muted)' }}>Loading…</div>;
  if (!match || match.meta?.status !== 'upcoming') {
    navigate('/'); return null;
  }

  const meta = match.meta;
  const sortedPlayers = [...allPlayers].sort((a, b) => (ROLE_ORDER[a.role] ?? 3) - (ROLE_ORDER[b.role] ?? 3));

  function toggleSelect(id) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function doBalance() {
    const selected = allPlayers.filter(p => selectedIds.includes(p.id));
    const { team1, team2 } = autoBalance(selected);
    setTeam1(team1); setTeam2(team2);
    setCaptain1(''); setVc1(''); setCaptain2(''); setVc2('');
    setSwapFrom(null);
    setStep(1);
  }

  function isCaptainOrVC(pid) { return [captain1, vc1, captain2, vc2].includes(pid); }

  function handleTap(player, fromTeam) {
    setSwapError('');
    if (isCaptainOrVC(player.id)) {
      setSwapError(`${player.name} is C/VC — remove role first`);
      setSwapFrom(null); return;
    }
    if (!swapFrom) { setSwapFrom({ player, fromTeam }); return; }
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

  function cycleRole(playerId, teamNum) {
    const cap = teamNum === 1 ? captain1 : captain2;
    const vc  = teamNum === 1 ? vc1 : vc2;
    const setCap = teamNum === 1 ? setCaptain1 : setCaptain2;
    const setVc  = teamNum === 1 ? setVc1 : setVc2;
    if (cap === playerId) { setCap(''); setVc(playerId); }
    else if (vc === playerId) { setVc(''); }
    else { if (cap) setVc(playerId); else setCap(playerId); }
  }

  function getBadge(pid, teamNum) {
    if ((teamNum === 1 ? captain1 : captain2) === pid) return 'C';
    if ((teamNum === 1 ? vc1 : vc2) === pid) return 'VC';
    return null;
  }

  async function saveSquad() {
    if (saving) return;
    setSaving(true);
    const p1 = team1, p2 = team2;
    try {
      await updateDoc(doc(db, 'matches', id), {
        'meta.players1': p1.map(p => p.name),
        'meta.players2': p2.map(p => p.name),
        'meta.playerRoles1': Object.fromEntries(p1.map(p => [p.name, p.role])),
        'meta.playerRoles2': Object.fromEntries(p2.map(p => [p.name, p.role])),
        'meta.captain1': p1.find(p => p.id === captain1)?.name || '',
        'meta.vc1': p1.find(p => p.id === vc1)?.name || '',
        'meta.captain2': p2.find(p => p.id === captain2)?.name || '',
        'meta.vc2': p2.find(p => p.id === vc2)?.name || '',
        'meta.playerCount': Math.max(p1.length, p2.length),
      });
      navigate('/');
    } catch (err) { console.error(err); alert('Error saving squad.'); }
    setSaving(false);
  }

  return (
    <>
      <div className="app-header">
        <button className="back-btn" onClick={() => step === 0 ? navigate('/') : setStep(0)}>←</button>
        <h1>Edit Squad</h1>
      </div>

      <div className="page">
        <div style={{ marginBottom: 12, padding: '8px 12px', background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 8 }}>
          <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{meta.team1} vs {meta.team2}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>{meta.overs} overs · Upcoming</div>
        </div>

        {/* ── Step 0: Select Players ── */}
        {step === 0 && (
          <div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 700 }}>Select Players</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>{selectedIds.length} selected</div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <button className="btn btn-secondary" style={{ flex: 1, fontSize: '0.82rem', padding: '8px' }} onClick={() => setSelectedIds(allPlayers.map(p => p.id))}>Select All</button>
              <button className="btn btn-secondary" style={{ flex: 1, fontSize: '0.82rem', padding: '8px' }} onClick={() => setSelectedIds([])}>Clear</button>
            </div>
            {sortedPlayers.map(p => {
              const sel = selectedIds.includes(p.id);
              return (
                <div key={p.id} onClick={() => toggleSelect(p.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '11px 14px', borderRadius: 10, marginBottom: 8,
                  border: `2px solid ${sel ? 'var(--accent)' : 'rgba(255,255,255,0.07)'}`,
                  background: sel ? 'rgba(56,189,248,0.08)' : 'var(--card-bg)',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                    background: sel ? 'var(--accent)' : 'var(--surface)',
                    color: sel ? '#0c1a28' : 'var(--white)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, fontSize: '0.9rem',
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
            <button
              className="btn btn-primary btn-full mt-16"
              disabled={selectedIds.length < 4 || selectedIds.length % 2 !== 0}
              onClick={doBalance}
            >
              {selectedIds.length < 4 ? `Select at least 4 (${selectedIds.length} selected)`
                : selectedIds.length % 2 !== 0 ? `Need even number (${selectedIds.length})`
                : `⚡ Auto-Balance ${selectedIds.length} Players →`}
            </button>
          </div>
        )}

        {/* ── Step 1: Review Teams ── */}
        {step === 1 && (
          <div>
            {swapError && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid var(--danger)', borderRadius: 10, padding: '8px 14px', marginBottom: 10, fontSize: '0.82rem', color: 'var(--danger-light)', display: 'flex', justifyContent: 'space-between' }}>
                <span>🔒 {swapError}</span>
                <button onClick={() => setSwapError('')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>✕</button>
              </div>
            )}
            {swapFrom && !swapError && (
              <div style={{ background: 'rgba(56,189,248,0.12)', border: '1px solid var(--accent)', borderRadius: 10, padding: '8px 14px', marginBottom: 10, fontSize: '0.82rem', color: 'var(--accent)', display: 'flex', justifyContent: 'space-between' }}>
                <span>Tap another player to swap with <strong>{swapFrom.player.name}</strong></span>
                <button onClick={() => setSwapFrom(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>✕</button>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              {/* Team 1 */}
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--accent)', marginBottom: 8, padding: '6px 10px', background: 'rgba(56,189,248,0.1)', borderRadius: 8, textAlign: 'center' }}>
                  {meta.team1} ({team1.length})
                </div>
                {team1.map(p => {
                  const badge = getBadge(p.id, 1);
                  const sel = swapFrom?.player.id === p.id;
                  return (
                    <div key={p.id} style={{ padding: '9px 10px', borderRadius: 8, marginBottom: 6, border: `1.5px solid ${sel ? 'var(--accent)' : badge ? 'rgba(250,204,21,0.4)' : 'rgba(255,255,255,0.08)'}`, background: sel ? 'rgba(56,189,248,0.15)' : badge ? 'rgba(250,204,21,0.06)' : 'var(--card-bg)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', flex: 1 }} onClick={() => handleTap(p, 1)}>{p.name}</div>
                        <button onClick={() => cycleRole(p.id, 1)} style={{ minWidth: 28, height: 22, borderRadius: 6, fontSize: '0.68rem', fontWeight: 800, border: `1.5px solid ${badge === 'C' ? '#facc15' : badge === 'VC' ? '#94a3b8' : 'rgba(255,255,255,0.15)'}`, background: badge === 'C' ? 'rgba(250,204,21,0.15)' : badge === 'VC' ? 'rgba(148,163,184,0.12)' : 'transparent', color: badge === 'C' ? '#facc15' : badge === 'VC' ? '#94a3b8' : 'rgba(255,255,255,0.25)', cursor: 'pointer', padding: '0 4px' }}>{badge || 'C'}</button>
                      </div>
                      <RoleBadge role={p.role} small />
                    </div>
                  );
                })}
              </div>

              {/* Team 2 */}
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#a78bfa', marginBottom: 8, padding: '6px 10px', background: 'rgba(167,139,250,0.1)', borderRadius: 8, textAlign: 'center' }}>
                  {meta.team2} ({team2.length})
                </div>
                {team2.map(p => {
                  const badge = getBadge(p.id, 2);
                  const sel = swapFrom?.player.id === p.id;
                  return (
                    <div key={p.id} style={{ padding: '9px 10px', borderRadius: 8, marginBottom: 6, border: `1.5px solid ${sel ? '#a78bfa' : badge ? 'rgba(250,204,21,0.4)' : 'rgba(255,255,255,0.08)'}`, background: sel ? 'rgba(167,139,250,0.15)' : badge ? 'rgba(250,204,21,0.06)' : 'var(--card-bg)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', flex: 1 }} onClick={() => handleTap(p, 2)}>{p.name}</div>
                        <button onClick={() => cycleRole(p.id, 2)} style={{ minWidth: 28, height: 22, borderRadius: 6, fontSize: '0.68rem', fontWeight: 800, border: `1.5px solid ${badge === 'C' ? '#facc15' : badge === 'VC' ? '#94a3b8' : 'rgba(255,255,255,0.15)'}`, background: badge === 'C' ? 'rgba(250,204,21,0.15)' : badge === 'VC' ? 'rgba(148,163,184,0.12)' : 'transparent', color: badge === 'C' ? '#facc15' : badge === 'VC' ? '#94a3b8' : 'rgba(255,255,255,0.25)', cursor: 'pointer', padding: '0 4px' }}>{badge || 'C'}</button>
                      </div>
                      <RoleBadge role={p.role} small />
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { const s = allPlayers.filter(p => selectedIds.includes(p.id)); const b = autoBalance(s); setTeam1(b.team1); setTeam2(b.team2); setCaptain1(''); setVc1(''); setCaptain2(''); setVc2(''); setSwapFrom(null); }}>
                🔀 Reshuffle
              </button>
              <button className="btn btn-primary" style={{ flex: 2 }} disabled={saving} onClick={saveSquad}>
                {saving ? 'Saving…' : '✅ Save Squad'}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
