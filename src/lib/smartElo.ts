import { GameSession } from '@/types/game';
import type { RankedPlayerProfile, PublicLeaderboardPlayer } from './rankedSync';

export interface PlayerMatchMetrics {
  playerId: string;
  playerName: string;
  finalScore: number;
  shotsCount: number;
  foulsCount: number;
  foulPointsLost: number;
  highestSingleShot: number;
  highestTurnBreak: number;
  scoringEfficiency: number; // points per scoring shot in this match
  isCleanPlay: boolean; // 0 fouls
}

export interface SmartEloCalculation {
  playerId: string;
  playerName: string;
  rank: number;
  isWinner: boolean;
  isDraw: boolean;
  ratingBefore: number;
  ratingAfter: number;
  ratingDelta: number;
  kFactor: number;
  expectedScore: number;
  actualScore: number;
  marginMultiplier: number;
  efficiencyMultiplier: number;
  breakBonus: number;
  cleanBonus: number;
  careerMatchesAfter: number;
  careerPointsAfter: number;
  careerPPG: number;
  careerHighestBreakAfter: number;
  metrics: PlayerMatchMetrics;
}

export interface MatchEloResult {
  matchId: string;
  timestamp: number;
  players: Record<string, SmartEloCalculation>;
  summary: {
    winnerId: string | null;
    winnerName: string;
    isDraw: boolean;
    highestBreakInMatch: number;
    highestBreakerName: string;
    totalEvents: number;
  };
}

/**
 * Extracts shot-by-shot event metrics for every player from game session history.
 */
export function extractPlayerMatchMetrics(session: GameSession): Record<string, PlayerMatchMetrics> {
  const result: Record<string, PlayerMatchMetrics> = {};

  // Initialize for all players
  for (const p of session.players) {
    result[p.id] = {
      playerId: p.id,
      playerName: p.name,
      finalScore: p.score,
      shotsCount: 0,
      foulsCount: 0,
      foulPointsLost: 0,
      highestSingleShot: 0,
      highestTurnBreak: 0,
      scoringEfficiency: 0,
      isCleanPlay: true,
    };
  }

  if (!session.history || session.history.length === 0) {
    for (const p of session.players) {
      result[p.id].highestTurnBreak = Math.max(0, p.score);
      result[p.id].highestSingleShot = Math.max(0, p.score);
    }
    return result;
  }

  // Track consecutive runs / innings per player
  let currentRunPlayerId: string | null = null;
  let currentRunPoints = 0;

  for (const tx of session.history) {
    const metrics = result[tx.playerId];
    if (!metrics) continue;

    if (tx.type === 'add') {
      metrics.shotsCount += 1;
      const pts = tx.amount || 0;
      if (pts > metrics.highestSingleShot) {
        metrics.highestSingleShot = pts;
      }

      // Inning / Break run tracker
      if (currentRunPlayerId === tx.playerId) {
        currentRunPoints += pts;
      } else {
        currentRunPlayerId = tx.playerId;
        currentRunPoints = pts;
      }

      if (currentRunPoints > metrics.highestTurnBreak) {
        metrics.highestTurnBreak = currentRunPoints;
      }
    } else if (tx.type === 'subtract') {
      metrics.foulsCount += 1;
      metrics.foulPointsLost += tx.amount || 0;
      metrics.isCleanPlay = false;

      // Foul terminates any consecutive run
      currentRunPlayerId = null;
      currentRunPoints = 0;
    }
  }

  // Calculate scoring efficiency (average points per positive scoring shot)
  for (const p of session.players) {
    const m = result[p.id];
    m.scoringEfficiency = m.shotsCount > 0 ? Math.round((m.finalScore / m.shotsCount) * 10) / 10 : 0;
    // Fallback: if highestTurnBreak is less than single shot, sync them
    if (m.highestSingleShot > m.highestTurnBreak) {
      m.highestTurnBreak = m.highestSingleShot;
    }
  }

  return result;
}

/**
 * SMART ELO ENGINE
 * 
 * Accurately calculates ELO changes while factoring in:
 * 1. Opponent skill disparity (Standard competitive ELO expected score)
 * 2. Dynamic K-Factor (Provisional rapid ascent for newer players, stabilized for veterans)
 * 3. Efficiency & Points-Per-Game (PPG): High points in fewer games yields higher ratings;
 *    prevents grinding low-efficiency matches from outranking high-efficiency players.
 * 4. Margin of Victory: Decisive blowout vs narrow win.
 * 5. High Break & Event Discipline: Rewards consecutive shotmaking and clean play (0 fouls).
 */
