import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  Mail,
  Trophy,
  ShieldCheck,
  Clock,
  Swords,
  ChevronDown,
  AlertTriangle,
  ListOrdered,
  Loader2,
  Target,
  Zap,
} from 'lucide-react';
import {
  PublicLeaderboardPlayer,
  RankedMatchLogItem,
  getPlayerRankedMatches,
  formatCompetitorIdentity,
} from '@/lib/rankedSync';

interface CompetitorProfileViewProps {
  player: PublicLeaderboardPlayer;
  rank?: number | null;
  onBack: () => void;
  isDark?: boolean;
  backLabel?: string;
}

export const CompetitorProfileView: React.FC<CompetitorProfileViewProps> = ({
  player,
  rank,
  onBack,
  isDark = false,
  backLabel = 'Tournament Table',
}) => {
  const competitor = useMemo(() => formatCompetitorIdentity(player), [player]);
  const playerKey = player.id || competitor.formattedTag;
  const [loadedPlayerKey, setLoadedPlayerKey] = useState<string | null>(null);
  const [matches, setMatches] = useState<RankedMatchLogItem[]>([]);
  const [expandedMatchIds, setExpandedMatchIds] = useState<Record<string, boolean>>({});
  const isProfileLoading = loadedPlayerKey !== playerKey;

  const toggleMatchEvents = (matchId: string) => {
    setExpandedMatchIds((prev) => ({
      ...prev,
      [matchId]: !prev[matchId],
    }));
  };

  const isLoadingMatches = loadedPlayerKey !== playerKey;

  useEffect(() => {
    let isMounted = true;

    getPlayerRankedMatches(player.id, competitor.username, competitor.discriminator)
      .then((data) => {
        if (isMounted) {
          setMatches(data);
          setLoadedPlayerKey(playerKey);
        }
      })
      .catch((err) => {
        console.warn('Failed loading player matches:', err);
        if (isMounted) {
          setLoadedPlayerKey(playerKey);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [player.id, competitor.username, competitor.discriminator, playerKey]);

  const totalMatches = player.totalMatches || 0;
  const wins = player.wins || 0;
  const losses = player.losses || 0;
  const winRate =
    totalMatches > 0 ? ((wins / totalMatches) * 100).toFixed(0) : '0';
  const playerColor = player.color || '#6366F1';

  if (isProfileLoading) {
    return (
      <div
        className={`w-full max-w-3xl mx-auto min-h-[55vh] flex flex-col items-center justify-center space-y-4 animate-fadeIn px-4 text-center ${
          isDark ? 'text-zinc-100' : 'text-zinc-900'
        }`}
      >
        <div className="relative">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-xl ring-4 ring-rose-500/20 animate-pulse"
            style={{ backgroundColor: playerColor }}
          >
            {competitor.username ? competitor.username.charAt(0).toUpperCase() : 'P'}
          </div>
          <Loader2 className="w-5 h-5 animate-spin text-rose-500 absolute -bottom-1 -right-1" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-black uppercase tracking-wider font-serif">
            Loading Profile...
          </h3>
          <p className="text-xs font-mono font-bold text-amber-500">
            {competitor.username} #{competitor.discriminator}
          </p>
          <p className="text-[11px] text-zinc-500 font-medium pt-0.5">
            Loading verified competitor statistics &amp; match history...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`w-full max-w-3xl mx-auto min-h-screen px-3.5 sm:px-6 py-4 space-y-6 animate-fadeIn pb-16 ${
        isDark ? 'text-zinc-100' : 'text-zinc-900'
      }`}
    >
      {/* TOP NAVIGATION */}
      <div
        className={`flex items-center justify-between pb-3 border-b ${
          isDark ? 'border-zinc-800' : 'border-zinc-200'
        }`}
      >
        <button
          type="button"
          onClick={onBack}
          className={`flex items-center gap-1.5 text-xs font-black uppercase tracking-wider transition-colors cursor-pointer py-1 -ml-1 px-2 rounded-lg ${
            isDark
              ? 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
              : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
          }`}
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{backLabel}</span>
        </button>

        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Verified Competitor Profile</span>
        </div>
      </div>

      {/* UNIFIED PLAYER HERO & RATING CARD */}
      <div
        className={`relative rounded-3xl border p-4 sm:p-5 transition-all shadow-xs overflow-hidden ${
          isDark
            ? 'bg-gradient-to-br from-zinc-900 via-zinc-900/98 to-zinc-950 border-zinc-800 text-white'
            : 'bg-gradient-to-br from-white via-zinc-50/80 to-slate-50 border-zinc-200/90 text-zinc-900'
        }`}
      >
        {/* Ambient Radial Accent */}
        <div
          className="absolute -top-12 -right-12 w-48 h-48 rounded-full pointer-events-none blur-3xl opacity-20 transition-all"
          style={{ backgroundColor: playerColor }}
        />
        {/* Subtle Watermark */}
        <div className="absolute right-3 bottom-1 pointer-events-none opacity-[0.03] dark:opacity-[0.05] select-none">
          <Trophy className="w-32 h-32" />
        </div>

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Identity info */}
          <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
            <div
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center text-white font-black text-xl sm:text-2xl shadow-md ring-2 ring-white/20 relative overflow-hidden flex-shrink-0"
              style={{ backgroundColor: playerColor }}
            >
              <div className="absolute inset-0 bg-gradient-to-b from-white/25 via-transparent to-black/20 pointer-events-none" />
              <span className="relative drop-shadow-sm select-none">
                {competitor.username ? competitor.username.charAt(0).toUpperCase() : 'P'}
              </span>
            </div>

            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-black tracking-tight truncate leading-tight">
                  {competitor.username}
                </h2>
                <span
                  className={`font-mono font-bold text-xs px-2 py-0.5 rounded-lg border ${
                    isDark
                      ? 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30'
                      : 'bg-indigo-50 text-indigo-600 border-indigo-200'
                  }`}
                >
                  #{competitor.discriminator}
                </span>
                {rank && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-500 border border-amber-500/25">
                    Rank #{rank}
                  </span>
                )}
                <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 stroke-[2.5]" />
                  <span>Verified</span>
                </span>
              </div>

              {/* Email Address */}
              <div className="flex items-center gap-1.5 text-xs min-w-0 text-zinc-500 dark:text-zinc-400">
                <Mail className="w-3.5 h-3.5 flex-shrink-0 text-zinc-400" />
                <span
                  className="font-semibold truncate max-w-[220px] sm:max-w-xs"
                  title={player.email || 'No email registered'}
                >
                  {player.email || 'No email registered'}
                </span>
              </div>
            </div>
          </div>

          {/* Rating Showcase */}
          <div
            className={`p-3 sm:p-3.5 rounded-2xl border flex sm:flex-col items-center sm:items-end justify-between gap-1 flex-shrink-0 ${
              isDark
                ? 'bg-zinc-800/80 border-zinc-700/80'
                : 'bg-zinc-100/90 border-zinc-200 shadow-2xs'
            }`}
          >
            <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-amber-500">
              <Trophy className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Competitive Rating</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-black font-mono leading-none tracking-tight">
                {(player.rating || 100).toLocaleString()}
              </span>
              <span className="text-xs font-bold text-amber-500">ELO</span>
            </div>
          </div>
        </div>
      </div>

      {/* PERFORMANCE METRICS GRID (4 BALANCED STAT CARDS) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        {/* Card 1: Matches Played */}
        <div
          className={`p-3 sm:p-3.5 rounded-2xl border transition-all ${
            isDark
              ? 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'
              : 'bg-white border-zinc-200 hover:border-zinc-300 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span
              className={`text-[10px] font-bold uppercase tracking-wider block ${
                isDark ? 'text-zinc-400' : 'text-zinc-500'
              }`}
            >
              Matches Played
            </span>
            <div className="w-6 h-6 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-500">
              <Trophy className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono leading-tight">
            {totalMatches}
          </div>
          <div className="text-[11px] font-semibold text-zinc-500 mt-0.5">
            <span className="text-emerald-600 dark:text-emerald-400">{wins}W</span>
            <span className="mx-1">•</span>
            <span className="text-rose-600 dark:text-rose-400">{losses}L</span>
          </div>
        </div>

        {/* Card 2: Win Rate */}
        <div
          className={`p-3 sm:p-3.5 rounded-2xl border transition-all ${
            isDark
              ? 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'
              : 'bg-white border-zinc-200 hover:border-zinc-300 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span
              className={`text-[10px] font-bold uppercase tracking-wider block ${
                isDark ? 'text-zinc-400' : 'text-zinc-500'
              }`}
            >
              Win Rate
            </span>
            <div className="w-6 h-6 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <Target className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono leading-tight text-emerald-600 dark:text-emerald-400">
            {winRate}%
          </div>
          <div className="text-[11px] font-semibold text-zinc-500 mt-0.5">
            {wins > 0 ? `${wins} career victory` : 'No victories logged'}
          </div>
        </div>

        {/* Card 3: Scoring Efficiency */}
        <div
          className={`p-3 sm:p-3.5 rounded-2xl border transition-all ${
            isDark
              ? 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'
              : 'bg-white border-zinc-200 hover:border-zinc-300 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span
              className={`text-[10px] font-bold uppercase tracking-wider block ${
                isDark ? 'text-zinc-400' : 'text-zinc-500'
              }`}
            >
              Scoring Avg
            </span>
            <div className="w-6 h-6 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
              <Zap className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono leading-tight text-amber-500">
            {player.pointsPerGame
              ? `${player.pointsPerGame} pts`
              : totalMatches > 0
              ? `${((player.totalPoints || 0) / totalMatches).toFixed(1)} pts`
              : '0.0 pts'}
          </div>
          <div className="text-[11px] font-semibold text-zinc-500 mt-0.5">
            Per match average
          </div>
        </div>

        {/* Card 4: Highest Break */}
        <div
          className={`p-3 sm:p-3.5 rounded-2xl border transition-all ${
            isDark
              ? 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'
              : 'bg-white border-zinc-200 hover:border-zinc-300 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span
              className={`text-[10px] font-bold uppercase tracking-wider block ${
                isDark ? 'text-zinc-400' : 'text-zinc-500'
              }`}
            >
              Highest Break
            </span>
            <div className="w-6 h-6 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-500">
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono leading-tight text-rose-500 dark:text-rose-400">
            {player.highestBreak || 0} pts
          </div>
          <div className="text-[11px] font-semibold text-zinc-500 mt-0.5">
            Best single turn run
          </div>
        </div>
      </div>

      {/* Casual & Event Track Record (if logged) */}
      {Boolean(
        (player.casualMatches && player.casualMatches > 0) ||
          (player.totalEventsLogged && player.totalEventsLogged > 0)
      ) && (
        <div
          className={`flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs border ${
            isDark
              ? 'bg-zinc-900/60 border-zinc-800 text-zinc-300'
              : 'bg-zinc-50 border-zinc-200 text-zinc-700'
          }`}
        >
          <div className="flex items-center gap-2 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
            <span>Casual Track Record:</span>
            <strong className={isDark ? 'text-zinc-100' : 'text-zinc-900'}>
              {player.casualMatches || 0} matches • {(player.casualPoints || 0).toLocaleString()} pts
            </strong>
          </div>
          {player.totalEventsLogged && player.totalEventsLogged > 0 && (
            <span className="text-[10px] font-mono text-zinc-500">
              {player.totalEventsLogged} events logged
            </span>
          )}
        </div>
      )}

      {/* RANKED MATCHES SECTION (ON THE PAGE) */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Swords className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            <h3 className="font-black text-sm uppercase tracking-wider">
              Ranked Matches Played ({matches.length})
            </h3>
          </div>
          <span
            className={`text-xs font-medium ${
              isDark ? 'text-zinc-400' : 'text-zinc-500'
            }`}
          >
            Official match history
          </span>
        </div>

        {/* MATCHES LIST DIRECTLY ON THE PAGE */}
        {isLoadingMatches ? (
          <div className="py-12 text-center space-y-2">
            <Loader2 className="w-5 h-5 animate-spin mx-auto text-indigo-500" />
            <p
              className={`text-xs font-bold uppercase tracking-wider ${
                isDark ? 'text-zinc-400' : 'text-zinc-500'
              }`}
            >
              Loading Ranked Match Logs...
            </p>
          </div>
        ) : matches.length === 0 ? (
          <div
            className={`py-12 text-center space-y-1.5 border border-dashed rounded-2xl ${
              isDark ? 'border-zinc-800 text-zinc-400' : 'border-zinc-200 text-zinc-500'
            }`}
          >
            <Clock className="w-6 h-6 mx-auto opacity-40 mb-1" />
            <p className="font-bold text-sm">No ranked matches recorded</p>
            <p className="text-xs">
              {player.username} has not completed any online ranked matches yet.
            </p>
          </div>
        ) : (
          <div
            className={`divide-y border-t ${
              isDark ? 'divide-zinc-800/80 border-zinc-800' : 'divide-zinc-200/80 border-zinc-200'
            }`}
          >
            {matches.map((match) => {
              const dateStr = new Date(match.createdAt).toLocaleDateString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              const isWin = match.myResult === 'win';
              const isDraw = match.myResult === 'draw';

              const opponentNames = match.opponents.map((o) => o.name).join(', ') || 'Opponent';

              const isExpanded = Boolean(expandedMatchIds[match.id]);

              return (
                <div
                  key={match.id}
                  className={`py-3.5 transition-colors ${
                    isDark ? 'hover:bg-zinc-900/40' : 'hover:bg-zinc-50/70'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Left: Match info & opponents */}
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        {/* Result Pill */}
                        {isDraw ? (
                          <span className="px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-500 border border-amber-500/30 flex-shrink-0">
                            DRAW (+5 ELO)
                          </span>
                        ) : isWin ? (
                          <span className="px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex-shrink-0">
                            VICTORY (+25 ELO)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 flex-shrink-0">
                            DEFEAT (-15 ELO)
                          </span>
                        )}

                        <span
                          className={`text-xs font-semibold ${
                            isDark ? 'text-zinc-400' : 'text-zinc-500'
                          }`}
                        >
                          {dateStr}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold min-w-0 flex-wrap">
                        <span className={`truncate max-w-[120px] sm:max-w-none ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                          {competitor.username}
                        </span>
                        <span className="text-zinc-400 text-xs">vs</span>
                        <span
                          className={`font-semibold truncate max-w-[160px] sm:max-w-none ${
                            isDark ? 'text-zinc-300' : 'text-zinc-700'
                          }`}
                        >
                          {opponentNames}
                        </span>
                      </div>
                    </div>

                    {/* Right: Scores breakdown & Toggle Events */}
                    <div className="flex items-center justify-between sm:justify-end gap-2.5 sm:gap-3 flex-wrap sm:flex-nowrap">
                      <div className="text-left sm:text-right">
                        <div className="font-mono font-black text-xs sm:text-sm">
                          <span className="text-indigo-600 dark:text-indigo-400">
                            {match.myScore} pts
                          </span>
                          <span className="text-zinc-400 mx-1.5">-</span>
                          <span className="text-zinc-600 dark:text-zinc-400">
                            {match.opponents.map((o) => `${o.score} pts`).join(', ')}
                          </span>
                        </div>
                        <span
                          className={`text-[9px] sm:text-[10px] font-medium block ${
                            isDark ? 'text-zinc-500' : 'text-zinc-400'
                          }`}
                        >
                          Ranked Match Log
                        </span>
                      </div>

                      {/* View Match Events button */}
                      <button
                        type="button"
                        onClick={() => toggleMatchEvents(match.id)}
                        className={`inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer border select-none flex-shrink-0 ${
                          isExpanded
                            ? isDark
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-xs'
                              : 'bg-rose-50 text-rose-600 border-rose-200 shadow-xs'
                            : isDark
                            ? 'bg-zinc-850 hover:bg-zinc-800 text-zinc-300 border-zinc-750'
                            : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border-zinc-200'
                        }`}
                        title={isExpanded ? 'Hide match events' : 'View match events'}
                      >
                        <ListOrdered className="w-3.5 h-3.5" />
                        <span>{isExpanded ? 'Hide' : `Events (${match.events?.length || 0})`}</span>
                        <ChevronDown
                          className={`w-3.5 h-3.5 transition-transform duration-200 ${
                            isExpanded ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* EXPANDABLE EVENTS TIMELINE */}
                  {isExpanded && (
                    <div
                      className={`mt-3 p-3 sm:p-4 rounded-xl border space-y-2 animate-fadeIn ${
                        isDark
                          ? 'bg-zinc-950/70 border-zinc-800 text-zinc-300'
                          : 'bg-zinc-50 border-zinc-200 text-zinc-700'
                      }`}
                    >
                      <div className="flex items-center justify-between pb-1.5 border-b border-zinc-200/60 dark:border-zinc-800/60 text-[10px] font-black uppercase tracking-wider text-zinc-500">
                        <span className="flex items-center gap-1.5">
                          <ListOrdered className="w-3.5 h-3.5 text-rose-500" />
                          <span>Match Turn-by-Turn Events</span>
                        </span>
                        <span>{match.events?.length || 0} Actions</span>
                      </div>

                      {(!match.events || match.events.length === 0) ? (
                        <p className="text-xs text-zinc-400 italic py-2 text-center">
                          No turn-by-turn events recorded for this session.
                        </p>
                      ) : (
                        <div className="divide-y divide-zinc-200/60 dark:divide-zinc-800/60 max-h-60 overflow-y-auto pr-1">
                          {match.events.map((tx, idx) => {
                            const isFoul = tx.type === 'subtract';
                            return (
                              <div
                                key={tx.id || idx}
                                className="py-1.5 px-1 flex items-center justify-between text-xs"
                              >
                                <div className="flex items-center gap-2 min-w-0 pr-2">
                                  <span className="text-[10px] font-mono font-bold text-zinc-400 w-5 text-right flex-shrink-0">
                                    #{idx + 1}
                                  </span>
                                  <span className="font-bold truncate max-w-[100px] xs:max-w-[150px] sm:max-w-none text-zinc-800 dark:text-zinc-200">
                                    {tx.playerName}
                                  </span>
                                  {tx.ballNumber ? (
                                    <span
                                      className={`text-[9px] sm:text-[10px] font-bold px-1.5 py-0.2 rounded border font-mono flex-shrink-0 ${
                                        isDark
                                          ? 'bg-zinc-800 text-zinc-300 border-zinc-700'
                                          : 'bg-white text-zinc-700 border-zinc-200 shadow-2xs'
                                      }`}
                                    >
                                      Ball #{tx.ballNumber}
                                    </span>
                                  ) : isFoul ? (
                                    <span className="text-[9px] sm:text-[10px] font-bold text-rose-500 flex items-center gap-1 flex-shrink-0">
                                      <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                                      <span>Foul</span>
                                    </span>
                                  ) : null}
                                </div>

                                <div className="text-right flex-shrink-0 pl-2">
                                  <span
                                    className={`font-black font-mono text-xs ${
                                      isFoul
                                        ? 'text-rose-500'
                                        : 'text-emerald-600 dark:text-emerald-400'
                                    }`}
                                  >
                                    {isFoul ? `-${tx.amount}` : `+${tx.amount}`} pts
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* RETURN BUTTON AT BOTTOM */}
      <div className="pt-4">
        <button
          type="button"
          onClick={onBack}
          className={`w-full py-3.5 px-6 rounded-2xl font-black text-xs uppercase tracking-wider transition-all active:scale-98 cursor-pointer shadow-sm ${
            isDark
              ? 'bg-zinc-800 hover:bg-zinc-750 text-white border border-zinc-700'
              : 'bg-zinc-900 hover:bg-zinc-800 text-white'
          }`}
        >
          ← Return to {backLabel || 'Tournament Table'}
        </button>
      </div>
    </div>
  );
};
