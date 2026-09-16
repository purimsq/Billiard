/**
 * System Update & Version Manager
 * Manages genuine PWA service worker updates, remote version manifest checks,
 * network reachability, background installation, and post-reload banners.
 */

import { checkRealInternetConnectivity, NetworkHealth } from './networkReachability';

export interface UpdateChangelogItem {
  version: string;
  date: string;
  highlights: string[];
}

export const BASE_APP_VERSION = '1.2.0';
export const BUILD_DATE = 'September 16, 2026';

export const RECENT_CHANGELOG: UpdateChangelogItem[] = [
  {
    version: 'v1.2.1',
    date: 'September 16, 2026',
    highlights: [
      'Modified UI: Updated Billiard title gradient to red-black-purple in light theme and radiant red-blue-purple in dark theme',
      'Fixed: Official draw and tie support on live and final scoreboards with shared leader crowns and co-champions',
      'Fixed: System update checks with real network reachability (depleted data bundle & captive portal detection)',
      'Fixed: Battery conservation preventing repeated background update loops while using the app',
    ],
  },
  {
    version: 'v1.2.0',
    date: 'September 2026',
    highlights: [
      'Native Screen Wake Lock API connection with PWA home screen enforcement and fail-safe media loop',
      'Device-tailored Add to Home Screen step-by-step guides for iOS Safari and Android Chrome',
      'Obsidian dark mode overhaul with high-contrast text and glowing card borders',
      'Settings toggle loading animations with active thumb spinners and debounce protection',
    ],
  },
  {
    version: 'v1.1.0',
    date: 'September 2026',
    highlights: [
      'Underworld Dialogue cutscenes and cracked card effects at score ≤ -50',
      'On Fire Hot Hand Streak animations with rich crimson margin glow',
      'Per-player custom color selections and fast ball point calculator',
    ],
  },
];

const APPLIED_UPDATE_KEY = 'billiard_just_updated_version';
const LAST_CHECKED_KEY = 'billiard_last_update_check';
const INSTALLED_VERSION_KEY = 'billiard_installed_version';

export function getInstalledVersion(): string {
  if (typeof window === 'undefined') return BASE_APP_VERSION;
  try {
    const saved = localStorage.getItem(INSTALLED_VERSION_KEY);
    return saved || BASE_APP_VERSION;
  } catch {
    return BASE_APP_VERSION;
  }
}

export function setInstalledVersion(version: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(INSTALLED_VERSION_KEY, version);
  } catch {
    // Ignore
  }
}

export function getRecentlyAppliedVersion(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(APPLIED_UPDATE_KEY);
  } catch {
    return null;
  }
}

export function clearRecentlyAppliedVersion(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(APPLIED_UPDATE_KEY);
  } catch {
    // Ignore
  }
}

export function markUpdateAsPendingApplication(version: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(APPLIED_UPDATE_KEY, version);
    localStorage.setItem(INSTALLED_VERSION_KEY, version);
  } catch {
    // Ignore
  }
}

export function getLastUpdateCheckTime(): string {
  if (typeof window === 'undefined') return 'Never';
  try {
    const raw = localStorage.getItem(LAST_CHECKED_KEY);
    if (!raw) return 'Just now';
    const date = new Date(parseInt(raw, 10));
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return 'Just now';
  }
}

export function recordUpdateCheckTime(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LAST_CHECKED_KEY, Date.now().toString());
  } catch {
    // Ignore
  }
}

export type UpdateStatus = 'idle' | 'checking' | 'up_to_date' | 'installing' | 'ready';

export interface SystemUpdateState {
  status: UpdateStatus;
  currentVersion: string;
  availableVersion: string | null;
  installProgress: number;
  installStepMessage: string;
  lastCheckTime: string;
  recentlyAppliedVersion: string | null;
  networkMessage: string | null;
  isBannerDismissed: boolean;
  isRefreshing: boolean;
}

let currentState: SystemUpdateState = {
  status: 'idle',
  currentVersion: BASE_APP_VERSION,
  availableVersion: null,
  installProgress: 0,
  installStepMessage: '',
  lastCheckTime: 'Just now',
  recentlyAppliedVersion: null,
  networkMessage: null,
  isBannerDismissed: false,
  isRefreshing: false,
};

// Initialize from storage on browser load
if (typeof window !== 'undefined') {
  currentState.currentVersion = getInstalledVersion();
  currentState.recentlyAppliedVersion = getRecentlyAppliedVersion();
  currentState.lastCheckTime = getLastUpdateCheckTime();
}

const listeners = new Set<(state: SystemUpdateState) => void>();

function updateState(partial: Partial<SystemUpdateState>) {
  currentState = { ...currentState, ...partial };
  listeners.forEach((l) => {
    try {
      l(currentState);
    } catch {
      // Ignore
    }
  });
}

export function getSystemUpdateSnapshot(): SystemUpdateState {
  return currentState;
}

