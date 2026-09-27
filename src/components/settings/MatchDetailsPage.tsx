import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  Clock,
  Trash2,
  AlertTriangle,
  Lock,
} from 'lucide-react';
import { GameSession } from '@/types/game';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';

interface MatchDetailsPageProps {
  game: GameSession;
  onBack: () => void;
  onDeleteMatch: (id: string) => void;
  isDark?: boolean;
}

export const MatchDetailsPage: React.FC<MatchDetailsPageProps> = ({
  game,
  onBack,
  onDeleteMatch,
  isDark = false,
}) => {
  const [confirmDelete, setConfirmDelete] = useState<boolean>(false);
  const [timelineOrder, setTimelineOrder] = useState<'chronological' | 'reverse'>('reverse');

  // Sorted players by score descending
  const sortedPlayers = useMemo(() => {
    return [...game.players].sort((a, b) => b.score - a.score);
  }, [game.players]);

  const maxScore = sortedPlayers[0]?.score ?? 0;
  const isDraw = sortedPlayers.length > 1 && sortedPlayers[0].score === sortedPlayers[1].score;
  const winner = sortedPlayers[0];
  const runnerUp = sortedPlayers[1];
  const margin = runnerUp ? maxScore - runnerUp.score : 0;

  // Format date & time
  const formattedDate = useMemo(() => {
    try {
      const d = new Date(game.createdAt || game.updatedAt);
      return d.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Completed Match';
    }
  }, [game.createdAt, game.updatedAt]);

  // Compute player stats from history events
  const playerStats = useMemo(() => {
    const stats: Record<
      string,
      {
        shotsCount: number;
        foulsCount: number;
        foulPointsLost: number;
        highestShot: number;
      }
    > = {};

    for (const p of game.players) {
      stats[p.id] = {
        shotsCount: 0,
        foulsCount: 0,
        foulPointsLost: 0,
        highestShot: 0,
      };
    }

    if (game.history) {
      for (const tx of game.history) {
        if (!stats[tx.playerId]) {
          stats[tx.playerId] = {
            shotsCount: 0,
            foulsCount: 0,
            foulPointsLost: 0,
            highestShot: 0,
          };
        }
        if (tx.type === 'add') {
          stats[tx.playerId].shotsCount += 1;
          if (tx.amount > stats[tx.playerId].highestShot) {
            stats[tx.playerId].highestShot = tx.amount;
          }
        } else {
          stats[tx.playerId].foulsCount += 1;
          stats[tx.playerId].foulPointsLost += tx.amount;
        }
      }
    }

    return stats;
  }, [game.players, game.history]);

  // Sorted timeline events
  const orderedEvents = useMemo(() => {
    const events = [...(game.history || [])];
    if (timelineOrder === 'chronological') {
      return events.sort((a, b) => a.timestamp - b.timestamp);
    }
    return events.sort((a, b) => b.timestamp - a.timestamp);
  }, [game.history, timelineOrder]);

  const handleDelete = () => {
    onDeleteMatch(game.id);
    onBack();
  };

  return (
    <div
      className={`w-full max-w-2xl mx-auto min-h-screen px-4 py-3 space-y-6 animate-fadeIn pb-14 ${
        isDark ? 'text-zinc-100' : 'text-zinc-900'
      }`}
    >
      {/* 1. TOP HEADER (GOOGLE MINIMALIST) */}
      <div
        className={`flex items-center justify-between pb-2 border-b ${
          isDark ? 'border-zinc-800' : 'border-zinc-200'
        }`}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            aria-label="Back to History"
            className={`p-1.5 -ml-1 rounded-full transition-all active:scale-90 flex items-center gap-1 ${
              isDark
                ? 'text-zinc-300 hover:text-white hover:bg-zinc-800'
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/70'
            }`}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
            Back to Match History
          </span>
        </div>

        {/* Delete or Protected Action */}
        <div>
          {game.mode === 'ranked' ? (
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold ${
                isDark
                  ? 'border-zinc-800 bg-zinc-900/80 text-zinc-400'
                  : 'border-zinc-200 bg-zinc-50 text-zinc-600'
              }`}
              title="Official competitive record: Ranked matches cannot be deleted"
            >
              <Lock className="w-3 h-3 text-zinc-400" />
              <span className="hidden sm:inline">Database Synced (Protected)</span>
              <span className="sm:hidden">Protected</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 text-zinc-400 hover:text-rose-500 transition ${
                isDark ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100'
              }`}
              title="Delete Casual Match"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="text-[11px] hidden sm:inline">Delete Record</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. MATCH METADATA OVERVIEW (LYING DIRECTLY ON PAGE) */}
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center gap-2">
          <span
            className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${
              game.mode === 'ranked'
                ? isDark
                  ? 'bg-amber-950/30 text-amber-400 border-amber-800/50'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
                : isDark
                ? 'bg-zinc-800 text-zinc-300 border-zinc-700'
                : 'bg-zinc-100 text-zinc-700 border-zinc-200'
            }`}
          >
            {game.mode === 'ranked' ? '⚔️ Ranked Match' : '🟢 Casual Match'}
          </span>
          <span className="text-[11px] font-medium text-zinc-500">•</span>
          <span className="text-[11px] font-medium text-zinc-500 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{formattedDate}</span>
          </span>
          <span className="text-[11px] font-medium text-zinc-500">•</span>
          <span className="text-[11px] font-medium text-zinc-500">
            {game.history?.length || 0} Total Turns
          </span>
        </div>

        <h2 className="text-2xl sm:text-3xl font-black tracking-tight font-serif uppercase">
          {isDraw
            ? 'Dead-Heat Draw'
            : `${winner?.name || 'Player'} Won by ${margin} ${margin === 1 ? 'Point' : 'Points'}`}
        </h2>

        <p className={`text-xs font-medium ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
          {isDraw
            ? `Both leaders tied at ${maxScore} points after ${game.history?.length || 0} turns.`
            : `${winner?.name} clinched victory with ${maxScore} points against ${runnerUp?.name || 'opponent'} (${runnerUp?.score || 0} pts).`}
        </p>
      </div>

      {/* 3. PRO SCOREBOARD TABLE (COMPACT, GOOGLE SPORTS STYLE DIRECTLY ON PAGE) */}
      <div className="space-y-2 pt-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-500">
            Final Scoreboard &amp; Player Stats
          </span>
          <span className="text-[11px] font-bold text-zinc-400 font-mono">
            {game.players.length} Competitors
          </span>
        </div>

        <div
          className={`border-t border-b divide-y ${
            isDark
              ? 'border-zinc-800 divide-zinc-800/80 bg-zinc-900/30'
              : 'border-zinc-200 divide-zinc-100 bg-white/70'
          }`}
        >
          {/* Table Header */}
          <div className="grid grid-cols-12 py-2 px-3 text-[10px] font-black uppercase tracking-wider text-zinc-400">
            <span className="col-span-1 text-center">#</span>
            <span className="col-span-5">Player</span>
            <span className="col-span-2 text-right">Shots</span>
            <span className="col-span-2 text-right">Fouls</span>
            <span className="col-span-2 text-right">Score</span>
          </div>

          {/* Player Rows */}
          {sortedPlayers.map((player, index) => {
            const isFirst = index === 0;
            const isTiedFirst = isDraw && player.score === maxScore;
            const pStat = playerStats[player.id] || {
              shotsCount: 0,
              foulsCount: 0,
              foulPointsLost: 0,
              highestShot: 0,
            };

            return (
              <div
                key={player.id}
                className={`grid grid-cols-12 py-3 px-3 items-center text-xs transition-colors ${
                  isFirst || isTiedFirst
                    ? isDark
                      ? 'bg-amber-500/5'
                      : 'bg-amber-50/40'
                    : ''
                }`}
              >
                {/* Rank Number */}
                <div className="col-span-1 text-center font-black font-mono text-zinc-400">
                  {isFirst && !isDraw ? '👑' : isTiedFirst ? '🤝' : index + 1}
                </div>

                {/* Player Name & Cue Dot */}
                <div className="col-span-5 flex items-center gap-2 min-w-0 pr-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: player.color || '#6366F1' }}
                  />
                  <span
                    className={`font-bold truncate ${
                      isFirst
                        ? 'text-zinc-900 dark:text-zinc-100 font-extrabold'
                        : 'text-zinc-700 dark:text-zinc-300'
                    }`}
                  >
                    {player.name}
                  </span>
                  {player.score <= -50 && (
                    <span className="text-[9px] font-black px-1 rounded bg-rose-500/20 text-rose-500 flex-shrink-0">
                      🪦
                    </span>
                  )}
                </div>

                {/* Shots Potted */}
                <div className="col-span-2 text-right font-mono font-medium text-zinc-500">
                  {pStat.shotsCount}
                </div>

                {/* Fouls Incurred */}
                <div
                  className={`col-span-2 text-right font-mono font-medium ${
                    pStat.foulsCount > 0 ? 'text-rose-500' : 'text-zinc-400'
                  }`}
                >
                  {pStat.foulsCount > 0 ? `-${pStat.foulPointsLost}` : '0'}
                </div>

                {/* Total Final Score */}
                <div className="col-span-2 text-right">
                  <span
                    className={`text-base font-black font-mono tracking-tight ${
                      player.score < 0
                        ? 'text-rose-500'
                        : isFirst || isTiedFirst
                        ? 'text-amber-500 font-extrabold'
                        : isDark
                        ? 'text-zinc-200'
                        : 'text-zinc-800'
                    }`}
                  >
                    {player.score}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. SHOT-BY-SHOT EVENT TIMELINE (COMPACT & COMPLETE) */}
      <div className="space-y-3 pt-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-500">
              Shot-by-Shot Timeline
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
              {orderedEvents.length} Events
            </span>
          </div>

          {/* Sort Switcher */}
          <div className="flex items-center gap-1 text-[10px] font-bold">
            <button
              type="button"
              onClick={() => setTimelineOrder('reverse')}
              className={`px-2 py-0.5 rounded transition ${
                timelineOrder === 'reverse'
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              Latest First
            </button>
            <button
              type="button"
              onClick={() => setTimelineOrder('chronological')}
              className={`px-2 py-0.5 rounded transition ${
                timelineOrder === 'chronological'
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              First to Last
            </button>
          </div>
        </div>

        {orderedEvents.length === 0 ? (
          <p className="text-xs text-zinc-500 italic py-4 text-center">
            No turn-by-turn events recorded for this session.
          </p>
        ) : (
          <div
            className={`border-t border-b divide-y ${
              isDark
                ? 'border-zinc-800 divide-zinc-800/60'
                : 'border-zinc-200 divide-zinc-100'
            }`}
          >
            {orderedEvents.map((tx, idx) => {
              const eventNum =
                timelineOrder === 'chronological'
                  ? idx + 1
                  : orderedEvents.length - idx;
              const isFoul = tx.type === 'subtract';

              return (
                <div
                  key={tx.id || idx}
                  className={`py-2.5 px-3 flex items-center justify-between text-xs transition-colors ${
                    isDark ? 'hover:bg-zinc-900/60' : 'hover:bg-zinc-50'
                  }`}
                >
                  {/* Left: Event index + Player */}
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <span className="text-[10px] font-bold font-mono text-zinc-400 w-5 text-right flex-shrink-0">
                      #{eventNum}
                    </span>

                    <span className="font-bold truncate text-zinc-800 dark:text-zinc-200">
                      {tx.playerName}
                    </span>

                    {tx.ballNumber ? (
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.2 rounded border font-mono flex-shrink-0 ${
                          isDark
                            ? 'bg-zinc-800 text-zinc-300 border-zinc-700'
                            : 'bg-zinc-100 text-zinc-700 border-zinc-200'
                        }`}
                      >
                        Ball #{tx.ballNumber}
                      </span>
                    ) : isFoul ? (
                      <span className="text-[10px] font-bold text-rose-500 flex items-center gap-1 flex-shrink-0">
                        <AlertTriangle className="w-3 h-3" />
                        <span>Foul / Penalty</span>
                      </span>
                    ) : null}
                  </div>

                  {/* Right: Point Change */}
                  <div className="text-right flex-shrink-0 pl-2">
                    <span
                      className={`font-black font-mono text-xs sm:text-sm ${
                        isFoul
                          ? 'text-rose-500'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {isFoul ? `-${tx.amount}` : `+${tx.amount}`} pts
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. RETURN BUTTON AT BOTTOM */}
      <div className="pt-4">
        <button
          type="button"
          onClick={onBack}
          className="w-full py-3 px-6 rounded-2xl bg-zinc-900 dark:bg-zinc-800 text-white font-black text-xs uppercase tracking-wider shadow-md hover:bg-indigo-600 dark:hover:bg-indigo-600 transition-all active:scale-[0.99] flex items-center justify-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>RETURN TO MATCH HISTORY</span>
        </button>
      </div>

      {/* 2-Step Pop Up Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Delete Match Record?"
        message="Are you sure you want to permanently delete this casual match record? This action cannot be undone."
        confirmText="Delete Match"
        cancelText="Cancel"
        variant="danger"
        isDark={isDark}
      />
    </div>
  );
};
