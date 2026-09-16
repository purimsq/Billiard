/**
 * Screen Wake Lock & PWA Standalone Mode Manager
 * Handles native phone lock API (Screen Wake Lock API), iOS-specific power-saving rules,
 * automatic re-acquisition on visibility change, user gesture retries, and accurate
 * standalone / home screen detection.
 */

export type MobilePlatform = 'ios' | 'android' | 'other';

/**
 * Detects whether the user is on iOS (iPhone/iPad), Android, or other
 */
export function detectPlatform(): MobilePlatform {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent || '';
  const platform = (navigator as unknown as { platform?: string }).platform || '';

  // Check iOS (iPhone, iPad, iPod, or iPadOS Safari on MacIntel with touch points)
  if (
    /iPad|iPhone|iPod/.test(ua) ||
    (platform === 'MacIntel' && typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1)
  ) {
    return 'ios';
  }

  // Check Android
  if (/Android/i.test(ua)) {
    return 'android';
  }

  return 'other';
}

/**
 * Accurately detects whether the application is running in "Added to Home Screen"
 * (standalone PWA) mode on iOS Safari, Android Chrome, or desktop PWA.
 */
export function isStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false;

  // 1. Standard PWA display-mode: standalone
  const isStandaloneMatch = window.matchMedia('(display-mode: standalone)').matches;

  // 2. iOS Safari standalone property
  const isIosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;

  // 3. Fullscreen / minimal-ui PWA modes
  const isFullscreenMatch = window.matchMedia('(display-mode: fullscreen)').matches;
  const isMinimalUiMatch = window.matchMedia('(display-mode: minimal-ui)').matches;

  // 4. Android TWA / app referrer
  const isAndroidApp = typeof document !== 'undefined' && document.referrer.includes('android-app://');

  return Boolean(isStandaloneMatch || isIosStandalone || isFullscreenMatch || isMinimalUiMatch || isAndroidApp);
}

/**
 * Checks if the Screen Wake Lock API is supported in the current environment.
 */
export function isWakeLockSupported(): boolean {
  return typeof navigator !== 'undefined' && 'wakeLock' in navigator;
}

// Global wake lock sentinel reference
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let globalSentinel: any = null;
let fallbackVideo: HTMLVideoElement | null = null;
let isRequested = false;
let visibilityListenerAttached = false;
let userGestureListenerAttached = false;

/**
 * High-compatibility silent video playback fallback for iOS WebKit.
 * Apple WebKit has an OS-level policy: active video playback prevents the device from sleeping.
 * This ensures that even on iOS versions with restrictive battery policies or Low Power Mode,
 * the screen remains 100% awake.
 */
function enableIosVideoFallback(): void {
  if (typeof document === 'undefined') return;

  try {
    if (!fallbackVideo) {
      fallbackVideo = document.createElement('video');
      fallbackVideo.setAttribute('playsinline', 'true');
      fallbackVideo.setAttribute('webkit-playsinline', 'true');
      fallbackVideo.setAttribute('loop', 'true');
      fallbackVideo.muted = true;
      fallbackVideo.style.position = 'fixed';
      fallbackVideo.style.top = '-9999px';
      fallbackVideo.style.left = '-9999px';
      fallbackVideo.style.width = '1px';
      fallbackVideo.style.height = '1px';
      fallbackVideo.style.opacity = '0.01';
      fallbackVideo.style.pointerEvents = 'none';

      // 1-second blank H.264 MP4 compatible with all iOS versions
      fallbackVideo.src =
        'data:video/mp4;base64,AAAAHGZ0eXBtcDQyAAAAAW1wNDJpc29tYXZjMQAAADpmcmVlAAAKdm1kYXQAAAK2BgX/hN3SAwf43d5wAP7/AAAANm1vb3YAAABsbXZoZAAAAAB2G6mEdhupgAAAA+gAAAPoAAEAAAEAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAAIZdHJhawAAAFx0a2hkAAAACHYbqYR2G6mEAAAAAQAAAAEAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAA';

      document.body.appendChild(fallbackVideo);
    }

    const playPromise = fallbackVideo.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Autoplay may wait for user gesture; attached retry handler will trigger it
      });
    }
  } catch (err) {
    console.warn('iOS video fallback setup notice:', err);
  }
}

