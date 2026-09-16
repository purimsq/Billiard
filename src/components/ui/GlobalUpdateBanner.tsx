'use client';

import React, { useSyncExternalStore } from 'react';
import {
  Loader2,
  Sparkles,
  RefreshCw,
  X,
  ArrowRight,
  Lock,
} from 'lucide-react';
import {
  getSystemUpdateSnapshot,
  subscribeSystemUpdate,
  applySystemUpdate,
  dismissUpdateBanner,
} from '@/lib/systemUpdateManager';

interface GlobalUpdateBannerProps {
  currentView: string;
  onOpenSettings: () => void;
  isDark: boolean;
}

export const GlobalUpdateBanner: React.FC<GlobalUpdateBannerProps> = ({
  currentView,
  onOpenSettings,
  isDark,
}) => {
  const state = useSyncExternalStore(
    subscribeSystemUpdate,
    getSystemUpdateSnapshot,
    getSystemUpdateSnapshot
  );

  // If user is already in settings, the SettingsPage card handles it
  if (currentView === 'settings') {
    return null;
  }

  // If banner was dismissed for ready state
  if (state.isBannerDismissed) {
    return null;
  }

  // Only show outside settings if actively installing or update is ready
  if (state.status !== 'installing' && state.status !== 'ready') {
    return null;
  }

  return (
    <aside
      aria-label="System Update Notification"
      className="fixed top-3 left-1/2 -translate-x-1/2 z-50 w-[94%] max-w-lg transition-all animate-fadeIn"
    >
      {/* Actively Installing State */}
      {state.status === 'installing' && (
        <div
          className={`p-3.5 rounded-2xl shadow-2xl border backdrop-blur-md flex flex-col gap-2 ${
            isDark
              ? 'bg-zinc-900/95 border-indigo-500/50 text-white'
              : 'bg-white/95 border-indigo-200 text-zinc-900'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-xl bg-indigo-600 text-white flex items-center justify-center flex-shrink-0">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
              <div className="truncate">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-black tracking-tight uppercase">
                    Updating Billiard
                  </p>
                  <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-400 font-mono">
                    {state.availableVersion || 'v1.2.1'}
                  </span>
                </div>
                <p className="text-[10px] opacity-75 font-medium truncate">
                  {state.installStepMessage}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              <div className="flex items-center gap-1 text-[9px] font-black text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                <Lock className="w-2.5 h-2.5" />
                <span>Auto</span>
              </div>
              <button
                onClick={onOpenSettings}
                className="text-[10px] font-black uppercase px-2 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-all flex items-center gap-1"
              >
                <span>View</span>
                <ArrowRight className="w-2.5 h-2.5" />
              </button>
            </div>
          </div>

          {/* Mini progress bar */}
          <div className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-600 transition-all duration-300"
              style={{ width: `${state.installProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Ready to Apply State */}
      {state.status === 'ready' && (
        <div
          className={`p-3.5 rounded-2xl shadow-2xl border backdrop-blur-md flex items-center justify-between gap-3 ${
            isDark
              ? 'bg-zinc-900/95 border-emerald-500/50 text-white'
              : 'bg-white/95 border-emerald-300 text-zinc-900'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="truncate">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-black tracking-tight uppercase">
                  Update Ready to Apply
                </p>
                <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 font-mono">
                  {state.availableVersion || 'v1.2.1'}
                </span>
              </div>
              <p className="text-[10px] opacity-75 font-medium truncate">
                Downloaded in background. Tap restart to apply changes.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={() => applySystemUpdate()}
              disabled={state.isRefreshing}
              className="text-[11px] font-black uppercase px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-all active:scale-95 flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3 h-3 ${state.isRefreshing ? 'animate-spin' : ''}`} />
              <span>{state.isRefreshing ? 'Restarting...' : 'Restart'}</span>
            </button>
            <button
              onClick={() => dismissUpdateBanner()}
              className="p-1 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
};
