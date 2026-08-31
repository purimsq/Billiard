import React, { useState } from 'react';
import { RotateCcw, Flag, Plus, Minus, Check } from 'lucide-react';
import { GameSession } from '@/types/game';
import { BALL_DEFINITIONS } from '@/lib/gameLogic';
import { PoolBall } from '../ui/PoolBall';

interface LiveGameViewProps {
  session: GameSession;
  onUpdateSession: (session: GameSession) => void;
  onEndGame: () => void;
}

export const LiveGameView: React.FC<LiveGameViewProps> = ({
  session,
  onUpdateSession,
  onEndGame,
}) => {
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>(
    session.players[0]?.id || ''
  );

  const [scoreMode, setScoreMode] = useState<'add' | 'subtract'>('add');
  const [selectedBalls, setSelectedBalls] = useState<number[]>([]);
  const [customInput, setCustomInput] = useState<string>('');
  const [isBallsDrawerOpen, setIsBallsDrawerOpen] = useState<boolean>(false);
  const [lastNotification, setLastNotification] = useState<string | null>(null);

  const selectedPlayer = session.players.find((p) => p.id === selectedPlayerId);

  // Sum points of all selected balls
  const selectedBallsSum = selectedBalls.reduce((acc, ballNum) => {
    const ballDef = BALL_DEFINITIONS.find((b) => b.number === ballNum);
    return acc + (ballDef?.points || 0);
  }, 0);

  // Active point value from either custom typing or multi-ball sum
  const currentInputValue = customInput !== ''
    ? (parseInt(customInput, 10) || 0)
    : selectedBallsSum;

  const handleSelectBall = (ballNum: number) => {
    if (selectedBalls.includes(ballNum)) {
      setSelectedBalls(selectedBalls.filter((num) => num !== ballNum));
    } else {
      setSelectedBalls([...selectedBalls, ballNum]);
    }
    setCustomInput('');
  };

  const handleDirectNumberInput = (val: string) => {
    if (/^\d*$/.test(val)) {
      setCustomInput(val);
      setSelectedBalls([]);
    }
  };

  const handleConfirmScore = () => {
    if (!selectedPlayer) return;
    if (currentInputValue === 0) return;

    const changeAmount = scoreMode === 'add' ? currentInputValue : -currentInputValue;
    const newScore = selectedPlayer.score + changeAmount;

    const transaction = {
      id: `tx_${Date.now()}`,
      playerId: selectedPlayer.id,
      playerName: selectedPlayer.name,
      amount: currentInputValue,
      type: scoreMode,
      ballNumber: selectedBalls.length === 1 ? selectedBalls[0] : undefined,
      timestamp: Date.now(),
    };

    const updatedPlayers = session.players.map((p) =>
      p.id === selectedPlayer.id ? { ...p, score: newScore } : p
    );

    const updatedSession: GameSession = {
      ...session,
      players: updatedPlayers,
      history: [transaction, ...session.history],
      updatedAt: Date.now(),
    };

    onUpdateSession(updatedSession);

    const sign = scoreMode === 'add' ? '+' : '-';
    setLastNotification(`${selectedPlayer.name}: ${sign}${currentInputValue} pts`);
    setTimeout(() => setLastNotification(null), 2500);

    setSelectedBalls([]);
    setCustomInput('');
  };

  const handleUndo = () => {
    if (session.history.length === 0) return;

    const [lastTx, ...remainingHistory] = session.history;
    const targetPlayer = session.players.find((p) => p.id === lastTx.playerId);
    if (!targetPlayer) return;

    const revertAmount = lastTx.type === 'add' ? -lastTx.amount : lastTx.amount;
    const updatedPlayers = session.players.map((p) =>
      p.id === lastTx.playerId ? { ...p, score: p.score + revertAmount } : p
    );

    onUpdateSession({
      ...session,
      players: updatedPlayers,
      history: remainingHistory,
      updatedAt: Date.now(),
    });

    setLastNotification(`Undid last score for ${lastTx.playerName}`);
    setTimeout(() => setLastNotification(null), 2500);
  };

  const sortedPlayers = [...session.players].sort((a, b) => b.score - a.score);

  return (
    <div className="w-full max-w-2xl mx-auto h-[100dvh] flex flex-col justify-between overflow-hidden bg-[#F4F2EC]">
      {/* ========================================== */}
      {/* TOP SECTION: 2-COLUMN RECTANGULAR CARDS   */}
      {/* ========================================== */}
      <div className="flex-1 flex flex-col min-h-0 px-4 pt-3 pb-2 space-y-2.5 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b-2 border-zinc-900">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black italic tracking-widest bg-gradient-to-r from-zinc-900 via-indigo-950 to-indigo-800 bg-clip-text text-transparent font-serif uppercase">
              BILLIARD
            </h1>
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 uppercase tracking-wider">
              LIVE
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleUndo}
              disabled={session.history.length === 0}
              className="px-3 py-1.5 rounded-full bg-white border border-zinc-200 text-zinc-700 font-bold text-xs flex items-center gap-1 hover:bg-zinc-100 disabled:opacity-40 shadow-sm transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Undo</span>
            </button>

            <button
              onClick={onEndGame}
              className="px-3 py-1.5 rounded-full bg-rose-600 text-white font-extrabold text-xs flex items-center gap-1 hover:bg-rose-700 shadow-sm transition active:scale-95"
            >
              <Flag className="w-3.5 h-3.5" />
              <span>End Game</span>
            </button>
          </div>
        </div>

        {/* Toast Notification */}
        {lastNotification && (
          <div className="px-3 py-1 rounded-xl bg-zinc-900 text-white text-xs font-bold text-center shadow-md animate-fadeIn">
            {lastNotification}
          </div>
        )}

        {/* 2-Column Rectangular Player Cards */}
        <div className="flex-1 overflow-y-auto pr-1 py-1">
          <div className="grid grid-cols-2 gap-2">
            {session.players.map((player) => {
              const isSelected = player.id === selectedPlayerId;
              const rank = sortedPlayers.findIndex((p) => p.id === player.id) + 1;

              return (
                <div
                  key={player.id}
                  onClick={() => setSelectedPlayerId(player.id)}
                  className={`p-3 sm:p-3.5 flex items-center justify-between cursor-pointer transition-all duration-150 border rounded-xl ${
                    isSelected
                      ? 'border-indigo-600 ring-2 ring-indigo-500/30 bg-indigo-50/50 shadow-md'
                      : 'border-zinc-200/90 hover:border-zinc-300 bg-white shadow-sm'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white font-black text-xs shadow-sm flex-shrink-0"
                      style={{ backgroundColor: player.color }}
                    >
                      {player.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="truncate">
                      <h4 className={`font-extrabold text-sm sm:text-base truncate leading-tight ${isSelected ? 'text-indigo-900' : 'text-zinc-900'}`}>
                        {player.name}
                      </h4>
                      <span className="text-[10px] font-bold text-zinc-400">
                        #{rank}
                      </span>
                    </div>
                  </div>

                  {/* Empty space in the middle of half-screen rectangle card */}
                  <div className="flex-1" />

                  <div className="text-right flex-shrink-0 pl-2 min-w-[44px]">
                    <span
                      className={`text-xl sm:text-2xl font-black ${
                        player.score < 0
                          ? 'text-rose-600'
                          : player.score > 0
                          ? 'text-indigo-900'
                          : 'text-zinc-700'
                      }`}
                    >
                      {player.score > 0 ? `+${player.score}` : player.score}
                    </span>
                    <span className="text-[9px] text-zinc-400 font-bold block uppercase leading-none">
                      pts
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* BOTTOM SECTION: REDESIGNED CALCULATOR       */}
      <div className="bg-white rounded-t-3xl border-t border-zinc-200 shadow-2xl p-4 sm:p-5 min-h-[38vh] flex flex-col justify-between space-y-3 z-20">
        {/* TOP ROW: Mode Toggle (Left) | Target Player (Right) */}
        <div className="flex items-center justify-between gap-2 border-b border-zinc-100 pb-2">
          {/* Top Left: Add / Subtract Mode Toggle */}
          <div className="flex items-center p-0.5 rounded-2xl bg-zinc-100 border border-zinc-200 flex-shrink-0">
            <button
              onClick={() => setScoreMode('add')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1 transition ${
                scoreMode === 'add'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>ADD</span>
            </button>
            <button
              onClick={() => setScoreMode('subtract')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1 transition ${
                scoreMode === 'subtract'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <Minus className="w-3.5 h-3.5" />
              <span>SUBTRACT</span>
            </button>
          </div>

          {/* Top Right: Target Player Indicator */}
          <div className="flex items-center gap-1.5 bg-zinc-100 px-3.5 py-1.5 rounded-2xl border border-zinc-200/80 flex-shrink-0">
            <span className="text-[10px] font-bold text-zinc-400 uppercase">Target:</span>
            <span className="text-xs font-extrabold text-indigo-900 truncate max-w-[120px]">
              {selectedPlayer?.name || 'Select Player'}
            </span>
          </div>
        </div>

        {/* MIDDLE AREA: INTERACTIVE DIRECT NUMERIC INPUT DISPLAY */}
        <div className="flex-1 flex flex-col items-center justify-center py-2 text-center">
          <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest block mb-0.5">
            TYPE OR SELECT POINT VALUE
          </span>
          <div className="flex items-center justify-center gap-1">
            <span
              className={`text-3xl sm:text-4xl font-black ${
                scoreMode === 'add' ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              {scoreMode === 'add' ? '+' : '-'}
            </span>

            <input
              type="text"
              inputMode="numeric"
              value={
                customInput !== ''
                  ? customInput
                  : selectedBalls.length > 0
                  ? String(selectedBallsSum)
                  : ''
              }
              onChange={(e) => handleDirectNumberInput(e.target.value)}
              placeholder="0"
              className={`w-24 sm:w-32 text-center text-4xl sm:text-5xl font-black tracking-tight bg-transparent border-b-2 border-zinc-200 focus:border-indigo-600 focus:outline-none transition ${
                currentInputValue === 0
                  ? 'text-zinc-300'
                  : scoreMode === 'add'
                  ? 'text-emerald-600'
                  : 'text-rose-600'
              }`}
            />

            <span className="text-xs font-extrabold text-zinc-400 uppercase self-end mb-2">
              PTS
            </span>
          </div>
        </div>

        {/* BOTTOM ROW: [ Quick Balls Drawer Button ] on Left & [ CONFIRM ] on Right */}
        <div className="flex items-center justify-between gap-3 pt-1">
          {/* Bottom Left: Quick Balls Drawer Toggle */}
          <button
            onClick={() => setIsBallsDrawerOpen(!isBallsDrawerOpen)}
            className={`px-4 py-2.5 rounded-2xl border font-extrabold text-xs flex items-center gap-1.5 transition flex-shrink-0 ${
              isBallsDrawerOpen || selectedBalls.length > 0
                ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-sm'
                : 'bg-zinc-50 border-zinc-200 text-zinc-700 hover:bg-zinc-100'
            }`}
          >
            <span className="text-sm">🎱</span>
            <span>
              {selectedBalls.length > 0
                ? `Balls (${selectedBalls.length})`
                : 'Quick Balls'}
            </span>
          </button>

          {/* Bottom Right: CONFIRM Button */}
          <button
            onClick={handleConfirmScore}
            disabled={currentInputValue === 0 || !selectedPlayer}
            className={`flex-1 py-2.5 px-4 rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 ${
              scoreMode === 'add'
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-rose-600 hover:bg-rose-700 text-white'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            <span>CONFIRM SCORE {currentInputValue > 0 ? `(${scoreMode === 'add' ? '+' : '-'}${currentInputValue})` : ''}</span>
            <Check className="w-4 h-4 stroke-[3]" />
          </button>
        </div>

        {/* EXPANDABLE QUICK BALLS DRAWER TRAY */}
        {isBallsDrawerOpen && (
          <div className="pt-2 border-t border-zinc-100 animate-fadeIn">
            <div className="flex items-center justify-between pb-1 px-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">
                Select Ball Point Value
              </span>
              {selectedBalls.length > 0 && (
                <span className="text-xs font-extrabold text-indigo-600">
                  Balls: {[...selectedBalls].sort((a, b) => a - b).map(b => `#${b}`).join(', ')} ({selectedBallsSum} pts)
                </span>
              )}
            </div>
            <div className="grid grid-cols-5 sm:grid-cols-8 gap-1.5 max-h-32 overflow-y-auto py-1 px-1">
              {BALL_DEFINITIONS.map((ball) => (
                <div key={ball.number} className="flex justify-center">
                  <PoolBall
                    number={ball.number}
                    size="md"
                    selected={selectedBalls.includes(ball.number)}
                    onClick={() => handleSelectBall(ball.number)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
