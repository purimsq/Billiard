import React from 'react';
import { getBallByNumber } from '@/lib/gameLogic';

interface PoolBallProps {
  number: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showPoints?: boolean;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}

export const PoolBall: React.FC<PoolBallProps> = ({
  number,
  size = 'md',
  showPoints = false,
  selected = false,
  onClick,
  className = '',
}) => {
  const ball = getBallByNumber(number);
  if (!ball) return null;

  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-11 h-11 text-sm',
    lg: 'w-14 h-14 text-base',
    xl: 'w-18 h-18 text-lg',
  }[size];

  const innerCircleSize = {
    sm: 'w-4 h-4 text-[9px]',
    md: 'w-5 h-5 text-[11px]',
    lg: 'w-7 h-7 text-xs font-bold',
    xl: 'w-9 h-9 text-sm font-bold',
  }[size];

  return (
    <div
      onClick={onClick}
      className={`relative inline-flex flex-col items-center cursor-pointer select-none transition-all duration-150 ${
        selected ? 'scale-110 ring-4 ring-indigo-500/50 rounded-full' : 'hover:scale-105 active:scale-95'
      } ${className}`}
    >
      <div
        className={`relative rounded-full flex items-center justify-center ball-shadow ${sizeClasses}`}
        style={{
          backgroundColor: ball.isStripe ? '#FFFFFF' : ball.bgHex,
          color: ball.textHex,
        }}
      >
        {/* Stripe graphic if stripe ball */}
        {ball.isStripe && (
          <div
            className="absolute inset-0 rounded-full overflow-hidden"
            style={{
              background: `linear-gradient(180deg, transparent 20%, ${ball.bgHex} 20%, ${ball.bgHex} 80%, transparent 80%)`,
            }}
          />
        )}

        {/* 3D Highlight Shine */}
        <div className="absolute top-1 left-2.5 w-1/3 h-1/3 rounded-full bg-white/40 blur-[1px] pointer-events-none" />

        {/* Inner number circle */}
        <div
          className={`relative z-10 rounded-full bg-white text-zinc-900 flex items-center justify-center font-extrabold shadow-sm ${innerCircleSize}`}
        >
          {ball.number}
        </div>
      </div>

      {showPoints && (
        <span className="mt-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-zinc-900 text-white shadow-sm">
          {ball.points} pts
        </span>
      )}
    </div>
  );
};
