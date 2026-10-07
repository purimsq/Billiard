import React, { useState, useEffect, useMemo, useSyncExternalStore, useCallback } from 'react';
import {
  ArrowLeft,
  Wifi,
  WifiOff,
  RefreshCw,
  Search,
  ShieldCheck,
  QrCode,
  ScanLine,
  MoreVertical,
  User,
  X,
  ArrowRight,
  Clock,
  Mail,
} from 'lucide-react';
import {
  PublicLeaderboardPlayer,
  getOnlineLeaderboard,
  getLocalDeviceProfile,
  RankedPlayerProfile,
  formatCompetitorIdentity,
  formatTournamentLastUpdated,
  getCachedLeaderboard,
  recordTournamentCheckTime,
  sortTournamentStandings,
  flushPendingRankedSync,
  getPendingRankedSyncCount,
  syncRosterMemberEmails,
} from '@/lib/rankedSync';
import {
  subscribeNetworkHealth,
  getNetworkHealthSnapshot,
  checkRealInternetConnectivity,
} from '@/lib/networkReachability';
import { PlayerQrCodeModal } from '@/components/profile/PlayerQrCodeModal';
import { ScanPlayerQrModal, ScannedPlayerPayload } from './ScanPlayerQrModal';
import { CompetitorProfileView } from './CompetitorProfileView';
import { useBackHandler } from '@/lib/backNavigation';

interface TournamentTablePageProps {
  onBack: () => void;
  isDark?: boolean;
}

