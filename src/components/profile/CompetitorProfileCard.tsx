import React, { useState, useEffect } from 'react';
import {
  QrCode,
  Trophy,
  Mail,
  Copy,
  Check,
  ShieldCheck,
  Zap,
  Target,
  ChevronRight,
  UserCheck,
} from 'lucide-react';
import { RankedPlayerProfile, getPlayerRankPosition } from '@/lib/rankedSync';

interface CompetitorProfileCardProps {
  profile: RankedPlayerProfile;
  isDark: boolean;
  onOpenQr: () => void;
}

export const CompetitorProfileCard: React.FC<CompetitorProfileCardProps> = ({
  profile,
  isDark,
  onOpenQr,
}) => {
  const [copiedTag, setCopiedTag] = useState<boolean>(false);
  const [rankPosition, setRankPosition] = useState<number | null>(null);
  const [isLoadingRank, setIsLoadingRank] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    getPlayerRankPosition(
      profile.id,
      profile.rating || 100,
      profile.username,
      profile.discriminator
    )
      .then((rank) => {
        if (isMounted) {
          setRankPosition(rank);
          setIsLoadingRank(false);
        }
      })
      .catch((err) => {
        console.warn('Failed to load rank position:', err);
        if (isMounted) {
          setRankPosition(1);
          setIsLoadingRank(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [profile.id, profile.rating, profile.username, profile.discriminator]);

  const totalMatches = profile.totalMatches || 0;
  const wins = profile.wins || 0;
  const losses = profile.losses || 0;
  const winRate =
    totalMatches > 0 ? ((wins / totalMatches) * 100).toFixed(1) : '0.0';
  const playerColor = profile.color || '#6366F1';
  const formattedTag =
    profile.tag || `${profile.username} #${profile.discriminator || '1001'}`;

  const handleCopyTag = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(formattedTag);
      setCopiedTag(true);
      setTimeout(() => setCopiedTag(false), 2000);
    }
  };

  const createdDateStr = profile.createdAt
    ? new Date(profile.createdAt).toLocaleDateString(undefined, {
        month: 'short',
        year: 'numeric',
      })
    : 'Member';

  return (
    <div
      className={`relative rounded-3xl border transition-all duration-300 overflow-hidden shadow-sm hover:shadow-md ${
        isDark
          ? 'bg-gradient-to-br from-zinc-900 via-zinc-900/98 to-zinc-950 border-zinc-800'
          : 'bg-gradient-to-br from-white via-zinc-50/80 to-slate-50 border-zinc-200/90'
      }`}
    >
      {/* Background Decorative Ambient Radial Glow from player color */}
      <div
        className="absolute -top-12 -right-12 w-48 h-48 rounded-full pointer-events-none blur-3xl opacity-20 transition-all duration-700"
        style={{ backgroundColor: playerColor }}
      />

      {/* Subtle Security / Guilloche Watermark Icon in background */}
      <div className="absolute right-4 bottom-3 pointer-events-none opacity-[0.03] dark:opacity-[0.05] select-none">
        <Trophy className="w-40 h-40" />
      </div>

      <div className="relative p-4 sm:p-5.5 space-y-4 sm:space-y-4.5">
        {/* TOP STATUS BAR: Verified Status & Division Rank */}
        <div className="flex items-center justify-between gap-2">
          {/* Verified Pill */}
          <div
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-2xs ${
              isDark
                ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                : 'bg-emerald-50 border-emerald-200 text-emerald-700'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <UserCheck className="w-3 h-3" />
            <span>Official Competitor Pass</span>
          </div>

          {/* Ranked Circuit Badge */}
          <div
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-2xs ${
              isDark
                ? 'bg-zinc-800/80 border-zinc-700/80 text-zinc-300'
                : 'bg-zinc-100 border-zinc-200 text-zinc-700'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            <span>Ranked Circuit</span>
          </div>
        </div>

        {/* PRIMARY HERO: Avatar, Identity Info & QR Pass Button */}
        <div className="flex items-center justify-between gap-3 sm:gap-4">
          {/* Left Side: Avatar + Player Info */}
          <div className="flex items-center gap-3.5 sm:gap-4 min-w-0 flex-1">
            {/* 3D Stylized Avatar with colored glow & active badge */}
            <div className="relative flex-shrink-0">
              {/* Soft ambient glow behind avatar */}
              <div
                className="absolute -inset-1 rounded-2xl blur-md opacity-40 transition-opacity"
                style={{ backgroundColor: playerColor }}
              />

              <div
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center text-white font-black text-xl sm:text-2xl shadow-lg relative overflow-hidden ring-2 ring-white/20 dark:ring-white/10"
                style={{ backgroundColor: playerColor }}
              >
                {/* Specular sheen overlay */}
                <div className="absolute inset-0 bg-gradient-to-b from-white/30 via-transparent to-black/25 pointer-events-none" />
                <span className="relative drop-shadow-sm select-none">
                  {profile.username
                    ? profile.username.charAt(0).toUpperCase()
                    : 'P'}
                </span>
              </div>

              {/* Status Badge at bottom-right corner */}
              <div
                className={`absolute -bottom-1 -right-1 w-4.5 h-4.5 rounded-full bg-emerald-500 border-2 flex items-center justify-center shadow-sm ${
                  isDark ? 'border-zinc-900' : 'border-white'
                }`}
                title="Active & Synced"
              >
                <Check className="w-2.5 h-2.5 text-white stroke-[3.5]" />
              </div>
            </div>

            {/* Identity Info */}
            <div className="min-w-0 flex-1 space-y-1">
              {/* Username + Monospace Discriminator + Copy Button */}
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <h4
                  className={`font-black text-base sm:text-lg leading-tight truncate tracking-tight ${
                    isDark ? 'text-white' : 'text-zinc-900'
                  }`}
                >
                  {profile.username}
                </h4>

                {/* Discriminator Badge with Copy Action */}
                <button
                  type="button"
                  onClick={handleCopyTag}
                  className={`group inline-flex items-center gap-1 font-mono font-bold text-xs px-2 py-0.5 rounded-lg border transition-all active:scale-95 cursor-pointer ${
                    isDark
                      ? 'text-indigo-400 bg-indigo-500/15 border-indigo-500/30 hover:bg-indigo-500/25 hover:border-indigo-400/50'
                      : 'text-indigo-600 bg-indigo-50 border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300'
                  }`}
                  title="Click to copy player tag"
                >
                  <span>#{profile.discriminator || '1001'}</span>
                  {copiedTag ? (
                    <Check className="w-3 h-3 text-emerald-500 stroke-[3]" />
                  ) : (
                    <Copy className="w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity" />
                  )}
                </button>

                {copiedTag && (
                  <span className="text-[10px] font-black text-emerald-500 animate-fadeIn">
                    Copied!
                  </span>
                )}
              </div>

              {/* Email Address with Icon */}
              <div className="flex items-center gap-1.5 text-xs truncate">
                <Mail
                  className={`w-3.5 h-3.5 flex-shrink-0 ${
                    isDark ? 'text-zinc-400' : 'text-zinc-500'
                  }`}
                />
                <span
                  className={`truncate font-medium ${
                    isDark ? 'text-zinc-300' : 'text-zinc-600'
                  }`}
                >
                  {profile.email || 'No email registered'}
                </span>
              </div>

              {/* Secondary meta info (Circuit ID / Registered) */}
              <div
                className={`text-[10px] font-semibold flex items-center gap-1.5 ${
                  isDark ? 'text-zinc-400' : 'text-zinc-500'
                }`}
              >
                <span>Joined {createdDateStr}</span>
                <span>•</span>
                <span className="font-mono">ID: {profile.id.slice(0, 8)}</span>
              </div>
            </div>
          </div>

          {/* Right Side: Tactile QR Pass Button */}
          <button
            type="button"
            onClick={onOpenQr}
            className={`p-2.5 sm:p-3 rounded-2xl border transition-all duration-200 active:scale-95 flex flex-col items-center justify-center gap-1.5 flex-shrink-0 cursor-pointer group shadow-2xs ${
              isDark
                ? 'bg-zinc-800/80 hover:bg-zinc-800 border-zinc-700/80 hover:border-indigo-500/60 text-zinc-200 hover:text-white hover:shadow-indigo-500/10'
                : 'bg-white hover:bg-zinc-50 border-zinc-200/90 hover:border-indigo-400 text-zinc-700 hover:text-zinc-900 hover:shadow-indigo-500/10'
            }`}
            title="Open Digital Player Pass & QR Code"
          >
            <div className="relative p-1.5 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/15 border border-indigo-500/20 group-hover:border-indigo-500/40 transition-colors">
              <QrCode
                className={`w-5 h-5 sm:w-6 sm:h-6 transition-transform duration-200 group-hover:scale-110 ${
                  isDark ? 'text-indigo-400 group-hover:text-indigo-300' : 'text-indigo-600'
                }`}
              />
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-zinc-900" />
            </div>
            <div className="text-center space-y-0.5">
              <span
                className={`text-[9px] font-black uppercase tracking-wider block transition-colors leading-none ${
                  isDark
                    ? 'text-zinc-200 group-hover:text-indigo-400'
                    : 'text-zinc-700 group-hover:text-indigo-600'
                }`}
              >
                Pass / QR
              </span>
              <span className="text-[8px] font-extrabold text-indigo-500 dark:text-indigo-400 uppercase tracking-tight block leading-none">
                Tap to View
              </span>
            </div>
          </button>
        </div>

        {/* STATS STRIP: 3 Micro-Cards (ELO, Record, High Break) */}
        <div className="grid grid-cols-3 gap-2 sm:gap-2.5 pt-1">
          {/* Card 1: Leaderboard Position from Database */}
          <div
            className={`p-2.5 sm:p-3 rounded-2xl border transition-all ${
              isDark
                ? 'bg-zinc-800/40 border-zinc-800/80 hover:border-zinc-700'
                : 'bg-white/80 border-zinc-200/70 shadow-2xs hover:border-zinc-300'
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <Trophy className="w-3.5 h-3.5 text-amber-500" />
              <span
                className={`text-[10px] font-extrabold uppercase tracking-wider ${
                  isDark ? 'text-zinc-300' : 'text-zinc-600'
                }`}
              >
                Position
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              {isLoadingRank ? (
                <div className="flex items-center gap-1 py-0.5">
                  <span className="w-12 h-5 rounded-md bg-zinc-200 dark:bg-zinc-700 animate-pulse" />
                </div>
              ) : (
                <>
                  <span className="font-mono font-bold text-xs text-amber-500">#</span>
                  <span
                    className={`font-black text-sm sm:text-base tracking-tight ${
                      isDark ? 'text-white' : 'text-zinc-900'
                    }`}
                  >
                    {rankPosition !== null ? rankPosition : '1'}
                  </span>
                  <span className="text-[10px] font-bold text-zinc-400">Rank</span>
                </>
              )}
            </div>
            <span
              className={`text-[9px] font-semibold block truncate mt-0.5 ${
                isDark ? 'text-zinc-400' : 'text-zinc-500'
              }`}
            >
              {(profile.rating || 100).toLocaleString()} ELO
            </span>
          </div>

          {/* Card 2: Record / Win Rate */}
          <div
            className={`p-2.5 sm:p-3 rounded-2xl border transition-all ${
              isDark
                ? 'bg-zinc-800/40 border-zinc-800/80 hover:border-zinc-700'
                : 'bg-white/80 border-zinc-200/70 shadow-2xs hover:border-zinc-300'
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <Target className="w-3.5 h-3.5 text-indigo-500" />
              <span
                className={`text-[10px] font-extrabold uppercase tracking-wider ${
                  isDark ? 'text-zinc-300' : 'text-zinc-600'
                }`}
              >
                Record
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span
                className={`font-black text-sm sm:text-base tracking-tight ${
                  isDark ? 'text-white' : 'text-zinc-900'
                }`}
              >
                {wins}W
              </span>
              <span
                className={`text-xs font-bold ${
                  isDark ? 'text-zinc-400' : 'text-zinc-500'
                }`}
              >
                -
              </span>
              <span
                className={`font-black text-sm sm:text-base tracking-tight ${
                  isDark ? 'text-zinc-300' : 'text-zinc-700'
                }`}
              >
                {losses}L
              </span>
            </div>
            <span
              className={`text-[9px] font-semibold block truncate mt-0.5 ${
                isDark ? 'text-zinc-400' : 'text-zinc-500'
              }`}
            >
              {totalMatches > 0 ? `${winRate}% Win Rate` : 'No matches yet'}
            </span>
          </div>

          {/* Card 3: Highest Break / Points */}
          <div
            className={`p-2.5 sm:p-3 rounded-2xl border transition-all ${
              isDark
                ? 'bg-zinc-800/40 border-zinc-800/80 hover:border-zinc-700'
                : 'bg-white/80 border-zinc-200/70 shadow-2xs hover:border-zinc-300'
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <Zap className="w-3.5 h-3.5 text-emerald-500" />
              <span
                className={`text-[10px] font-extrabold uppercase tracking-wider ${
                  isDark ? 'text-zinc-300' : 'text-zinc-600'
                }`}
              >
                Best Break
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span
                className={`font-black text-sm sm:text-base tracking-tight ${
                  isDark ? 'text-white' : 'text-zinc-900'
                }`}
              >
                {profile.highestBreak || 0}
              </span>
              <span className="text-[10px] font-bold text-emerald-500">pts</span>
            </div>
            <span
              className={`text-[9px] font-semibold block truncate mt-0.5 ${
                isDark ? 'text-zinc-400' : 'text-zinc-500'
              }`}
            >
              {profile.pointsPerGame
                ? `${profile.pointsPerGame} PPG • ${(profile.totalPoints || 0).toLocaleString()} pts`
                : totalMatches > 0
                ? `${((profile.totalPoints || 0) / totalMatches).toFixed(1)} PPG • ${(profile.totalPoints || 0).toLocaleString()} pts`
                : `${(profile.totalPoints || 0).toLocaleString()} Total Pts`}
            </span>
          </div>
        </div>

        {/* BOTTOM METADATA / ACTION STRIP */}
        <div
          className={`pt-2 flex items-center justify-between border-t text-[11px] font-medium gap-2 ${
            isDark ? 'border-zinc-800/80' : 'border-zinc-200/80'
          }`}
        >
          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
            <ShieldCheck className="w-3.5 h-3.5 stroke-[2.5]" />
            <span className="text-[10px] sm:text-[11px]">Ranked Cloud Synced</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenQr}
              className={`font-bold text-[10px] sm:text-[11px] flex items-center gap-1 transition-colors cursor-pointer ${
                isDark
                  ? 'text-indigo-400 hover:text-indigo-300'
                  : 'text-indigo-600 hover:text-indigo-700'
              }`}
            >
              <span>View Pass</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
