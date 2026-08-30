import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { GameSession } from '@/types/game';

interface EndGameModalProps {
  session: GameSession;
  isOpen: boolean;
  onDone: () => void;
  onNewGame: () => void;
}

export const EndGameModal: React.FC<EndGameModalProps> = ({
  session,
  isOpen,
  onDone,
  onNewGame,
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

  if (!isOpen) return null;

  const sortedPlayers = [...session.players].sort((a, b) => b.score - a.score);
  const winner = sortedPlayers[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 border border-zinc-200 relative max-h-[90vh] overflow-y-auto">
        {/* Winner Announcement Header */}
        <div className="text-center space-y-1 pt-1 border-b border-zinc-100 pb-3">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-600">
            Session Concluded
          </span>
          <h2 className="text-2xl font-black text-zinc-900 tracking-tight uppercase font-serif">
            FINAL RESULTS
          </h2>
          {winner && (
            <p className="text-xs font-medium text-zinc-600">
              <strong className="text-zinc-900">{winner.name}</strong> leads with{' '}
              <strong className="text-indigo-600">{winner.score} pts</strong>
            </p>
          )}
        </div>

        {/* Compact Final Standings Table */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 px-2">
            <span>Rank & Player</span>
            <span>Final Score</span>
          </div>

          <div className="space-y-1.5">
            {sortedPlayers.map((player, idx) => {
              const isWinner = idx === 0;

              return (
                <div
                  key={player.id}
                  className={`p-3 rounded-xl flex items-center justify-between transition border ${
                    isWinner
                      ? 'bg-amber-50/70 border-amber-300 ring-1 ring-amber-400/50'
                      : 'bg-zinc-50 border-zinc-200/80'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-5 text-center text-xs font-black text-zinc-400">
                      #{idx + 1}
                    </span>

                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white font-extrabold text-xs shadow-sm"
                      style={{ backgroundColor: player.color }}
                    >
                      {player.name.slice(0, 2).toUpperCase()}
                    </div>

                    <div>
                      <h4 className="font-extrabold text-zinc-900 text-sm leading-none">
                        {player.name}
                      </h4>
                      {isWinner && (
                        <span className="text-[9px] font-extrabold text-amber-700 uppercase tracking-wide">
                          Winner
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <span
                      className={`text-lg font-black ${
                        isWinner
                          ? 'text-amber-900'
                          : player.score < 0
                          ? 'text-rose-600'
                          : 'text-zinc-900'
                      }`}
                    >
                      {player.score > 0 ? `+${player.score}` : player.score}
                    </span>
                    <span className="text-[9px] text-zinc-400 font-bold block leading-none">
                      pts
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Action Buttons */}
        <div className="grid grid-cols-2 gap-2.5 pt-2">
          <button
            onClick={onNewGame}
            className="py-3 px-4 rounded-2xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold text-xs transition"
          >
            PLAY AGAIN
          </button>

          <button
            onClick={onDone}
            className="py-3 px-4 rounded-2xl bg-zinc-900 hover:bg-indigo-600 text-white font-black text-xs transition shadow-md active:scale-95"
          >
            DONE
          </button>
        </div>
      </div>
    </div>
  );
};
