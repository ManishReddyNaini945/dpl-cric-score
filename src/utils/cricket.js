export function formatOvers(legalBalls) {
  const overs = Math.floor(legalBalls / 6);
  const balls = legalBalls % 6;
  return `${overs}.${balls}`;
}

export function getRunRate(runs, legalBalls) {
  if (legalBalls === 0) return '0.00';
  return ((runs / legalBalls) * 6).toFixed(2);
}

export function getRequiredRunRate(target, runs, legalBalls, totalLegalBalls) {
  const needed = target - runs;
  const left = totalLegalBalls - legalBalls;
  if (left <= 0) return '-';
  if (needed <= 0) return '0.00';
  return ((needed / left) * 6).toFixed(2);
}

export function isInningsComplete(innings, maxOvers, target = null) {
  const maxWickets = innings.players - 1;
  const maxBalls = maxOvers * 6;
  if (target !== null && innings.runs >= target) return true;
  return innings.wickets >= maxWickets || innings.legalBalls >= maxBalls;
}

export function getCurrentOverBalls(deliveries, currentOverIndex) {
  return deliveries.filter(d => d.overIndex === currentOverIndex);
}

export function ballLabel(delivery) {
  if (delivery.isWicket) return 'W';
  if (delivery.type === 'wide') return `Wd${delivery.runs > 1 ? '+' + (delivery.runs - 1) : ''}`;
  if (delivery.type === 'noball') return `Nb${delivery.runs > 0 ? '+' + delivery.runs : ''}`;
  if (delivery.type === 'bye') return `B${delivery.runs}`;
  if (delivery.type === 'legbye') return `Lb${delivery.runs}`;
  return String(delivery.runs);
}

export function ballClass(delivery) {
  if (delivery.isWicket) return 'ball-wicket';
  if (delivery.type === 'wide' || delivery.type === 'noball') return 'ball-extra';
  if (delivery.runs === 4) return 'ball-four';
  if (delivery.runs === 6) return 'ball-six';
  return 'ball-normal';
}

export function makeEmptyInnings(battingTeam, bowlingTeam, players) {
  return {
    battingTeam,
    bowlingTeam,
    runs: 0,
    wickets: 0,
    legalBalls: 0,
    players,
    extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0 },
    deliveries: [],
    batsmen: {},
    bowlers: {},
    striker: '',
    nonStriker: '',
    bowler: '',
    battingOrder: [],
    complete: false,
  };
}

export function addBatsmanToInnings(innings, name) {
  return {
    ...innings,
    batsmen: {
      ...innings.batsmen,
      [name]: { runs: 0, balls: 0, fours: 0, sixes: 0, out: false, dismissal: '' },
    },
    battingOrder: [...innings.battingOrder, name],
  };
}

export function ensureBowler(innings, name) {
  if (innings.bowlers[name]) return innings;
  return {
    ...innings,
    bowlers: {
      ...innings.bowlers,
      [name]: { balls: 0, runs: 0, wickets: 0, wides: 0, noBalls: 0 },
    },
  };
}

