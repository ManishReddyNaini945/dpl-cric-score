import { useMemo, useState } from 'react';

function calcOverRuns(deliveries, totalOvers) {
  const overs = Array(totalOvers).fill(null);
  for (const d of deliveries) {
    if (d.overIndex >= totalOvers) continue;
    if (overs[d.overIndex] === null) overs[d.overIndex] = 0;
    const runs = d.type === 'wide' ? 1 + d.runs : d.type === 'noball' ? 1 + d.runs : d.runs;
    overs[d.overIndex] += runs;
  }
  return overs;
}

function barColor(runs) {
  if (runs == null) return 'rgba(255,255,255,0.06)';
  if (runs >= 12) return '#a855f7';
  if (runs >= 9)  return '#22c55e';
  if (runs >= 6)  return '#38bdf8';
  if (runs >= 4)  return '#f59e0b';
  return '#f87171';
}

export default function MatchInsights({ innings, meta, target, inn1 }) {
  const [collapsed, setCollapsed] = useState(false);
  const totalBalls = meta.overs * 6;
  const isSecondInnings = target != null;

  const overRuns = useMemo(
    () => calcOverRuns(innings.deliveries || [], meta.overs),
    [innings.deliveries, meta.overs]
  );

  const currentOverIdx = Math.floor(innings.legalBalls / 6);
  const ballInOver   = innings.legalBalls % 6;
  const maxBarVal    = Math.max(...overRuns.filter(v => v != null), 1);

  // Run rates
  const crr = innings.legalBalls > 0 ? (innings.runs / innings.legalBalls) * 6 : 0;
  const ballsLeft   = totalBalls - innings.legalBalls;
  const runsNeeded  = isSecondInnings ? target - innings.runs : 0;
  const rrr = isSecondInnings && ballsLeft > 0 && runsNeeded > 0
    ? (runsNeeded / ballsLeft) * 6 : 0;

  // Projected score (1st innings)
  const projected    = innings.runs + Math.round((crr / 6) * ballsLeft);
  const projLow      = Math.max(0, projected - 5);
  const projHigh     = projected + 5;

  // Win probability (2nd innings)
  let winProb = 50;
  if (isSecondInnings && innings.legalBalls > 0) {
    const rateDiff = (crr - rrr) * 5;
    const wktPenalty = innings.wickets * 5;
    winProb = Math.round(Math.min(95, Math.max(5, 50 + rateDiff - wktPenalty)));
  }
  if (isSecondInnings && runsNeeded <= 0) winProb = 95;

  // Momentum
  const completedOvers = overRuns.filter((v, i) => v != null && i < currentOverIdx);
  const avgRPO = completedOvers.length
    ? completedOvers.reduce((a, b) => a + b, 0) / completedOvers.length : 0;
  const last3  = completedOvers.slice(-3);
  const last3Avg = last3.length ? last3.reduce((a, b) => a + b, 0) / last3.length : 0;

  let momentumLabel, momentumBg, momentumFg, momentumIcon;
  if (completedOvers.length < 2) {
    momentumLabel = 'Building'; momentumBg = 'rgba(148,163,184,0.1)'; momentumFg = '#94a3b8'; momentumIcon = '➔';
  } else if (last3Avg >= avgRPO * 1.25) {
    momentumLabel = 'Surging';         momentumBg = 'rgba(34,197,94,0.1)';  momentumFg = '#22c55e'; momentumIcon = '🔥';
  } else if (last3Avg >= avgRPO * 0.8) {
    momentumLabel = 'Steady';          momentumBg = 'rgba(56,189,248,0.1)'; momentumFg = '#38bdf8'; momentumIcon = '✅';
  } else {
    momentumLabel = 'Under Pressure';  momentumBg = 'rgba(248,113,113,0.1)'; momentumFg = '#f87171'; momentumIcon = '⚠️';
  }

  // Top bat & top bowler
  const batEntries  = Object.entries(innings.batsmen || {});
  const topBat      = batEntries.sort(([, a], [, b]) => b.runs - a.runs)[0];
  const bowlEntries = Object.entries(innings.bowlers || {});
  const topBowl     = bowlEntries
    .filter(([, b]) => b.wickets > 0 || b.balls > 0)
    .sort(([, a], [, b]) => b.wickets - a.wickets || a.runs - b.runs)[0];

  const battingTeamName  = innings.battingTeam  === 'team1' ? meta.team1 : meta.team2;
  const bowlingTeamName  = innings.bowlingTeam  === 'team1' ? meta.team1 : meta.team2;

  return (
    <div style={{
      margin: '10px 0',
      borderRadius: 16,
      overflow: 'hidden',
      border: '1px solid rgba(56,189,248,0.12)',
      background: 'linear-gradient(160deg, #0f1f30 0%, #131c2b 100%)',
      boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
    }}>

      {/* Header */}
      <button
        onClick={() => setCollapsed(c => !c)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          padding: '9px 14px',
          background: 'linear-gradient(90deg, rgba(56,189,248,0.09) 0%, rgba(139,92,246,0.06) 100%)',
          borderBottom: collapsed ? 'none' : '1px solid rgba(255,255,255,0.06)',
          border: 'none', cursor: 'pointer',
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e', flexShrink: 0 }} />
        <span style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '1.2px', textTransform: 'uppercase', color: '#38bdf8' }}>
          Match Insights
        </span>
        <span style={{ marginLeft: 'auto', fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', fontWeight: 600, letterSpacing: '0.5px' }}>
          LIVE
        </span>
        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.65rem', marginLeft: 6, transform: collapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
      </button>

      {!collapsed && (
        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* ── Win Probability (2nd innings) ─────────────────────── */}
          {isSecondInnings ? (
            <div>
              <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 9 }}>
                Win Probability
              </div>

              {/* Batting team bar */}
              <div style={{ marginBottom: 7 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#38bdf8' }}>{battingTeamName}</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 900, color: winProb >= 50 ? '#22c55e' : '#f87171' }}>{winProb}%</span>
                </div>
                <div style={{ height: 9, borderRadius: 6, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${winProb}%`, borderRadius: 6, transition: 'width 0.6s ease',
                    background: winProb >= 60
                      ? 'linear-gradient(90deg,#16a34a,#4ade80)'
                      : winProb >= 40
                      ? 'linear-gradient(90deg,#d97706,#fbbf24)'
                      : 'linear-gradient(90deg,#dc2626,#f87171)',
                    boxShadow: winProb >= 60 ? '0 0 10px rgba(34,197,94,0.4)' : winProb >= 40 ? '0 0 10px rgba(251,191,36,0.4)' : '0 0 10px rgba(248,113,113,0.4)',
                  }} />
                </div>
              </div>

              {/* Bowling team bar */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#a78bfa' }}>{bowlingTeamName}</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 900, color: (100 - winProb) >= 50 ? '#22c55e' : '#f87171' }}>{100 - winProb}%</span>
                </div>
                <div style={{ height: 9, borderRadius: 6, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${100 - winProb}%`, borderRadius: 6, transition: 'width 0.6s ease',
                    background: (100 - winProb) >= 60
                      ? 'linear-gradient(90deg,#16a34a,#4ade80)'
                      : (100 - winProb) >= 40
                      ? 'linear-gradient(90deg,#d97706,#fbbf24)'
                      : 'linear-gradient(90deg,#dc2626,#f87171)',
                    boxShadow: (100 - winProb) >= 60 ? '0 0 10px rgba(34,197,94,0.4)' : (100 - winProb) >= 40 ? '0 0 10px rgba(251,191,36,0.4)' : '0 0 10px rgba(248,113,113,0.4)',
                  }} />
                </div>
              </div>

              {/* Stats pills */}
              {runsNeeded > 0 ? (
                <div style={{ display: 'flex', gap: 6 }}>
                  {[
                    { label: 'Need',      value: runsNeeded,                  color: '#f87171' },
                    { label: 'RRR',       value: rrr.toFixed(1),              color: rrr > crr ? '#f87171' : '#22c55e' },
                    { label: 'CRR',       value: crr.toFixed(1),              color: '#38bdf8' },
                    { label: 'Balls',     value: ballsLeft,                   color: '#a78bfa' },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ flex: 1, textAlign: 'center', padding: '7px 4px', background: 'rgba(255,255,255,0.04)', borderRadius: 9, border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ fontSize: '0.95rem', fontWeight: 900, color }}>{value}</div>
                      <div style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 1 }}>{label}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', fontWeight: 800, color: '#22c55e', fontSize: '0.95rem' }}>
                  🎉 Target achieved!
                </div>
              )}
            </div>

          ) : (
            /* ── Projected score (1st innings) ──────────────────── */
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{
                flex: 3, padding: '10px 12px',
                background: 'linear-gradient(135deg, rgba(56,189,248,0.1) 0%, rgba(139,92,246,0.06) 100%)',
                borderRadius: 12, border: '1px solid rgba(56,189,248,0.18)',
              }}>
                <div style={{ fontSize: '0.6rem', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 3 }}>Projected Score</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#fff', lineHeight: 1 }}>{projLow}–{projHigh}</div>
                <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>based on current CRR</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 2 }}>
                <div style={{ flex: 1, padding: '7px 10px', background: 'rgba(139,92,246,0.1)', borderRadius: 10, border: '1px solid rgba(139,92,246,0.18)', textAlign: 'center' }}>
                  <div style={{ fontSize: '1rem', fontWeight: 900, color: '#a78bfa' }}>{crr.toFixed(2)}</div>
                  <div style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>CRR</div>
                </div>
                <div style={{ flex: 1, padding: '7px 10px', background: 'rgba(250,204,21,0.08)', borderRadius: 10, border: '1px solid rgba(250,204,21,0.18)', textAlign: 'center' }}>
                  <div style={{ fontSize: '1rem', fontWeight: 900, color: '#facc15' }}>{innings.wickets}</div>
                  <div style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Wickets</div>
                </div>
              </div>
            </div>
          )}

          {/* ── Over-by-over bar chart ──────────────────────────── */}
          <div>
            <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>
              Over by Over
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 60 }}>
              {Array.from({ length: meta.overs }).map((_, i) => {
                const runs   = overRuns[i];
                const done   = runs != null && i < currentOverIdx;
                const active = i === currentOverIdx && ballInOver > 0;
                const bc     = barColor(done || active ? runs : null);
                const barH   = done || active ? Math.max(5, (runs / maxBarVal) * 46) : 0;

                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
                    <div style={{ position: 'relative', width: '100%', height: 48, display: 'flex', alignItems: 'flex-end' }}>
                      {/* run label above bar */}
                      {(done || active) && (
                        <div style={{
                          position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                          fontSize: '0.6rem', fontWeight: 800, color: bc, whiteSpace: 'nowrap',
                        }}>
                          {runs}
                        </div>
                      )}
                      {/* bar */}
                      <div style={{
                        width: '100%', height: done || active ? barH : 4, borderRadius: '4px 4px 0 0',
                        background: done
                          ? bc
                          : active
                          ? `repeating-linear-gradient(45deg, ${bc}66, ${bc}66 3px, transparent 3px, transparent 6px)`
                          : 'rgba(255,255,255,0.05)',
                        border: active ? `1px solid ${bc}88` : 'none',
                        boxShadow: done ? `0 0 8px ${bc}55` : 'none',
                        transition: 'height 0.3s ease',
                      }} />
                    </div>
                    {/* over number */}
                    <div style={{
                      fontSize: '0.58rem', marginTop: 3, fontWeight: active ? 700 : 400,
                      color: active ? bc : done ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.15)',
                    }}>
                      {i + 1}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bar legend */}
            <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
              {[['12+', '#a855f7'], ['9+', '#22c55e'], ['6+', '#38bdf8'], ['4+', '#f59e0b'], ['<4', '#f87171']].map(([label, color]) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
                  <span style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.3)' }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Momentum + Top performers ───────────────────────── */}
          <div style={{ display: 'flex', gap: 8 }}>

            {/* Momentum */}
            <div style={{ flex: 1, padding: '9px 10px', background: momentumBg, borderRadius: 12, border: `1px solid ${momentumFg}28` }}>
              <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>Momentum</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: momentumFg }}>{momentumIcon} {momentumLabel}</div>
              {last3.length > 0 && (
                <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.3)', marginTop: 3 }}>
                  Last {last3.length} ov: <strong style={{ color: momentumFg }}>{last3.reduce((a, b) => a + b, 0)}</strong> runs
                </div>
              )}
            </div>

            {/* Top bat */}
            {topBat && (
              <div style={{ flex: 1, padding: '9px 10px', background: 'rgba(250,204,21,0.07)', borderRadius: 12, border: '1px solid rgba(250,204,21,0.18)' }}>
                <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>Top Bat</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#facc15', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{topBat[0]}</div>
                <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.3)', marginTop: 3 }}>
                  {topBat[1].runs}<span style={{ color: 'rgba(255,255,255,0.2)' }}>({topBat[1].balls})</span>
                  {topBat[1].fours > 0 && <> · <span style={{ color: '#38bdf8' }}>{topBat[1].fours}×4</span></>}
                  {topBat[1].sixes > 0 && <> · <span style={{ color: '#22c55e' }}>{topBat[1].sixes}×6</span></>}
                </div>
              </div>
            )}

            {/* Top bowler */}
            {!topBat && topBowl && (
              <div style={{ flex: 1, padding: '9px 10px', background: 'rgba(34,197,94,0.07)', borderRadius: 12, border: '1px solid rgba(34,197,94,0.18)' }}>
                <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>Best Bowl</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#4ade80', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{topBowl[0]}</div>
                <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.3)', marginTop: 3 }}>
                  {topBowl[1].wickets}W · {Math.floor(topBowl[1].balls / 6)}.{topBowl[1].balls % 6} ov · {topBowl[1].runs}R
                </div>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
