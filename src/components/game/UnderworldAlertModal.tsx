import React, { useEffect, useState, useMemo } from 'react';
import {
  playUnderworldAlertSound,
  playTypewriterKeyClick,
  preloadUnderworldSounds,
} from '@/lib/underworldAudio';

export type UnderworldAlertType = 'first_death' | 'companion_death' | 'resurrection' | 're_death';

export interface UnderworldAlertData {
  id: string; // unique trigger id
  playerId: string;
  playerName: string;
  type: UnderworldAlertType;
  companionName?: string;
  score: number;
}

interface UnderworldAlertModalProps {
  alert: UnderworldAlertData | null;
  onSequenceComplete: (alert: UnderworldAlertData) => void;
  isDark?: boolean;
  soundEffectsEnabled?: boolean;
}

const SOLO_DEATH_QUOTES = [
  "{player} has reached the point of no return! Will they ever crawl out of the abyss?",
  "Rest In Points! {player} just fell past -50... Digging their own grave.",
  "{player} crossed into the underworld. Abandon all hope ye who scratch here.",
  "Flatline! {player} plunged below -50. Cue the funeral march.",
  "Welcome to the graveyard, {player}. Hope you brought a shovel.",
];

const COMPANION_DEATH_QUOTES = [
  "{player} has reached the point of no return! {companion} welcomes you to eternal damnation.",
  "Misery loves company! {player} joins {companion} beyond the -50 threshold.",
  "{player} fell into the graveyard! {companion} just pulled up a tombstone for you.",
  "The underworld expands! {companion} greets {player} at the gates of -50.",
  "Room for one more! {companion} slides over to make space for {player}.",
];

const RESURRECTION_QUOTES = [
  "I see you're trying to make your way back from the dead, {player}. Let's see if you can keep it up!",
  "A pulse detected! {player} crawled out of the underworld. Don't slip back in!",
  "{player} refused to stay buried! Welcome back to the living... for now.",
  "Resurrection! {player} broke free from the -50 curse. Keep fighting!",
  "Back from the grave! {player} just escaped the cemetery gates.",
];

const RE_DEATH_QUOTES = [
  "Welcome back to the dead, {player}! Did you really think you could escape?",
  "Back to the graveyard so soon, {player}? We kept your tombstone warm!",
  "Nice try clawing out, {player}! The underworld reclaims its own.",
  "That resurrection didn't last long, {player}. Welcome back below -50.",
  "The grave was lonely without you, {player}. Dragged right back down!",
];

function pickRandomQuote(quotes: string[], player: string, companion?: string): string {
  const template = quotes[Math.floor(Math.random() * quotes.length)];
  return template
    .replace(/{player}/g, player)
    .replace(/{companion}/g, companion || 'your companion');
}

