'use client';

import React, { useEffect, useState } from 'react';

/* ─────────────────────────────────────────────
   Pool ball colours (solids 1–8)
───────────────────────────────────────────── */
const BALL_COLORS = [
  { main: '#F5C842', num: 1 }, // yellow
  { main: '#2563EB', num: 2 }, // blue
  { main: '#DC2626', num: 3 }, // red
  { main: '#7C3AED', num: 4 }, // purple
  { main: '#EA580C', num: 5 }, // orange
  { main: '#16A34A', num: 6 }, // green
  { main: '#92400E', num: 7 }, // maroon
  { main: '#18181B', num: 8 }, // black (8-ball)
];

/* ─────────────────────────────────────────────
   Single pool ball SVG
───────────────────────────────────────────── */
const PoolBallSVG: React.FC<{ color: string; num: number; size?: number }> = ({
  color,
  num,
  size = 40,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 40 40"
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: 'block', flexShrink: 0 }}
  >
    {/* Drop shadow */}
    <ellipse cx="20" cy="37" rx="11" ry="2.5" fill="rgba(0,0,0,0.13)" />
    {/* Ball body */}
    <circle cx="20" cy="19" r="17" fill={color} />
    {/* Gloss */}
    <ellipse cx="14" cy="12" rx="5.5" ry="3.8" fill="rgba(255,255,255,0.36)" />
    {/* Number badge */}
    <circle cx="20" cy="19" r="7.5" fill="white" opacity="0.92" />
    {/* Number */}
    <text
      x="20"
      y="23"
      textAnchor="middle"
      fontFamily="system-ui, sans-serif"
      fontWeight="900"
      fontSize={num >= 10 ? '7' : '8.5'}
      fill={color}
    >
      {num}
    </text>
  </svg>
);

/* ─────────────────────────────────────────────
   Wave-bounce pool ball loader
   3 random balls; smooth sine-wave rise+fall,
   long rest at the bottom between bounces.
───────────────────────────────────────────── */
const PoolBallLoader: React.FC<{ label: string }> = ({ label }) => {
  const [balls] = useState(() => {
    const shuffled = [...BALL_COLORS].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 3);
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '14px', height: '78px' }}>
        {balls.map((ball, i) => (
          <div
            key={ball.num}
            style={{
              animation: 'poolWave 2.2s ease-in-out infinite',
              animationDelay: `${i * 0.28}s`,
              transformOrigin: 'bottom center',
            }}
          >
            <PoolBallSVG color={ball.main} num={ball.num} size={42} />
          </div>
        ))}
      </div>
      <LoaderText label={label} />
    </div>
  );
};

/* ─────────────────────────────────────────────
   Arc spinner — matches reference image:
   thin indigo arc, elegant "C" shape rotation
───────────────────────────────────────────── */
const ArcSpinner: React.FC<{ label: string }> = ({ label }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '22px' }}>
    <div
      style={{
        width: 44,
        height: 44,
        border: '3px solid transparent',
        borderTopColor: '#4338CA',
        borderRightColor: 'rgba(67,56,202,0.18)',
        borderBottomColor: 'transparent',
        borderLeftColor: 'rgba(67,56,202,0.08)',
        borderRadius: '50%',
        animation: 'arcSpin 1.1s cubic-bezier(0.4, 0, 0.2, 1) infinite',
      }}
    />
    <LoaderText label={label} />
  </div>
);

/* Shared label text block */
const LoaderText: React.FC<{ label: string }> = ({ label }) => (
  <p
    style={{
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontWeight: 700,
      fontSize: '0.7rem',
      letterSpacing: '0.18em',
      textTransform: 'uppercase',
      color: '#52525b',
      margin: 0,
      textAlign: 'center',
    }}
  >
    {label}
  </p>
);

/* ─────────────────────────────────────────────
   Variant config
───────────────────────────────────────────── */
export type LoadingVariant = 'quick' | 'game' | 'results' | 'again';

interface LoadingScreenProps {
  variant: LoadingVariant;
  visible: boolean;
}

const VARIANT_CONFIG: Record<
  LoadingVariant,
  { label: string; useBalls: boolean }
> = {
  quick:   { label: 'Setting things up…',     useBalls: false },
  game:    { label: 'Preparing game…',         useBalls: true  },
  results: { label: 'Preparing results…',      useBalls: false },
  again:   { label: 'Racking up…',             useBalls: true  },
};

/* ─────────────────────────────────────────────
   Exported LoadingScreen
───────────────────────────────────────────── */
export const LoadingScreen: React.FC<LoadingScreenProps> = ({ variant, visible }) => {
  const [show, setShow] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    if (visible) {
      t = setTimeout(() => {
        setFadeOut(false);
        setShow(true);
      }, 0);
    } else {
      t = setTimeout(() => setFadeOut(true), 0);
      const hide = setTimeout(() => setShow(false), 400);
      return () => {
        clearTimeout(t);
        clearTimeout(hide);
      };
    }
    return () => clearTimeout(t);
  }, [visible]);

  if (!show) return null;

  const cfg = VARIANT_CONFIG[variant];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        /* Subtle light tint — app content visible but softened */
        backgroundColor: 'rgba(244, 242, 236, 0.82)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: fadeOut ? 0 : 1,
        transition: 'opacity 0.4s ease',
        pointerEvents: visible ? 'all' : 'none',
      }}
    >
      {cfg.useBalls
        ? <PoolBallLoader label={cfg.label} />
        : <ArcSpinner label={cfg.label} />
      }

      {/* Injected keyframes */}
      <style>{`
        /* Smooth wave: gentle sine-like rise, smooth peak, soft landing, long rest */
        @keyframes poolWave {
          0%   { transform: translateY(0px)   scaleY(1);    }
          8%   { transform: translateY(-6px)  scaleY(1.02); }
          22%  { transform: translateY(-30px) scaleY(1.05); }
          36%  { transform: translateY(-6px)  scaleY(1.02); }
          44%  { transform: translateY(2px)   scaleY(0.88); }
          50%  { transform: translateY(0px)   scaleY(1);    }
          100% { transform: translateY(0px)   scaleY(1);    }
        }

        /* Arc spinner — smooth ease */
        @keyframes arcSpin {
          0%   { transform: rotate(0deg);   }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