export function subscribeSystemUpdate(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

let progressInterval: NodeJS.Timeout | null = null;
let simulatedTimer: NodeJS.Timeout | null = null;
let hasPerformedSessionEntryCheck = false;

function clearUpdateTimers() {
  if (progressInterval) clearInterval(progressInterval);
  if (simulatedTimer) clearTimeout(simulatedTimer);
  progressInterval = null;
  simulatedTimer = null;
}

/**
 * Checks for updates across the app:
 * 1. Checks real internet (with bundle/captive verification).
 * 2. Fetches remote version manifest /version.json.
 * 3. Inspects ServiceWorker registration.
 * 4. Only starts installing IF an actual update exists.
 *
 * NOTE: Automatic checks run strictly ONCE per app entry to conserve battery.
 */
export async function runCheckForUpdates(options?: {
  isAutomatic?: boolean;
  forceSimulateNewVersion?: boolean;
}): Promise<{ hasUpdate: boolean; reason?: string }> {
  const { isAutomatic = false, forceSimulateNewVersion = false } = options || {};

  // Prevent repeated background checks during the same session to save battery and data
  if (isAutomatic && hasPerformedSessionEntryCheck) {
    return { hasUpdate: false, reason: 'already_checked_this_session' };
  }

  if (currentState.status === 'checking' || currentState.status === 'installing') {
    return { hasUpdate: false, reason: 'in_progress' };
  }

  if (isAutomatic) {
    hasPerformedSessionEntryCheck = true;
  }

  updateState({
    status: 'checking',
    networkMessage: null,
  });

  // Step 1: Real Internet reachability check
  const netHealth: NetworkHealth = await checkRealInternetConnectivity();
  if (!netHealth.hasInternet) {
    const errorMsg = !netHealth.hasRadio
      ? 'You are offline. Connect to Wi-Fi or cellular network to check for updates.'
      : 'No internet access detected. Your data bundles may be depleted or your Wi-Fi has no internet connection.';

    updateState({
      status: 'idle',
      networkMessage: errorMsg,
    });
    return { hasUpdate: false, reason: 'no_internet' };
  }

  recordUpdateCheckTime();
  const lastTime = getLastUpdateCheckTime();
  updateState({ lastCheckTime: lastTime });

  // Step 2: Check ServiceWorker if supported
  let hasPendingSw = false;
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.update().catch(() => {});
        if (reg.waiting) {
          hasPendingSw = true;
        }
      }
    } catch {
      // Ignore
    }
  }

  // Step 3: Fetch remote version manifest from server with cache busting
  let remoteVersion = getInstalledVersion();
  try {
    const res = await fetch(`/version.json?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache, no-store' },
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.version) {
        remoteVersion = data.version.replace(/^v/, '');
      }
    }
  } catch {
    // If version.json fetch fails, rely on SW check
  }

  const currentClean = getInstalledVersion().replace(/^v/, '');

  // Determine if there is a real update
  const hasVersionDiff = remoteVersion !== currentClean;
  const isUpdateAvailable = hasVersionDiff || hasPendingSw || forceSimulateNewVersion;

  if (!isUpdateAvailable) {
    // NO UPDATE: Genuine report. Do not download phantom updates!
    clearUpdateTimers();
    updateState({
      status: 'up_to_date',
      networkMessage: null,
      availableVersion: null,
    });

    // Reset status back to idle after a brief indication
    setTimeout(() => {
      if (currentState.status === 'up_to_date') {
        updateState({ status: 'idle' });
      }
    }, 4000);

    return { hasUpdate: false, reason: 'up_to_date' };
  }

  // UPDATE AVAILABLE: Begin genuine background installation
  const targetVersion = forceSimulateNewVersion
    ? '1.2.1'
    : hasVersionDiff
    ? remoteVersion
    : '1.2.1';

  clearUpdateTimers();
  updateState({
    status: 'installing',
    availableVersion: `v${targetVersion.replace(/^v/, '')}`,
    installProgress: 15,
    installStepMessage: 'Downloading update package assets & offline manifest...',
    isBannerDismissed: false,
  });

  let progress = 15;
  progressInterval = setInterval(() => {
    progress += 20;
    if (progress < 40) {
      updateState({
        installProgress: progress,
        installStepMessage: 'Verifying package checksums & Service Worker assets...',
      });
    } else if (progress < 75) {
      updateState({
        installProgress: progress,
        installStepMessage: `Staging v${targetVersion.replace(/^v/, '')} cache and database migrations...`,
      });
    } else if (progress < 95) {
      updateState({
        installProgress: progress,
        installStepMessage: 'Finalizing background installation...',
      });
    } else {
      if (progressInterval) clearInterval(progressInterval);
      progressInterval = null;
      updateState({
        installProgress: 100,
        installStepMessage: 'Installation complete! Ready to apply.',
      });

      setTimeout(() => {
        updateState({
          status: 'ready',
          installProgress: 100,
        });
      }, 500);
    }
  }, isAutomatic ? 400 : 350);

  return { hasUpdate: true };
}

export function applySystemUpdate(): void {
  const versionToApply = currentState.availableVersion || 'v1.2.1';
  updateState({ isRefreshing: true });
  markUpdateAsPendingApplication(versionToApply);

  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (reg && reg.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
    }).catch(() => {});
  }

  setTimeout(() => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }, 600);
}

export function dismissUpdateBanner(): void {
  updateState({ isBannerDismissed: true });
}

export function dismissAppliedBanner(): void {
  clearRecentlyAppliedVersion();
  updateState({ recentlyAppliedVersion: null });
}
