/**
 * Underworld Dialogue Sound Effects Engine
 * Manages playback of sound effects for the Underworld Dialogue setting,
 * including preloading, audio pooling, volume balancing, and Web Audio API fallback.
 */

import { UnderworldAlertType } from '@/components/game/UnderworldAlertModal';

export type UnderworldSoundEffect = 
  | UnderworldAlertType 
  | 'typewriter' 
  | 'tombstone_slam' 
  | 'card_break' 
  | 'card_repair';

const SOUND_PATHS: Record<UnderworldSoundEffect, string> = {
  first_death: '/sounds/underworld/first_death.wav',
  companion_death: '/sounds/underworld/companion_death.wav',
  resurrection: '/sounds/underworld/resurrection.wav',
  re_death: '/sounds/underworld/re_death.wav',
  typewriter: '/sounds/underworld/typewriter_click.wav',
  tombstone_slam: '/sounds/underworld/tombstone_slam.wav',
  card_break: '/sounds/underworld/glass-ball-broken.mp3',
  card_repair: '/sounds/underworld/card_repair.wav',
};

// Cached Audio instances for instant playback without network delays
const audioCache: Map<string, HTMLAudioElement> = new Map();

// Small pool for typewriter clicks to allow rapid sequential tapping
const typewriterPool: HTMLAudioElement[] = [];
const TYPEWRITER_POOL_SIZE = 4;
let typewriterPoolIndex = 0;

function getAudio(path: string, volume = 0.75): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null;

  try {
    let audio = audioCache.get(path);
    if (!audio) {
      audio = new Audio(path);
      audio.preload = 'auto';
      audioCache.set(path, audio);
    }
    audio.volume = volume;
    return audio;
  } catch {
    return null;
  }
}

/**
 * Preload sound assets into browser memory
 */
export function preloadUnderworldSounds(): void {
  if (typeof window === 'undefined') return;

  try {
    Object.values(SOUND_PATHS).forEach((path) => {
      getAudio(path);
    });

    // Initialize typewriter pool
    for (let i = 0; i < TYPEWRITER_POOL_SIZE; i++) {
      const audio = new Audio(SOUND_PATHS.typewriter);
      audio.volume = 0.35;
      audio.preload = 'auto';
      typewriterPool.push(audio);
    }
  } catch {
    // Ignore autoplay or preload restrictions
  }
}

/**
 * Synthesized Web Audio API fallback in case audio files fail to load
 */
function playSynthesizedFallback(type: UnderworldAlertType): void {
  if (typeof window === 'undefined') return;
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return;

  try {
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'first_death') {
      // Low ominous bell
      osc.type = 'sine';
      osc.frequency.setValueAtTime(110, now);
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 2.0);
      osc.start(now);
      osc.stop(now + 2.0);
    } else if (type === 'resurrection') {
      // High bright chime
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.exponentialRampToValueAtTime(1046.5, now + 0.6);
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
      osc.start(now);
      osc.stop(now + 1.5);
    } else if (type === 'companion_death') {
      // Tritone dissonance
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(146.8, now);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);
      osc.start(now);
      osc.stop(now + 1.8);
    } else {
      // Re-death downward drop
      osc.type = 'sine';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(45, now + 0.8);
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.6);
      osc.start(now);
      osc.stop(now + 1.6);
    }
  } catch {
    // Ignore audio context issues
  }
}

/**
 * Plays the corresponding cutscene audio stinger for an underworld event
 */
export function playUnderworldAlertSound(type: UnderworldAlertType, volume = 0.8): void {
  if (typeof window === 'undefined') return;

  const path = SOUND_PATHS[type];
  const audio = getAudio(path, volume);

  if (audio) {
    audio.currentTime = 0;
    audio.play().catch(() => {
      // Fall back to Web Audio synthesis if autoplay policy blocks file audio
      playSynthesizedFallback(type);
    });
  } else {
    playSynthesizedFallback(type);
  }
}

/**
 * Plays a typewriter key click sound for character typing
 */
export function playTypewriterKeyClick(): void {
  if (typeof window === 'undefined') return;

  try {
    if (typewriterPool.length > 0) {
      const audio = typewriterPool[typewriterPoolIndex];
      typewriterPoolIndex = (typewriterPoolIndex + 1) % typewriterPool.length;
      audio.currentTime = 0;
      audio.play().catch(() => {});
    } else {
      const audio = new Audio(SOUND_PATHS.typewriter);
      audio.volume = 0.35;
      audio.play().catch(() => {});
    }
  } catch {
    // Ignore
  }
}

/**
 * Plays the heavy tombstone slam sound effect
 */
export function playTombstoneSlam(volume = 0.85): void {
  if (typeof window === 'undefined') return;

  const audio = getAudio(SOUND_PATHS.tombstone_slam, volume);
  if (audio) {
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }
}

/**
 * Synthesizes a fracture / crack sound via Web Audio API if glass-ball-broken.mp3 cannot load
 */
function playSynthesizedCardBreak(): void {
  if (typeof window === 'undefined') return;
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return;

  try {
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.18);

    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.35);
  } catch {
    // Ignore audio context issues
  }
}

/**
 * Synthesizes a soft dreaming harp arpeggio via Web Audio API if card_repair.wav cannot load
 */
function playSynthesizedCardRepair(): void {
  if (typeof window === 'undefined') return;
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return;

  try {
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    // Soft dreaming harp plucks (Db4, F4, Ab4, C5, Eb5)
    const harpNotes = [
      { delay: 0.04, freq: 277.18, gain: 0.18 },
      { delay: 0.22, freq: 349.23, gain: 0.17 },
      { delay: 0.40, freq: 415.30, gain: 0.15 },
      { delay: 0.60, freq: 523.25, gain: 0.14 },
      { delay: 0.82, freq: 622.25, gain: 0.12 },
    ];

    harpNotes.forEach((note) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(note.freq, now + note.delay);

      const noteStart = now + note.delay;
      gain.gain.setValueAtTime(0.0001, noteStart);
      gain.gain.linearRampToValueAtTime(note.gain, noteStart + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 1.6);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(noteStart);
      osc.stop(noteStart + 1.6);
    });
  } catch {
    // Ignore audio context issues
  }
}

/**
 * Plays the sharp fracture sound when a card breaks under death pressure
 */
export function playCardBreakSound(volume = 0.85): void {
  if (typeof window === 'undefined') return;

  const audio = getAudio(SOUND_PATHS.card_break, volume);
  if (audio) {
    audio.currentTime = 0;
    audio.play().catch(() => {
      playSynthesizedCardBreak();
    });
  } else {
    playSynthesizedCardBreak();
  }
}

/**
 * Plays the crystalline healing sound when a card repairs itself upon resurrection
 */
export function playCardRepairSound(volume = 0.85): void {
  if (typeof window === 'undefined') return;

  const audio = getAudio(SOUND_PATHS.card_repair, volume);
  if (audio) {
    audio.currentTime = 0;
    audio.play().catch(() => {
      playSynthesizedCardRepair();
    });
  } else {
    playSynthesizedCardRepair();
  }
}