function disableIosVideoFallback(): void {
  if (fallbackVideo) {
    try {
      fallbackVideo.pause();
      fallbackVideo.remove();
    } catch {
      // Ignore
    }
    fallbackVideo = null;
  }
}

/**
 * Requests screen wake lock from the device OS.
 * Uses a Dual-Layer Strategy:
 * 1. Native Screen Wake Lock API (`navigator.wakeLock.request('screen')`)
 * 2. Secondary WebKit media loop fallback for iOS
 * Automatically handles re-acquisition on visibility changes.
 */
export async function requestScreenWakeLock(): Promise<boolean> {
  isRequested = true;
  const isIos = detectPlatform() === 'ios';

  // Always enable the iOS video fallback on Apple devices as a fail-safe
  if (isIos) {
    enableIosVideoFallback();
  }

  // Attempt native Screen Wake Lock API (supported natively on iOS 16.4+ in PWA mode, and Android)
  if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
    try {
      if (globalSentinel && !globalSentinel.released) {
        await globalSentinel.release().catch(() => {});
        globalSentinel = null;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sentinel = await (navigator as any).wakeLock.request('screen');
      globalSentinel = sentinel;

      sentinel.addEventListener('release', () => {
        if (globalSentinel === sentinel) {
          globalSentinel = null;
        }
      });

      attachVisibilityHandler();
      return true;
    } catch (err) {
      console.warn('Native Screen WakeLock request notice (falling back to media loop if on iOS):', err);
      attachUserGestureRetry();
      // If native failed on iOS, the video fallback above continues to protect it
      return isIos;
    }
  }

  // If navigator.wakeLock is not present (older iOS versions), video fallback handles it
  attachVisibilityHandler();
  return isIos;
}

/**
 * Releases all wake locks (both native sentinel and iOS media playback).
 */
export async function releaseScreenWakeLock(): Promise<void> {
  isRequested = false;

  // 1. Release native sentinel
  if (globalSentinel && !globalSentinel.released) {
    try {
      await globalSentinel.release();
    } catch {
      // Ignore release errors
    }
  }
  globalSentinel = null;

  // 2. Release iOS video playback fallback
  disableIosVideoFallback();
}

/**
 * Re-acquires wake lock when the page returns to visible state (e.g. app reopened from background).
 */
function attachVisibilityHandler(): void {
  if (visibilityListenerAttached || typeof document === 'undefined') return;
  visibilityListenerAttached = true;

  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible' && isRequested) {
      await requestScreenWakeLock();
    }
  });
}

/**
 * If the initial request failed due to lack of a user gesture,
 * attaches a one-time gesture listener to activate as soon as user taps.
 */
function attachUserGestureRetry(): void {
  if (userGestureListenerAttached || typeof window === 'undefined') return;
  userGestureListenerAttached = true;

  const onGesture = async () => {
    window.removeEventListener('pointerdown', onGesture);
    window.removeEventListener('click', onGesture);
    userGestureListenerAttached = false;

    if (isRequested && !globalSentinel) {
      await requestScreenWakeLock();
    }
  };

  window.addEventListener('pointerdown', onGesture, { once: true, passive: true });
  window.addEventListener('click', onGesture, { once: true, passive: true });
}

/**
 * Returns true if the screen wake lock is currently active on the device.
 */
export function isWakeLockActive(): boolean {
  return Boolean(
    (globalSentinel && !globalSentinel.released) ||
    (fallbackVideo && !fallbackVideo.paused)
  );
}
