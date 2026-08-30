import React from 'react';
import { GameSession } from '@/types/game';

interface HomeHeroProps {
  activeSession: GameSession | null;
  onStartNewGame: () => void;
  onResumeGame: () => void;
  onClearSession: () => void;
  onScrollToRules?: () => void;
}

export const HomeHero: React.FC<HomeHeroProps> = ({
  activeSession,
  onStartNewGame,
  onResumeGame,
  onClearSession,
  onScrollToRules,
}) => {
  return (
    <div className="w-full max-w-2xl mx-auto space-y-3 pt-2 px-4">
      {/* Simple, Compact Title Header with Visible Black Line */}
      <div className="flex items-center justify-between pb-2 border-b-2 border-zinc-900">
        <h1 className="text-xl sm:text-2xl font-black italic tracking-widest bg-gradient-to-r from-zinc-900 via-indigo-950 to-indigo-800 bg-clip-text text-transparent font-serif uppercase">
          BILLIARD
        </h1>

        <span className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-600 font-serif italic">
          SCOREKEEPER
        </span>
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
            className="felt-card p-3 sm:p-4 text-left transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98] border border-zinc-200/90 bg-white flex items-center justify-between group cursor-pointer h-20 sm:h-22"
          >
            <div className="space-y-0.5">
              <span className="text-[9px] font-extrabold text-indigo-600 uppercase tracking-widest block">
                New Session
              </span>
              <h3 className="font-black text-zinc-900 text-sm sm:text-base group-hover:text-indigo-600 transition-colors leading-none">
                START GAME
              </h3>
              <p className="text-[10px] text-zinc-500 font-medium truncate">
                Add players
              </p>
            </div>
            <span className="text-sm font-black text-zinc-900 group-hover:translate-x-1 transition-transform pl-1">
              →
            </span>
          </button>

          {/* GAME RULES Card */}
          <button
            onClick={onScrollToRules}
            className="felt-card p-3 sm:p-4 text-left transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98] border border-zinc-200/90 bg-white flex items-center justify-between group cursor-pointer h-20 sm:h-22"
          >
            <div className="space-y-0.5">
              <span className="text-[9px] font-extrabold text-amber-600 uppercase tracking-widest block">
                Scoring Guide
              </span>
              <h3 className="font-black text-zinc-900 text-sm sm:text-base group-hover:text-amber-600 transition-colors leading-none">
                GAME RULES
              </h3>
              <p className="text-[10px] text-zinc-500 font-medium truncate">
                Ball values
              </p>
            </div>
            <span className="text-sm font-black text-zinc-900 group-hover:translate-x-1 transition-transform pl-1">
              ↓
            </span>
          </button>
        </div>
      </div>

      {/* Active Game Banner */}
      {activeSession && (
        <div className="pt-1">
          <div className="felt-card p-3 border border-indigo-200 bg-indigo-50/40 flex items-center justify-between gap-2">
            <div className="space-y-0.5 truncate">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-900">
                  Active Game
                </span>
              </div>
              <p className="text-xs font-bold text-zinc-800 truncate">
                {activeSession.players.map(p => `${p.name} (${p.score})`).join(' • ')}
              </p>
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                onClick={onResumeGame}
                className="px-3.5 py-1.5 rounded-full bg-indigo-600 text-white font-extrabold text-xs hover:bg-indigo-700 shadow-sm transition active:scale-95"
              >
                RESUME
              </button>
              <button
                onClick={onClearSession}
                title="Discard session"
                className="text-[11px] text-zinc-400 hover:text-rose-600 px-1.5 py-1 transition"
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
