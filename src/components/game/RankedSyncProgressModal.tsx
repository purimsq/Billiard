import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameSession } from '@/types/game';
import {
  submitRankedMatch,
  RankedSyncProgressUpdate,
  SubmitRankedMatchResult,
} from '@/lib/rankedSync';
import { MatchEloResult } from '@/lib/smartElo';
import { WifiOff, RefreshCw, ArrowRight } from 'lucide-react';

interface RankedSyncProgressModalProps {
  session: GameSession;
  isOpen: boolean;
  isDark: boolean;
  onComplete: (
    session: GameSession,
    eloResult: MatchEloResult | null,
    syncStatus: 'synced' | 'queued'
  ) => void;
}

type SyncPhase = 'progress' | 'error_retry' | 'tick' | 'spinner';

export const RankedSyncProgressModal: React.FC<RankedSyncProgressModalProps> = ({
  session,
  isOpen,
  isDark,
  onComplete,
}) => {
  const [phase, setPhase] = useState<SyncPhase>('progress');
  const [displayProgress, setDisplayProgress] = useState<number>(8);
  const [stageLabel, setStageLabel] = useState<string>('STARTING SYNC...');
  const [stageDetail, setStageDetail] = useState<string>(
    'Initializing tournament verification protocol...'
  );
  const [isOfflineDetected, setIsOfflineDetected] = useState<boolean>(false);
  const [syncResult, setSyncResult] = useState<SubmitRankedMatchResult | null>(null);

  const targetProgressRef = useRef<number>(8);
  const hasTriggeredRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Smooth number interpolation ticker for the progress bar
  useEffect(() => {
    if (!isOpen || phase !== 'progress') return;

    const interval = setInterval(() => {
      setDisplayProgress((prev) => {
        const target = targetProgressRef.current;
        if (prev < target) {
          const step = Math.max(1, Math.ceil((target - prev) / 5));
          return Math.min(target, prev + step);
        }
        return prev;
      });
    }, 45);

    return () => clearInterval(interval);
  }, [isOpen, phase]);

  // Main submission controller
  const executeSubmission = useCallback(async () => {
    if (!isMountedRef.current) return;
    setPhase('progress');
    setIsOfflineDetected(false);
    targetProgressRef.current = 15;
    setStageLabel('FETCHING STANDINGS & PROFILES');
    setStageDetail('Querying latest competitor ratings and seeding data...');

    try {
      const res = await submitRankedMatch(session, (update: RankedSyncProgressUpdate) => {
        if (!isMountedRef.current) return;
        targetProgressRef.current = Math.max(targetProgressRef.current, update.percent);
        setStageLabel(update.label);
        setStageDetail(update.detail);
        if (update.stage === 'offline_queuing') {
          setIsOfflineDetected(true);
        }
      });

      if (!isMountedRef.current) return;
      setSyncResult(res);
      targetProgressRef.current = 100;

      // Small pause to let progress reach 100% smoothly
      setTimeout(() => {
        if (!isMountedRef.current) return;
        setPhase('tick');

        // Transition from checkmark tick to preparing results spinner
        setTimeout(() => {
          if (!isMountedRef.current) return;
          setPhase('spinner');

          // Transition to final scoreboard modal
          setTimeout(() => {
            if (!isMountedRef.current) return;
            const status: 'synced' | 'queued' = res.offlineQueued ? 'queued' : 'synced';
            onComplete(session, res.eloResult || null, status);
          }, 1600);
        }, 1300);
      }, 500);
    } catch {
      if (!isMountedRef.current) return;
      // Network stalled or unrecoverable mid-sync -> offer retry or safe offline save
      setPhase('error_retry');
    }
  }, [session, onComplete]);

  useEffect(() => {
    if (isOpen && !hasTriggeredRef.current) {
      hasTriggeredRef.current = true;
      executeSubmission();
    }
  }, [isOpen, executeSubmission]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none backdrop-blur-md animate-fadeIn"
      style={{
        backgroundColor: isDark ? 'rgba(9, 9, 11, 0.94)' : 'rgba(15, 23, 42, 0.88)',
      }}
    >
      <div
        className={`w-full max-w-md rounded-3xl border p-6 sm:p-8 flex flex-col items-center text-center shadow-2xl relative overflow-hidden transition-all duration-300 ${
          isDark
            ? 'bg-zinc-950/90 border-zinc-800 text-zinc-100 shadow-cyan-950/20'
            : 'bg-zinc-900/95 border-zinc-700/80 text-white shadow-black/40'
        }`}
      >
        {/* Subtle Ambient Background Glow */}
        <div className="absolute -top-24 -left-24 w-60 h-60 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-60 h-60 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

        {/* ================= PHASE 1: RETRO / DIGITAL STRIPED PROGRESS BAR ================= */}
        {phase === 'progress' && (
          <div className="w-full flex flex-col items-center space-y-5 py-2 animate-fadeIn">
            {/* Top Header Label */}
            <div className="flex flex-col items-center space-y-1">
              <span className="text-[11px] font-black uppercase tracking-[0.28em] text-cyan-400 font-mono">
                {isOfflineDetected ? 'OFFLINE QUEUING...' : 'SYNCING RANKED RESULTS...'}
              </span>
              <h3 className="text-xl sm:text-2xl font-black uppercase tracking-tight font-serif text-white">
                OFFICIAL MATCH LOG
              </h3>
            </div>

            {/* Retro Striped Progress Bar Container (Image 1 Style) */}
            <div className="w-full space-y-3 pt-2">
              <div
                className="w-full h-9 sm:h-11 rounded-lg border-2 border-cyan-400/90 p-1 relative overflow-hidden bg-black/60 shadow-[0_0_15px_rgba(34,211,238,0.3)] flex items-center"
                style={{
                  boxShadow: '0 0 16px rgba(34, 211, 238, 0.25)',
                }}
              >
                <div
                  className="h-full rounded-sm transition-all duration-150 ease-out animate-stripeMove"
                  style={{
                    width: `${Math.max(4, Math.min(100, displayProgress))}%`,
                    backgroundImage: `repeating-linear-gradient(
                      -45deg,
                      #22d3ee,
                      #22d3ee 9px,
                      transparent 9px,
                      transparent 16px
                    )`,
                    backgroundSize: '28px 28px',
                  }}
                />
              </div>

              {/* Bold Monospace Percentage Counter */}
              <div className="flex items-center justify-center">
                <span className="font-mono text-3xl sm:text-4xl font-black text-cyan-400 tracking-wider">
                  {displayProgress}%
                </span>
              </div>
            </div>

            {/* Current Stage Information Card */}
            <div className="w-full p-3.5 rounded-2xl border border-zinc-800 bg-zinc-900/60 flex flex-col items-center space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                <span className="text-xs font-black uppercase tracking-wider text-cyan-300">
                  {stageLabel}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 font-medium max-w-xs leading-relaxed">
                {stageDetail}
              </p>
            </div>
          </div>
        )}

        {/* ================= PHASE 2: ERROR & MID-STREAM CUTOFF RECOVERY ================= */}
        {phase === 'error_retry' && (
          <div className="w-full flex flex-col items-center space-y-4 py-3 animate-fadeIn">
            <div className="w-14 h-14 rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <WifiOff className="w-7 h-7" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-black uppercase text-white tracking-wide">
                Network Interrupted Mid-Sync
              </h3>
              <p className="text-xs text-zinc-400 font-medium max-w-xs">
                The connection dropped while communicating with the database. Your match is 100%
                safe on this device.
              </p>
            </div>

            <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-3">
              <button
                type="button"
                onClick={executeSubmission}
                className="py-3 px-4 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition active:scale-95 shadow-md shadow-cyan-500/20"
              >
                <RefreshCw className="w-4 h-4" />
                <span>TRY AGAIN</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onComplete(session, syncResult?.eloResult || null, 'queued');
                }}
                className="py-3 px-4 rounded-2xl bg-zinc-800 hover:bg-zinc-750 border border-zinc-700 text-zinc-200 font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition active:scale-95"
              >
                <span>SAVE OFFLINE & VIEW</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ================= PHASE 3: DRAWN CHECKMARK TICK SVG ANIMATION ================= */}
        {phase === 'tick' && (
          <div className="w-full flex flex-col items-center space-y-4 py-6 animate-fadeIn">
            <div className="relative flex items-center justify-center">
              <svg className="w-20 h-20 text-emerald-400" viewBox="0 0 52 52">
                <circle
                  className="opacity-20"
                  strokeWidth="4"
                  stroke="currentColor"
                  fill="none"
                  cx="26"
                  cy="26"
                  r="24"
                />
                <circle
                  className="animate-circleDraw"
                  strokeWidth="4"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  cx="26"
                  cy="26"
                  r="24"
                />
                <path
                  className="animate-checkStroke"
                  fill="none"
                  strokeWidth="4.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  stroke="currentColor"
                  d="M14 27l8 8 16-16"
                />
              </svg>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 block font-mono">
                {isOfflineDetected ? 'STORED LOCALLY' : 'VERIFIED IN FIRESTORE'}
              </span>
              <h3 className="text-xl font-black uppercase text-white tracking-tight">
                {isOfflineDetected ? 'SAVED TO OFFLINE QUEUE' : 'STANDINGS SYNCHRONIZED'}
              </h3>
              <p className="text-xs text-zinc-400 font-medium">
                {isOfflineDetected
                  ? 'Will automatically push to tournament table when connected.'
                  : 'Official ratings and tournament records updated.'}
              </p>
            </div>
          </div>
        )}

        {/* ================= PHASE 4: PREPARING RESULTS LUXURY SPINNER ================= */}
        {phase === 'spinner' && (
          <div className="w-full flex flex-col items-center space-y-5 py-6 animate-fadeIn">
            {/* Luxury Continuous 360° Circular SVG Spinner (Same as Account Restore) */}
            <div className="relative flex items-center justify-center">
              <svg
                className="w-16 h-16 text-indigo-500"
                viewBox="0 0 50 50"
                style={{ animation: 'spin 1s linear infinite' }}
              >
                <circle
                  cx="25"
                  cy="25"
                  r="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeDasharray="90 150"
                  className="opacity-90"
                />
              </svg>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 block font-mono">
                FINALIZING PRESENTATION
              </span>
              <h3 className="text-xl font-black uppercase text-white tracking-tight">
                PREPARING RESULTS...
              </h3>
              <p className="text-xs text-zinc-400 font-medium">
                Compiling final scoreboard and match metrics
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
