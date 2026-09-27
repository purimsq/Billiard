import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Users,
  ChevronRight,
  ChevronDown,
  Check,
  Trash2,
  Lock,
  HardDrive,
} from 'lucide-react';
import { GameSession, Player } from '@/types/game';
import {
  getGameHistory,
  deleteGameFromHistory,
  clearGameHistory,
  getCasualHistoryLimit,
  setCasualHistoryLimit,
} from '@/lib/storage';
import { MatchDetailsPage } from './MatchDetailsPage';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';

interface GameHistoryPageProps {
  onBack: () => void;
  isDark?: boolean;
}

export const GameHistoryPage: React.FC<GameHistoryPageProps> = ({ onBack, isDark = false }) => {
  const [history, setHistory] = useState<GameSession[]>(() => {
    if (typeof window === 'undefined') return [];
    return getGameHistory();
  });
  const [activeTab, setActiveTab] = useState<'casual' | 'ranked'>('casual');
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [isClearModalOpen, setIsClearModalOpen] = useState<boolean>(false);
  const [matchToDelete, setMatchToDelete] = useState<GameSession | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Casual Game Retention Limit State (Default 20, configurable up to 50)
  const [casualLimit, setCasualLimit] = useState<number>(() => {
    if (typeof window === 'undefined') return 20;
    return getCasualHistoryLimit();
  });
  const [isLimitDropdownOpen, setIsLimitDropdownOpen] = useState<boolean>(false);
  const [isLimitModalOpen, setIsLimitModalOpen] = useState<boolean>(false);
  const [targetLimit, setTargetLimit] = useState<number>(20);
  const [hasAcknowledgedStorage, setHasAcknowledgedStorage] = useState<boolean>(false);
  const retentionDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        retentionDropdownRef.current &&
        !retentionDropdownRef.current.contains(e.target as Node)
      ) {
        setIsLimitDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const reloadHistory = () => {
    setHistory(getGameHistory());
    setCasualLimit(getCasualHistoryLimit());
  };

  const handleSelectLimit = (newLim: number) => {
    if (newLim === casualLimit) return;
    setTargetLimit(newLim);
    setHasAcknowledgedStorage(false);
    setIsLimitModalOpen(true);
  };

  const handleConfirmLimitChange = () => {
    setCasualHistoryLimit(targetLimit);
    setCasualLimit(targetLimit);
    setIsLimitModalOpen(false);
    reloadHistory();
    setToastMessage(`Casual history retention limit updated to ${targetLimit} matches`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const casualGames = useMemo(
    () => history.filter((g) => (g.mode || 'casual') === 'casual'),
    [history]
  );
  const rankedGames = useMemo(
    () => history.filter((g) => g.mode === 'ranked'),
    [history]
  );
  const displayedGames = activeTab === 'casual' ? casualGames : rankedGames;

  // Selected game for Match Details Page
  const selectedGame = useMemo(() => {
    if (!selectedGameId) return null;
    return history.find((g) => g.id === selectedGameId) || null;
  }, [history, selectedGameId]);

  // Overall Stats Ribbon
  const summaryStats = useMemo(() => {
    const totalMatches = history.length;
    let highestScore = 0;
    let topScorerName = '—';
    let totalPoints = 0;
    let tieCount = 0;

    for (const game of history) {
      if (!game.players || game.players.length === 0) continue;
      const sorted = [...game.players].sort((a, b) => b.score - a.score);
      const topScore = sorted[0].score;
      if (topScore > highestScore) {
        highestScore = topScore;
        topScorerName = sorted[0].name;
      }
      if (sorted.length > 1 && sorted[0].score === sorted[1].score) {
        tieCount++;
      }
      for (const p of game.players) {
        if (p.score > 0) totalPoints += p.score;
      }
    }

    return {
      totalMatches,
      highestScore,
      topScorerName,
      totalPoints,
      tieCount,
    };
  }, [history]);

  const handleDelete = (id: string) => {
    deleteGameFromHistory(id);
    if (selectedGameId === id) {
      setSelectedGameId(null);
    }
    reloadHistory();
  };

  const handleConfirmClearCasual = () => {
    clearGameHistory('casual');
    reloadHistory();
    setToastMessage('Casual match records cleared');
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleConfirmDeleteMatch = () => {
    if (!matchToDelete) return;
    handleDelete(matchToDelete.id);
    setToastMessage('Match record deleted');
    setTimeout(() => setToastMessage(null), 2500);
    setMatchToDelete(null);
  };

  const formatMatchDate = (timestamp: number) => {
    try {
      const d = new Date(timestamp);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

      if (diffHours < 1) return 'Just recently';
      if (diffHours < 24) {
        return `Today, ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      }
      if (diffHours < 48) {
        return `Yesterday, ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      }

      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return 'Recent match';
    }
  };

  const getWinnerInfo = (players: Player[]) => {
    if (!players || players.length === 0) return null;
    const sorted = [...players].sort((a, b) => b.score - a.score);
    const maxScore = sorted[0].score;
    const leaders = sorted.filter((p) => p.score === maxScore);

    if (leaders.length > 1) {
      return {
        isDraw: true,
        leaders,
        maxScore,
        margin: 0,
      };
    }

    const runnerUpScore = sorted[1] ? sorted[1].score : 0;
    const margin = maxScore - runnerUpScore;

    return {
      isDraw: false,
      winner: sorted[0],
      runnerUp: sorted[1],
      maxScore,
      margin,
    };
  };

  // If a specific match is opened, show the detailed MatchDetailsPage
  if (selectedGame) {
    return (
      <MatchDetailsPage
        game={selectedGame}
        onBack={() => setSelectedGameId(null)}
        onDeleteMatch={handleDelete}
        isDark={isDark}
      />
    );
  }

  return (
    <div
      className={`w-full max-w-2xl mx-auto min-h-screen px-4 py-3 space-y-6 animate-fadeIn pb-14 ${
        isDark ? 'text-zinc-100' : 'text-zinc-900'
      }`}
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl bg-zinc-900/95 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-2xl border border-zinc-700/60 dark:border-zinc-300 text-xs font-black flex items-center gap-2 animate-fadeIn max-w-[92vw]">
          <Check className="w-4 h-4 text-emerald-400 flex-shrink-0 stroke-[3]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header matching app standard */}
      <div
        className={`flex items-center justify-between pb-2 border-b ${
          isDark ? 'border-zinc-800' : 'border-zinc-200'
        }`}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            aria-label="Back to Settings"
            className={`p-1.5 -ml-1 rounded-full transition-all active:scale-90 flex items-center gap-1 ${
              isDark
                ? 'text-zinc-300 hover:text-white hover:bg-zinc-800'
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/70'
            }`}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1
            className={`text-xl sm:text-2xl font-black italic tracking-widest bg-clip-text text-transparent font-serif uppercase ${
              isDark
                ? 'bg-gradient-to-r from-red-500 via-blue-500 to-purple-400'
                : 'bg-gradient-to-r from-red-600 via-black to-purple-600'
            }`}
          >
            BILLIARD
          </h1>
        </div>

        <span
          className={`text-[10px] font-extrabold uppercase tracking-widest font-serif italic ${
            isDark ? 'text-zinc-400' : 'text-zinc-600'
          }`}
        >
          HISTORY
        </span>
      </div>

      {/* Compact Title Section */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight uppercase font-serif">
            GAME HISTORY
          </h2>
          <p className={`text-xs font-medium ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
            Completed matches, verified outcomes, and scoring records.
          </p>
        </div>
      </div>

      {/* Google-Style Metric Stats Bar (Clean, Minimalist, Directly on Page) */}
      <div
        className={`border-t border-b py-3 grid grid-cols-4 divide-x ${
          isDark
            ? 'border-zinc-800 divide-zinc-800/80 bg-zinc-900/20'
            : 'border-zinc-200 divide-zinc-200/80 bg-zinc-50/50'
        }`}
      >
        <div className="px-2 sm:px-3 text-center">
          <span className="text-[9px] font-black uppercase tracking-wider text-zinc-400 block">
            Games
          </span>
          <span className="text-lg sm:text-xl font-black font-mono leading-tight">
            {summaryStats.totalMatches}
          </span>
        </div>

        <div className="px-2 sm:px-3 text-center">
          <span className="text-[9px] font-black uppercase tracking-wider text-zinc-400 block">
            Top Score
          </span>
          <span className="text-lg sm:text-xl font-black font-mono leading-tight text-amber-500">
            {summaryStats.highestScore}
          </span>
        </div>

        <div className="px-2 sm:px-3 text-center">
          <span className="text-[9px] font-black uppercase tracking-wider text-zinc-400 block">
            Points Sunk
          </span>
          <span className="text-lg sm:text-xl font-black font-mono leading-tight">
            {summaryStats.totalPoints}
          </span>
        </div>

        <div className="px-2 sm:px-3 text-center">
          <span className="text-[9px] font-black uppercase tracking-wider text-zinc-400 block">
            Draws
          </span>
          <span className="text-lg sm:text-xl font-black font-mono leading-tight">
            {summaryStats.tieCount}
          </span>
        </div>
      </div>

      {/* Segmented Filter Control & Actions */}
      <div className="flex items-center justify-between gap-3">
        {/* Modern Minimalist Segmented Pill */}
        <div
          className={`p-1 rounded-xl border flex items-center gap-1 ${
            isDark
              ? 'bg-zinc-900 border-zinc-800'
              : 'bg-zinc-100 border-zinc-200'
          }`}
        >
          <button
            type="button"
            onClick={() => setActiveTab('casual')}
            className={`py-1.5 px-3 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all ${
              activeTab === 'casual'
                ? isDark
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'bg-white text-zinc-900 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            <span>Casual Games</span>
            <span className="text-[10px] font-mono opacity-70">({casualGames.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ranked')}
            className={`py-1.5 px-3 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all ${
              activeTab === 'ranked'
                ? isDark
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'bg-white text-zinc-900 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            <span>Ranked Games</span>
            <span className="text-[10px] font-mono opacity-70">({rankedGames.length})</span>
          </button>
        </div>

        {/* Actions: Retention Tag Dropdown & Clear (Casual) or Protected Badge (Ranked) */}
        <div className="flex items-center gap-2">
          {activeTab === 'casual' ? (
            <>
              {/* Sleek Retention Tag with Dropdown Menu */}
              <div className="relative" ref={retentionDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsLimitDropdownOpen(!isLimitDropdownOpen)}
                  className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold font-mono flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer ${
                    isDark
                      ? 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700'
                      : 'bg-white border-zinc-200 text-zinc-700 hover:text-zinc-900 hover:border-zinc-300 shadow-2xs'
                  }`}
                  title={`Casual retention limit: ${casualLimit} games max`}
                >
                  <HardDrive className="w-3.5 h-3.5 text-emerald-500" />
                  <span>{casualLimit} Max</span>
                  <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isLimitDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu */}
                {isLimitDropdownOpen && (
                  <div
                    className={`absolute right-0 top-full mt-1.5 w-60 rounded-2xl border p-2 shadow-2xl z-40 animate-fadeIn ${
                      isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-100' : 'bg-white border-zinc-200 text-zinc-900'
                    }`}
                  >
                    <div className="px-2.5 py-1.5 border-b border-zinc-100 dark:border-zinc-800 mb-1">
                      <span className="text-[10px] font-black uppercase tracking-wider block text-zinc-400">
                        History Retention
                      </span>
                      <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                        {casualGames.length} / {casualLimit} Games Retained
                      </span>
                    </div>

                    <div className="space-y-0.5">
                      {[10, 20, 30, 40, 50].map((lim) => {
                        const isCurrent = casualLimit === lim;
                        return (
                          <button
                            key={lim}
                            type="button"
                            onClick={() => {
                              setIsLimitDropdownOpen(false);
                              handleSelectLimit(lim);
                            }}
                            className={`w-full px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                              isCurrent
                                ? isDark
                                  ? 'bg-emerald-500/15 text-emerald-400 font-bold'
                                  : 'bg-emerald-50 text-emerald-600 font-bold'
                                : isDark
                                ? 'hover:bg-zinc-800 text-zinc-300'
                                : 'hover:bg-zinc-100 text-zinc-700'
                            }`}
                          >
                            <span className="flex items-center gap-1.5">
                              <span>{lim} Matches</span>
                              {lim === 20 && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-500">
                                  Default
                                </span>
                              )}
                            </span>
                            {isCurrent && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {casualGames.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsClearModalOpen(true)}
                  className="text-[11px] font-medium text-zinc-400 hover:text-rose-500 transition flex items-center gap-1 px-2 py-1.5 rounded-xl hover:bg-rose-500/10"
                  title="Clear all casual records"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Clear</span>
                </button>
              )}
            </>
          ) : (
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold select-none ${
                isDark
                  ? 'border-zinc-800 bg-zinc-900/60 text-zinc-400'
                  : 'border-zinc-200 bg-zinc-50 text-zinc-500'
              }`}
              title="Official competitive record: Ranked matches cannot be cleared or deleted"
            >
              <Lock className="w-3 h-3 text-zinc-400" />
              <span className="hidden sm:inline">Database Synced (Protected)</span>
              <span className="sm:hidden">Protected</span>
            </div>
          )}
        </div>
      </div>

      {/* Match Fixture List (Google Sports / Search Style: Clean, Direct on Page, Compact) */}
      <div className="space-y-3">
        {displayedGames.length === 0 ? (
          <div
            className={`p-8 rounded-2xl border text-center space-y-2.5 ${
              isDark
                ? 'bg-zinc-900/30 border-zinc-800'
                : 'bg-zinc-50/50 border-zinc-200'
            }`}
          >
            <div className="text-zinc-400">
              <Users className="w-6 h-6 mx-auto opacity-50" />
            </div>
            <h4 className="font-bold text-sm">
              No {activeTab === 'casual' ? 'Casual' : 'Ranked'} Matches Recorded
            </h4>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto">
              {activeTab === 'casual'
                ? 'Matches played in casual mode will appear here.'
                : 'Matches played in competitive ranked mode will appear here.'}
            </p>
          </div>
        ) : (
          displayedGames.map((game) => {
            const winnerInfo = getWinnerInfo(game.players);
            const sorted = [...game.players].sort((a, b) => b.score - a.score);

            return (
              <div
                key={game.id}
                onClick={() => setSelectedGameId(game.id)}
                className={`p-4 rounded-2xl border transition-all duration-150 cursor-pointer group ${
                  isDark
                    ? 'bg-zinc-900/60 border-zinc-800 hover:bg-zinc-900 hover:border-zinc-700'
                    : 'bg-white border-zinc-200 hover:border-zinc-300 hover:shadow-sm'
                }`}
              >
                {/* 1. Header Bar: Date & Status */}
                <div className="flex items-center justify-between text-xs text-zinc-500 pb-2 mb-2 border-b border-zinc-100 dark:border-zinc-800/60">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                      {game.mode === 'ranked' ? '⚔️ Ranked Match' : '🟢 Casual Match'}
                    </span>
                    <span>•</span>
                    <span className="text-[11px]">{formatMatchDate(game.createdAt || game.updatedAt)}</span>
                  </div>

                  <div className="flex items-center gap-1 text-[11px] text-zinc-400">
                    <span>{game.history?.length || 0} {game.history?.length === 1 ? 'Event' : 'Events'}</span>
                  </div>
                </div>

                {/* 2. Google Sports Style Match Scoreboard */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                  {/* Left (Player rows with bold scores) */}
                  <div className="sm:col-span-9 space-y-1.5">
                    {sorted.map((player) => {
                      const isWinner =
                        winnerInfo && !winnerInfo.isDraw && winnerInfo.winner?.id === player.id;
                      const isTied = winnerInfo && winnerInfo.isDraw && player.score === winnerInfo.maxScore;

                      return (
                        <div
                          key={player.id}
                          className="flex items-center justify-between text-sm py-0.5"
                        >
                          <div className="flex items-center gap-2 min-w-0 pr-3">
                            <span
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: player.color || '#6366F1' }}
                            />
                            <span
                              className={`truncate ${
                                isWinner || isTied
                                  ? 'font-extrabold text-zinc-900 dark:text-zinc-100'
                                  : 'font-medium text-zinc-600 dark:text-zinc-400'
                              }`}
                            >
                              {player.name}
                            </span>
                            {isWinner && (
                              <span className="text-[10px] font-black text-amber-500">👑</span>
                            )}
                            {player.score <= -50 && (
                              <span className="text-[9px] font-bold text-rose-500">🪦</span>
                            )}
                          </div>

                          <div className="text-right flex-shrink-0">
                            <span
                              className={`font-mono text-base font-black tracking-tight ${
                                player.score < 0
                                  ? 'text-rose-500'
                                  : isWinner || isTied
                                  ? 'text-amber-500'
                                  : 'text-zinc-700 dark:text-zinc-300'
                              }`}
                            >
                              {player.score}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Right: View Details & Actions */}
                  <div className="sm:col-span-3 sm:border-l sm:border-zinc-100 dark:sm:border-zinc-800/80 sm:pl-3 flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1.5 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-100 dark:border-zinc-800/40">
                    <span className="text-[11px] font-bold text-zinc-400 text-right truncate">
                      {winnerInfo?.isDraw
                        ? '🤝 Dead Heat'
                        : `+${winnerInfo?.margin || 0} margin`}
                    </span>

                    <div className="flex items-center gap-2">
                      {game.mode === 'casual' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMatchToDelete(game);
                          }}
                          title="Delete casual match record"
                          className="p-1 rounded-md text-zinc-400 hover:text-rose-500 hover:bg-rose-500/10 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <div className="flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 group-hover:translate-x-0.5 transition-transform">
                        <span>Details</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Return to Settings Button at Bottom */}
      <div className="pt-2">
        <button
          type="button"
          onClick={onBack}
          className="w-full py-3 px-6 rounded-2xl bg-zinc-900 dark:bg-zinc-800 text-white font-black text-xs uppercase tracking-wider shadow-md hover:bg-indigo-600 dark:hover:bg-indigo-600 transition-all active:scale-[0.99] flex items-center justify-center gap-2"
        >
          <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
          <span>RETURN TO SETTINGS</span>
        </button>
      </div>

      {/* 2-Step Confirmation Modal: Clear Casual Matches */}
      <ConfirmationModal
        isOpen={isClearModalOpen}
        onClose={() => setIsClearModalOpen(false)}
        onConfirm={handleConfirmClearCasual}
        title="Clear Casual Match History?"
        message="Are you sure you want to permanently clear all casual match records from this device? Official ranked records will not be affected. This action cannot be undone."
        confirmText="Clear History"
        cancelText="Cancel"
        variant="danger"
        isDark={isDark}
      />

      {/* 2-Step Confirmation Modal: Delete Single Match */}
      <ConfirmationModal
        isOpen={matchToDelete !== null}
        onClose={() => setMatchToDelete(null)}
        onConfirm={handleConfirmDeleteMatch}
        title="Delete Match Record?"
        message={`Are you sure you want to permanently delete this casual match record (${
          matchToDelete ? matchToDelete.players.map((p) => p.name).join(' vs ') : ''
        })? This action cannot be undone.`}
        confirmText="Delete Match"
        cancelText="Cancel"
        variant="danger"
        isDark={isDark}
      />

      {/* Storage Limit Acknowledgment & Confirmation Modal */}
      {isLimitModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setIsLimitModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-sm rounded-3xl p-5 sm:p-6 border shadow-2xl space-y-4 animate-scaleUp transition-colors ${
              isDark
                ? 'bg-zinc-900 border-zinc-800 text-zinc-100'
                : 'bg-white border-zinc-200 text-zinc-900'
            }`}
          >
            {/* Header */}
            <div className="flex items-start gap-3">
              <div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                  targetLimit > casualLimit
                    ? 'bg-emerald-500/15 text-emerald-500'
                    : 'bg-amber-500/15 text-amber-500'
                }`}
              >
                <HardDrive className="w-5 h-5" />
              </div>

              <div>
                <h3 className="font-extrabold text-base leading-tight">
                  {targetLimit > casualLimit
                    ? 'Acknowledge Storage Usage'
                    : 'Reduce History Limit'}
                </h3>
                <p className="text-[11px] font-semibold text-zinc-400">
                  Casual History • {casualLimit} → {targetLimit} Games
                </p>
              </div>
            </div>

            {/* Explanation Body */}
            <div
              className={`p-3.5 rounded-2xl border text-xs leading-relaxed space-y-2 ${
                isDark
                  ? 'bg-zinc-950/60 border-zinc-800 text-zinc-300'
                  : 'bg-zinc-50 border-zinc-200 text-zinc-700'
              }`}
            >
              {targetLimit > casualLimit ? (
                <>
                  <p>
                    Increasing retention to <strong>{targetLimit} matches</strong> allows you to keep more history on this device (default is 20, max is 50).
                  </p>
                  <p className="text-zinc-400 dark:text-zinc-500">
                    Each match preserves the complete scoreboard and ball-by-ball event log. <em>Space will be used on this device, but not too much</em> (typically under ~100 KB total). Oldest games beyond this limit will be automatically deleted on a rolling FIFO basis.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    Lowering retention to <strong>{targetLimit} matches</strong> will retain only the {targetLimit} most recent casual matches.
                  </p>
                  {casualGames.length > targetLimit && (
                    <p className="text-rose-500 dark:text-rose-400 font-semibold">
                      ⚠️ The {casualGames.length - targetLimit} oldest casual match(es) will be permanently deleted from this device immediately.
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Mandatory Acknowledgment Checkbox */}
            <label className="flex items-start gap-2.5 cursor-pointer select-none px-1">
              <input
                type="checkbox"
                checked={hasAcknowledgedStorage}
                onChange={(e) => setHasAcknowledgedStorage(e.target.checked)}
                className="mt-0.5 rounded border-zinc-400 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
              />
              <span className={`text-xs font-semibold ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                {targetLimit > casualLimit
                  ? 'I acknowledge that local device storage will be used for these games.'
                  : 'I understand and confirm this retention limit.'}
              </span>
            </label>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setIsLimitModalOpen(false)}
                className={`py-2.5 px-4 rounded-xl font-bold text-xs transition ${
                  isDark
                    ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                    : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
                }`}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmLimitChange}
                disabled={!hasAcknowledgedStorage}
                className={`py-2.5 px-4 rounded-xl font-extrabold text-xs transition shadow-md ${
                  hasAcknowledgedStorage
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer active:scale-95'
                    : 'bg-zinc-200 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-600 cursor-not-allowed opacity-60'
                }`}
              >
                {targetLimit > casualLimit ? 'Confirm & Set Limit' : 'Prune & Set Limit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
