import React from 'react';
import { PoolBall } from '../ui/PoolBall';

export const RulesCard: React.FC = () => {
  return (
    <div id="rules-section" className="w-full max-w-2xl mx-auto px-4 pb-12 space-y-6 pt-2">
      <div className="felt-card p-5 sm:p-6 space-y-5 border border-zinc-200/80">
        {/* Section Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
          <div>
            <h3 className="font-black text-zinc-900 text-base sm:text-lg tracking-tight">
              GAME RULES & SCORING
            </h3>
            <p className="text-xs text-zinc-500 font-medium">Billiards Point Values & Foul Rules</p>
          </div>
          <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-700 uppercase tracking-wider">
            Rules Guide
          </span>
        </div>

        {/* Ball Point Breakdown Cards */}
        <div className="space-y-3">
          <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-400">
            Ball Point Allocation
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Special Late Rotation Balls (1 & 2) */}
            <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200/70 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-900">Late Rotation</span>
                <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-amber-200/80 text-amber-900">
                  HIGH VAL
                </span>
              </div>
              <div className="flex items-center gap-2">
                <PoolBall number={1} size="sm" showPoints />
                <PoolBall number={2} size="sm" showPoints />
              </div>
              <p className="text-[11px] text-amber-900 leading-tight">
                <strong>Ball 1</strong> = 16 pts<br />
                <strong>Ball 2</strong> = 17 pts
              </p>
            </div>

            {/* Balls 3 to 6 */}
            <div className="p-3.5 rounded-2xl bg-indigo-50/60 border border-indigo-200/70 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-900">Balls 3 – 6</span>
                <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-indigo-200/80 text-indigo-900">
                  6 PTS
                </span>
              </div>
              <div className="flex items-center gap-1 overflow-x-auto py-0.5">
                <PoolBall number={3} size="sm" />
                <PoolBall number={4} size="sm" />
                <PoolBall number={5} size="sm" />
                <PoolBall number={6} size="sm" />
              </div>
              <p className="text-[11px] text-indigo-900 leading-tight">
                Balls 3 to 6 award <strong>6 points</strong> each.
              </p>
            </div>

            {/* Balls 7 to 15 */}
            <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-200/70 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-900">Balls 7 – 15</span>
                <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-200/80 text-emerald-900">
                  FACE VAL
                </span>
              </div>
              <div className="flex items-center gap-1 overflow-x-auto py-0.5">
                <PoolBall number={7} size="sm" />
                <PoolBall number={8} size="sm" />
                <PoolBall number={15} size="sm" />
              </div>
              <p className="text-[11px] text-emerald-900 leading-tight">
                Face value: <strong>7 pts</strong> up to <strong>15 pts</strong>.
              </p>
            </div>
          </div>
        </div>

        {/* Fouls & Architecture Notes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {/* Fouls Card */}
          <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-1">
            <h5 className="font-extrabold text-xs text-zinc-900 uppercase tracking-wide">
              Fouls & Deductions
            </h5>
            <p className="text-xs text-zinc-600 leading-normal">
              Hitting wrong ball or scratching deducts ball value. Players can enter negative scores (e.g. <strong>-30 pts</strong>).
            </p>
          </div>

          {/* Quick Flow Card */}
          <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-1">
            <h5 className="font-extrabold text-xs text-zinc-900 uppercase tracking-wide">
              Direct Tallying
            </h5>
            <p className="text-xs text-zinc-600 leading-normal">
              No turn waiting! Pick any player card, select point value or ball, and confirm score instantly.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