export function applyDelivery(innings, delivery) {
  let updated = { ...innings };
  const { type, runs, isWicket, wicket, overIndex } = delivery;

  const isLegal = type === 'normal' || type === 'bye' || type === 'legbye';
  const totalRuns =
    type === 'wide' ? 1 + runs :
    type === 'noball' ? 1 + runs :
    runs;

  // Update innings totals
  updated.runs += totalRuns;
  if (isLegal) updated.legalBalls += 1;

  // Extras
  if (type === 'wide') updated.extras = { ...updated.extras, wides: updated.extras.wides + 1 + runs };
  if (type === 'noball') updated.extras = { ...updated.extras, noBalls: updated.extras.noBalls + 1 };
  if (type === 'bye') updated.extras = { ...updated.extras, byes: updated.extras.byes + runs };
  if (type === 'legbye') updated.extras = { ...updated.extras, legByes: updated.extras.legByes + runs };

  // Update striker stats (only on normal/noball)
  if (type === 'normal' || type === 'noball') {
    const batter = { ...updated.batsmen[updated.striker] };
    batter.balls += (type === 'normal' ? 1 : 1);
    batter.runs += runs;
    if (runs === 4) batter.fours += 1;
    if (runs === 6) batter.sixes += 1;
    updated.batsmen = { ...updated.batsmen, [updated.striker]: batter };
  } else if (type === 'bye' || type === 'legbye') {
    const batter = { ...updated.batsmen[updated.striker] };
    batter.balls += 1;
    updated.batsmen = { ...updated.batsmen, [updated.striker]: batter };
  }

  // Update bowler stats
  const bowler = { ...updated.bowlers[updated.bowler] };
  bowler.runs += totalRuns;
  if (type === 'wide') bowler.wides += 1;
  else if (type === 'noball') bowler.noBalls += 1;
  else bowler.balls += 1;

  // Wicket handling
  if (isWicket) {
    updated.wickets += 1;
    bowler.wickets += 1;
    const dismissed = wicket.batsman;
    updated.batsmen = {
      ...updated.batsmen,
      [dismissed]: { ...updated.batsmen[dismissed], out: true, dismissal: wicket.dismissal },
    };
    // New batsman
    if (wicket.newBatsman) {
      updated = addBatsmanToInnings(updated, wicket.newBatsman);
      if (wicket.batsman === updated.striker) {
        updated.striker = wicket.newBatsman;
      } else {
        updated.nonStriker = wicket.newBatsman;
      }
    }
  }
  updated.bowlers = { ...updated.bowlers, [updated.bowler]: bowler };

  // Rotate strike on odd runs (normal + bye + legbye)
  if (isLegal && !isWicket) {
    if (runs % 2 === 1) {
      [updated.striker, updated.nonStriker] = [updated.nonStriker, updated.striker];
    }
  }
  if (!isLegal && !isWicket && runs % 2 === 1) {
    // wide/noball with odd runs rotate strike too
    [updated.striker, updated.nonStriker] = [updated.nonStriker, updated.striker];
  }

  // End of over: swap ends + mark over index
  const newOverIndex = Math.floor(updated.legalBalls / 6);
  if (isLegal && updated.legalBalls % 6 === 0 && updated.legalBalls > 0) {
    [updated.striker, updated.nonStriker] = [updated.nonStriker, updated.striker];
    updated.bowler = '';
  }

  // Append delivery
  updated.deliveries = [...updated.deliveries, { ...delivery, overIndex }];

  return updated;
}

export function retireBatsman(innings, retiringName, newBatsmanName) {
  let updated = {
    ...innings,
    batsmen: {
      ...innings.batsmen,
      [retiringName]: { ...innings.batsmen[retiringName], out: true, dismissal: 'Retired Out' },
    },
    striker:    innings.striker    === retiringName ? newBatsmanName : innings.striker,
    nonStriker: innings.nonStriker === retiringName ? newBatsmanName : innings.nonStriker,
  };
  updated = addBatsmanToInnings(updated, newBatsmanName);
  return updated;
}

export function rebuildInnings(original, newDeliveries) {
  let rebuilt = makeEmptyInnings(original.battingTeam, original.bowlingTeam, original.players);
  const opener1 = original.battingOrder[0];
  const opener2 = original.battingOrder[1];
  if (opener1) rebuilt = addBatsmanToInnings(rebuilt, opener1);
  if (opener2) rebuilt = addBatsmanToInnings(rebuilt, opener2);
  rebuilt.striker = opener1 || '';
  rebuilt.nonStriker = opener2 || '';

  for (const delivery of newDeliveries) {
    if (delivery.bowler && delivery.bowler !== rebuilt.bowler) {
      rebuilt.bowler = delivery.bowler;
      rebuilt = ensureBowler(rebuilt, delivery.bowler);
    }
    rebuilt = applyDelivery(rebuilt, delivery);
  }
  return rebuilt;
}

export function getLastBowler(innings) {
  const deliveries = innings?.deliveries || [];
  for (let i = deliveries.length - 1; i >= 0; i--) {
    if (deliveries[i].bowler) return deliveries[i].bowler;
  }
  return '';
}

export function formatBowlerOvers(balls) {
  return `${Math.floor(balls / 6)}.${balls % 6}`;
}

export function getWinnerMessage(match) {
  const { innings, meta } = match;
  if (!innings || innings.length < 2) return '';
  const inn1 = innings[0];
  const inn2 = innings[1];
  const team1Name = meta.team1;
  const team2Name = meta.team2;
  const bat1 = inn1.battingTeam === 'team1' ? team1Name : team2Name;
  const bat2 = inn2.battingTeam === 'team1' ? team1Name : team2Name;

  if (inn2.runs > inn1.runs) {
    const wktsLeft = inn2.players - 1 - inn2.wickets;
    return `${bat2} won by ${wktsLeft} wicket${wktsLeft !== 1 ? 's' : ''}`;
  } else if (inn1.runs > inn2.runs) {
    return `${bat1} won by ${inn1.runs - inn2.runs} run${inn1.runs - inn2.runs !== 1 ? 's' : ''}`;
  }
  return 'Match Tied!';
}
