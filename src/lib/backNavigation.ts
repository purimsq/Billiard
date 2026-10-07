'use client';

import { useEffect, useRef } from 'react';

/**
 * Smart Back Navigation Coordinator for Mobile Hardware/Gesture Back and PWA History
 *
 * Coordinates Android hardware back button, edge-swipe back gestures, and browser history
 * so that modal dialogs, drawers, and nested screens step backward hierarchically,
 * while allowing the app to close/minimize naturally only when on the root Home screen.
 */

export interface BackLayer {
  id: string;
  onBack: () => void;
  timestamp: number;
}

const backStack: BackLayer[] = [];
let programmaticPopsPending = 0;
let isInitialized = false;

/**
 * Initializes the global popstate event listener for the app.
 * Safe to call multiple times or during SSR (no-op).
 */
export function initBackNavigation(): void {
  if (typeof window === 'undefined' || isInitialized) return;
  isInitialized = true;

  window.addEventListener('popstate', () => {
    // If this pop was triggered by our own code removing an already-closed layer from history:
    if (programmaticPopsPending > 0) {
      programmaticPopsPending--;
      return;
    }

    // Hardware back or edge-swipe back triggered by user
    if (backStack.length > 0) {
      const top = backStack.pop()!;
      try {
        top.onBack();
      } catch (err) {
        console.error(`[BackNavigation] Error in back handler "${top.id}":`, err);
      }
    }
  });
}

/**
 * Registers an active layer onto the back stack and pushes a history state.
 * Returns an unregister function to remove the layer.
 */
export function registerBackHandler(id: string, onBack: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  initBackNavigation();

  // Push synthetic history state so Android back / gesture produces a popstate event
  try {
    window.history.pushState({ billiardLayer: id, timestamp: Date.now() }, '');
  } catch {
    // Ignore history errors if storage/history quota is restricted
  }

  const layer: BackLayer = {
    id,
    onBack,
    timestamp: Date.now(),
  };

  backStack.push(layer);

  // Return unregister callback
  return () => {
    const index = backStack.indexOf(layer);
    if (index !== -1) {
      // Layer was removed by UI (e.g. close button, unmount, backdrop click)
      // rather than by a user popstate event.
      backStack.splice(index, 1);
      programmaticPopsPending++;
      try {
        window.history.back();
      } catch {
        programmaticPopsPending = Math.max(0, programmaticPopsPending - 1);
      }
    }
  };
}

/**
 * Custom React hook that registers a back handler when isActive is true.
 * Automatically synchronizes with Android hardware back, edge swipes, and UI closes.
 */
export function useBackHandler(
  id: string,
  isActive: boolean,
  onBack: () => void
): void {
  const onBackRef = useRef(onBack);

  useEffect(() => {
    onBackRef.current = onBack;
  });

  useEffect(() => {
    if (!isActive) return;

    const unregister = registerBackHandler(id, () => {
      onBackRef.current();
    });

    return () => {
      unregister();
    };
  }, [id, isActive]);
}

/**
 * Programmatically triggers the topmost back action (similar to hardware back).
 */
export function triggerBack(): boolean {
  if (typeof window === 'undefined') return false;
  if (backStack.length > 0) {
    window.history.back();
    return true;
  }
  return false;
}

/**
 * Gets the current depth of active back layers.
 */
export function getBackStackDepth(): number {
  return backStack.length;
}
