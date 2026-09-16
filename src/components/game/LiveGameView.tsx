import React, { useState, useRef, useMemo, useEffect } from 'react';
import { RotateCcw, Flag, Plus, Minus, Check, Settings, Flame } from 'lucide-react';
import { GameSession } from '@/types/game';
import { AppSettings } from '@/types/settings';
import { BALL_DEFINITIONS } from '@/lib/gameLogic';
import { PoolBall } from '../ui/PoolBall';
import { AdvancedFlameBorder } from '../ui/AdvancedFlameBorder';
import { UnderworldAlertModal, UnderworldAlertData } from './UnderworldAlertModal';
import { requestScreenWakeLock, releaseScreenWakeLock, isStandaloneMode } from '@/lib/wakeLockManager';

interface LiveGameViewProps {
  session: GameSession;
  settings?: AppSettings;
  onUpdateSession: (session: GameSession) => void;
  onEndGame: () => void;
  onOpenSettings?: () => void;
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}`;
}

function getTimestamp(): number {
  return Date.now();
}

function getRandomCompanion(players: { name: string }[]): { name: string } {
  return players[Math.floor(Math.random() * players.length)];
}

export function LiveGameView({
  session,
  settings,
  onUpdateSession,
  onEndGame,
  onOpenSettings,
}: LiveGameViewProps) {
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>(
    session.players[0]?.id || ''
  );

  const [scoreMode, setScoreMode] = useState<'add' | 'subtract'>('add');
  const [selectedBalls, setSelectedBalls] = useState<number[]>([]);
  const [customInput, setCustomInput] = useState<string>('');
  const [isBallsDrawerOpen, setIsBallsDrawerOpen] = useState<boolean>(false);
  const [lastNotification, setLastNotification] = useState<string | null>(null);

  // Underworld / Point of No Return alert state
  const [underworldAlert, setUnderworldAlert] = useState<UnderworldAlertData | null>(null);

  // Track player IDs that have fallen <= -50 during this session
  const deadPlayerIdsEver = useRef<Set<string>>(
    new Set(session.players.filter((p) => p.score <= -50).map((p) => p.id))
  );

  // Track which player cards are currently displaying cracks
  const [crackedPlayerIds, setCrackedPlayerIds] = useState<Set<string>>(
    () => new Set(session.players.filter((p) => p.score <= -50).map((p) => p.id))
  );

  // Briefly pulse newly cracked card
  const [recentlyCrackedPlayerId, setRecentlyCrackedPlayerId] = useState<string | null>(null);

  // Player currently experiencing the resurrection flash of light
  const [resurrectingPlayerId, setResurrectingPlayerId] = useState<string | null>(null);

  // Briefly show extinguished badge when player loses a hot streak of >= 2
  const [extinguishedPlayerId, setExtinguishedPlayerId] = useState<string | null>(null);

  // Calculate hot hand streaks directly from session history (resets on subtract)
  const playerStreaks = useMemo(() => {
    const streaks: Record<string, number> = {};
    for (const player of session.players) {
      let streak = 0;
      for (const tx of session.history) {
        if (tx.playerId === player.id) {
          if (tx.type === 'add') {
            streak++;
          } else {
            break; // Streak broken by foul/subtraction
          }
        }
      }
      streaks[player.id] = streak;
    }
    return streaks;
  }, [session.players, session.history]);

  // Screen Wake Lock
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isStandalone = isStandaloneMode();
    if (settings?.keepScreenAwake && isStandalone) {
      requestScreenWakeLock();
    } else {
      releaseScreenWakeLock();
    }
  }, [settings?.keepScreenAwake]);

  const selectedPlayer = session.players.find((p) => p.id === selectedPlayerId);

  // Sum points of all selected balls
  const selectedBallsSum = selectedBalls.reduce((acc, ballNum) => {
    const ballDef = BALL_DEFINITIONS.find((b) => b.number === ballNum);
    return acc + (ballDef?.points || 0);
  }, 0);

  // Active point value — custom input takes priority over ball selection
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

  const isDialogueEnabled = settings?.underworldDialogue ?? false;

  const handleConfirmScore = () => {
    if (!selectedPlayer) return;
    if (currentInputValue === 0) return;

    const oldScore = selectedPlayer.score;
    const changeAmount = scoreMode === 'add' ? currentInputValue : -currentInputValue;
    const newScore = oldScore + changeAmount;
    const alertId = generateId('alert');

    // If subtracting, check if a hot streak was extinguished (streak >= 4)
    if (scoreMode === 'subtract') {
      const prevStreak = playerStreaks[selectedPlayer.id] || 0;
      if (prevStreak >= 4) {
        setExtinguishedPlayerId(selectedPlayer.id);
        setTimeout(() => setExtinguishedPlayerId(null), 2500);
      }
    }

    // Check for Underworld boundary transitions (at -50 points) ONLY IF dialogue setting is enabled
    if (isDialogueEnabled) {
      if (oldScore > -50 && newScore <= -50) {
        // Player crossed into the dead
        if (deadPlayerIdsEver.current.has(selectedPlayer.id)) {
          // Has died before -> Re-death
          setUnderworldAlert({
            id: alertId,
            playerId: selectedPlayer.id,
            playerName: selectedPlayer.name,
            type: 're_death',
            score: newScore,
          });
        } else {
          // First time dying
          deadPlayerIdsEver.current.add(selectedPlayer.id);

          // Check if other players are already dead
          const otherDeadPlayers = session.players.filter(
            (p) => p.id !== selectedPlayer.id && p.score <= -50
          );

          if (otherDeadPlayers.length > 0) {
            // Greeted by a fellow dead player
            const randomCompanion = getRandomCompanion(otherDeadPlayers);
            setUnderworldAlert({
              id: alertId,
              playerId: selectedPlayer.id,
              playerName: selectedPlayer.name,
              type: 'companion_death',
              companionName: randomCompanion.name,
              score: newScore,
            });
          } else {
            // Solo death
            setUnderworldAlert({
              id: alertId,
              playerId: selectedPlayer.id,
              playerName: selectedPlayer.name,
              type: 'first_death',
              score: newScore,
            });
          }
        }
      } else if (oldScore <= -50 && newScore > -50) {
        // Player rose back above -50 -> Resurrection
        setUnderworldAlert({
          id: alertId,
          playerId: selectedPlayer.id,
          playerName: selectedPlayer.name,
          type: 'resurrection',
          score: newScore,
        });
      }
    }

    const transaction = {
      id: generateId('tx'),
      playerId: selectedPlayer.id,
      playerName: selectedPlayer.name,
      amount: currentInputValue,
      type: scoreMode,
      ballNumber: selectedBalls.length === 1 ? selectedBalls[0] : undefined,
      timestamp: getTimestamp(),
    };

    const updatedPlayers = session.players.map((p) =>
      p.id === selectedPlayer.id ? { ...p, score: newScore } : p
    );

    const updatedSession: GameSession = {
      ...session,
      players: updatedPlayers,
      history: [transaction, ...session.history],
      updatedAt: getTimestamp(),
    };

    onUpdateSession(updatedSession);

    const sign = scoreMode === 'add' ? '+' : '-';
    if (scoreMode === 'subtract' && (playerStreaks[selectedPlayer.id] || 0) >= 4) {
      setLastNotification(`🧊 STREAK EXTINGUISHED! ${selectedPlayer.name}: -${currentInputValue} pts`);
    } else {
      setLastNotification(`${selectedPlayer.name}: ${sign}${currentInputValue} pts`);
    }
    setTimeout(() => setLastNotification(null), 2500);

    setSelectedBalls([]);
    setCustomInput('');
  };

  const handleSequenceComplete = (completedAlert: UnderworldAlertData) => {
    setUnderworldAlert(null);

    if (completedAlert.type === 'resurrection') {
      // Trigger huge flash of light from the whole card for ~2 seconds
      setResurrectingPlayerId(completedAlert.playerId);

      // Halfway through the flash (at 900ms), clear cracks so they dissolve under the light
      setTimeout(() => {
        setCrackedPlayerIds((prev) => {
          const next = new Set(prev);
          next.delete(completedAlert.playerId);
          return next;
        });
      }, 900);

      // Light finishes fading after ~2.3s
      setTimeout(() => {
        setResurrectingPlayerId(null);
      }, 2300);
    } else {
      // Player died -> card cracks with dramatic, slower fracture shudder!
      setCrackedPlayerIds((prev) => new Set([...prev, completedAlert.playerId]));
      setRecentlyCrackedPlayerId(completedAlert.playerId);
      setTimeout(() => setRecentlyCrackedPlayerId(null), 1200);
    }
  };

  const handleUndo = () => {
    if (session.history.length === 0) return;

    const [lastTx, ...remainingHistory] = session.history;
    const targetPlayer = session.players.find((p) => p.id === lastTx.playerId);
    if (!targetPlayer) return;

    const revertAmount = lastTx.type === 'add' ? -lastTx.amount : lastTx.amount;
    const revertedScore = targetPlayer.score + revertAmount;
    const updatedPlayers = session.players.map((p) =>
      p.id === lastTx.playerId ? { ...p, score: revertedScore } : p
    );

    onUpdateSession({
      ...session,
      players: updatedPlayers,
      history: remainingHistory,
      updatedAt: Date.now(),
    });

    // Synchronize cracked state on undo
    if (revertedScore > -50) {
      setCrackedPlayerIds((prev) => {
        const next = new Set(prev);
        next.delete(targetPlayer.id);
        return next;
      });
    } else if (isDialogueEnabled) {
      setCrackedPlayerIds((prev) => new Set([...prev, targetPlayer.id]));
    }

    setUnderworldAlert(null);
    setLastNotification(`Undid last score for ${lastTx.playerName}`);
    setTimeout(() => setLastNotification(null), 2500);
  };

  const isTargetCracked = isDialogueEnabled && (selectedPlayer ? crackedPlayerIds.has(selectedPlayer.id) : false);
  const isDark = settings?.darkMode ?? false;

  return (
    <div
      className={`w-full max-w-2xl mx-auto h-[100dvh] flex flex-col justify-between overflow-hidden relative transition-colors ${
        isDark ? 'bg-[#121214] text-zinc-100' : 'bg-[#F4F2EC] text-[#1C1C1E]'
      } ${underworldAlert ? 'pointer-events-none select-none' : ''}`}
    >
      {/* Underworld Standalone Tombstone Cutscene (only if dialogue is enabled) */}
      {isDialogueEnabled && (
        <UnderworldAlertModal
          key={underworldAlert ? underworldAlert.id : 'no-underworld-alert'}
          alert={underworldAlert}
          onSequenceComplete={handleSequenceComplete}
          isDark={isDark}
        />
      )}

      {/* top section — player cards */}
      <div className="flex-1 flex flex-col min-h-0 px-4 pt-3 pb-2 space-y-2.5 overflow-hidden">
        {/* Header */}
        <div
          className={`flex items-center justify-between pb-2 border-b-2 ${
            isDark ? 'border-zinc-800' : 'border-zinc-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <h1
              className={`text-xl font-black italic tracking-widest bg-clip-text text-transparent font-serif uppercase ${
                isDark
                  ? 'bg-gradient-to-r from-white via-indigo-200 to-indigo-400'
                  : 'bg-gradient-to-r from-zinc-900 via-indigo-950 to-indigo-800'
              }`}
            >
              BILLIARD
            </h1>
            <span
              className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                isDark
                  ? 'bg-emerald-950/50 text-emerald-300 border border-emerald-800/60'
                  : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              LIVE
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleUndo}
              disabled={session.history.length === 0}
              className={`px-3 py-1.5 rounded-full border font-bold text-xs flex items-center gap-1 disabled:opacity-40 shadow-sm transition ${
                isDark
                  ? 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-white'
                  : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-100'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Undo</span>
            </button>

            {onOpenSettings && (
              <button
                onClick={onOpenSettings}
                title="Settings"
                aria-label="Settings"
                className={`p-1.5 rounded-full border shadow-sm transition active:scale-90 ${
                  isDark
                    ? 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-white'
                    : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-100'
                }`}
              >
                <Settings className="w-4 h-4" />
              </button>
            )}

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
          <div
            className={`px-3 py-1 rounded-xl text-xs font-bold text-center shadow-md animate-fadeIn ${
              isDark
                ? 'bg-zinc-800 text-zinc-100 border border-zinc-700'
                : 'bg-zinc-900 text-white'
            }`}
          >
            {lastNotification}
          </div>
        )}

        {/* player cards grid */}
        <div className="flex-1 overflow-y-auto pr-1 py-1">
          <div className="grid grid-cols-2 gap-2">
            {session.players.map((player) => {
              const isSelected = player.id === selectedPlayerId;
              // Official tournament rank accommodating ties/draws
              const strictlyHigher = session.players.filter((p) => p.score > player.score).length;
              const sameScore = session.players.filter((p) => p.score === player.score).length;
              const rank = strictlyHigher + 1;
              const isTied = sameScore > 1;
              const displayRank = isTied ? `T-#${rank}` : `#${rank}`;
              const isCoLeader = rank === 1 && isTied;

              const isCracked = isDialogueEnabled && crackedPlayerIds.has(player.id);
              const isJustCracked = recentlyCrackedPlayerId === player.id;
              const isResurrecting = resurrectingPlayerId === player.id;
              const streak = playerStreaks[player.id] || 0;
              const hasHotStreak = (settings?.hotHandStreaks ?? true) && streak >= 4;
              const isExtinguished = extinguishedPlayerId === player.id;
              const showCrown = (settings?.showLeaderCrown ?? true) && rank === 1 && player.score > 0;

              return (
                <div
                  key={player.id}
                  onClick={() => setSelectedPlayerId(player.id)}
                  className={`relative p-3 sm:p-3.5 flex items-center justify-between cursor-pointer transition-all duration-150 border rounded-xl ${
                    isSelected
                      ? isDark
                        ? hasHotStreak
                          ? 'border-red-600 ring-2 ring-red-500/40 bg-indigo-950/40 shadow-md'
                          : 'border-indigo-500 ring-2 ring-indigo-500/30 bg-indigo-950/40 shadow-md'
                        : hasHotStreak
                          ? 'border-red-600 ring-2 ring-red-500/40 bg-indigo-50/50 shadow-md'
                          : 'border-indigo-600 ring-2 ring-indigo-500/30 bg-indigo-50/50 shadow-md'
                      : isDark
                      ? hasHotStreak
                        ? 'border-red-600/90 bg-zinc-900 shadow-[0_0_12px_rgba(220,38,38,0.3)]'
                        : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900 shadow-sm'
                      : hasHotStreak
                      ? 'border-red-600/90 bg-white shadow-[0_0_12px_rgba(220,38,38,0.2)]'
                      : 'border-zinc-200/90 hover:border-zinc-300 bg-white shadow-sm'
                  } ${isJustCracked ? 'animate-crackPop' : ''}`}
                >
                  {/* Advanced Flames wrapping around all card margins */}
                  {hasHotStreak && <AdvancedFlameBorder streak={streak} />}

                  {/* Table Leader Crown - perched on top right of the card, tilted to the right like a hat */}
                  {showCrown && (
                    <div
                      title={isCoLeader ? 'Co-Leader (Tied for #1)' : 'Table Leader (#1)'}
                      className="absolute -top-3.5 -right-2 z-30 transform rotate-[16deg] filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.35)] select-none pointer-events-none text-2xl sm:text-[26px] leading-none"
                    >
                      👑
                    </div>
                  )}

                  {/* Inner clipped effects (Resurrection light & stress fractures) */}
                  <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none z-10">
                    {/* Radiant Moving Light Sweep & Shimmer (Lazy-Loading Style) */}
                    {isResurrecting && (
                      <div className="absolute inset-0 z-30 pointer-events-none rounded-xl overflow-hidden animate-auraGlow border-2 border-emerald-400/90 shadow-[0_0_35px_rgba(255,255,255,0.9)]">
                        {/* Sweeping diagonal beam of brilliant light moving across the card */}
                        <div
                          className="absolute inset-0 w-full h-full animate-lightSweep"
                          style={{
                            background:
                              'linear-gradient(105deg, transparent 15%, rgba(255,255,255,0.6) 38%, rgba(255,255,255,1) 50%, rgba(254,240,138,0.8) 62%, transparent 85%)',
                          }}
                        />
                        {/* Ambient luminous glow overlay */}
                        <div className="absolute inset-0 bg-white/35 backdrop-brightness-125" />
                      </div>
                    )}

                    {/* Realistic Stress Fracture / Cracks (Maintains existing theme) */}
                    {isCracked && (
                      <svg
                        className="absolute inset-0 w-full h-full pointer-events-none"
                        preserveAspectRatio="none"
                        viewBox="0 0 200 100"
                      >
                        {/* Deep jagged primary crack lines */}
                        <path
                          d="M 14 0 L 38 28 L 28 54 L 52 82 L 40 100 M 38 28 L 82 36 L 126 14 L 155 22 M 82 36 L 96 70 L 132 100 M 28 54 L 8 76"
                          stroke={isDark ? '#E4E4E7' : '#18181B'}
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          fill="none"
                          opacity={isDark ? 0.85 : 0.8}
                        />
                        {/* Secondary stress fractures */}
                        <path
                          d="M 175 0 L 155 22 L 172 48 L 194 66 M 172 48 L 145 60 L 120 54"
                          stroke={isDark ? '#A1A1AA' : '#3F3F46'}
                          strokeWidth="1.1"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          fill="none"
                          opacity={isDark ? 0.75 : 0.65}
                        />
                        {/* Fine hairline fissures */}
                        <path
                          d="M 52 82 L 76 86 M 126 14 L 142 4"
                          stroke={isDark ? '#71717A' : '#71717A'}
                          strokeWidth="0.8"
                          strokeLinecap="round"
                          fill="none"
                          opacity={isDark ? 0.6 : 0.5}
                        />
                      </svg>
                    )}
                  </div>

                  <div className="relative z-20 flex items-center gap-2.5 truncate">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white font-black text-xs shadow-sm flex-shrink-0 relative overflow-hidden"
                      style={{ backgroundColor: player.color }}
                    >
                      {player.name.slice(0, 2).toUpperCase()}
                      {isCracked && (
                        <div className="absolute inset-0 bg-zinc-950/40 flex items-center justify-center text-[11px]">
                          💀
                        </div>
                      )}
                    </div>
                    <div className="truncate">
                      <div className="flex items-center gap-1.5 truncate">
                        <h4
                          className={`font-extrabold text-sm sm:text-base truncate leading-tight ${
                            isSelected
                              ? isDark
                                ? 'text-indigo-300'
                                : 'text-indigo-900'
                              : isDark
                              ? 'text-zinc-100'
                              : 'text-zinc-900'
                          }`}
                        >
                          {player.name}
                        </h4>
                      </div>

                      {/* Status / Streaks / Cracks Badges */}
                      <div className="flex items-center gap-1 mt-0.5">
                        {isCracked ? (
                          <span
                            className={`inline-flex items-center gap-0.5 text-[9px] font-black px-1.5 py-0.2 rounded border uppercase tracking-wider ${
                              isDark
                                ? 'bg-zinc-800 text-zinc-300 border-zinc-700'
                                : 'bg-zinc-100 text-zinc-700 border-zinc-300/90'
                            }`}
                          >
                            🪦 RIP {displayRank}
                          </span>
                        ) : isExtinguished ? (
                          <span
                            className={`inline-flex items-center gap-0.5 text-[9px] font-black px-1.5 py-0.2 rounded border uppercase tracking-wider animate-pulse ${
                              isDark
                                ? 'bg-cyan-950/50 text-cyan-300 border-cyan-800'
                                : 'bg-cyan-100 text-cyan-700 border-cyan-300'
                            }`}
                          >
                            🧊 EXTINGUISHED!
                          </span>
                        ) : hasHotStreak ? (
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-black px-1.5 py-0.5 rounded-full bg-gradient-to-r from-red-700 via-red-600 to-rose-700 text-white shadow-sm uppercase tracking-wider">
                            <Flame className="w-2.5 h-2.5 fill-rose-200 text-rose-200" />
                            <span>{streak}-STREAK</span>
                          </span>
                        ) : (
                          <span
                            className={`text-[10px] font-bold ${
                              isCoLeader
                                ? isDark
                                  ? 'text-amber-400 font-extrabold'
                                  : 'text-amber-600 font-extrabold'
                                : isDark
                                ? 'text-zinc-500'
                                : 'text-zinc-400'
                            }`}
                            title={isTied ? `Tied for #${rank}` : `Rank #${rank}`}
                          >
                            {displayRank}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* spacer */}
                  <div className="flex-1" />

                  <div className="relative z-20 text-right flex-shrink-0 pl-2 min-w-[44px]">
                    <span
                      className={`text-xl sm:text-2xl font-black ${
                        player.score < 0
                          ? 'text-rose-500'
                          : player.score > 0
                          ? isDark
                            ? 'text-indigo-400'
                            : 'text-indigo-900'
                          : isDark
                          ? 'text-zinc-300'
                          : 'text-zinc-700'
                      }`}
                    >
                      {player.score > 0 ? `+${player.score}` : player.score}
                    </span>
                    <span
                      className={`text-[9px] font-bold block uppercase leading-none ${
                        isCracked
                          ? 'text-rose-500 font-black'
                          : isDark
                          ? 'text-zinc-500'
                          : 'text-zinc-400'
                      }`}
                    >
                      {isCracked ? 'CRACKED' : 'pts'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* bottom calculator panel */}
      <div
        className={`rounded-t-3xl border-t shadow-2xl p-4 sm:p-5 min-h-[38vh] flex flex-col justify-between space-y-3 z-20 transition-colors ${
          isDark
            ? 'bg-zinc-900 border-zinc-800 text-zinc-100'
            : 'bg-white border-zinc-200 text-zinc-900'
        }`}
      >
        {/* mode toggle and active player */}
        <div
          className={`flex items-center justify-between gap-2 pb-2 border-b ${
            isDark ? 'border-zinc-800' : 'border-zinc-100'
          }`}
        >
          {/* add / subtract toggle */}
          <div
            className={`flex items-center p-0.5 rounded-2xl border flex-shrink-0 ${
              isDark ? 'bg-zinc-800 border-zinc-700' : 'bg-zinc-100 border-zinc-200'
            }`}
          >
            <button
              onClick={() => setScoreMode('add')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1 transition ${
                scoreMode === 'add'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : isDark
                  ? 'text-zinc-400 hover:text-zinc-200'
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
                  : isDark
                  ? 'text-zinc-400 hover:text-zinc-200'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <Minus className="w-3.5 h-3.5" />
              <span>SUBTRACT</span>
            </button>
          </div>

          {/* which player is being scored */}
          <div
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-2xl border flex-shrink-0 transition-colors ${
              isDark
                ? isTargetCracked
                  ? 'bg-zinc-800 border-zinc-700 text-zinc-200'
                  : 'bg-zinc-800/80 border-zinc-700 text-indigo-300'
                : isTargetCracked
                ? 'bg-zinc-100 border-zinc-300 text-zinc-900'
                : 'bg-zinc-100 border-zinc-200/80 text-indigo-900'
            }`}
          >
            <span
              className={`text-[10px] font-bold uppercase ${
                isDark ? 'text-zinc-500' : 'text-zinc-400'
              }`}
            >
              Target:
            </span>
            <span className="text-xs font-extrabold truncate max-w-[130px] flex items-center gap-1">
              {isTargetCracked && <span>💀</span>}
              <span>{selectedPlayer?.name || 'Select Player'}</span>
              {(settings?.hotHandStreaks ?? true) && (playerStreaks[selectedPlayer?.id || ''] || 0) >= 4 && (
                <span className="text-red-500 flex items-center text-[10px]" title="Hot Streak">
                  🔥
                </span>
              )}
            </span>
          </div>
        </div>

        {/* score input — type a number or use the ball picker */}
        <div className="flex-1 flex flex-col items-center justify-center py-2 text-center">
          <span
            className={`text-[10px] font-extrabold uppercase tracking-widest block mb-0.5 ${
              isDark ? 'text-zinc-500' : 'text-zinc-400'
            }`}
          >
            TYPE OR SELECT POINT VALUE
          </span>
          <div className="flex items-center justify-center gap-1">
            <span
              className={`text-3xl sm:text-4xl font-black ${
                scoreMode === 'add' ? 'text-emerald-500' : 'text-rose-500'
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
              className={`w-24 sm:w-32 text-center text-4xl sm:text-5xl font-black tracking-tight bg-transparent border-b-2 transition ${
                isDark
                  ? 'border-zinc-700 focus:border-indigo-500 focus:outline-none'
                  : 'border-zinc-200 focus:border-indigo-600 focus:outline-none'
              } ${
                currentInputValue === 0
                  ? isDark
                    ? 'text-zinc-600 placeholder:text-zinc-600'
                    : 'text-zinc-300 placeholder:text-zinc-300'
                  : scoreMode === 'add'
                  ? 'text-emerald-500'
                  : 'text-rose-500'
              }`}
            />

            <span
              className={`text-xs font-extrabold uppercase self-end mb-2 ${
                isDark ? 'text-zinc-500' : 'text-zinc-400'
              }`}
            >
              PTS
            </span>
          </div>
        </div>

        {/* quick balls toggle on the left, confirm button on the right */}
        <div className="flex items-center justify-between gap-3 pt-1">
          {/* opens / closes the ball picker tray */}
          <button
            onClick={() => setIsBallsDrawerOpen(!isBallsDrawerOpen)}
            className={`px-4 py-2.5 rounded-2xl border font-extrabold text-xs flex items-center gap-1.5 transition flex-shrink-0 ${
              isBallsDrawerOpen || selectedBalls.length > 0
                ? isDark
                  ? 'bg-indigo-950/40 border-indigo-700 text-indigo-300 shadow-sm'
                  : 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-sm'
                : isDark
                ? 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-750'
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

          {/* confirm and apply the score */}
          <button
            onClick={handleConfirmScore}
            disabled={currentInputValue === 0 || !selectedPlayer}
            className={`flex-1 py-2.5 px-4 rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 ${
              scoreMode === 'add'
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                : 'bg-rose-600 hover:bg-rose-500 text-white'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            <span>CONFIRM SCORE {currentInputValue > 0 ? `(${scoreMode === 'add' ? '+' : '-'}${currentInputValue})` : ''}</span>
            <Check className="w-4 h-4 stroke-[3]" />
          </button>
        </div>

        {/* expandable ball picker */}
        {isBallsDrawerOpen && (
          <div
            className={`pt-2 border-t animate-fadeIn ${
              isDark ? 'border-zinc-800' : 'border-zinc-100'
            }`}
          >
            <div className="flex items-center justify-between pb-1 px-1">
              <span
                className={`text-[10px] font-extrabold uppercase tracking-wider ${
                  isDark ? 'text-zinc-500' : 'text-zinc-400'
                }`}
              >
                Select Ball Point Value
              </span>
              {selectedBalls.length > 0 && (
                <span
                  className={`text-xs font-extrabold ${
                    isDark ? 'text-indigo-400' : 'text-indigo-600'
                  }`}
                >
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
                    isDark={isDark}
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