export const TournamentTablePage: React.FC<TournamentTablePageProps> = ({
  onBack,
  isDark = false,
}) => {
  const network = useSyncExternalStore(
    subscribeNetworkHealth,
    getNetworkHealthSnapshot,
    getNetworkHealthSnapshot
  );

  const localProfile: RankedPlayerProfile | null = useMemo(() => {
    return getLocalDeviceProfile();
  }, []);

  const [lastUpdatedTime, setLastUpdatedTime] = useState<string>(() =>
    formatTournamentLastUpdated()
  );
  const [players, setPlayers] = useState<PublicLeaderboardPlayer[]>(() => {
    const cached = getCachedLeaderboard();
    if (cached.length > 0) {
      return cached;
    }
    return [];
  });
  const [selectedPlayer, setSelectedPlayer] = useState<PublicLeaderboardPlayer | null>(null);
  const [menuPlayer, setMenuPlayer] = useState<PublicLeaderboardPlayer | null>(null);

  // Mobile hardware/gesture back support for nested profile card and context action menu
  useBackHandler('tournament:selected-player', Boolean(selectedPlayer), () => setSelectedPlayer(null));
  useBackHandler('tournament:menu-player', Boolean(menuPlayer), () => setMenuPlayer(null));
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    const cached = getCachedLeaderboard();
    return cached.length === 0 && network.hasInternet;
  });
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [pendingCount, setPendingCount] = useState<number>(() => getPendingRankedSyncCount());
  const [isCheckingConnection, setIsCheckingConnection] = useState<boolean>(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState<boolean>(false);
  const [isScanQrModalOpen, setIsScanQrModalOpen] = useState<boolean>(false);

  const processStandingsData = useCallback(
    (data: PublicLeaderboardPlayer[]) => {
      const mergedList = data.map((p) => {
        const comp = formatCompetitorIdentity(p);
        return {
          ...p,
          username: comp.username,
          discriminator: comp.discriminator,
          tag: comp.formattedTag,
          name: p.name || comp.formattedTag,
          email: p.email || '',
        };
      });

      if (localProfile && (localProfile.username || localProfile.name)) {
        const localComp = formatCompetitorIdentity(localProfile);
        const alreadyInList = mergedList.some(
          (p) =>
            (localProfile.id && p.id === localProfile.id) ||
            (p.username.toLowerCase() === localComp.username.toLowerCase() &&
              p.discriminator === localComp.discriminator)
        );
        if (!alreadyInList) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { pin, ...publicLocal } = localProfile;
          mergedList.push({
            ...publicLocal,
            username: localComp.username,
            discriminator: localComp.discriminator,
            tag: localComp.formattedTag,
            name: publicLocal.name || localComp.formattedTag,
            email: localProfile.email || publicLocal.email || '',
          });
        }
      }

      // Sort via Smart Standings hierarchy: ELO desc -> PPG (Points per game) desc -> Wins desc -> Points desc -> Fewest matches played
      return sortTournamentStandings(mergedList);
    },
    [localProfile]
  );

  // Proactively backfill emails for any existing roster members
  useEffect(() => {
    syncRosterMemberEmails().catch(() => {});
  }, []);

  useEffect(() => {
    if (!network.hasInternet) return;

    let isCancelled = false;
    flushPendingRankedSync()
      .then(() => {
        if (!isCancelled) setPendingCount(getPendingRankedSyncCount());
        return getOnlineLeaderboard(100);
      })
      .then((data) => {
        if (!isCancelled) {
          setPlayers(processStandingsData(data));
          recordTournamentCheckTime();
          setLastUpdatedTime(formatTournamentLastUpdated());
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          console.warn('Failed to load tournament standings:', err);
          setIsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [network.hasInternet, processStandingsData]);

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    checkRealInternetConnectivity().then((health) => {
      if (health.hasInternet) {
        flushPendingRankedSync()
          .then(() => {
            setPendingCount(getPendingRankedSyncCount());
            return getOnlineLeaderboard(100);
          })
          .then((data) => {
            setPlayers(processStandingsData(data));
            recordTournamentCheckTime();
            setLastUpdatedTime(formatTournamentLastUpdated());
          })
          .catch((err) => {
            console.warn('Refresh error:', err);
          })
          .finally(() => {
            setIsRefreshing(false);
          });
      } else {
        setIsRefreshing(false);
      }
    });
  };

  const handleRetryConnection = async () => {
    setIsCheckingConnection(true);
    const health = await checkRealInternetConnectivity();
    setIsCheckingConnection(false);
    if (health.hasInternet) {
      setIsLoading(true);
      try {
        const data = await getOnlineLeaderboard(100);
        setPlayers(processStandingsData(data));
        recordTournamentCheckTime();
        setLastUpdatedTime(formatTournamentLastUpdated());
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Handle scanned competitor QR code
  const handlePlayerScanned = useCallback(
    (scanned: ScannedPlayerPayload) => {
      // Find matching player in tournament list
      const matched = players.find((p) => {
        const comp = formatCompetitorIdentity(p);
        if (scanned.id && p.id === scanned.id) return true;
        if (scanned.email && p.email && scanned.email.toLowerCase() === p.email.toLowerCase()) return true;
        if (
          scanned.discriminator &&
          comp.discriminator === scanned.discriminator &&
          scanned.username &&
          comp.username.toLowerCase() === scanned.username.toLowerCase()
        ) {
          return true;
        }
        if (scanned.discriminator && comp.discriminator === scanned.discriminator) {
          return true;
        }
        if (
          scanned.username &&
          comp.username.toLowerCase() === scanned.username.toLowerCase()
        ) {
          return true;
        }
        return false;
      });

      if (matched) {
        const comp = formatCompetitorIdentity(matched);
        setSearchQuery(comp.username);
        setMenuPlayer(matched);
      } else {
        setSearchQuery(scanned.username || scanned.email || scanned.discriminator || scanned.tag || '');
      }
    },
    [players]
  );

  // Rank of player currently shown in quick overview modal
  const menuPlayerRank = useMemo(() => {
    if (!menuPlayer) return null;
    const targetComp = formatCompetitorIdentity(menuPlayer);
    const idx = players.findIndex((p) => {
      const pComp = formatCompetitorIdentity(p);
      return (
        (menuPlayer.id && p.id === menuPlayer.id) ||
        (pComp.username === targetComp.username &&
          pComp.discriminator === targetComp.discriminator)
      );
    });
    return idx >= 0 ? idx + 1 : null;
  }, [menuPlayer, players]);

  // Filtered players
  const filteredPlayers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return players;
    return players.filter((p) => {
      const comp = formatCompetitorIdentity(p);
      const matchName = comp.username.toLowerCase();
      const matchTag = comp.formattedTag.toLowerCase();
      const matchDisc = comp.discriminator.toLowerCase();
      const matchEmail = (p.email || '').toLowerCase();
      return (
        matchName.includes(q) ||
        matchTag.includes(q) ||
        matchDisc.includes(q) ||
        `#${matchDisc}`.includes(q) ||
        matchEmail.includes(q)
      );
    });
  }, [players, searchQuery]);

  // If a player profile is selected to view, display their complete profile on page
  if (selectedPlayer) {
    const playerRank =
      players.findIndex(
        (p) =>
          p.id === selectedPlayer.id ||
          (p.username === selectedPlayer.username &&
            p.discriminator === selectedPlayer.discriminator)
      ) + 1;

    return (
      <CompetitorProfileView
        player={selectedPlayer}
        rank={playerRank > 0 ? playerRank : null}
        onBack={() => setSelectedPlayer(null)}
        isDark={isDark}
        backLabel="Tournament Table"
      />
    );
  }

  return (
    <div
      className={`w-full max-w-4xl mx-auto min-h-screen px-3 sm:px-4 py-3 space-y-4 animate-fadeIn pb-16 ${
        isDark ? 'text-zinc-100' : 'text-zinc-900'
      }`}
    >
      {/* TOP NAVIGATION & ACTIONS */}
      <div
        className={`flex items-center justify-between pb-3 border-b gap-2 ${
          isDark ? 'border-zinc-800' : 'border-zinc-200'
        }`}
      >
        <button
          type="button"
          onClick={onBack}
          className={`flex items-center gap-1.5 text-xs font-black uppercase tracking-wider transition-colors cursor-pointer flex-shrink-0 ${
            isDark
              ? 'text-zinc-400 hover:text-white'
              : 'text-zinc-600 hover:text-zinc-900'
          }`}
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Home</span>
        </button>

        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end">
          {/* Last Updated Timestamp Badge */}
          <div
            className={`hidden xs:inline-flex sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[9px] sm:text-[10px] font-bold flex-shrink-0 ${
              isDark
                ? 'bg-zinc-900 border-zinc-800 text-zinc-400'
                : 'bg-zinc-50 border-zinc-200 text-zinc-600'
            }`}
            title="Last tournament results check"
          >
            <Clock className="w-3 h-3 text-rose-500 flex-shrink-0" />
            <span>Last updated: {lastUpdatedTime}</span>
          </div>

          {/* Online/Offline status pill */}
          {network.hasInternet ? (
            <span className="inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex-shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Live Standings</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider bg-rose-500/10 text-rose-500 border border-rose-500/20 flex-shrink-0">
              <WifiOff className="w-3 h-3" />
              <span>Offline</span>
            </span>
          )}

          {/* Refresh Button */}
          {network.hasInternet && (
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={isRefreshing || isLoading}
              className={`p-1.5 sm:p-2 rounded-xl border transition-all active:scale-95 cursor-pointer flex-shrink-0 ${
                isDark
                  ? 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-300 hover:text-white'
                  : 'bg-white hover:bg-zinc-50 border-zinc-200 text-zinc-700 hover:text-zinc-900 shadow-2xs'
              }`}
              title="Refresh Standings"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${
                  isRefreshing || isLoading ? 'animate-spin text-rose-600 dark:text-rose-400' : ''
                }`}
              />
            </button>
          )}

          {/* Player QR Pass */}
          {localProfile && (
            <button
              type="button"
              onClick={() => setIsQrModalOpen(true)}
              className={`p-1.5 sm:p-2 rounded-xl border transition-all active:scale-95 cursor-pointer flex-shrink-0 ${
                isDark
                  ? 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-indigo-400 hover:text-indigo-300'
                  : 'bg-white hover:bg-zinc-50 border-zinc-200 text-indigo-600 hover:text-indigo-700 shadow-2xs'
              }`}
              title="View Player Pass"
            >
              <QrCode className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* SECTION TITLE & META */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pt-1">
        <div className="space-y-0.5 sm:space-y-1">
          <h2 className="text-lg sm:text-2xl font-black tracking-tight text-zinc-900 dark:text-white">
            Tournament League Table
          </h2>

          <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-zinc-500 dark:text-zinc-400 font-medium flex-wrap">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-rose-500 flex-shrink-0" />
              <span>Last updated: {lastUpdatedTime}</span>
            </span>
            <span>•</span>
            <span>{players.length} competitors recorded</span>
            {isRefreshing && (
              <>
                <span>•</span>
                <span className="text-rose-500 font-bold animate-pulse flex items-center gap-1">
                  <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                  Syncing...
                </span>
              </>
            )}
            {pendingCount > 0 && (
              <>
                <span>•</span>
                <button
                  type="button"
                  onClick={handleManualRefresh}
                  title="Offline matches waiting to upload to tournament table"
                  className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-500 font-extrabold text-[10px] flex items-center gap-1 hover:bg-amber-500/25 transition active:scale-95"
                >
                  <span>⚡ {pendingCount} offline queued</span>
                  <span className="underline ml-0.5">Push now</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Season Selector / Filter Controls */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Search Input */}
          <div className="relative flex-1 sm:w-60">
            <Search
              className={`w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 ${
                isDark ? 'text-zinc-500' : 'text-zinc-400'
              }`}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search competitor..."
              className={`w-full pl-8 pr-3 py-1.5 rounded-xl border text-xs font-medium outline-none transition-all focus:ring-1 focus:ring-rose-500/40 ${
                isDark
                  ? 'bg-zinc-900 border-zinc-800 text-white placeholder-zinc-500'
                  : 'bg-white border-zinc-200 text-zinc-900 placeholder-zinc-400'
              }`}
            />
          </div>

          {/* Scan QR Button (Searches player by scanning their QR code) */}
          <button
            type="button"
            onClick={() => setIsScanQrModalOpen(true)}
            className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border text-[11px] sm:text-xs font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer flex-shrink-0 ${
              isDark
                ? 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-200 hover:text-white'
                : 'bg-white hover:bg-zinc-50 border-zinc-200 text-zinc-800 hover:text-black shadow-2xs'
            }`}
            title="Scan Player Pass QR Code to Search"
            aria-label="Scan Competitor QR Code"
          >
            <ScanLine className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
            <span>Scan QR</span>
          </button>
        </div>
      </div>

      {/* CASE 1: OFFLINE STATE */}
      {!network.hasInternet ? (
        <div
          className={`p-6 sm:p-8 rounded-3xl border text-center space-y-4 sm:space-y-5 animate-fadeIn transition-colors ${
            isDark
              ? 'bg-zinc-900/90 border-zinc-800'
              : 'bg-white border-zinc-200 shadow-sm'
          }`}
        >
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-3xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center mx-auto shadow-sm">
            <WifiOff className="w-7 h-7 sm:w-8 sm:h-8 stroke-[2.2]" />
          </div>

          <div className="space-y-1.5 max-w-md mx-auto">
            <h3 className="text-base sm:text-lg font-black tracking-tight text-rose-500">
              You are not connected to the internet
            </h3>
            <p
              className={`text-xs sm:text-sm font-medium leading-relaxed ${
                isDark ? 'text-zinc-400' : 'text-zinc-600'
              }`}
            >
              Please connect to the internet first to see the tournament table and live competitor results.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2 max-w-xs mx-auto">
            <button
              type="button"
              onClick={handleRetryConnection}
              disabled={isCheckingConnection}
              className="w-full py-3 px-5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs uppercase tracking-wider transition-all active:scale-95 shadow-md shadow-rose-600/25 flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw
                className={`w-4 h-4 ${isCheckingConnection ? 'animate-spin' : ''}`}
              />
              <span>
                {isCheckingConnection ? 'Testing Connection...' : 'Retry Connection'}
              </span>
            </button>

            <button
              type="button"
              onClick={onBack}
              className={`w-full py-3 px-5 rounded-2xl border font-bold text-xs uppercase tracking-wider transition-all active:scale-95 cursor-pointer ${
                isDark
                  ? 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-300'
                  : 'bg-zinc-100 hover:bg-zinc-200 border-zinc-200 text-zinc-700'
              }`}
            >
              Return to Home
            </button>
          </div>

          <div className="pt-2">
            <span
              className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${
                isDark ? 'text-zinc-500' : 'text-zinc-400'
              }`}
            >
              <Wifi className="w-3 h-3" />
              <span>Standings update automatically upon reconnecting</span>
            </span>
          </div>
        </div>
      ) : (
        /* CASE 2: SPORTS LEAGUE TABLE (UEFA / FANATIK RANKING TABLE STYLE) - DIRECTLY ON PAGE */
        <div className="space-y-3 sm:space-y-4">
          {/* Card Table Container - Firmly In-Place & Fully Responsive */}
          <div
            className={`w-full rounded-2xl sm:rounded-3xl border shadow-xs transition-all overflow-hidden flex flex-col ${
              isDark
                ? 'bg-zinc-900/60 border-zinc-800/80 backdrop-blur-md'
                : 'bg-white/90 border-zinc-200/90 backdrop-blur-md'
            }`}
          >
            {/* Scrollable Viewport: Players inside scroll smoothly when they become a lot */}
            <div className="overflow-x-auto overflow-y-auto max-h-[58vh] sm:max-h-[64vh] overscroll-contain touch-pan-y scroll-smooth">
              <table className="w-full text-left border-collapse text-xs whitespace-nowrap min-w-[340px] sm:min-w-full">
                {/* Pinned Sticky Table Header */}
                <thead className="sticky top-0 z-20 shadow-2xs">
                  <tr
                    className={`select-none transition-colors border-b ${
                      isDark
                        ? 'bg-zinc-900/95 border-zinc-800 text-zinc-400 backdrop-blur-md'
                        : 'bg-zinc-100/95 border-zinc-200 text-zinc-600 backdrop-blur-md'
                    }`}
                  >
                    <th className="py-2.5 px-2 sm:px-2.5 w-8 sm:w-10 text-center font-black sticky top-0 z-20 bg-inherit">#</th>
                    <th className="py-2.5 px-2 sm:px-3 font-black uppercase text-[10px] sm:text-[11px] sticky top-0 z-20 bg-inherit">
                      Competitor
                    </th>
                    <th className="py-2.5 px-1.5 sm:px-2 w-12 sm:w-14 text-center font-black text-rose-600 dark:text-rose-400 text-[10px] sm:text-xs sticky top-0 z-20 bg-inherit">
                      WR%
                    </th>
                    <th className="py-2.5 px-1.5 sm:px-2 w-14 sm:w-16 text-center font-black text-rose-600 dark:text-rose-400 text-[10px] sm:text-xs sticky top-0 z-20 bg-inherit">
                      PTS
                    </th>
                    <th className="py-2.5 px-2 sm:px-2.5 w-14 sm:w-16 text-right font-black text-rose-600 dark:text-rose-400 text-xs sm:text-xs sticky top-0 z-20 bg-inherit">
                      ELO
                    </th>
                    <th className="py-2.5 px-1.5 sm:px-2 w-8 sm:w-10 text-center font-black sticky top-0 z-20 bg-inherit">
                      <span className="sr-only">More Options</span>
                    </th>
                  </tr>
                </thead>

                {/* TABLE BODY */}
                <tbody
                  className={`divide-y ${
                    isDark ? 'divide-zinc-800/60' : 'divide-zinc-200/70'
                  }`}
                >
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="py-14 text-center">
                      <div className="flex flex-col items-center justify-center gap-2.5">
                        <div className="w-9 h-9 border-3 border-rose-600 border-t-transparent rounded-full animate-spin" />
                        <span
                          className={`text-xs font-black uppercase tracking-wider font-serif ${
                            isDark ? 'text-zinc-300' : 'text-zinc-700'
                          }`}
                        >
                          Loading Tournament Results...
                        </span>
                        <span className="text-[11px] text-zinc-500">
                          Fetching live tournament rankings &amp; competitor scores
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : filteredPlayers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className={`py-12 text-center ${
                        isDark ? 'text-zinc-400' : 'text-zinc-500'
                      }`}
                    >
                      <p className="font-bold text-sm text-zinc-900 dark:text-white">
                        No competitors found
                      </p>
                      <p className="text-xs mt-1">
                        {searchQuery
                          ? `No player matches "${searchQuery}"`
                          : 'No competitors registered yet.'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredPlayers.map((player, index) => {
                    const rank = index + 1;
                    const rowKey = player.id || `${player.username}-${index}`;
                    const competitor = formatCompetitorIdentity(player);
                    const isMe =
                      localProfile &&
                      (player.id === localProfile.id ||
                        (competitor.username === localProfile.username &&
                          competitor.discriminator === localProfile.discriminator));

                    // Qualification Zone coloring for the rank box (Fanatik style!)
                    // 1-4: Sky Blue (Championship)
                    // 5-6: Premier Tier
                    // 7-8: Contender Tier
                    // 9+: Neutral
                    const isZoneBlue = rank >= 1 && rank <= 4;
                    const isZoneGreen = rank >= 5 && rank <= 6;
                    const isZoneYellow = rank >= 7 && rank <= 8;

                    const rankCellBg = isZoneBlue
                      ? 'bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300'
                      : isZoneGreen
                      ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                      : isZoneYellow
                      ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                      : isDark
                      ? 'text-zinc-400'
                      : 'text-zinc-500';

                    const matches = player.totalMatches || 0;
                    const wins = player.wins || 0;
                    const winRate =
                      matches > 0 ? ((wins / matches) * 100).toFixed(0) : '0';

                    return (
                      <tr
                        key={rowKey}
                        className={`transition-all duration-200 font-medium relative ${
                          isMe
                            ? isDark
                              ? 'bg-indigo-500/15 hover:bg-indigo-500/20 ring-1 ring-inset ring-indigo-500/30'
                              : 'bg-indigo-50/80 hover:bg-indigo-100/70 ring-1 ring-inset ring-indigo-200'
                            : isDark
                            ? 'hover:bg-zinc-800/40'
                            : 'hover:bg-zinc-50/80'
                        }`}
                      >
                        {/* Rank # Cell with zone coloring */}
                        <td className="py-2.5 px-2 sm:px-2.5 text-center">
                          <span
                            className={`inline-flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 rounded-md font-mono font-black text-[11px] sm:text-xs ${rankCellBg}`}
                          >
                            {rank}
                          </span>
                        </td>

                        {/* Competitor: Flag/Avatar + Username + ALWAYS-VISIBLE Short Code + Email */}
                        <td className="py-2.5 px-2 sm:px-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {/* Round emblem / avatar */}
                            <span
                              className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] sm:text-[11px] font-black text-white shadow-2xs flex-shrink-0 ring-1 ring-white/10"
                              style={{
                                backgroundColor: player.color || '#6366F1',
                              }}
                            >
                              {competitor.username.charAt(0).toUpperCase()}
                            </span>

                            <div className="flex flex-col min-w-0">
                              <div className="flex items-center gap-1.5 min-w-0 flex-wrap sm:flex-nowrap">
                                <button
                                  type="button"
                                  onClick={() => setSelectedPlayer(player)}
                                  className={`font-black text-xs truncate max-w-[100px] xs:max-w-[140px] sm:max-w-[200px] hover:underline text-left cursor-pointer transition-colors ${
                                    isDark ? 'text-white hover:text-rose-400' : 'text-zinc-900 hover:text-rose-600'
                                  }`}
                                  title={`View ${competitor.formattedTag}'s profile`}
                                >
                                  {competitor.username}
                                </button>

                                {/* ALWAYS visible short code */}
                                <span
                                  className="inline-flex items-center px-1.5 py-0.5 rounded-md font-mono text-[9px] sm:text-[10px] font-bold bg-zinc-200/80 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-300/50 dark:border-zinc-700/60 flex-shrink-0"
                                  title={`Competitor Code: #${competitor.discriminator}`}
                                >
                                  #{competitor.discriminator}
                                </span>

                                {isMe && (
                                  <span className="px-1.5 py-0.5 rounded-full text-[8px] sm:text-[9px] font-black uppercase tracking-wider bg-emerald-500 text-white flex-shrink-0 shadow-2xs">
                                    You
                                  </span>
                                )}
                              </div>

                              {/* Competitor Email underneath username */}
                              {player.email ? (
                                <span
                                  className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium truncate max-w-[130px] xs:max-w-[170px] sm:max-w-[230px] leading-tight block select-all pt-0.5"
                                  title={player.email}
                                >
                                  {player.email}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </td>

                        {/* Win Rate (WR%) */}
                        <td className="py-2.5 px-1.5 sm:px-2 text-center font-mono font-bold text-zinc-700 dark:text-zinc-300 text-[11px] sm:text-xs">
                          {winRate}%
                        </td>

                        {/* Total Points (PTS) */}
                        <td className="py-2.5 px-1.5 sm:px-2 text-center font-mono text-zinc-600 dark:text-zinc-400 text-[11px] sm:text-xs">
                          {(player.totalPoints || 0).toLocaleString()}
                        </td>

                        {/* ELO Rating Points */}
                        <td className="py-2.5 px-2 sm:px-2.5 text-right font-black font-mono text-xs sm:text-sm text-zinc-900 dark:text-white">
                          {(player.rating || 100).toLocaleString()}
                        </td>

                        {/* 3-Dots More Menu (⋮) */}
                        <td className="py-2.5 px-1.5 sm:px-2 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuPlayer(player);
                            }}
                            className={`p-1.5 rounded-xl border transition-all active:scale-95 cursor-pointer ${
                              isDark
                                ? 'bg-zinc-850 hover:bg-zinc-800 border-zinc-750 text-zinc-300 hover:text-white'
                                : 'bg-white hover:bg-zinc-100 border-zinc-200 text-zinc-600 hover:text-zinc-900 shadow-2xs'
                            }`}
                            title={`Overview & quick stats for ${competitor.formattedTag}`}
                            aria-label={`More options for ${competitor.formattedTag}`}
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* In-Place Bottom Status Indicator when competitor list is scrollable */}
          {filteredPlayers.length > 5 && (
            <div
              className={`py-1.5 px-3.5 text-[10px] font-semibold border-t flex items-center justify-between flex-shrink-0 select-none ${
                isDark
                  ? 'bg-zinc-950/40 border-zinc-800/70 text-zinc-400'
                  : 'bg-zinc-50/70 border-zinc-200/70 text-zinc-500'
              }`}
            >
              <span>{filteredPlayers.length} competitors ranked</span>
              <span className="text-[9px] font-medium text-zinc-400 dark:text-zinc-500 italic">
                Scroll for full standings ↓
              </span>
            </div>
          )}
        </div>

          {/* TABLE FOOTER & UEFA QUALIFICATION ZONE LEGEND (Matching Fanatik screenshot!) */}
          <div
            className={`pt-2 pb-1 space-y-2 text-[10px] sm:text-[11px] font-medium ${
              isDark ? 'text-zinc-400' : 'text-zinc-600'
            }`}
          >
            {/* Zone Badges */}
            <div className="flex items-center gap-2.5 sm:gap-4 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-sky-500 flex-shrink-0" />
                <span className="font-bold">1-4: Championship Tier</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-emerald-500 flex-shrink-0" />
                <span className="font-bold">5-6: Premier Tier</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-amber-500 flex-shrink-0" />
                <span className="font-bold">7-8: Contender Tier</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-zinc-300 dark:bg-zinc-700 flex-shrink-0" />
                <span className="font-bold">9+: Circuit</span>
              </div>
            </div>

            {/* Column Guide */}
            <div className="text-[9px] sm:text-[10px] text-zinc-400 dark:text-zinc-500 pt-1.5 border-t border-zinc-200/60 dark:border-zinc-800/60 flex items-center justify-between flex-wrap gap-2">
              <span>
                <b>WR%</b>: Win Rate • <b>PTS</b>: Points • <b>ELO</b>: Rating Points • <b>⋮</b>: More Stats (MP, W/L, HB) & View Profile
              </span>
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                <span>Verified Circuit Standings</span>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* COMPETITOR QUICK OVERVIEW MODAL (SLEEK, MINIMAL & PROFESSIONAL) */}
      {menuPlayer && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fadeIn"
          onClick={() => setMenuPlayer(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className={`w-full max-w-sm sm:max-w-md rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xl border transition-all animate-scaleIn text-left relative overflow-y-auto max-h-[92vh] ${
              isDark
                ? 'bg-zinc-900 border-zinc-800 text-white shadow-black/90'
                : 'bg-white border-zinc-200 text-zinc-900 shadow-2xl'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Bar: Title & Close Button */}
            <div className="flex items-center justify-between pb-1 border-b border-zinc-200/60 dark:border-zinc-800/60">
              <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                <User className="w-3.5 h-3.5" />
                <span>Competitor Overview</span>
              </div>

              <button
                type="button"
                onClick={() => setMenuPlayer(null)}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                  isDark
                    ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white'
                    : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-500 hover:text-zinc-900'
                }`}
                aria-label="Close overview"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {(() => {
              const compIdentity = formatCompetitorIdentity(menuPlayer);
              const mMatches = menuPlayer.totalMatches || 0;
              const mWins = menuPlayer.wins || 0;
              const mLosses = menuPlayer.losses || 0;
              const mWinRate = mMatches > 0 ? ((mWins / mMatches) * 100).toFixed(0) : '0';
              const mRank = menuPlayerRank;
              const isMe =
                localProfile &&
                (menuPlayer.id === localProfile.id ||
                  (compIdentity.username.toLowerCase() === localProfile.username?.toLowerCase() &&
                    compIdentity.discriminator === localProfile.discriminator));

              return (
                <div className="space-y-4">
                  {/* Competitor Hero Row */}
                  <div className="flex items-center gap-3.5 sm:gap-4 p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-850/50 border border-zinc-200/80 dark:border-zinc-800">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 font-black text-xl shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-800 flex-shrink-0">
                      <span className="select-none">
                        {compIdentity.username.charAt(0).toUpperCase()}
                      </span>
                    </div>

                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base sm:text-lg font-black tracking-tight truncate leading-tight">
                          {compIdentity.username}
                        </h3>
                        <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-lg bg-zinc-200/80 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-300/60 dark:border-zinc-700">
                          #{compIdentity.discriminator}
                        </span>
                        {isMe && (
                          <span className="px-1.5 py-0.5 rounded-full text-[8px] sm:text-[9px] font-black uppercase tracking-wider bg-zinc-900 text-white dark:bg-zinc-200 dark:text-zinc-900 shadow-2xs">
                            You
                          </span>
                        )}
                      </div>

                      {menuPlayer.email && (
                        <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                          <Mail className="w-3.5 h-3.5 flex-shrink-0 text-zinc-400" />
                          <span className="font-medium truncate max-w-[200px] sm:max-w-xs select-all">
                            {menuPlayer.email}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center gap-2 flex-wrap text-xs">
                        {mRank && (
                          <span className="font-bold text-zinc-700 dark:text-zinc-300">
                            Tournament Rank #{mRank}
                          </span>
                        )}
                        <span className="text-zinc-300 dark:text-zinc-600">•</span>
                        <span className="text-zinc-500 dark:text-zinc-400 font-medium">
                          ELO Rating:{' '}
                          <strong className="font-mono text-zinc-900 dark:text-white font-black">
                            {(menuPlayer.rating || 100).toLocaleString()}
                          </strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 3 Spacious Unified Monochrome Stat Cards */}
                  <div className="grid grid-cols-3 gap-2.5">
                    {/* Matches */}
                    <div
                      className={`p-3 rounded-2xl border text-center space-y-1 ${
                        isDark ? 'bg-zinc-850/50 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
                      }`}
                    >
                      <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-500 block">
                        Matches
                      </span>
                      <p className="text-base sm:text-lg font-black font-mono text-zinc-900 dark:text-white">
                        {mMatches}
                      </p>
                      <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block truncate">
                        Games Played
                      </span>
                    </div>

                    {/* Record */}
                    <div
                      className={`p-3 rounded-2xl border text-center space-y-1 ${
                        isDark ? 'bg-zinc-850/50 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
                      }`}
                    >
                      <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-500 block">
                        Record
                      </span>
                      <p className="text-base sm:text-lg font-black font-mono text-zinc-900 dark:text-white">
                        {mWins}W · {mLosses}L
                      </p>
                      <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 block truncate">
                        {mWinRate}% Win Rate
                      </span>
                    </div>

                    {/* Best Break */}
                    <div
                      className={`p-3 rounded-2xl border text-center space-y-1 ${
                        isDark ? 'bg-zinc-850/50 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
                      }`}
                    >
                      <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-500 block">
                        Best Break
                      </span>
                      <p className="text-base sm:text-lg font-black font-mono text-zinc-900 dark:text-white">
                        {menuPlayer.highestBreak || 0} pts
                      </p>
                      <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block truncate">
                        Single Turn
                      </span>
                    </div>
                  </div>

                  {/* Sleek Executive CTA Button */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        const target = menuPlayer;
                        setMenuPlayer(null);
                        setSelectedPlayer(target);
                      }}
                      className="w-full py-3.5 px-4 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-100 dark:text-zinc-950 font-black text-xs sm:text-sm uppercase tracking-wider flex items-center justify-between transition-all active:scale-[0.98] shadow-sm cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        <span>View Full Profile & Match History</span>
                      </span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* QR Code Pass Modal for current player if triggered */}
      {isQrModalOpen && localProfile && (
        <PlayerQrCodeModal
          isOpen={isQrModalOpen}
          onClose={() => setIsQrModalOpen(false)}
          profile={localProfile}
          isDark={isDark}
        />
      )}

      {/* Scan Competitor QR Pass Modal */}
      {isScanQrModalOpen && (
        <ScanPlayerQrModal
          isOpen={isScanQrModalOpen}
          onClose={() => setIsScanQrModalOpen(false)}
          onPlayerScanned={handlePlayerScanned}
          isDark={isDark}
        />
      )}
    </div>
  );
};
