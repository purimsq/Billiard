/**
 * Real Internet Reachability & Data Bundle Probe
 * Solves the issue where navigator.onLine is true (radio active), but:
 * 1. Mobile data is on with 0 data bundles / no data plan (carrier drop or captive portal).
 * 2. Connected to Wi-Fi with no internet / WAN access.
 */

export interface NetworkHealth {
  hasRadio: boolean; // navigator.onLine
  hasInternet: boolean; // Actual HTTP traffic can reach the web
  lastChecked: number;
  reason?: 'offline' | 'no_bundles_or_captive' | 'connected';
}

let currentHealth: NetworkHealth = {
  hasRadio: typeof navigator !== 'undefined' ? navigator.onLine : true,
  hasInternet: typeof navigator !== 'undefined' ? navigator.onLine : true,
  lastChecked: Date.now(),
  reason: 'connected',
};

const listeners = new Set<(health: NetworkHealth) => void>();

function notifyListeners() {
  listeners.forEach((listener) => {
    try {
      listener(currentHealth);
    } catch {
      // Ignore listener error
    }
  });
}

/**
 * Checks if actual HTTP traffic can reach our server or the internet.
 * Uses a strict timeout to quickly catch depleted data bundles.
 */
export async function checkRealInternetConnectivity(): Promise<NetworkHealth> {
  if (typeof window === 'undefined') {
    return { hasRadio: true, hasInternet: true, lastChecked: Date.now(), reason: 'connected' };
  }

  const hasRadio = navigator.onLine;
  if (!hasRadio) {
    currentHealth = {
      hasRadio: false,
      hasInternet: false,
      lastChecked: Date.now(),
      reason: 'offline',
    };
    notifyListeners();
    return currentHealth;
  }

  // Attempt a fast probe with cache busting
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3500);

  try {
    const probeUrl = `/version.json?_probe=${Date.now()}`;
    const response = await fetch(probeUrl, {
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
      },
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    // If redirected to carrier captive portal or bad status, no real internet
    if (response.ok && !response.redirected) {
      currentHealth = {
        hasRadio: true,
        hasInternet: true,
        lastChecked: Date.now(),
        reason: 'connected',
      };
      notifyListeners();
      return currentHealth;
    }

    currentHealth = {
      hasRadio: true,
      hasInternet: false,
      lastChecked: Date.now(),
      reason: 'no_bundles_or_captive',
    };
    notifyListeners();
    return currentHealth;
  } catch {
    clearTimeout(timeoutId);

    // Secondary fallback probe in case local server was busy or service worker intercepted
    try {
      const fallbackController = new AbortController();
      const fbTimer = setTimeout(() => fallbackController.abort(), 2500);
      const fbResp = await fetch(`https://dns.google/resolve?name=example.com&_probe=${Date.now()}`, {
        method: 'GET',
        mode: 'cors',
        cache: 'no-store',
        signal: fallbackController.signal,
      });
      clearTimeout(fbTimer);

      if (fbResp.ok) {
        currentHealth = {
          hasRadio: true,
          hasInternet: true,
          lastChecked: Date.now(),
          reason: 'connected',
        };
        notifyListeners();
        return currentHealth;
      }
    } catch {
      // Both failed
    }

    currentHealth = {
      hasRadio: true,
      hasInternet: false,
      lastChecked: Date.now(),
      reason: 'no_bundles_or_captive',
    };
    notifyListeners();
    return currentHealth;
  }
}

export function getNetworkHealthSnapshot(): NetworkHealth {
  return currentHealth;
}

export function subscribeNetworkHealth(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const listener = () => callback();
  listeners.add(listener);

  const handleOnline = () => {
    checkRealInternetConnectivity();
  };
  const handleOffline = () => {
    currentHealth = {
      hasRadio: false,
      hasInternet: false,
      lastChecked: Date.now(),
      reason: 'offline',
    };
    notifyListeners();
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Initial check on subscribe
  checkRealInternetConnectivity();

  return () => {
    listeners.delete(listener);
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}
