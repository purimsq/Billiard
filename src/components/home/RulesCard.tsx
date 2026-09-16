import React from 'react';
import { PoolBall } from '../ui/PoolBall';

interface RulesCardProps {
  isDark?: boolean;
}

export const RulesCard: React.FC<RulesCardProps> = ({ isDark = false }) => {
  return (
    <div id="rules-section" className="w-full max-w-2xl mx-auto px-4 pb-12 space-y-6 pt-2">
      <div
        className={`p-5 sm:p-6 space-y-5 border rounded-3xl ${
          isDark
            ? 'bg-zinc-900 border-zinc-800 shadow-sm text-zinc-100'
            : 'felt-card border-zinc-200/80 bg-white'
        }`}
      >
        {/* Section Header */}
        <div
          className={`flex items-center justify-between pb-3 border-b ${
            isDark ? 'border-zinc-800' : 'border-zinc-100'
          }`}
        >
          <div>
            <h3
              className={`font-black text-base sm:text-lg tracking-tight ${
                isDark ? 'text-zinc-100' : 'text-zinc-900'
              }`}
            >
              GAME RULES & SCORING
            </h3>
            <p className={`text-xs font-medium ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
              Billiards Point Values & Foul Rules
            </p>
          </div>
          <span
            className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider ${
              isDark
                ? 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                : 'bg-zinc-100 text-zinc-700'
            }`}
          >
            Rules Guide
          </span>
        </div>

        {/* Ball Point Breakdown Cards */}
        <div className="space-y-3">
          <h4
            className={`text-[11px] font-extrabold uppercase tracking-wider ${
              isDark ? 'text-zinc-400' : 'text-zinc-400'
            }`}
          >
            Ball Point Allocation
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Special Late Rotation Balls (1 & 2) */}
            <div
              className={`p-3.5 rounded-2xl border space-y-2 ${
                isDark
                  ? 'bg-amber-950/20 border-amber-800/40'
                  : 'bg-amber-50/60 border-amber-200/70'
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-xs font-bold ${
                    isDark ? 'text-amber-200' : 'text-amber-900'
                  }`}
                >
                  Late Rotation
                </span>
                <span
                  className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
                    isDark
                      ? 'bg-amber-900/60 text-amber-200 border border-amber-700/50'
                      : 'bg-amber-200/80 text-amber-900'
                  }`}
                >
                  HIGH VAL
                </span>
              </div>
              <div className="flex items-center gap-2">
                <PoolBall number={1} size="sm" showPoints isDark={isDark} />
                <PoolBall number={2} size="sm" showPoints isDark={isDark} />
              </div>
              <p
                className={`text-[11px] leading-tight ${
                  isDark ? 'text-amber-300' : 'text-amber-900'
                }`}
              >
                <strong>Ball 1</strong> = 16 pts<br />
                <strong>Ball 2</strong> = 17 pts
              </p>
            </div>

            {/* Balls 3 to 6 */}
            <div
              className={`p-3.5 rounded-2xl border space-y-2 ${
                isDark
                  ? 'bg-indigo-950/20 border-indigo-800/40'
                  : 'bg-indigo-50/60 border-indigo-200/70'
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-xs font-bold ${
                    isDark ? 'text-indigo-200' : 'text-indigo-900'
                  }`}
                >
                  Balls 3 – 6
                </span>
                <span
                  className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
                    isDark
                      ? 'bg-indigo-900/60 text-indigo-200 border border-indigo-700/50'
                      : 'bg-indigo-200/80 text-indigo-900'
                  }`}
                >
                  6 PTS
                </span>
              </div>
              <div className="flex items-center gap-1 overflow-x-auto py-0.5">
                <PoolBall number={3} size="sm" isDark={isDark} />
                <PoolBall number={4} size="sm" isDark={isDark} />
                <PoolBall number={5} size="sm" isDark={isDark} />
                <PoolBall number={6} size="sm" isDark={isDark} />
              </div>
              <p
                className={`text-[11px] leading-tight ${
                  isDark ? 'text-indigo-300' : 'text-indigo-900'
                }`}
              >
                Balls 3 to 6 award <strong>6 points</strong> each.
              </p>
            </div>

            {/* Balls 7 to 15 */}
            <div
              className={`p-3.5 rounded-2xl border space-y-2 ${
                isDark
                  ? 'bg-emerald-950/20 border-emerald-800/40'
                  : 'bg-emerald-50/60 border-emerald-200/70'
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-xs font-bold ${
                    isDark ? 'text-emerald-200' : 'text-emerald-900'
                  }`}
                >
                  Balls 7 – 15
                </span>
                <span
                  className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
                    isDark
                      ? 'bg-emerald-900/60 text-emerald-200 border border-emerald-700/50'
                      : 'bg-emerald-200/80 text-emerald-900'
                  }`}
                >
                  FACE VAL
                </span>
              </div>
              <div className="flex items-center gap-1 overflow-x-auto py-0.5">
                <PoolBall number={7} size="sm" isDark={isDark} />
                <PoolBall number={8} size="sm" isDark={isDark} />
                <PoolBall number={15} size="sm" isDark={isDark} />
              </div>
              <p
                className={`text-[11px] leading-tight ${
                  isDark ? 'text-emerald-300' : 'text-emerald-900'
                }`}
              >
                Face value: <strong>7 pts</strong> up to <strong>15 pts</strong>.
              </p>
            </div>
          </div>
        </div>

        {/* Fouls & Architecture Notes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {/* Fouls Card */}
          <div
            className={`p-3.5 rounded-2xl border space-y-1 ${
              isDark
                ? 'bg-zinc-800/40 border-zinc-800'
                : 'bg-zinc-50 border-zinc-200'
            }`}
          >
            <h5
              className={`font-extrabold text-xs uppercase tracking-wide ${
                isDark ? 'text-zinc-200' : 'text-zinc-900'
              }`}
            >
              Fouls & Deductions
            </h5>
            <p className={`text-xs leading-normal ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
              Hitting wrong ball or scratching deducts ball value. Players can enter negative scores (e.g. <strong>-30 pts</strong>).
            </p>
          </div>

          {/* Quick Flow Card */}
          <div
            className={`p-3.5 rounded-2xl border space-y-1 ${
              isDark
                ? 'bg-zinc-800/40 border-zinc-800'
                : 'bg-zinc-50 border-zinc-200'
            }`}
          >
            <h5
              className={`font-extrabold text-xs uppercase tracking-wide ${
                isDark ? 'text-zinc-200' : 'text-zinc-900'
              }`}
            >
              Direct Tallying
            </h5>
            <p className={`text-xs leading-normal ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
              No turn waiting! Pick any player card, select point value or ball, and confirm score instantly.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
