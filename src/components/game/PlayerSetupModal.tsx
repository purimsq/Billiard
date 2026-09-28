import React, { useState, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import {
  Search,
  QrCode,
  Lock,
  Plus,
  Trash2,
  Users,
  ShieldCheck,
  CheckCircle2,
  Loader2,
  X,
  WifiOff,
} from 'lucide-react';
import { Player, GameMode } from '@/types/game';
import { getRandomPlayerColor } from '@/lib/gameLogic';
import {
  getLocalDeviceProfile,
  searchRankedPlayers,
  getVerifiedRoster,
  recordCompetitorInteraction,
  verifyOfflineCompetitor,
  formatCompetitorIdentity,
  PublicLeaderboardPlayer,
} from '@/lib/rankedSync';
import {
  subscribeNetworkHealth,
  getNetworkHealthSnapshot,
} from '@/lib/networkReachability';
import { ScanPlayerQrModal, ScannedPlayerPayload } from '@/components/tournament/ScanPlayerQrModal';

interface PlayerSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartGame: (players: Player[], mode?: GameMode) => void;
  isDark?: boolean;
}

function makeUniqueId(prefix: string, disambiguator?: string): string {
  const rand = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${disambiguator || 'p'}_${rand}`;
}

export const PlayerSetupModal: React.FC<PlayerSetupModalProps> = ({
  isOpen,
  onClose,
  onStartGame,
  isDark = false,
}) => {
  const [selectedMode, setSelectedMode] = useState<GameMode>('casual');
  const [error, setError] = useState<string | null>(null);

  // Casual Mode Player Names
  const [casualPlayerNames, setCasualPlayerNames] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const profile = getLocalDeviceProfile();
      if (profile && profile.username) {
        return [profile.username, 'Player 2'];
      }
    }
    return ['Player 1', 'Player 2'];
  });

  // Ranked Competitors State
  const deviceProfile = isOpen ? getLocalDeviceProfile() : null;
  const hasProfile = Boolean(deviceProfile && deviceProfile.username);

  const [rankedOpponents, setRankedOpponents] = useState<Player[]>([]);
  const [competitorToRemove, setCompetitorToRemove] = useState<{
    player: Player;
    index: number;
  } | null>(null);
  const [pressingOpponentId, setPressingOpponentId] = useState<string | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const [isRosterMenuOpen, setIsRosterMenuOpen] = useState<boolean>(false);
  const [manualOfflineMode, setManualOfflineMode] = useState<boolean>(false);

  // Network health detection
  const networkOnline = useSyncExternalStore(
    subscribeNetworkHealth,
    () => getNetworkHealthSnapshot().hasInternet,
    () => true
  );
  const isOnline = networkOnline && (typeof navigator !== 'undefined' ? navigator.onLine : true);
  const showSearch = isOnline && !manualOfflineMode;

  // Search state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<PublicLeaderboardPlayer[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const verifiedRoster = useMemo(() => {
    if (!isOpen || typeof window === 'undefined') return [];
    return getVerifiedRoster();
  }, [isOpen]);

  // Method 2: Scan QR Modal state
  const [isScanQrOpen, setIsScanQrOpen] = useState<boolean>(false);

  // Method 3: Offline PIN state
  const [offlineTag, setOfflineTag] = useState<string>('');
  const [offlinePin, setOfflinePin] = useState<string>('');
  const [isVerifyingOffline, setIsVerifyingOffline] = useState<boolean>(false);

  // Method 1: Search filtering automatically after 3 characters
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 3) {
      return;
    }

    let isCancelled = false;
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const matches = await searchRankedPlayers(trimmed);
        if (!isCancelled) {
          setSearchResults(matches);
        }
      } catch (err) {
        console.warn('Player search failed:', err);
        if (!isCancelled) setSearchResults([]);
      } finally {
        if (!isCancelled) setIsSearching(false);
      }
    }, 280);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  if (!isOpen) return null;

  // Host Player object for Ranked Mode
  const hostPlayer: Player = {
    id: deviceProfile?.id || 'host_player',
    name: deviceProfile?.username || 'You',
    username: deviceProfile?.username || 'You',
    discriminator: deviceProfile?.discriminator || '1001',
    score: 0,
    color: deviceProfile?.color || '#6366F1',
    avatarBg: deviceProfile?.color || '#6366F1',
    rating: deviceProfile?.rating || 100,
    isVerified: true,
  };

  const allRankedPlayers: Player[] = [hostPlayer, ...rankedOpponents];

  // ================= CASUAL HANDLERS =================
  const handleAddCasualPlayer = () => {
    if (casualPlayerNames.length >= 8) {
      setError('Maximum 8 players allowed');
      return;
    }
    setError(null);
    setCasualPlayerNames([...casualPlayerNames, `Player ${casualPlayerNames.length + 1}`]);
  };

  const handleRemoveCasualPlayer = (index: number) => {
    if (casualPlayerNames.length <= 1) {
      setError('At least 1 player is required');
      return;
    }
    setError(null);
    setCasualPlayerNames(casualPlayerNames.filter((_, i) => i !== index));
  };

  const handleCasualNameChange = (index: number, value: string) => {
    const updated = [...casualPlayerNames];
    updated[index] = value;
    setCasualPlayerNames(updated);
  };

  const handleCasualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = casualPlayerNames.map((n) => n.trim()).filter(Boolean);
    if (cleaned.length === 0) {
      setError('Please enter at least one player name');
      return;
    }

    const createdPlayers: Player[] = cleaned.map((name, idx) => ({
      id: makeUniqueId('player', String(idx)),
      name: name || `Player ${idx + 1}`,
      score: 0,
      color: getRandomPlayerColor(idx),
      avatarBg: getRandomPlayerColor(idx),
    }));

    onStartGame(createdPlayers, 'casual');
  };

  // ================= RANKED ADD COMPETITOR HELPER =================
  const addCompetitorToRanked = (comp: {
    id?: string;
    username?: string;
    name?: string;
    discriminator?: string;
    tag?: string;
    color?: string;
    rating?: number;
  }) => {
    setError(null);
    const identity = formatCompetitorIdentity(comp);

    // Prevent adding host as opponent
    if (
      identity.username.toLowerCase() === hostPlayer.username?.toLowerCase() &&
      identity.discriminator === hostPlayer.discriminator
    ) {
      setError('You are already registered as Player 1 (Host)');
      return;
    }

    // Prevent duplicate competitor
    const alreadyAdded = rankedOpponents.some((p) => {
      const pIdent = formatCompetitorIdentity(p);
      return (
        (comp.id && p.id === comp.id) ||
        (pIdent.username.toLowerCase() === identity.username.toLowerCase() &&
          pIdent.discriminator === identity.discriminator)
      );
    });

    if (alreadyAdded) {
      setError(`${identity.formattedTag} is already in the match roster`);
      return;
    }

    if (rankedOpponents.length >= 7) {
      setError('Maximum 8 competitors allowed per match');
      return;
    }

    const newOpponent: Player = {
      id: comp.id || makeUniqueId('comp', identity.discriminator),
      name: identity.username,
      username: identity.username,
      discriminator: identity.discriminator,
      score: 0,
      color: comp.color || getRandomPlayerColor(rankedOpponents.length + 1),
      avatarBg: comp.color || getRandomPlayerColor(rankedOpponents.length + 1),
      rating: comp.rating || 100,
      isVerified: true,
    };

    setRankedOpponents([...rankedOpponents, newOpponent]);
    recordCompetitorInteraction(comp);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleRemoveRankedOpponent = (target: number | Player) => {
    if (typeof target === 'number') {
      setRankedOpponents((prev) => prev.filter((_, i) => i !== target));
    } else {
      setRankedOpponents((prev) => prev.filter((p) => p.id !== target.id));
    }
    setError(null);
  };

  const handleOpponentPressStart = (
    player: Player,
    index: number,
    clientX?: number,
    clientY?: number
  ) => {
    if (clientX !== undefined && clientY !== undefined) {
      touchStartPosRef.current = { x: clientX, y: clientY };
    } else {
      touchStartPosRef.current = null;
    }
    setPressingOpponentId(player.id);
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
    longPressTimerRef.current = setTimeout(() => {
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(40);
        } catch {
          // ignore
        }
      }
      setCompetitorToRemove({ player, index });
      setPressingOpponentId(null);
    }, 450);
  };

  const handleOpponentPressEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    setPressingOpponentId(null);
    touchStartPosRef.current = null;
  };

  const handleOpponentTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPosRef.current || !e.touches[0]) return;
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStartPosRef.current.x);
    const dy = Math.abs(touch.clientY - touchStartPosRef.current.y);
    if (dx > 10 || dy > 10) {
      handleOpponentPressEnd();
    }
  };

  // Method 2: Handle QR Scanned
  const handleQrScanned = (payload: ScannedPlayerPayload) => {
    setIsScanQrOpen(false);
    const comp = formatCompetitorIdentity({
      id: payload.id,
      username: payload.username,
      discriminator: payload.discriminator,
      tag: payload.tag,
    });
    addCompetitorToRanked(comp);
  };

  // Method 3: Handle Offline PIN verification
  const handleVerifyOffline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!offlineTag.trim()) {
      setError('Please enter a player username or tag');
      return;
    }
    if (!/^\d{4}$/.test(offlinePin.trim())) {
      setError('Please enter a valid 4-digit security PIN');
      return;
    }

    setIsVerifyingOffline(true);
    setError(null);

    try {
      const res = await verifyOfflineCompetitor(offlineTag, offlinePin);
      if (res.success && res.player) {
        addCompetitorToRanked(res.player);
        setOfflineTag('');
        setOfflinePin('');
      } else {
        setError(res.error || 'Failed to verify competitor PIN');
      }
    } catch {
      setError('Error verifying competitor PIN');
    } finally {
      setIsVerifyingOffline(false);
    }
  };

  const handleRankedSubmit = () => {
    if (rankedOpponents.length === 0) {
      setError('At least 1 verified opponent is required for a ranked match');
      return;
    }
    onStartGame(allRankedPlayers, 'ranked');
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-zinc-950/75 backdrop-blur-sm animate-fadeIn">
        <div
          className={`w-full max-w-md sm:max-w-lg rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 border relative transition-colors max-h-[90vh] overflow-y-auto ${
            isDark
              ? 'bg-zinc-900 border-zinc-800 text-zinc-100'
              : 'bg-white border-zinc-200 text-zinc-900'
          }`}
        >
          {/* Header */}
          <div
            className={`flex items-center justify-between pb-3 border-b ${
              isDark ? 'border-zinc-800' : 'border-zinc-100'
            }`}
          >
            <div>
              <h3 className="text-xl font-black tracking-tight uppercase font-serif">
                Match Setup
              </h3>
              <p className={`text-xs font-medium ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                {selectedMode === 'ranked'
                  ? 'Add verified competitors for official ELO ranking'
                  : 'Add players in turn order for casual play'}
              </p>
            </div>
            <button
              onClick={onClose}
              className={`text-xs font-bold px-2 py-1 transition ${
                isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-zinc-400 hover:text-zinc-700'
              }`}
            >
              Cancel
            </button>
          </div>

          {/* Error Banner */}
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

          {/* Mode Selector (Casual vs Ranked) */}
          {hasProfile && (
            <div className="space-y-1.5">
              <label
                className={`text-[10px] font-black uppercase tracking-wider block ${
                  isDark ? 'text-zinc-400' : 'text-zinc-500'
                }`}
              >
                Match Mode
              </label>
              <div
                className={`grid grid-cols-2 p-1 rounded-2xl border transition-colors ${
                  isDark ? 'bg-zinc-950/70 border-zinc-800' : 'bg-zinc-100/90 border-zinc-200'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setSelectedMode('casual');
                    setError(null);
                  }}
                  className={`py-2 px-3 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all ${
                    selectedMode === 'casual'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : isDark
                      ? 'text-zinc-400 hover:text-zinc-200'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  <span>🟢</span>
                  <span>Casual</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedMode('ranked');
                    setError(null);
                  }}
                  className={`py-2 px-3 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all ${
                    selectedMode === 'ranked'
                      ? 'bg-amber-600 text-white shadow-md'
                      : isDark
                      ? 'text-zinc-400 hover:text-zinc-200'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  <span>⚔️</span>
                  <span>Ranked</span>
                </button>
              </div>
            </div>
          )}

          {/* ================= CASUAL MODE FORM ================= */}
          {selectedMode === 'casual' && (
            <form onSubmit={handleCasualSubmit} className="space-y-4 pt-1">
              <div className="max-h-56 overflow-y-auto pr-1 space-y-2.5">
                {casualPlayerNames.map((name, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white font-extrabold text-xs shadow-sm flex-shrink-0"
                      style={{ backgroundColor: getRandomPlayerColor(index) }}
                    >
                      {index + 1}
                    </div>
                    <div className="flex-1 relative flex items-center">
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => handleCasualNameChange(index, e.target.value)}
                        placeholder={`Player ${index + 1} Name`}
                        className={`w-full px-3.5 py-2 ${
                          index === 0 && deviceProfile?.username && name === deviceProfile.username
                            ? 'pr-14'
                            : ''
                        } rounded-xl border font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition ${
                          isDark
                            ? 'bg-zinc-800/90 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus:bg-zinc-800 focus:border-indigo-500'
                            : 'bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:bg-white focus:border-indigo-600'
                        }`}
                        required
                      />
                      {index === 0 &&
                        deviceProfile?.username &&
                        name === deviceProfile.username && (
                          <span className="absolute right-2 px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-indigo-500/15 text-indigo-500 dark:text-indigo-400 border border-indigo-500/25 pointer-events-none">
                            YOU
                          </span>
                        )}
                    </div>
                    {casualPlayerNames.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveCasualPlayer(index)}
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

              <button
                type="button"
                onClick={handleAddCasualPlayer}
                className={`w-full py-2.5 px-4 rounded-2xl border border-dashed font-bold text-xs transition ${
                  isDark
                    ? 'border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:border-zinc-600 hover:text-indigo-400'
                    : 'border-zinc-300 text-zinc-700 hover:bg-zinc-50 hover:border-indigo-300 hover:text-indigo-600'
                }`}
              >
                + ADD PLAYER FIELD
              </button>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3.5 rounded-2xl font-black text-sm active:scale-[0.99] shadow-lg transition-all bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                >
                  START CASUAL GAME
                </button>
              </div>
            </form>
          )}

          {/* ================= RANKED MODE COMPETITOR SETUP ================= */}
          {selectedMode === 'ranked' && (
            <div className="space-y-4 pt-1">
              {/* 1. Add Opponent Header with Smart Actions at Top Right */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-black uppercase tracking-wider text-zinc-400">
                      Add Opponent
                    </span>
                    {!isOnline && (
                      <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-500 border border-rose-500/25 flex items-center gap-1">
                        <WifiOff className="w-2.5 h-2.5" />
                        OFFLINE
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* QR Code Action (Always available online and offline) */}
                    <button
                      type="button"
                      onClick={() => setIsScanQrOpen(true)}
                      className={`p-1.5 rounded-xl border transition active:scale-95 flex items-center justify-center ${
                        isDark
                          ? 'bg-zinc-800/80 border-zinc-700 text-zinc-300 hover:text-amber-400 hover:bg-zinc-800 hover:border-amber-500/40'
                          : 'bg-zinc-100 border-zinc-200 text-zinc-600 hover:text-amber-600 hover:bg-white hover:border-amber-300'
                      }`}
                      title="Scan Player QR Badge"
                    >
                      <QrCode className="w-4 h-4" />
                    </button>

                    {/* Roster Menu Button */}
                    <button
                      type="button"
                      onClick={() => setIsRosterMenuOpen(true)}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition active:scale-95 ${
                        isRosterMenuOpen
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                          : isDark
                          ? 'bg-zinc-800/80 border-zinc-700 text-zinc-300 hover:text-emerald-400 hover:border-emerald-500/40'
                          : 'bg-zinc-100 border-zinc-200 text-zinc-700 hover:text-emerald-600 hover:border-emerald-300'
                      }`}
                      title="Open Verified Competitor Roster"
                    >
                      <Users className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Roster</span>
                      {verifiedRoster.length > 0 && (
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                            isRosterMenuOpen
                              ? 'bg-emerald-700 text-emerald-100'
                              : 'bg-emerald-500/15 text-emerald-500'
                          }`}
                        >
                          {verifiedRoster.length}
                        </span>
                      )}
                    </button>
                  </div>
                </div>

                {/* 2. WHEN ONLINE: CLEAN SEARCH BAR */}
                {showSearch ? (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSearchQuery(val);
                          if (val.trim().length < 3) {
                            setSearchResults([]);
                            setIsSearching(false);
                          }
                        }}
                        placeholder="Search player name or #tag (3+ chars)..."
                        className={`w-full pl-9 pr-9 py-2.5 rounded-xl border text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/40 transition ${
                          isDark
                            ? 'bg-zinc-800/90 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus:border-amber-500'
                            : 'bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:bg-white focus:border-amber-500'
                        }`}
                      />
                      {isSearching && (
                        <Loader2 className="w-3.5 h-3.5 animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                      )}
                    </div>

                    {/* Search Results Dropdown (When query >= 3) */}
                    {searchQuery.trim().length >= 3 && (
                      <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-1">
                          Search Matches ({searchResults.length})
                        </div>

                        {isSearching ? (
                          <div className="flex items-center justify-center gap-2 py-4 text-xs font-bold text-amber-500 bg-amber-500/5 rounded-xl border border-amber-500/20 animate-pulse">
                            <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                            <span>Searching for players...</span>
                          </div>
                        ) : searchResults.length === 0 ? (
                          <p className="text-xs text-zinc-500 py-3 text-center">
                            No players matching &quot;{searchQuery}&quot; found.
                          </p>
                        ) : (
                          searchResults.map((player) => {
                            const pComp = formatCompetitorIdentity(player);
                            const isHost =
                              pComp.username.toLowerCase() === hostPlayer.username?.toLowerCase() &&
                              pComp.discriminator === hostPlayer.discriminator;
                            const isAlreadyAdded = rankedOpponents.some((p) => {
                              const existingComp = formatCompetitorIdentity(p);
                              return (
                                (player.id && p.id === player.id) ||
                                (existingComp.username.toLowerCase() === pComp.username.toLowerCase() &&
                                  existingComp.discriminator === pComp.discriminator)
                              );
                            });

                            return (
                              <div
                                key={player.id}
                                onClick={() => {
                                  if (!isAlreadyAdded && !isHost) {
                                    addCompetitorToRanked(player);
                                  }
                                }}
                                className={`p-2.5 rounded-xl border flex items-center justify-between transition ${
                                  isHost || isAlreadyAdded
                                    ? 'opacity-60 bg-zinc-800/30 border-zinc-700/50 cursor-not-allowed'
                                    : isDark
                                    ? 'bg-zinc-800/70 border-zinc-700 hover:bg-zinc-800 hover:border-amber-500/50 cursor-pointer active:scale-[0.99]'
                                    : 'bg-white border-zinc-200 hover:border-amber-500/50 hover:bg-amber-50/20 cursor-pointer active:scale-[0.99]'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <div
                                    className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-extrabold text-xs flex-shrink-0"
                                    style={{ backgroundColor: player.color || '#6366F1' }}
                                  >
                                    {player.username ? player.username.charAt(0).toUpperCase() : 'P'}
                                  </div>
                                  <div className="truncate">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-mono font-black text-xs block truncate">
                                        {player.username} #{player.discriminator}
                                      </span>
                                      {isHost && (
                                        <span className="text-[8px] font-black px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-500 border border-amber-500/25">
                                          HOST (YOU)
                                        </span>
                                      )}
                                      {isAlreadyAdded && !isHost && (
                                        <span className="text-[8px] font-extrabold px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-500 border border-emerald-500/25">
                                          IN MATCH
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-[10px] font-bold text-amber-500">
                                      ⚔️ {player.rating || 100} ELO • {player.wins || 0}W/{player.losses || 0}L
                                    </span>
                                  </div>
                                </div>

                                {isHost ? (
                                  <span className="px-2 py-1 rounded-lg text-[10px] font-bold text-zinc-400 bg-zinc-700/30 flex-shrink-0">
                                    Host
                                  </span>
                                ) : isAlreadyAdded ? (
                                  <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-1 flex-shrink-0">
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>Added</span>
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-600 hover:bg-amber-500 text-white flex items-center gap-1 flex-shrink-0 cursor-pointer"
                                  >
                                    <Plus className="w-3 h-3" />
                                    <span>Add</span>
                                  </button>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  /* WHEN OFFLINE: INPUT FIELD AND 4-DIGIT PIN */
                  <form
                    onSubmit={handleVerifyOffline}
                    className={`p-3 sm:p-3.5 rounded-2xl border space-y-2.5 ${
                      isDark ? 'bg-zinc-950/60 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-amber-500" />
                        <span className="text-xs font-bold">Offline PIN Verification</span>
                      </div>
                      {isOnline && (
                        <button
                          type="button"
                          onClick={() => setManualOfflineMode(false)}
                          className="text-[10px] text-amber-500 hover:underline font-bold"
                        >
                          &larr; Back to Search
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={offlineTag}
                        onChange={(e) => setOfflineTag(e.target.value)}
                        placeholder="Player username or tag..."
                        className={`w-full px-3 py-2 rounded-xl border text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/40 ${
                          isDark
                            ? 'bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500'
                            : 'bg-white border-zinc-200 text-zinc-900 placeholder:text-zinc-400'
                        }`}
                        required
                      />

                      <input
                        type="password"
                        maxLength={4}
                        value={offlinePin}
                        onChange={(e) => setOfflinePin(e.target.value.replace(/\D/g, ''))}
                        placeholder="4-digit PIN (••••)"
                        className={`w-full px-3 py-2 rounded-xl border text-xs font-mono font-black tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-amber-500/40 ${
                          isDark
                            ? 'bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500'
                            : 'bg-white border-zinc-200 text-zinc-900 placeholder:text-zinc-400'
                        }`}
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isVerifyingOffline || !offlineTag.trim() || offlinePin.length !== 4}
                      className="w-full py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      {isVerifyingOffline ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Verifying PIN...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Verify &amp; Add Competitor</span>
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>

              {/* 3. Selected Players (Match Roster) - PLACED BELOW THE SEARCH BAR / INPUT FIELDS */}
              <div className="space-y-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-zinc-400 px-0.5">
                  <div className="flex items-center gap-1.5">
                    <span>Match Roster ({allRankedPlayers.length}/8)</span>
                    <span className="text-[9px] text-zinc-500 font-semibold normal-case">
                      (press &amp; hold card to remove)
                    </span>
                  </div>
                  <span className="text-[10px] text-amber-500 font-bold">Minimum 2 Players</span>
                </div>

                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {/* Player 1 (Host / Device Owner) */}
                  <div
                    className={`p-3 rounded-2xl border flex items-center justify-between ${
                      isDark
                        ? 'bg-zinc-950/60 border-zinc-800 text-zinc-100'
                        : 'bg-zinc-50 border-zinc-200 text-zinc-900'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-extrabold text-xs shadow-sm flex-shrink-0"
                        style={{ backgroundColor: hostPlayer.color }}
                      >
                        1
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-black text-sm">
                            {hostPlayer.name} #{hostPlayer.discriminator}
                          </span>
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500 border border-amber-500/25">
                            HOST (YOU)
                          </span>
                        </div>
                        <span className="text-[10px] font-bold text-amber-500 block">
                          ⚔️ {hostPlayer.rating || 100} ELO
                        </span>
                      </div>
                    </div>
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  </div>

                  {/* Added Opponents with prominent Remove button & long-press gesture */}
                  {rankedOpponents.map((opp, idx) => (
                    <div
                      key={opp.id}
                      onTouchStart={(e) => {
                        const t = e.touches[0];
                        handleOpponentPressStart(opp, idx, t?.clientX, t?.clientY);
                      }}
                      onTouchMove={handleOpponentTouchMove}
                      onTouchEnd={handleOpponentPressEnd}
                      onTouchCancel={handleOpponentPressEnd}
                      onMouseDown={(e) => {
                        if (e.button === 0) {
                          handleOpponentPressStart(opp, idx, e.clientX, e.clientY);
                        }
                      }}
                      onMouseUp={handleOpponentPressEnd}
                      onMouseLeave={handleOpponentPressEnd}
                      onContextMenu={(e) => {
                        // Prevent browser native context menu on long-press
                        e.preventDefault();
                      }}
                      className={`p-2.5 sm:p-3 rounded-2xl border flex items-center justify-between animate-fadeIn transition-all select-none cursor-pointer ${
                        pressingOpponentId === opp.id
                          ? 'scale-[0.98] ring-2 ring-rose-500/50 border-rose-500/50 bg-rose-500/5'
                          : isDark
                          ? 'bg-zinc-900/90 border-zinc-800 hover:border-zinc-700'
                          : 'bg-white border-zinc-200 hover:border-zinc-300 shadow-2xs'
                      }`}
                      title="Long-press card or click Remove to drop player"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-extrabold text-xs shadow-sm flex-shrink-0"
                          style={{ backgroundColor: opp.color }}
                        >
                          {idx + 2}
                        </div>
                        <div className="truncate">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-black text-sm truncate">
                              {opp.name} #{opp.discriminator}
                            </span>
                            <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                              VERIFIED
                            </span>
                          </div>
                          <span className="text-[10px] font-bold text-amber-500 block">
                            ⚔️ {opp.rating || 100} ELO
                          </span>
                        </div>
                      </div>

                      {/* Explicit, visible Remove button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCompetitorToRemove({ player: opp, index: idx });
                        }}
                        className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition active:scale-95 flex items-center gap-1.5 cursor-pointer flex-shrink-0 ${
                          isDark
                            ? 'bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 border border-rose-500/30'
                            : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                        }`}
                        title={`Remove ${opp.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                        <span>Remove</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* 4. Start Ranked Match Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleRankedSubmit}
                  disabled={rankedOpponents.length === 0}
                  className={`w-full py-3.5 rounded-2xl font-black text-sm uppercase tracking-wider active:scale-[0.99] shadow-lg transition-all flex items-center justify-center gap-2 ${
                    rankedOpponents.length > 0
                      ? 'bg-amber-600 hover:bg-amber-500 text-white cursor-pointer shadow-amber-600/30'
                      : 'bg-zinc-200 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-600 cursor-not-allowed opacity-60'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>
                    START RANKED MATCH ({allRankedPlayers.length} {allRankedPlayers.length === 1 ? 'Player' : 'Players'})
                  </span>
                </button>
                {rankedOpponents.length === 0 && (
                  <p className="text-[10px] text-zinc-400 text-center mt-1">
                    Add at least 1 verified opponent to start an official ranked match
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* QR Scanner Submodal */}
      {isScanQrOpen && (
        <ScanPlayerQrModal
          isOpen={isScanQrOpen}
          onClose={() => setIsScanQrOpen(false)}
          onPlayerScanned={handleQrScanned}
          isDark={isDark}
        />
      )}

      {/* Roster Menu Modal */}
      {isRosterMenuOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-zinc-950/80 backdrop-blur-sm animate-fadeIn">
          <div
            className={`w-full max-w-md max-h-[85vh] sm:max-h-[88vh] flex flex-col rounded-3xl p-4 sm:p-6 shadow-2xl border relative animate-scaleUp transition-colors ${
              isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-100' : 'bg-white border-zinc-200 text-zinc-900'
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center flex-shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black uppercase font-serif tracking-tight">
                    Competitor Roster
                  </h3>
                  <span className="text-[10px] text-emerald-500 font-bold block">
                    Verified Offline Footprints ({verifiedRoster.length})
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsRosterMenuOpen(false)}
                className={`p-1.5 rounded-full transition cursor-pointer ${
                  isDark
                    ? 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                    : 'hover:bg-zinc-100 text-zinc-500 hover:text-zinc-800'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* List */}
            {verifiedRoster.length === 0 ? (
              <div
                className={`p-6 rounded-2xl border text-center space-y-2 my-auto ${
                  isDark ? 'bg-zinc-950/50 border-zinc-800 text-zinc-400' : 'bg-zinc-50 border-zinc-200 text-zinc-600'
                }`}
              >
                <Users className="w-8 h-8 mx-auto opacity-30 text-emerald-500" />
                <p className="text-xs font-bold">No players in your Roster yet.</p>
                <p className="text-[11px] opacity-75 max-w-xs mx-auto">
                  Add frequent opponents in <b>Settings &gt; Competitor Roster</b> or search them online to save their verified credentials for offline play.
                </p>
              </div>
            ) : (
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pr-1.5 py-2 space-y-2 touch-pan-y">
                {verifiedRoster.map((player) => {
                  const pComp = formatCompetitorIdentity(player);
                  const isHost =
                    pComp.username.toLowerCase() === hostPlayer.username?.toLowerCase() &&
                    pComp.discriminator === hostPlayer.discriminator;
                  const isAdded = rankedOpponents.some((p) => {
                    const existingComp = formatCompetitorIdentity(p);
                    return (
                      (player.id && p.id === player.id) ||
                      (existingComp.username.toLowerCase() === pComp.username.toLowerCase() &&
                        existingComp.discriminator === pComp.discriminator)
                    );
                  });

                  return (
                    <div
                      key={player.id}
                      onClick={() => {
                        if (!isAdded && !isHost) addCompetitorToRanked(player);
                      }}
                      className={`p-2.5 sm:p-3 rounded-2xl border flex items-center justify-between transition ${
                        isAdded || isHost
                          ? 'opacity-50 cursor-not-allowed bg-zinc-800/20 border-zinc-800/40'
                          : isDark
                          ? 'bg-zinc-800/60 border-zinc-700/80 hover:bg-zinc-800 hover:border-emerald-500/50 cursor-pointer active:scale-[0.99]'
                          : 'bg-white border-zinc-200 hover:border-emerald-400 hover:bg-emerald-50/20 cursor-pointer active:scale-[0.99] shadow-2xs'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-extrabold text-xs flex-shrink-0 shadow-sm"
                          style={{ backgroundColor: player.color || '#6366F1' }}
                        >
                          {player.username ? player.username.charAt(0).toUpperCase() : 'P'}
                        </div>
                        <div className="truncate">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-black text-xs block truncate">
                              {player.username} #{player.discriminator}
                            </span>
                            <span className="text-[8px] font-extrabold px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-500 border border-emerald-500/25">
                              OFFLINE OK
                            </span>
                          </div>
                          <span className="text-[10px] font-bold text-amber-500">
                            ⚔️ {player.rating || 100} ELO • {player.wins || 0}W/{player.losses || 0}L
                          </span>
                        </div>
                      </div>

                      {isHost ? (
                        <span className="px-3 py-1.5 rounded-xl text-[11px] font-bold text-zinc-400 bg-zinc-700/30 cursor-not-allowed flex-shrink-0">
                          Host
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={isAdded}
                          className={`px-3 py-1.5 rounded-xl text-[11px] font-extrabold flex items-center gap-1 flex-shrink-0 transition ${
                            isAdded
                              ? 'bg-zinc-700/50 text-zinc-400 cursor-not-allowed'
                              : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm cursor-pointer'
                          }`}
                        >
                          {isAdded ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              <span>Added</span>
                            </>
                          ) : (
                            <>
                              <Plus className="w-3 h-3" />
                              <span>Add</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Bottom Done button */}
            <div className="pt-3 border-t border-zinc-200/80 dark:border-zinc-800/80 flex-shrink-0">
              <button
                type="button"
                onClick={() => setIsRosterMenuOpen(false)}
                className={`w-full py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition cursor-pointer ${
                  isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
                }`}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Competitor Action Modal (triggered via Long-press or Remove Button) */}
      {competitorToRemove && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm animate-fadeIn">
          <div
            className={`w-full max-w-sm rounded-3xl p-5 sm:p-6 shadow-2xl border space-y-4 relative animate-scaleUp text-center ${
              isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-100' : 'bg-white border-zinc-200 text-zinc-900'
            }`}
          >
            <div
              className="mx-auto w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg ring-4 ring-rose-500/20"
              style={{ backgroundColor: competitorToRemove.player.color || '#6366F1' }}
            >
              {competitorToRemove.player.username
                ? competitorToRemove.player.username.charAt(0).toUpperCase()
                : 'P'}
            </div>

            <div className="space-y-1">
              <h4 className="text-lg font-black tracking-tight font-serif uppercase">
                Remove Competitor?
              </h4>
              <div className="font-mono text-xs font-bold text-amber-500">
                {competitorToRemove.player.username || competitorToRemove.player.name} #{competitorToRemove.player.discriminator || '0000'}
              </div>
              <p className={`text-xs pt-1 leading-relaxed ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                Remove this player from the current match roster? They can be searched and selected again at any time.
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  handleRemoveRankedOpponent(competitorToRemove.player);
                  setCompetitorToRemove(null);
                }}
                className="w-full py-3 rounded-2xl font-bold text-xs uppercase tracking-wider bg-rose-600 hover:bg-rose-500 text-white transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-rose-600/25"
              >
                <Trash2 className="w-4 h-4" />
                <span>Remove Player</span>
              </button>

              <button
                type="button"
                onClick={() => setCompetitorToRemove(null)}
                className={`w-full py-2.5 rounded-2xl font-bold text-xs uppercase tracking-wider transition cursor-pointer ${
                  isDark
                    ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                    : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
                }`}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PlayerSetupModal;
