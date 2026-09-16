import React from 'react';
import { Settings } from 'lucide-react';
import { GameSession } from '@/types/game';

interface HomeHeroProps {
  activeSession: GameSession | null;
  onStartNewGame: () => void;
  onResumeGame: () => void;
  onClearSession: () => void;
  onScrollToRules?: () => void;
  onOpenSettings?: () => void;
  isDark?: boolean;
}

export const HomeHero: React.FC<HomeHeroProps> = ({
  activeSession,
  onStartNewGame,
  onResumeGame,
  onClearSession,
  onScrollToRules,
  onOpenSettings,
  isDark = false,
}) => {
  return (
    <div className="w-full max-w-2xl mx-auto space-y-3 pt-2 px-4">
      {/* Simple, Compact Title Header */}
      <div
        className={`flex items-center justify-between pb-2 border-b-2 ${
          isDark ? 'border-zinc-800' : 'border-zinc-900'
        }`}
      >
        <h1
          className={`text-xl sm:text-2xl font-black italic tracking-widest bg-clip-text text-transparent font-serif uppercase ${
            isDark
              ? 'bg-gradient-to-r from-white via-indigo-200 to-indigo-400'
              : 'bg-gradient-to-r from-zinc-900 via-indigo-950 to-indigo-800'
          }`}
        >
          BILLIARD
        </h1>

        <div className="flex items-center gap-2">
          <span
            className={`text-[10px] font-extrabold uppercase tracking-widest font-serif italic ${
              isDark ? 'text-zinc-400' : 'text-zinc-600'
            }`}
          >
            SCOREKEEPER
          </span>
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Settings"
            className={`p-1.5 rounded-full transition-all active:scale-90 ${
              isDark
                ? 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/70'
            }`}
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Landing Card with Background Image (Compact Height) */}
      <div className="relative rounded-3xl overflow-hidden shadow-md min-h-[170px] sm:min-h-[200px] flex flex-col justify-end p-4 sm:p-6 bg-zinc-900 border border-zinc-800">
        {/* Background Image & Overlay */}
        <div
          className="absolute inset-0 bg-cover bg-center transition-transform duration-700 hover:scale-105"
          style={{ backgroundImage: `url('/pool_hero_bg.png')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-zinc-950/20" />

        {/* Hero Content */}
        <div className="relative z-10 space-y-1 pb-8 sm:pb-10">
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white leading-tight">
            PLAY CLEAN. <span className="text-indigo-400">SINK THEM IN.</span>
          </h2>
          <p className="text-xs text-zinc-300 font-medium max-w-md">
            Direct score tallying & automatic offline state tracking.
          </p>
        </div>
      </div>

      {/* Side-by-Side Compact Rectangular Action Cards */}
      <div className="-mt-10 sm:-mt-12 relative z-20 px-1 sm:px-2">
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
          {/* START GAME Card */}
          <button
            onClick={onStartNewGame}
            className={`p-3 sm:p-4 text-left transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98] border flex items-center justify-between group cursor-pointer h-20 sm:h-22 ${
              isDark
                ? 'rounded-3xl border-zinc-800 bg-zinc-900 hover:bg-zinc-800/80 hover:border-zinc-700 shadow-sm'
                : 'felt-card border-zinc-200/90 bg-white'
            }`}
          >
            <div className="space-y-0.5">
              <span className="text-[9px] font-extrabold text-indigo-500 uppercase tracking-widest block">
                New Session
              </span>
              <h3
                className={`font-black text-sm sm:text-base transition-colors leading-none ${
                  isDark
                    ? 'text-zinc-100 group-hover:text-indigo-400'
                    : 'text-zinc-900 group-hover:text-indigo-600'
                }`}
              >
                START GAME
              </h3>
              <p
                className={`text-[10px] font-medium truncate ${
                  isDark ? 'text-zinc-400' : 'text-zinc-500'
                }`}
              >
                Add players
              </p>
            </div>
            <span
              className={`text-sm font-black group-hover:translate-x-1 transition-transform pl-1 ${
                isDark ? 'text-zinc-100' : 'text-zinc-900'
              }`}
            >
              →
            </span>
          </button>

          {/* GAME RULES Card */}
          <button
            onClick={onScrollToRules}
            className={`p-3 sm:p-4 text-left transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98] border flex items-center justify-between group cursor-pointer h-20 sm:h-22 ${
              isDark
                ? 'rounded-3xl border-zinc-800 bg-zinc-900 hover:bg-zinc-800/80 hover:border-zinc-700 shadow-sm'
                : 'felt-card border-zinc-200/90 bg-white'
            }`}
          >
            <div className="space-y-0.5">
              <span className="text-[9px] font-extrabold text-amber-500 uppercase tracking-widest block">
                Scoring Guide
              </span>
              <h3
                className={`font-black text-sm sm:text-base transition-colors leading-none ${
                  isDark
                    ? 'text-zinc-100 group-hover:text-amber-400'
                    : 'text-zinc-900 group-hover:text-amber-600'
                }`}
              >
                GAME RULES
              </h3>
              <p
                className={`text-[10px] font-medium truncate ${
                  isDark ? 'text-zinc-400' : 'text-zinc-500'
                }`}
              >
                Ball values
              </p>
            </div>
            <span
              className={`text-sm font-black group-hover:translate-x-1 transition-transform pl-1 ${
                isDark ? 'text-zinc-100' : 'text-zinc-900'
              }`}
            >
              ↓
            </span>
          </button>
        </div>
      </div>

      {/* Active Game Banner */}
      {activeSession && (
        <div className="pt-1">
          <div
            className={`p-3 border flex items-center justify-between gap-2 rounded-2xl ${
              isDark
                ? 'border-indigo-900/60 bg-zinc-900/90'
                : 'felt-card border-indigo-200 bg-indigo-50/40'
            }`}
          >
            <div className="space-y-0.5 truncate">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span
                  className={`text-[10px] font-extrabold uppercase tracking-wider ${
                    isDark ? 'text-indigo-300' : 'text-indigo-900'
                  }`}
                >
                  Active Game
                </span>
              </div>
              <p
                className={`text-xs font-bold truncate ${
                  isDark ? 'text-zinc-200' : 'text-zinc-800'
                }`}
              >
                {activeSession.players.map(p => `${p.name} (${p.score})`).join(' • ')}
              </p>
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                onClick={onResumeGame}
                className="px-3.5 py-1.5 rounded-full bg-indigo-600 text-white font-extrabold text-xs hover:bg-indigo-500 shadow-sm transition active:scale-95"
              >
                RESUME
              </button>
              <button
                onClick={onClearSession}
                title="Discard session"
                className={`text-[11px] px-1.5 py-1 transition ${
                  isDark ? 'text-zinc-400 hover:text-rose-400' : 'text-zinc-400 hover:text-rose-600'
                }`}
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
