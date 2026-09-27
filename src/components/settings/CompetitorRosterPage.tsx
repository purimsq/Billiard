import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Users,
  Search,
  Plus,
  Trash2,
  ShieldCheck,
  Check,
  UserCheck,
  Eye,
  Loader2,
} from 'lucide-react';
import {
  getVerifiedRoster,
  addPlayerToRoster,
  removePlayerFromRoster,
  isPlayerInRoster,
  searchRankedPlayers,
  getLocalDeviceProfile,
  formatCompetitorIdentity,
  PublicLeaderboardPlayer,
} from '@/lib/rankedSync';
import { CompetitorProfileView } from '@/components/tournament/CompetitorProfileView';

interface CompetitorRosterPageProps {
  onBack: () => void;
  isDark?: boolean;
}

export const CompetitorRosterPage: React.FC<CompetitorRosterPageProps> = ({
  onBack,
  isDark = false,
}) => {
  const [roster, setRoster] = useState<PublicLeaderboardPlayer[]>(() => {
    if (typeof window === 'undefined') return [];
    return getVerifiedRoster();
  });

  const [selectedPlayer, setSelectedPlayer] = useState<PublicLeaderboardPlayer | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<PublicLeaderboardPlayer[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const localProfile = getLocalDeviceProfile();

  const reloadRoster = () => {
    setRoster(getVerifiedRoster());
  };

  // Debounced search when 3+ characters typed
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
        console.warn('Roster search failed:', err);
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

  const handleAddCompetitor = (player: PublicLeaderboardPlayer) => {
    const res = addPlayerToRoster(player);
    if (res.success) {
      reloadRoster();
      const comp = formatCompetitorIdentity(player);
      setToastMessage(`${comp.formattedTag} added to your verified roster`);
      setTimeout(() => setToastMessage(null), 3000);
      setSearchQuery('');
      setSearchResults([]);
    } else {
      setToastMessage(res.message || 'Could not add player to roster');
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const handleRemoveCompetitor = (id: string, name: string) => {
    removePlayerFromRoster(id);
    reloadRoster();
    setToastMessage(`${name} removed from roster`);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // If viewing a specific player's profile
  if (selectedPlayer) {
    return (
      <CompetitorProfileView
        player={selectedPlayer}
        onBack={() => setSelectedPlayer(null)}
        isDark={isDark}
        backLabel="Competitor Roster"
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
          ROSTER
        </span>
      </div>

      {/* Compact Title Section */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight uppercase font-serif">
            COMPETITOR ROSTER
          </h2>
          <p className={`text-xs font-medium ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
            Verified player identities cached locally for instant offline match setup and ranking.
          </p>
        </div>
      </div>

      {/* Google-Style Metric Stats Bar */}
      <div
        className={`border-t border-b py-3 grid grid-cols-3 divide-x ${
          isDark
            ? 'border-zinc-800 divide-zinc-800/80 bg-zinc-900/20'
            : 'border-zinc-200 divide-zinc-200/80 bg-zinc-50/50'
        }`}
      >
        <div className="px-2 sm:px-3 text-center">
          <span className="text-[9px] font-black uppercase tracking-wider text-zinc-400 block">
            Roster Count
          </span>
          <span className="text-lg sm:text-xl font-black font-mono leading-tight">
            {roster.length}
          </span>
        </div>

        <div className="px-2 sm:px-3 text-center">
          <span className="text-[9px] font-black uppercase tracking-wider text-zinc-400 block">
            Offline Status
          </span>
          <span className="text-xs sm:text-sm font-black text-emerald-500 inline-flex items-center gap-1 mt-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            Verified Ready
          </span>
        </div>

        <div className="px-2 sm:px-3 text-center">
          <span className="text-[9px] font-black uppercase tracking-wider text-zinc-400 block">
            Avg ELO
          </span>
          <span className="text-lg sm:text-xl font-black font-mono leading-tight text-amber-500">
            {roster.length > 0
              ? Math.round(
                  roster.reduce((acc, p) => acc + (p.rating || 100), 0) / roster.length
                )
              : '—'}
          </span>
        </div>
      </div>

      {/* Search & Add Player to Roster */}
      <div
        className={`p-4 sm:p-5 rounded-3xl border space-y-3.5 ${
          isDark ? 'bg-zinc-900/70 border-zinc-800' : 'bg-white border-zinc-200/90 shadow-sm'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-emerald-500" />
            <h3 className="font-extrabold text-sm uppercase tracking-wider">
              Add Player to Roster
            </h3>
          </div>
          <span className="text-[10px] text-zinc-400">Database Search (3+ chars)</span>
        </div>

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
            placeholder="Type at least 3 letters to search database (e.g. Dave or #1001)..."
            className={`w-full pl-9 pr-9 py-2.5 rounded-xl border text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition ${
              isDark
                ? 'bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500'
                : 'bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400'
            }`}
          />
          {isSearching && (
            <Loader2 className="w-4 h-4 animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          )}
        </div>

        {/* Search Results */}
        {searchQuery.trim().length >= 3 && (
          <div className="space-y-2 pt-1 border-t border-zinc-100 dark:border-zinc-800 max-h-56 overflow-y-auto pr-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-1">
              Search Results ({searchResults.length})
            </div>

            {isSearching ? (
              <div className="flex items-center justify-center gap-2 py-4 text-xs font-bold text-emerald-500 bg-emerald-500/5 rounded-xl border border-emerald-500/20 animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                <span>Searching for players...</span>
              </div>
            ) : searchResults.length === 0 ? (
              <p className="text-xs text-zinc-500 py-3 text-center">
                No competitors matching &quot;{searchQuery}&quot; found in database.
              </p>
            ) : (
              searchResults.map((player) => {
                const comp = formatCompetitorIdentity(player);
                const isSelf =
                  localProfile &&
                  localProfile.username.toLowerCase() === comp.username.toLowerCase() &&
                  localProfile.discriminator === comp.discriminator;
                const inRoster = isPlayerInRoster(player);

                return (
                  <div
                    key={player.id || comp.formattedTag}
                    className={`p-3 rounded-2xl border flex items-center justify-between transition ${
                      isDark ? 'bg-zinc-800/60 border-zinc-700' : 'bg-zinc-50 border-zinc-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-extrabold text-xs shadow-sm flex-shrink-0"
                        style={{ backgroundColor: player.color || '#6366F1' }}
                      >
                        {comp.username ? comp.username.charAt(0).toUpperCase() : 'P'}
                      </div>
                      <div className="truncate">
                        <span className="font-mono font-black text-xs block truncate">
                          {comp.formattedTag}
                        </span>
                        <span className="text-[10px] font-bold text-amber-500">
                          ⚔️ {player.rating || 100} ELO • {player.wins || 0}W/{player.losses || 0}L
                        </span>
                      </div>
                    </div>

                    <div>
                      {isSelf ? (
                        <span className="text-[10px] font-extrabold px-2 py-1 rounded-lg bg-zinc-500/15 text-zinc-400 border border-zinc-500/20">
                          YOU (OWNER)
                        </span>
                      ) : inRoster ? (
                        <span className="text-[10px] font-extrabold px-2 py-1 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                          <Check className="w-3 h-3 stroke-[3]" />
                          IN ROSTER
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleAddCompetitor(player)}
                          className="py-1 px-3 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1 transition active:scale-95 shadow-sm"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Roster Players List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400">
            Saved Competitors ({roster.length})
          </h3>
          <span className="text-[10px] text-zinc-500">Instant Offline Access</span>
        </div>

        {roster.length === 0 ? (
          <div
            className={`p-8 rounded-3xl border text-center space-y-2.5 ${
              isDark ? 'bg-zinc-900/40 border-zinc-800' : 'bg-zinc-50/60 border-zinc-200'
            }`}
          >
            <div className="text-zinc-400">
              <Users className="w-8 h-8 mx-auto opacity-50" />
            </div>
            <h4 className="font-bold text-sm">No Competitors in Roster</h4>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto">
              Add the players you frequently play with at pool tables. Their verified identity
              footprint is stored on this device so you can play ranked matches even when offline.
            </p>
          </div>
        ) : (
          roster.map((player) => {
            const comp = formatCompetitorIdentity(player);
            const totalMatches = player.totalMatches || 0;
            const wins = player.wins || 0;
            const winRate =
              totalMatches > 0 ? ((wins / totalMatches) * 100).toFixed(0) : '0';

            return (
              <div
                key={player.id || comp.formattedTag}
                className={`p-4 rounded-2xl border transition-all duration-150 ${
                  isDark
                    ? 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'
                    : 'bg-white border-zinc-200 hover:border-zinc-300 shadow-2xs'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-extrabold text-sm shadow-sm flex-shrink-0"
                      style={{ backgroundColor: player.color || '#6366F1' }}
                    >
                      {comp.username ? comp.username.charAt(0).toUpperCase() : 'P'}
                    </div>

                    <div className="truncate">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-black text-sm text-zinc-900 dark:text-zinc-100 truncate">
                          {comp.formattedTag}
                        </span>
                        <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          VERIFIED
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-zinc-400 mt-0.5">
                        <span className="font-black text-amber-500">
                          ⚔️ {player.rating || 100} ELO
                        </span>
                        <span>•</span>
                        <span>
                          {player.wins || 0}W / {player.losses || 0}L ({winRate}%)
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* View Profile Button */}
                    <button
                      type="button"
                      onClick={() => setSelectedPlayer(player)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer ${
                        isDark
                          ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700'
                          : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border border-zinc-200'
                      }`}
                      title="View full competitor profile and match history"
                    >
                      <Eye className="w-3.5 h-3.5 text-zinc-400" />
                      <span>View Profile</span>
                    </button>

                    {/* Remove from Roster Button */}
                    <button
                      type="button"
                      onClick={() => handleRemoveCompetitor(player.id, comp.formattedTag)}
                      className="p-1.5 rounded-xl text-zinc-400 hover:text-rose-500 transition hover:bg-rose-500/10 cursor-pointer"
                      title="Remove from roster"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Return Button */}
      <div className="pt-2">
        <button
          type="button"
          onClick={onBack}
          className="w-full py-3 px-6 rounded-2xl bg-zinc-900 dark:bg-zinc-800 text-white font-black text-xs uppercase tracking-wider shadow-md hover:bg-indigo-600 dark:hover:bg-indigo-600 transition-all active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
          <span>RETURN TO SETTINGS</span>
        </button>
      </div>
    </div>
  );
};

export default CompetitorRosterPage;
