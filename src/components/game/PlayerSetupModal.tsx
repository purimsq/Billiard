import React, { useState } from 'react';
import { Player } from '@/types/game';
import { getRandomPlayerColor } from '@/lib/gameLogic';

interface PlayerSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartGame: (players: Player[]) => void;
}

export const PlayerSetupModal: React.FC<PlayerSetupModalProps> = ({
  isOpen,
  onClose,
  onStartGame,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 border border-zinc-200 relative">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
          <div>
            <h3 className="text-xl font-black text-zinc-900 tracking-tight">PLAYER SETUP</h3>
            <p className="text-xs text-zinc-500 font-medium">Add players in turn order</p>
          </div>
          <button
            onClick={onClose}
            className="text-xs font-bold text-zinc-400 hover:text-zinc-700 px-2 py-1"
          >
            Cancel
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
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
                  className="flex-1 px-3.5 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-zinc-900 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:bg-white transition"
                  required
                />
                {playerNames.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemovePlayer(index)}
                    className="text-xs font-bold text-zinc-400 hover:text-rose-600 px-2 py-1 transition"
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
            className="w-full py-2.5 px-4 rounded-2xl border border-dashed border-zinc-300 text-zinc-700 font-bold text-xs hover:bg-zinc-50 hover:border-indigo-300 hover:text-indigo-600 transition"
          >
            + ADD PLAYER FIELD
          </button>

          {/* Submit / Start Game Button */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-3.5 rounded-2xl bg-zinc-900 text-white font-black text-sm hover:bg-indigo-600 active:scale-[0.99] shadow-lg transition-all"
            >
              START GAME
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