export function calculateSmartMatchElo(
  session: GameSession,
  playerProfiles: Record<string, Partial<RankedPlayerProfile | PublicLeaderboardPlayer>>
): MatchEloResult {
  const matchMetrics = extractPlayerMatchMetrics(session);
  const players = [...session.players];

  // Sort descending by final score
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const maxScore = sorted[0]?.score ?? 0;
  const isDraw = sorted.length > 1 && sorted[0].score === sorted[1].score;
  const winner = isDraw ? null : sorted[0];

  const calculations: Record<string, SmartEloCalculation> = {};

  // Pre-calculate prior ratings
  const ratings: Record<string, number> = {};
  for (const p of players) {
    const prof = playerProfiles[p.id];
    ratings[p.id] = typeof prof?.rating === 'number' ? prof.rating : 100;
  }

  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    const metrics = matchMetrics[p.id];
    const prof = playerProfiles[p.id];
    const ratingBefore = ratings[p.id];
    const priorMatches = prof?.totalMatches || 0;
    const priorPoints = prof?.totalPoints || 0;
    const priorHighestBreak = prof?.highestBreak || 0;

    // Rank (accommodates ties)
    const rank = sorted.filter((other) => other.score > p.score).length + 1;
    const isPlayerWinner = winner !== null && winner.id === p.id;
    const isPlayerDraw = isDraw && p.score === maxScore;

    // 1. Calculate Expected Score against opponents
    const opponents = players.filter((other) => other.id !== p.id);
    let expectedSum = 0;
    for (const opp of opponents) {
      const oppRating = ratings[opp.id] || 100;
      // Standard logistic expectancy curve
      const exp = 1 / (1 + Math.pow(10, (oppRating - ratingBefore) / 400));
      expectedSum += exp;
    }
    const expectedScore = opponents.length > 0 ? expectedSum / opponents.length : 0.5;

    // Actual Score (S_i)
    let actualScore = 0;
    if (isPlayerWinner) {
      actualScore = 1.0;
    } else if (isPlayerDraw) {
      actualScore = 0.5;
    } else if (players.length > 2) {
      // Fractional normalized rank for multi-player games
      actualScore = (players.length - rank) / (players.length - 1);
    } else {
      actualScore = 0.0;
    }

    // 2. Dynamic K-Factor (Provisional vs Intermediate vs Veteran)
    let kFactor = 28;
    if (priorMatches < 8) {
      kFactor = 40; // High volatility for new players to swiftly reach their skill tier
    } else if (priorMatches < 25) {
      kFactor = 28;
    } else {
      kFactor = 18; // Stabilized veteran curve
    }

    // 3. Efficiency & Points-Per-Game (PPG) Multiplier
    // A player who scores more points in fewer matches is objectively more efficient.
    const careerMatchesAfter = priorMatches + 1;
    const careerPointsAfter = priorPoints + Math.max(0, p.score);
    const careerPPG = Math.round((careerPointsAfter / careerMatchesAfter) * 10) / 10;

    // Compare new career PPG against competitive benchmark (~35 pts/match)
    const ppgRatio = Math.max(0.2, Math.min(2.5, careerPPG / 35));
    let efficiencyMultiplier = 1.0;

    if (actualScore >= 0.5) {
      // Winner / Draw: high PPG elevates rating gain (up to +45% bonus)
      efficiencyMultiplier = Math.max(0.85, Math.min(1.45, 0.8 + 0.4 * ppgRatio));
    } else {
      // Defeat: High PPG demonstrates strong individual offense despite team/match loss,
      // softening rating decay (resilience). Inefficient low-PPG players absorb the full drop.
      efficiencyMultiplier = Math.max(0.75, Math.min(1.2, 1.25 - 0.35 * ppgRatio));
    }

    // 4. Margin of Victory / Dominance Multiplier
    const oppAvgScore =
      opponents.length > 0
        ? opponents.reduce((sum, opp) => sum + opp.score, 0) / opponents.length
        : p.score;
    const margin = p.score - oppAvgScore;

    let marginMultiplier = 1.0;
    if (actualScore >= 0.5) {
      // Decisive victory gives a scaling boost
      const normalizedMargin = Math.max(0, margin) / Math.max(20, oppAvgScore);
      marginMultiplier = Math.max(1.0, Math.min(1.5, 1.0 + Math.log(1.0 + normalizedMargin) * 0.45));
    } else {
      // Narrow defeat (e.g. 48-50) loses fewer points than a 2-50 blowout
      const closeness = Math.max(0, p.score) / Math.max(1, maxScore);
      marginMultiplier = Math.max(0.65, Math.min(1.0, 1.05 - 0.35 * closeness));
    }

    // 5. Inning Break & Skill Bonuses
    let breakBonus = 0;
    const matchHighestBreak = metrics.highestTurnBreak;
    if (matchHighestBreak >= 30) {
      breakBonus += 4;
    } else if (matchHighestBreak >= 15) {
      breakBonus += 2;
    }

    // Career Personal Best Break Bonus
    const careerHighestBreakAfter = Math.max(priorHighestBreak, matchHighestBreak);
    if (matchHighestBreak > priorHighestBreak && priorMatches > 0) {
      breakBonus += 3; // +3 PB break bonus
    }

    // Clean Play Bonus
    let cleanBonus = 0;
    if (metrics.isCleanPlay && metrics.shotsCount >= 3) {
      cleanBonus += 2; // +2 for flawless discipline with zero fouls
    } else if (metrics.foulsCount >= 3) {
      cleanBonus -= 2; // -2 discipline deduction for 3+ unforced fouls
    }

    // 6. Final Rating Delta Calculation
    const baseDelta = kFactor * (actualScore - expectedScore) * marginMultiplier * efficiencyMultiplier;
    let finalDelta = Math.round(baseDelta + breakBonus + cleanBonus);

    // Guard rails & bounds
    if (isPlayerWinner) {
      finalDelta = Math.max(6, Math.min(60, finalDelta));
    } else if (isPlayerDraw) {
      finalDelta = Math.max(-4, Math.min(12, finalDelta));
    } else {
      finalDelta = Math.min(-3, Math.max(-35, finalDelta));
    }

    const ratingAfter = Math.max(0, ratingBefore + finalDelta);

    calculations[p.id] = {
      playerId: p.id,
      playerName: p.name,
      rank,
      isWinner: isPlayerWinner,
      isDraw: isPlayerDraw,
      ratingBefore,
      ratingAfter,
      ratingDelta: finalDelta,
      kFactor,
      expectedScore: Math.round(expectedScore * 100) / 100,
      actualScore,
      marginMultiplier: Math.round(marginMultiplier * 100) / 100,
      efficiencyMultiplier: Math.round(efficiencyMultiplier * 100) / 100,
      breakBonus,
      cleanBonus,
      careerMatchesAfter,
      careerPointsAfter,
      careerPPG,
      careerHighestBreakAfter,
      metrics,
    };
  }

  // Summary metadata
  let matchHighestBreak = 0;
  let matchHighestBreaker = 'None';
  for (const calc of Object.values(calculations)) {
    if (calc.metrics.highestTurnBreak > matchHighestBreak) {
      matchHighestBreak = calc.metrics.highestTurnBreak;
      matchHighestBreaker = calc.playerName;
    }
  }

  return {
    matchId: session.id,
    timestamp: session.createdAt || Date.now(),
    players: calculations,
    summary: {
      winnerId: winner ? winner.id : null,
      winnerName: winner ? winner.name : 'Tie',
      isDraw,
      highestBreakInMatch: matchHighestBreak,
      highestBreakerName: matchHighestBreaker,
      totalEvents: session.history?.length || 0,
    },
  };
}

