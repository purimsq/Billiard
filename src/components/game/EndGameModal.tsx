import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Zap, HardDrive, ShieldCheck } from 'lucide-react';
import { GameSession } from '@/types/game';
import { getCasualHistoryLimit } from '@/lib/storage';

interface EndGameModalProps {
  session: GameSession;
  isOpen: boolean;
  onDone: () => void;
  onNewGame: () => void;
  onCancelGame?: () => void;
  isDark?: boolean;
}

export const EndGameModal: React.FC<EndGameModalProps> = ({
  session,
  isOpen,
  onDone,
  onNewGame,
  onCancelGame,
  isDark = false,
}) => {
  useEffect(() => {
    if (isOpen) {
      try {
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.6 },
        });
      } catch (err) {
        console.error('Confetti error:', err);
      }
    }
  }, [isOpen]);

  const casualLimit = getCasualHistoryLimit();

  if (!isOpen) return null;

  const sortedPlayers = [...session.players].sort((a, b) => b.score - a.score);
  const totalEvents = session.history?.length || 0;

  // Group players by score to accurately identify ties/draws
  const topScore = sortedPlayers[0]?.score ?? 0;
  const tiedWinners = sortedPlayers.filter((p) => p.score === topScore);
  const isDraw = tiedWinners.length > 1;

  // Rank calculation helper accommodating ties across the entire board
  const getRankInfo = (score: number) => {
    const higherCount = sortedPlayers.filter((p) => p.score > score).length;
    const sameCount = sortedPlayers.filter((p) => p.score === score).length;
    const rank = higherCount + 1;
    const isTied = sameCount > 1;
    return {
      rank,
      isTied,
      isTop: rank === 1,
      displayRank: isTied ? `T-#${rank}` : `#${rank}`,
    };
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/75 backdrop-blur-sm animate-fadeIn">
      <div
        className={`w-full max-w-md rounded-3xl p-6 sm:p-7 shadow-2xl space-y-4 border relative max-h-[90vh] overflow-y-auto transition-colors ${
          isDark
            ? 'bg-zinc-900 border-zinc-800 text-zinc-100'
            : 'bg-white border-zinc-200 text-zinc-900'
        }`}
      >
        {/* Winner / Draw Announcement Header */}
        <div
          className={`text-center space-y-1.5 pt-1 pb-3 border-b ${
            isDark ? 'border-zinc-800' : 'border-zinc-100'
          }`}
        >
          {isDraw ? (
            <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
              <span>🤝</span>
              <span>IT&apos;S A DRAW • TIED FOR 1ST</span>
            </span>
          ) : (
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-500">
              Session Concluded
            </span>
          )}

          <h2
            className={`text-2xl font-black tracking-tight uppercase font-serif ${
              isDark ? 'text-zinc-100' : 'text-zinc-900'
            }`}
          >
            {isDraw ? 'TIED CHAMPIONS' : 'FINAL RESULTS'}
          </h2>

          {isDraw ? (
            <p className={`text-xs font-medium ${isDark ? 'text-zinc-300' : 'text-zinc-600'}`}>
              <strong className={isDark ? 'text-amber-400' : 'text-amber-600'}>
                {tiedWinners.map((w) => w.name).join(' & ')}
              </strong>{' '}
              tied for 1st place with{' '}
              <strong className={isDark ? 'text-indigo-400' : 'text-indigo-600'}>
                {topScore > 0 ? `+${topScore}` : topScore} pts
              </strong>
            </p>
          ) : (
            sortedPlayers[0] && (
              <p className={`text-xs font-medium ${isDark ? 'text-zinc-300' : 'text-zinc-600'}`}>
                <strong className={isDark ? 'text-zinc-100' : 'text-zinc-900'}>
                  {sortedPlayers[0].name}
                </strong>{' '}
                leads with{' '}
                <strong className={isDark ? 'text-indigo-400' : 'text-indigo-600'}>
                  {sortedPlayers[0].score > 0 ? `+${sortedPlayers[0].score}` : sortedPlayers[0].score} pts
                </strong>
              </p>
            )
          )}
        </div>

        {/* Scoreboard Info Ribbon: Game Mode & Event Count */}
        <div
          className={`flex items-center justify-between px-3.5 py-2 rounded-2xl border text-xs ${
            isDark
              ? 'bg-zinc-950/70 border-zinc-800 text-zinc-300'
              : 'bg-zinc-50/90 border-zinc-200 text-zinc-700'
          }`}
        >
          <div className="flex items-center gap-1.5 font-bold">
            {session.mode === 'ranked' ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase text-amber-500">
                <ShieldCheck className="w-3.5 h-3.5" />
                Ranked Match
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase text-emerald-600 dark:text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                Casual Match
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider ${
                isDark
                  ? 'bg-zinc-800 text-zinc-200 border border-zinc-700'
                  : 'bg-white text-zinc-800 border border-zinc-200 shadow-2xs'
              }`}
            >
              <Zap className="w-3 h-3 text-amber-500" />
              <span>{totalEvents} {totalEvents === 1 ? 'Event' : 'Events'}</span>
            </span>
          </div>
        </div>

        {/* Compact Final Standings Table */}
        <div className="space-y-2">
          <div
            className={`flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider px-2 ${
              isDark ? 'text-zinc-500' : 'text-zinc-400'
            }`}
          >
            <span>Rank &amp; Player</span>
            <span>Final Score</span>
          </div>

          <div className="space-y-1.5">
            {sortedPlayers.map((player) => {
              const rankInfo = getRankInfo(player.score);
              const isWinner = rankInfo.isTop;
              const playerShots = (session.history || []).filter(
                (tx) => tx.playerId === player.id && tx.type === 'add'
              ).length;
              const playerFouls = (session.history || []).filter(
                (tx) => tx.playerId === player.id && tx.type === 'subtract'
              ).length;

              return (
                <div
                  key={player.id}
                  className={`p-3 rounded-xl flex items-center justify-between transition border ${
                    isWinner
                      ? isDark
                        ? 'bg-amber-950/30 border-amber-800/60 ring-1 ring-amber-500/30'
                        : 'bg-amber-50/70 border-amber-300 ring-1 ring-amber-400/50'
                      : isDark
                      ? 'bg-zinc-800/60 border-zinc-700/60'
                      : 'bg-zinc-50 border-zinc-200/80'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-7 text-center text-xs font-black ${
                        isWinner
                          ? 'text-amber-500'
                          : isDark
                          ? 'text-zinc-500'
                          : 'text-zinc-400'
                      }`}
                    >
                      {rankInfo.displayRank}
                    </span>

                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white font-extrabold text-xs shadow-sm flex-shrink-0"
                      style={{ backgroundColor: player.color }}
                    >
                      {player.name.slice(0, 2).toUpperCase()}
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4
                          className={`font-extrabold text-sm leading-none ${
                            isDark ? 'text-zinc-100' : 'text-zinc-900'
                          }`}
                        >
                          {player.name}
                        </h4>
                        {isWinner && (
                          <span className="text-xs" title={isDraw ? 'Tied Winner' : 'Winner'}>
                            👑
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {isWinner && (
                          <span className="text-[9px] font-extrabold text-amber-500 uppercase tracking-wide">
                            {isDraw ? 'Tied Winner' : 'Winner'}
                          </span>
                        )}
                        <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500">
                          {playerShots} {playerShots === 1 ? 'shot' : 'shots'}
                          {playerFouls > 0 ? ` • ${playerFouls} ${playerFouls === 1 ? 'foul' : 'fouls'}` : ''}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span
                      className={`text-lg font-black ${
                        isWinner
                          ? isDark
                            ? 'text-amber-400'
                            : 'text-amber-900'
                          : player.score < 0
                          ? 'text-rose-500'
                          : isDark
                          ? 'text-zinc-100'
                          : 'text-zinc-900'
                      }`}
                    >
                      {player.score > 0 ? `+${player.score}` : player.score}
                    </span>
                    <span
                      className={`text-[9px] font-bold block leading-none ${
                        isDark ? 'text-zinc-500' : 'text-zinc-400'
                      }`}
                    >
                      pts
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Local Storage Auto-save Notice */}
        <div
          className={`px-3 py-2 rounded-xl text-center text-[10px] font-semibold flex items-center justify-center gap-1.5 border ${
            isDark
              ? 'bg-zinc-950/40 border-zinc-800/80 text-zinc-400'
              : 'bg-zinc-50 border-zinc-200 text-zinc-600'
          }`}
        >
          <HardDrive className="w-3 h-3 text-zinc-400" />
          <span>
            {session.mode === 'ranked'
              ? 'Submitted & synced to competitive ranked database'
              : `Saved to device Casual History (${casualLimit} recent matches retained)`}
          </span>
        </div>

        {/* Modal Action Buttons */}
        <div className="grid grid-cols-2 gap-2.5 pt-2">
          <button
            onClick={onNewGame}
            className={`py-3 px-4 rounded-2xl font-bold text-xs transition ${
              isDark
                ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
                : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800'
            }`}
          >
            PLAY AGAIN
          </button>

          <button
            onClick={onDone}
            className={`py-3 px-4 rounded-2xl font-black text-xs transition shadow-md active:scale-95 ${
              isDark
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                : 'bg-zinc-900 hover:bg-indigo-600 text-white'
            }`}
          >
            DONE
          </button>
        </div>

        {onCancelGame && (
          <div className="pt-1 text-center">
            <button
              type="button"
              onClick={onCancelGame}
              className={`text-xs font-semibold px-3 py-1.5 rounded-xl transition ${
                isDark
                  ? 'text-rose-400/80 hover:text-rose-300 hover:bg-rose-950/30'
                  : 'text-rose-600/80 hover:text-rose-700 hover:bg-rose-50'
              }`}
            >
              Cancel &amp; discard match without saving
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
