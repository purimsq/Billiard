import React, { useEffect } from 'react';
import { Ban, AlertTriangle, X, ShieldAlert, Users } from 'lucide-react';
import { GameSession } from '@/types/game';

interface CancelGameModalProps {
  isOpen: boolean;
  session: GameSession | null;
  onClose: () => void;
  onConfirmCancel: () => void;
  isDark?: boolean;
}

export const CancelGameModal: React.FC<CancelGameModalProps> = ({
  isOpen,
  session,
  onClose,
  onConfirmCancel,
  isDark = false,
}) => {
  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !session) return null;

  const isRanked = session.mode === 'ranked';
  const totalEvents = session.history?.length || 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-game-title"
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-sm sm:max-w-md rounded-3xl p-5 sm:p-6 border shadow-2xl space-y-4 animate-scaleUp transition-colors ${
          isDark
            ? 'bg-zinc-900 border-zinc-800 text-zinc-100'
            : 'bg-white border-zinc-200 text-zinc-900'
        }`}
      >
        {/* Top Header Row with Badge & Dismiss */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            {isRanked ? (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-500 border border-amber-500/30">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Ranked Match</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Casual Match</span>
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={`p-1.5 rounded-full transition active:scale-90 ${
              isDark
                ? 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Warning Icon & Main Title */}
        <div className="flex items-start gap-3.5 pt-1">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 bg-rose-500/15 text-rose-500 border border-rose-500/25 shadow-sm">
            <Ban className="w-6 h-6 stroke-[2.2]" />
          </div>

          <div className="space-y-1">
            <h3
              id="cancel-game-title"
              className="font-black text-lg sm:text-xl uppercase font-serif tracking-tight leading-tight"
            >
              {isRanked ? 'Cancel Ranked Match?' : 'Cancel Casual Game?'}
            </h3>
            <p
              className={`text-xs font-medium leading-relaxed ${
                isDark ? 'text-zinc-300' : 'text-zinc-600'
              }`}
            >
              {isRanked ? (
                <>
                  This ranked match will be <strong className="text-rose-500 font-bold">voided</strong>. It will{' '}
                  <strong className="underline decoration-rose-500/50">not</strong> be submitted to the tournament database, will not alter any player ratings or ELO, and will not appear in match history.
                </>
              ) : (
                <>
                  Are you sure you want to cancel this game? This session will be discarded and will{' '}
                  <strong className="underline decoration-rose-500/50">not</strong> be recorded in your match history or profile stats.
                </>
              )}
            </p>
          </div>
        </div>

        {/* Match Context Details Box */}
        <div
          className={`p-3.5 rounded-2xl border space-y-2 text-xs ${
            isDark
              ? 'bg-zinc-950/70 border-zinc-800/90 text-zinc-300'
              : 'bg-zinc-50 border-zinc-200 text-zinc-700'
          }`}
        >
          <div className="flex items-center justify-between font-bold text-[11px] text-zinc-400 uppercase tracking-wider">
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              <span>Participants ({session.players.length})</span>
            </span>
            <span>{totalEvents} {totalEvents === 1 ? 'event' : 'events'}</span>
          </div>

          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {session.players.map((p) => (
              <span
                key={p.id}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs font-bold ${
                  isDark
                    ? 'bg-zinc-900 border-zinc-800 text-zinc-200'
                    : 'bg-white border-zinc-200 text-zinc-800 shadow-2xs'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: p.color }}
                />
                <span className="truncate max-w-[120px]">{p.name}</span>
                <span
                  className={`text-[11px] font-extrabold ${
                    p.score > 0
                      ? isDark
                        ? 'text-emerald-400'
                        : 'text-emerald-600'
                      : p.score < 0
                      ? 'text-rose-500'
                      : 'text-zinc-400'
                  }`}
                >
                  {p.score > 0 ? `+${p.score}` : p.score}
                </span>
              </span>
            ))}
          </div>
        </div>

        {/* Warning Callout */}
        <div
          className={`px-3 py-2 rounded-xl text-[11px] font-semibold flex items-center gap-2 border ${
            isDark
              ? 'bg-rose-950/30 border-rose-900/40 text-rose-300'
              : 'bg-rose-50 border-rose-200 text-rose-700'
          }`}
        >
          <AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0" />
          <span>This action cannot be undone. All unsaved scores will be discarded.</span>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <button
            type="button"
            onClick={onClose}
            className={`py-3 px-3 rounded-2xl border font-bold text-xs transition active:scale-[0.98] ${
              isDark
                ? 'border-zinc-700 bg-zinc-800/80 text-zinc-200 hover:bg-zinc-800 hover:text-white'
                : 'border-zinc-300 bg-zinc-100 text-zinc-800 hover:bg-zinc-200'
            }`}
          >
            Keep Playing
          </button>

          <button
            type="button"
            onClick={onConfirmCancel}
            className="py-3 px-3 rounded-2xl font-black text-xs uppercase tracking-wider text-white bg-rose-600 hover:bg-rose-700 shadow-md shadow-rose-600/25 transition active:scale-[0.98] flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Ban className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Yes, Cancel</span>
          </button>
        </div>
      </div>
    </div>
  );
};