/**
 * Intelligent Standings Sorter
 * 
 * Solves the critical requirement:
 * "someone can have more accumulated point but in less games and someone can have
 * more games and same points and those are not the same coz less games also counts"
 * 
 * Tiebreaking Hierarchy:
 * 1. ELO Rating (descending)
 * 2. Career PPG / Efficiency (descending)
 * 3. Total Wins (descending)
 * 4. Total Points (descending)
 * 5. Fewest Matches Played (ascending) - Fewer games with equal points is objectively superior!
 */
export function sortTournamentStandings(players: PublicLeaderboardPlayer[]): PublicLeaderboardPlayer[] {
  return [...players].sort((a, b) => {
    // 1. Rating (ELO)
    const ratingA = a.rating || 100;
    const ratingB = b.rating || 100;
    if (ratingB !== ratingA) {
      return ratingB - ratingA;
    }

    // 2. Points Per Game (PPG / Efficiency)
    const matchesA = a.totalMatches || 0;
    const matchesB = b.totalMatches || 0;
    const pointsA = a.totalPoints || 0;
    const pointsB = b.totalPoints || 0;

    const ppgA = matchesA > 0 ? pointsA / matchesA : 0;
    const ppgB = matchesB > 0 ? pointsB / matchesB : 0;
    if (Math.abs(ppgB - ppgA) > 0.05) {
      return ppgB - ppgA;
    }

    // 3. Total Wins
    const winsA = a.wins || 0;
    const winsB = b.wins || 0;
    if (winsB !== winsA) {
      return winsB - winsA;
    }

    // 4. Total Points
    if (pointsB !== pointsA) {
      return pointsB - pointsA;
    }

    // 5. Fewest Matches Played (Efficiency bonus: less games to achieve same score ranks higher)
    if (matchesA !== matchesB) {
      return matchesA - matchesB;
    }

    // 6. Highest Break
    const breakA = a.highestBreak || 0;
    const breakB = b.highestBreak || 0;
    return breakB - breakA;
  });
}