export const UnderworldAlertModal: React.FC<UnderworldAlertModalProps> = ({
  alert,
  onSequenceComplete,
  isDark = false,
  soundEffectsEnabled = false,
}) => {
  // Compute quote via useMemo to avoid cascading renders
  const quote = useMemo(() => {
    if (!alert) return '';
    switch (alert.type) {
      case 'first_death':
        return pickRandomQuote(SOLO_DEATH_QUOTES, alert.playerName);
      case 'companion_death':
        return pickRandomQuote(COMPANION_DEATH_QUOTES, alert.playerName, alert.companionName);
      case 'resurrection':
        return pickRandomQuote(RESURRECTION_QUOTES, alert.playerName);
      case 're_death':
        return pickRandomQuote(RE_DEATH_QUOTES, alert.playerName);
      default:
        return '';
    }
  }, [alert]);

  const [stage, setStage] = useState<'backdrop' | 'content_in' | 'typing' | 'fade_out' | 'done'>(
    alert ? 'backdrop' : 'done'
  );
  const [charCount, setCharCount] = useState<number>(0);

  // Preload underworld sound effects on mount only if sound is enabled
  useEffect(() => {
    if (soundEffectsEnabled) {
      preloadUnderworldSounds();
    }
  }, [soundEffectsEnabled]);

  useEffect(() => {
    if (!alert) return;

    // Play corresponding underworld audio stinger as content reveals (if sound enabled)
    if (soundEffectsEnabled) {
      playUnderworldAlertSound(alert.type);
    }

    // Step 1: Light background fades in, then content appears
    const contentTimer = setTimeout(() => {
      setStage('content_in');
    }, 400);

    // Step 2: Content settled, begin deliberate typewriter effect from character 0
    const typingStartTimer = setTimeout(() => {
      setStage('typing');
    }, 1100);

    return () => {
      clearTimeout(contentTimer);
      clearTimeout(typingStartTimer);
    };
  }, [alert, soundEffectsEnabled]);

  // Step 3: Deliberate typewriter effect (~64ms per character) with typewriter sound click
  useEffect(() => {
    if (stage !== 'typing' || !quote) return;

    if (charCount < quote.length) {
      const nextChar = quote[charCount];
      if (soundEffectsEnabled && nextChar && nextChar.trim() !== '') {
        playTypewriterKeyClick();
      }

      const typeTimer = setTimeout(() => {
        setCharCount((prev) => prev + 1);
      }, 64); // Slower, dramatic typing cadence
      return () => clearTimeout(typeTimer);
    } else {
      // Typing finished -> Hold for reading pause, then fade out
      const pauseTimer = setTimeout(() => {
        setStage('fade_out');
      }, 2500); // 2.5s pause to read
      return () => clearTimeout(pauseTimer);
    }
  }, [stage, charCount, quote, soundEffectsEnabled]);

  // Step 4: Fade out and signal sequence complete
  useEffect(() => {
    if (stage !== 'fade_out' || !alert) return;

    const finishTimer = setTimeout(() => {
      setStage('done');
      onSequenceComplete(alert);
    }, 700);

    return () => clearTimeout(finishTimer);
  }, [stage, alert, onSequenceComplete]);

  if (!alert || stage === 'done') return null;

  const isResurrection = alert.type === 'resurrection';
  const isBackdropActive = stage !== 'fade_out';
  const isContentVisible = stage === 'content_in' || stage === 'typing';
  const displayedText = quote.slice(0, charCount);
  const isStillTyping = stage === 'typing' && charCount < quote.length;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-700 select-none pointer-events-auto ${
        isBackdropActive ? 'opacity-100' : 'opacity-0'
      }`}
      style={{
        backgroundColor: isBackdropActive
          ? isDark
            ? 'rgba(14, 14, 18, 0.92)'
            : 'rgba(244, 242, 236, 0.90)'
          : isDark
          ? 'rgba(14, 14, 18, 0)'
          : 'rgba(244, 242, 236, 0)',
        backdropFilter: isBackdropActive ? 'blur(6px)' : 'none',
        WebkitBackdropFilter: isBackdropActive ? 'blur(6px)' : 'none',
        touchAction: 'none',
      }}
    >
      {/* CASE A: RESURRECTION - Professional Minimalist Floating Typography (NO cards, NO badges) */}
      {isResurrection ? (
        <div
          className={`max-w-lg w-full px-6 flex flex-col items-center justify-center text-center transition-all duration-700 ease-out transform ${
            isContentVisible
              ? 'opacity-100 translate-y-0 scale-100'
              : 'opacity-0 translate-y-8 scale-95'
          }`}
        >
          <p
            className={`text-[11px] font-black uppercase tracking-[0.35em] mb-2 ${
              isDark ? 'text-emerald-400' : 'text-emerald-800/80'
            }`}
          >
            RESURRECTION
          </p>

          <h3
            className={`text-3xl sm:text-4xl font-black uppercase font-serif tracking-tight mb-4 ${
              isDark ? 'text-zinc-100' : 'text-zinc-900'
            }`}
          >
            {alert.playerName}
          </h3>

          <p
            className={`font-serif text-lg sm:text-xl md:text-2xl font-bold italic leading-relaxed max-w-md ${
              isDark ? 'text-zinc-200' : 'text-zinc-800'
            }`}
          >
            “{displayedText}”
            {isStillTyping && (
              <span
                className={`inline-block w-2 h-5 ml-1 animate-pulse align-middle ${
                  isDark ? 'bg-zinc-200' : 'bg-zinc-800'
                }`}
              />
            )}
          </p>

          <p
            className={`text-[10px] font-mono tracking-widest font-extrabold uppercase mt-5 ${
              isDark ? 'text-zinc-500' : 'text-zinc-400'
            }`}
          >
            {alert.score} PTS
          </p>
        </div>
      ) : (
        /* CASE B: DEATH & RE-DEATH - Authentic Proportioned Compact Light Granite Tombstone */
        <div
          className={`relative flex flex-col items-center max-w-sm w-full transition-all duration-700 ease-out transform ${
            isContentVisible
              ? 'opacity-100 translate-y-0 scale-100'
              : 'opacity-0 translate-y-10 scale-95'
          }`}
        >
          {/* Ambient Ground Shadow */}
          <div className="absolute -bottom-5 w-64 h-12 bg-radial from-zinc-400/25 to-transparent blur-lg pointer-events-none" />

          {/* Compact Tombstone with Natural Classical Proportions (Never squished) */}
          <div className="relative w-[255px] sm:w-[285px] flex flex-col items-center">
            <svg
              viewBox="0 0 280 360"
              className="w-full h-auto drop-shadow-[0_16px_30px_rgba(0,0,0,0.14)] filter"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                {/* Light Limestone / Granite Gradient */}
                <linearGradient id="compactGraniteBody" x1="0" y1="0" x2="280" y2="360" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#F9FAFB" />
                  <stop offset="25%" stopColor="#E5E7EB" />
                  <stop offset="65%" stopColor="#D1D5DB" />
                  <stop offset="100%" stopColor="#9CA3AF" />
                </linearGradient>

                {/* Stone Bevel Highlight */}
                <linearGradient id="compactGraniteBevel" x1="0" y1="0" x2="280" y2="0" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#FFFFFF" />
                  <stop offset="50%" stopColor="#E5E7EB" />
                  <stop offset="100%" stopColor="#9CA3AF" />
                </linearGradient>

                {/* Base Plinth Gradient */}
                <linearGradient id="compactGraniteBase" x1="0" y1="0" x2="0" y2="30" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#D1D5DB" />
                  <stop offset="100%" stopColor="#6B7280" />
                </linearGradient>
              </defs>

              {/* Stepped Pedestal Base */}
              <rect x="10" y="336" width="260" height="18" rx="3" fill="url(#compactGraniteBase)" stroke="#6B7280" strokeWidth="1.2" />
              <rect x="25" y="324" width="230" height="13" rx="2" fill="#9CA3AF" stroke="#6B7280" strokeWidth="1" />

              {/* Main Natural Arched Slab */}
              <path
                d="M 32 326 V 96 C 32 34, 248 34, 248 96 V 326 Z"
                fill="url(#compactGraniteBody)"
                stroke="url(#compactGraniteBevel)"
                strokeWidth="3"
              />

              {/* Inset Chiseled Inner Groove */}
              <path
                d="M 42 316 V 98 C 42 46, 238 46, 238 98 V 316 Z"
                fill="none"
                stroke="#6B7280"
                strokeWidth="1.2"
                opacity="0.65"
              />

              {/* Weathered Stone Fissures */}
              <path
                d="M 140 40 L 134 56 L 142 70 L 130 88"
                stroke="#4B5563"
                strokeWidth="1.4"
                strokeLinecap="round"
                opacity="0.75"
              />
              <path
                d="M 215 72 L 202 90 L 208 104"
                stroke="#4B5563"
                strokeWidth="1.1"
                strokeLinecap="round"
                opacity="0.6"
              />
              <path
                d="M 46 220 L 58 232 L 52 248"
                stroke="#4B5563"
                strokeWidth="1.1"
                strokeLinecap="round"
                opacity="0.55"
              />

              {/* Gothic Cross Carving at Crown */}
              <g opacity="0.85">
                <path d="M 140 54 V 80 M 128 64 H 152" stroke="#374151" strokeWidth="2.8" strokeLinecap="round" />
                <path d="M 140 55 V 79 M 129 64 H 151" stroke="#FFFFFF" strokeWidth="1" strokeLinecap="round" />
              </g>

              {/* Creeping Dead Vines up base sides */}
              <g stroke="#374151" strokeWidth="1.4" fill="none" opacity="0.7">
                {/* Left vine */}
                <path d="M 20 345 Q 34 300 32 260 Q 28 220 36 190" />
                <path d="M 32 270 Q 26 262 24 265" />
                <path d="M 34 230 Q 42 222 45 225" />
                <circle cx="24" cy="265" r="1.5" fill="#374151" />
                <circle cx="45" cy="225" r="1.5" fill="#374151" />

                {/* Right vine */}
                <path d="M 260 345 Q 246 300 248 260 Q 252 220 244 190" />
                <path d="M 248 270 Q 254 262 256 265" />
                <path d="M 246 230 Q 238 222 235 225" />
                <circle cx="256" cy="265" r="1.5" fill="#374151" />
                <circle cx="235" cy="225" r="1.5" fill="#374151" />
              </g>

              {/* R. I. P. Inset Chiseled Engraving */}
              <text
                x="140"
                y="108"
                textAnchor="middle"
                fontFamily="Georgia, serif"
                fontWeight="900"
                fontSize="15"
                letterSpacing="6"
                fill="#374151"
              >
                R. I. P.
              </text>
              <text
                x="140"
                y="107"
                textAnchor="middle"
                fontFamily="Georgia, serif"
                fontWeight="900"
                fontSize="15"
                letterSpacing="6"
                fill="#FFFFFF"
                opacity="0.75"
              >
                R. I. P.
              </text>

              {/* Engraved Player Name */}
              <text
                x="140"
                y="136"
                textAnchor="middle"
                fontFamily="Georgia, serif"
                fontWeight="900"
                fontSize="16"
                letterSpacing="2"
                fill="#1F2937"
              >
                {alert.playerName.toUpperCase()}
              </text>
              <text
                x="140"
                y="135"
                textAnchor="middle"
                fontFamily="Georgia, serif"
                fontWeight="900"
                fontSize="16"
                letterSpacing="2"
                fill="#FFFFFF"
                opacity="0.8"
              >
                {alert.playerName.toUpperCase()}
              </text>

              {/* Chiseled Divider */}
              <line x1="75" y1="148" x2="205" y2="148" stroke="#4B5563" strokeWidth="1.2" />
              <line x1="75" y1="149" x2="205" y2="149" stroke="#FFFFFF" strokeWidth="0.8" opacity="0.8" />

              {/* Sub-label */}
              <text
                x="140"
                y="164"
                textAnchor="middle"
                fontFamily="sans-serif"
                fontWeight="800"
                fontSize="8.5"
                letterSpacing="2"
                fill="#B91C1C"
              >
                {alert.type === 're_death' ? '— RECLAIMED BY THE DEAD —' : '— POINT OF NO RETURN —'}
              </text>
            </svg>

            {/* Typewriter Text Inside Well-Proportioned Slab Area */}
            <div className="absolute top-[172px] left-[35px] right-[35px] bottom-[38px] flex flex-col items-center justify-start text-center px-1 overflow-hidden pointer-events-none">
              <p className="font-serif text-[12px] sm:text-[13px] leading-snug font-bold text-zinc-800 italic">
                “{displayedText}”
                {isStillTyping && (
                  <span className="inline-block w-1.5 h-3.5 ml-0.5 bg-zinc-700 animate-pulse align-middle" />
                )}
              </p>

              <div className="mt-auto pb-1">
                <span className="text-[9.5px] font-mono tracking-widest font-black text-rose-700 uppercase">
                  {alert.score} PTS
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
