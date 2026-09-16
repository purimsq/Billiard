import React, { useState } from 'react';
import { Player } from '@/types/game';
import { getRandomPlayerColor } from '@/lib/gameLogic';

interface PlayerSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartGame: (players: Player[]) => void;
  isDark?: boolean;
}

export const PlayerSetupModal: React.FC<PlayerSetupModalProps> = ({
  isOpen,
  onClose,
  onStartGame,
  isDark = false,
}) => {
  const [playerNames, setPlayerNames] = useState<string[]>(['Player 1', 'Player 2']);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAddPlayer = () => {
    if (playerNames.length >= 8) {
      setError('Maximum 8 players allowed');
      return;
    }
    setError(null);
    setPlayerNames([...playerNames, `Player ${playerNames.length + 1}`]);
  };

  const handleRemovePlayer = (index: number) => {
    if (playerNames.length <= 1) {
      setError('At least 1 player is required');
      return;
    }
    setError(null);
    setPlayerNames(playerNames.filter((_, i) => i !== index));
  };

  const handleNameChange = (index: number, value: string) => {
    const updated = [...playerNames];
    updated[index] = value;
    setPlayerNames(updated);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = playerNames.map(n => n.trim()).filter(Boolean);
    if (cleaned.length === 0) {
      setError('Please enter at least one player name');
      return;
    }

    const createdPlayers: Player[] = cleaned.map((name, idx) => ({
      id: `player_${Date.now()}_${idx}`,
      name: name || `Player ${idx + 1}`,
      score: 0,
      color: getRandomPlayerColor(idx),
      avatarBg: getRandomPlayerColor(idx),
    }));

    onStartGame(createdPlayers);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/75 backdrop-blur-sm animate-fadeIn">
      <div
        className={`w-full max-w-md rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 border relative transition-colors ${
          isDark
            ? 'bg-zinc-900 border-zinc-800 text-zinc-100'
            : 'bg-white border-zinc-200 text-zinc-900'
        }`}
      >
        {/* Modal Header */}
        <div
          className={`flex items-center justify-between pb-3 border-b ${
            isDark ? 'border-zinc-800' : 'border-zinc-100'
          }`}
        >
          <div>
            <h3
              className={`text-xl font-black tracking-tight ${
                isDark ? 'text-zinc-100' : 'text-zinc-900'
              }`}
            >
              PLAYER SETUP
            </h3>
            <p className={`text-xs font-medium ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
              Add players in turn order
            </p>
          </div>
          <button
            onClick={onClose}
            className={`text-xs font-bold px-2 py-1 transition ${
              isDark
                ? 'text-zinc-400 hover:text-zinc-200'
                : 'text-zinc-400 hover:text-zinc-700'
            }`}
          >
            Cancel
          </button>
        </div>

        {error && (
          <div
            className={`p-3 rounded-2xl text-xs font-semibold border ${
              isDark
                ? 'bg-rose-950/40 border-rose-800/60 text-rose-300'
                : 'bg-rose-50 border-rose-200 text-rose-700'
            }`}
          >
            {error}
          </div>
        )}

        {/* Player Name Form */}
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div className="max-h-60 overflow-y-auto pr-1 space-y-2.5">
            {playerNames.map((name, index) => (
              <div key={index} className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white font-extrabold text-xs shadow-sm flex-shrink-0"
                  style={{ backgroundColor: getRandomPlayerColor(index) }}
                >
                  {index + 1}
                </div>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => handleNameChange(index, e.target.value)}
                  placeholder={`Player ${index + 1} Name`}
                  className={`flex-1 px-3.5 py-2 rounded-xl border font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition ${
                    isDark
                      ? 'bg-zinc-800/90 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus:bg-zinc-800 focus:border-indigo-500'
                      : 'bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:bg-white focus:border-indigo-600'
                  }`}
                  required
                />
                {playerNames.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemovePlayer(index)}
                    className={`text-xs font-bold px-2 py-1 transition ${
                      isDark
                        ? 'text-zinc-500 hover:text-rose-400'
                        : 'text-zinc-400 hover:text-rose-600'
                    }`}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Add Player Button */}
          <button
            type="button"
            onClick={handleAddPlayer}
            className={`w-full py-2.5 px-4 rounded-2xl border border-dashed font-bold text-xs transition ${
              isDark
                ? 'border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:border-zinc-600 hover:text-indigo-400'
                : 'border-zinc-300 text-zinc-700 hover:bg-zinc-50 hover:border-indigo-300 hover:text-indigo-600'
            }`}
          >
            + ADD PLAYER FIELD
          </button>

          {/* Submit / Start Game Button */}
          <div className="pt-2">
            <button
              type="submit"
              className={`w-full py-3.5 rounded-2xl font-black text-sm active:scale-[0.99] shadow-lg transition-all ${
                isDark
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                  : 'bg-zinc-900 hover:bg-indigo-600 text-white'
              }`}
            >
              START GAME
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
