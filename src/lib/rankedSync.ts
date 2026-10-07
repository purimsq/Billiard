import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  orderBy,
  limit,
  increment,
  getCountFromServer,
} from 'firebase/firestore';
import { db, ensureAnonymousAuth } from './firebase';
import { GameSession, Transaction } from '@/types/game';
import { getGameHistory } from './storage';
import { checkRealInternetConnectivity } from './networkReachability';
import {
  calculateSmartMatchElo,
  extractPlayerMatchMetrics,
  sortTournamentStandings,
  MatchEloResult,
  SmartEloCalculation,
  PlayerMatchMetrics,
} from './smartElo';

export {
  calculateSmartMatchElo,
  extractPlayerMatchMetrics,
  sortTournamentStandings,
};
export type {
  MatchEloResult,
  SmartEloCalculation,
  PlayerMatchMetrics,
};

export interface RankedPlayerProfile {
  id: string; // Auth UID or generated player ID
  username: string; // e.g. "Dave"
  discriminator: string; // 4-digit short number e.g. "4821"
  tag: string; // Formatted tag e.g. "Dave #4821"
  name: string; // For backward compatibility
  email: string; // Email for notifications & recovery
  pin: string; // 4-digit verification PIN
  avatarBg?: string;
  color?: string;
  totalMatches: number;
  wins: number;
  losses: number;
  draws: number;
  totalPoints: number;
  highestBreak: number;
  rating: number; // Base rating (starts at 100)
  pointsPerGame?: number; // Career average points per game (smart efficiency metric)
  casualMatches?: number; // Total casual matches recorded
  casualPoints?: number; // Total casual points scored
  casualHighestBreak?: number; // Personal best break in casual play
  totalEventsLogged?: number; // Total game events/shots logged across casual & ranked
  qrData?: string; // QR code raw payload string
  createdAt?: number;
  updatedAt: number;
}

export type PublicLeaderboardPlayer = Omit<RankedPlayerProfile, 'pin'>;

export interface CompetitorIdentity {
  username: string;
  discriminator: string;
  formattedTag: string;
}

/**
 * Robust helper to extract both clean username and 4-digit short code from any competitor record.
 */
export function formatCompetitorIdentity(player?: {
  id?: string;
  username?: string;
  name?: string;
  discriminator?: string;
  tag?: string;
} | null): CompetitorIdentity {
  if (!player) {
    return {
      username: 'Competitor',
      discriminator: '1001',
      formattedTag: 'Competitor #1001',
    };
  }

  let username = (player.username || '').trim();
  let discriminator = (player.discriminator || '').trim();

  // If username is empty, try to extract from name or tag
  if (!username) {
    const rawName = (player.name || player.tag || '').trim();
    if (rawName.includes('#')) {
      const parts = rawName.split('#');
      username = parts[0].trim();
      if (!discriminator && parts[1]) {
        discriminator = parts[1].trim();
      }
    } else {
      username = rawName || 'Competitor';
    }
  }

  // If discriminator is still empty, try to extract from tag or name
  if (!discriminator) {
    const rawTag = (player.tag || player.name || '').trim();
    if (rawTag.includes('#')) {
      const parts = rawTag.split('#');
      discriminator = parts[1]?.trim() || '';
    }
  }

  // Sanitize discriminator to clean digits
  discriminator = discriminator.replace(/[^0-9]/g, '');
  if (!discriminator) {
    if (player.id) {
      let hash = 0;
      for (let i = 0; i < player.id.length; i++) {
        hash = (hash * 31 + player.id.charCodeAt(i)) % 9000;
      }
      discriminator = String(Math.abs(hash) + 1000);
    } else {
      discriminator = '1001';
    }
  }

  // Format short code to 4 digits if needed
  if (discriminator.length < 4) {
    discriminator = discriminator.padStart(4, '0');
  }

  return {
    username: username || 'Competitor',
    discriminator,
    formattedTag: `${username || 'Competitor'} #${discriminator}`,
  };
}

const DEVICE_PROFILE_KEY = 'billiard_device_player_profile_v1';
const PENDING_SYNC_KEY = 'billiard_pending_ranked_sync_v1';
const CACHED_LEADERBOARD_KEY = 'billiard_cached_leaderboard_v1';
const LAST_TOURNAMENT_CHECK_KEY = 'billiard_last_tournament_check_v1';

export function recordTournamentCheckTime(timestamp: number = Date.now()): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LAST_TOURNAMENT_CHECK_KEY, timestamp.toString());
  } catch {
    // ignore
  }
}

export function getLastTournamentCheckTimestamp(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LAST_TOURNAMENT_CHECK_KEY);
    if (!raw) return null;
    const num = parseInt(raw, 10);
    return isNaN(num) ? null : num;
  } catch {
    return null;
  }
}

export function formatTournamentLastUpdated(timestamp?: number | null): string {
  const ts = timestamp ?? getLastTournamentCheckTimestamp();
  if (!ts) return 'Never checked';
  const now = Date.now();
  const diffMs = now - ts;
  if (diffMs < 60 * 1000) {
    return 'Just now';
  }
  const date = new Date(ts);
  const isToday = new Date().toDateString() === date.toDateString();
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (isToday) {
    return `Today at ${timeStr}`;
  }
  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${timeStr}`;
}

const BANNED_TEST_USERS = ['dave', 'player 1', 'player 2', 'player1', 'player2'];

export function isBannedTestPlayer(nameOrTag?: string, id?: string): boolean {
  if (id && (id === 'player_1790498452450_0' || id === 'player_1790498452450_1' || id === '4wgYMGQZscS4kuRCbk3uf7n51v42')) {
    return true;
  }
  if (!nameOrTag) return false;
  const clean = nameOrTag.trim().toLowerCase();
  return BANNED_TEST_USERS.some(
    (b) => clean === b || clean.startsWith('player 1') || clean.startsWith('player 2') || clean.startsWith('dave #') || clean.startsWith('dave#')
  );
}

// Auto-sanitize legacy test players from local storage on module boot
if (typeof window !== 'undefined') {
  try {
    const keys = [
      CACHED_LEADERBOARD_KEY,
      'billiard_smart_frequent_competitors_v1',
      'billiard_verified_competitor_roster_v1',
    ];
    for (const key of keys) {
      const raw = localStorage.getItem(key);
      if (raw) {
        try {
          const list = JSON.parse(raw);
          if (Array.isArray(list)) {
            const cleaned = list.filter((item: Record<string, unknown>) => {
              const u = String(item.username || item.name || item.tag || '');
              const id = typeof item.id === 'string' ? item.id : undefined;
              return !isBannedTestPlayer(u, id);
            });
            if (cleaned.length !== list.length) {
              localStorage.setItem(key, JSON.stringify(cleaned));
            }
          }
        } catch {}
      }
    }
  } catch {}
}

export function getCachedLeaderboard(): PublicLeaderboardPlayer[] {
  if (typeof window === 'undefined') return [];
  try {
    const cached = localStorage.getItem(CACHED_LEADERBOARD_KEY);
    if (!cached) return [];
    const parsed = JSON.parse(cached) as PublicLeaderboardPlayer[];
    const cleaned = parsed.filter((p) => {
      const u = p.username || p.name || p.tag || '';
      return !isBannedTestPlayer(u, p.id);
    });
    return cleaned.map((p) => {
      const comp = formatCompetitorIdentity(p);
      return {
        ...p,
        username: comp.username,
        discriminator: comp.discriminator,
        tag: comp.formattedTag,
        name: p.name || comp.formattedTag,
      };
    });
  } catch {
    return [];
  }
}

let hasPerformedTournamentEntryCheck = false;

export async function checkAndSyncTournamentResults(options?: {
  isAutomatic?: boolean;
  limitCount?: number;
}): Promise<{ success: boolean; data: PublicLeaderboardPlayer[]; lastUpdated: string }> {
  const { isAutomatic = false, limitCount = 100 } = options || {};

  if (isAutomatic && hasPerformedTournamentEntryCheck) {
    return {
      success: true,
      data: getCachedLeaderboard(),
      lastUpdated: formatTournamentLastUpdated(),
    };
  }

  if (isAutomatic) {
    hasPerformedTournamentEntryCheck = true;
  }

  try {
    const data = await getOnlineLeaderboard(limitCount);
    recordTournamentCheckTime();
    return {
      success: true,
      data,
      lastUpdated: formatTournamentLastUpdated(),
    };
  } catch (err) {
    console.warn('[RankedSync] Automatic tournament check failed:', err);
    return {
      success: false,
      data: getCachedLeaderboard(),
      lastUpdated: formatTournamentLastUpdated(),
    };
  }
}

// 1. Device Profile Management
export function getLocalDeviceProfile(): RankedPlayerProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(DEVICE_PROFILE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RankedPlayerProfile;
    if (!parsed) return null;

    // Graceful backward compatibility fallback
    if (!parsed.username && parsed.name) {
      const parts = parsed.name.split('#');
      parsed.username = parts[0].trim();
      parsed.discriminator = parts[1] ? parts[1].trim() : '1001';
      parsed.tag = `${parsed.username} #${parsed.discriminator}`;
    }
    if (!parsed.tag && parsed.username && parsed.discriminator) {
      parsed.tag = `${parsed.username} #${parsed.discriminator}`;
    }
    if (!parsed.email) {
      parsed.email = '';
    }

    return parsed;
  } catch (err) {
    console.error('Failed to get local device profile:', err);
    return null;
  }
}

export function saveLocalDeviceProfile(profile: RankedPlayerProfile): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DEVICE_PROFILE_KEY, JSON.stringify(profile));
  } catch (err) {
    console.error('Failed to save local device profile:', err);
  }
}

/**
 * Allocates a 4-digit unique discriminator (#1000 - #9999) for a given username.
 * Queries Firestore to guarantee two players with the same username never share a short number.
 */
export async function allocateUniqueDiscriminator(username: string): Promise<string> {
  const cleanName = username.trim().toLowerCase();
  const taken = new Set<string>();

  if (cleanName) {
    try {
      const playersRef = collection(db, 'players');
      const q = query(playersRef, where('username_lower', '==', cleanName));
      const snapshot = await getDocs(q);
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.discriminator) {
          taken.add(String(data.discriminator).padStart(4, '0'));
        }
      });
    } catch (err) {
      console.warn('[RankedSync] Failed to query existing discriminators:', err);
    }
  }

  // Generate a random 4-digit number that isn't taken
  for (let attempt = 0; attempt < 250; attempt++) {
    const candidate = Math.floor(1000 + Math.random() * 9000).toString();
    if (!taken.has(candidate)) {
      return candidate;
    }
  }

  // Fallback sequential search
  for (let num = 1000; num <= 9999; num++) {
    const s = String(num);
    if (!taken.has(s)) {
      return s;
    }
  }

  return '1001';
}

export interface RegisterProfileParams {
  username: string;
  discriminator: string;
  pin: string;
  email: string;
  color?: string;
}

// Register or update device player profile in Firestore & local cache
export async function registerPlayerProfile(
  paramsOrName: RegisterProfileParams | string,
  legacyPin?: string,
  legacyColor = '#6366F1'
): Promise<RankedPlayerProfile> {
  const user = await ensureAnonymousAuth();
  const uid = user ? user.uid : `player_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  let username = '';
  let discriminator = '1001';
  let pin = '';
  let email = '';
  let color = '#6366F1';

  if (typeof paramsOrName === 'string') {
    username = paramsOrName.trim();
    pin = (legacyPin || '0000').trim();
    color = legacyColor;
    discriminator = await allocateUniqueDiscriminator(username);
  } else {
    username = paramsOrName.username.trim();
    discriminator = paramsOrName.discriminator.trim() || '1001';
    pin = paramsOrName.pin.trim();
    email = paramsOrName.email.trim().toLowerCase();
    color = paramsOrName.color || '#6366F1';
  }

  const tag = `${username} #${discriminator}`;

  // QR Code payload representation
  const qrData = JSON.stringify({
    app: 'billiard',
    type: 'player_profile',
    id: uid,
    tag,
    username,
    discriminator,
    email,
    createdAt: Date.now(),
  });

  const existingLocal = getLocalDeviceProfile();
  const profile: RankedPlayerProfile = {
    id: existingLocal?.id || uid,
    username,
    discriminator,
    tag,
    name: tag,
    email,
    pin,
    color,
    avatarBg: color,
    totalMatches: existingLocal?.totalMatches || 0,
    wins: existingLocal?.wins || 0,
    losses: existingLocal?.losses || 0,
    draws: existingLocal?.draws || 0,
    totalPoints: existingLocal?.totalPoints || 0,
    highestBreak: existingLocal?.highestBreak || 0,
    rating: existingLocal?.rating || 100,
    qrData,
    createdAt: existingLocal?.createdAt || Date.now(),
    updatedAt: Date.now(),
  };

  // Save locally first
  saveLocalDeviceProfile(profile);

  // Sync to Firestore
  try {
    const playerRef = doc(db, 'players', profile.id);
    await setDoc(
      playerRef,
      {
        ...profile,
        username_lower: username.toLowerCase(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('[RankedSync] Failed to sync profile to Firestore (will operate offline):', err);
  }

  return profile;
}

/**
 * Restores an existing cloud profile onto this device using Player Tag (or Email) and 4-digit PIN.
 * Provides safe, non-revealing credential validation feedback.
 */
export async function restorePlayerProfile(
  identifier: string,
  enteredPin: string
): Promise<{ success: boolean; profile?: RankedPlayerProfile; error?: string }> {
  const cleanId = identifier.trim();
  const cleanPin = enteredPin.trim();

  if (!cleanId) {
    return { success: false, error: 'Please enter your Player Tag or Email address' };
  }
  if (!cleanPin || cleanPin.length !== 4) {
    return { success: false, error: 'Please enter your 4-digit Security PIN' };
  }

  // Safe standard security feedback message
  const GENERIC_ERROR = 'Invalid credentials. Please verify your Player Tag or Email and 4-digit PIN.';

  try {
    const playersRef = collection(db, 'players');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let matchedDoc: any = null;

    // A. Check if identifier is an email address
    if (cleanId.includes('@')) {
      const emailLower = cleanId.toLowerCase();
      const qEmail = query(playersRef, where('email', '==', emailLower), limit(2));
      const snap = await getDocs(qEmail);
      if (!snap.empty) {
        matchedDoc = snap.docs[0];
      }
    } 
    // B. Check if identifier contains a tag with # (e.g. "Dylen #1001", "Dylen#1001", "Dylen # 1001")
    else if (cleanId.includes('#')) {
      const parts = cleanId.split('#');
      const u = parts[0].trim().toLowerCase();
      const rawDigits = parts.slice(1).join('').replace(/[^0-9]/g, '').trim();
      const d = rawDigits ? rawDigits.padStart(4, '0') : '';
      if (d) {
        const qTag = query(playersRef, where('username_lower', '==', u), where('discriminator', '==', d), limit(1));
        const snap = await getDocs(qTag);
        if (!snap.empty) {
          matchedDoc = snap.docs[0];
        }
      }
    }
    // C. Check if user typed digits with space but without # (e.g. "Dylen 1001", "Dylen   1001")
    else if (/^(.+?)\s+(\d{1,4})$/.test(cleanId)) {
      const match = cleanId.match(/^(.+?)\s+(\d{1,4})$/);
      if (match) {
        const u = match[1].trim().toLowerCase();
        const d = match[2].trim().padStart(4, '0');
        const qTag = query(playersRef, where('username_lower', '==', u), where('discriminator', '==', d), limit(1));
        const snap = await getDocs(qTag);
        if (!snap.empty) {
          matchedDoc = snap.docs[0];
        }
      }
    }
    // D. Check if user typed name joined with 4 digits without space or # (e.g. "Dylen1001")
    else if (/^([a-zA-Z_.-]{2,})(\d{4})$/.test(cleanId)) {
      const match = cleanId.match(/^([a-zA-Z_.-]{2,})(\d{4})$/);
      if (match) {
        const u = match[1].trim().toLowerCase();
        const d = match[2].trim();
        const qTag = query(playersRef, where('username_lower', '==', u), where('discriminator', '==', d), limit(1));
        const snap = await getDocs(qTag);
        if (!snap.empty) {
          matchedDoc = snap.docs[0];
        }
      }
    }

    // E. Fallback: Search by username only (e.g. "Dylen" or if discriminator didn't match directly)
    if (!matchedDoc && !cleanId.includes('@')) {
      // Strip any trailing digits or # to get base username
      const cleanBaseUser = cleanId.split('#')[0].replace(/\s+\d+$/, '').trim().toLowerCase();
      const uToSearch = cleanBaseUser || cleanId.toLowerCase();

      const qUser = query(playersRef, where('username_lower', '==', uToSearch), limit(10));
      const snap = await getDocs(qUser);
      if (!snap.empty) {
        for (const docSnap of snap.docs) {
          const docData = docSnap.data();
          if (docData.pin && docData.pin.trim() === cleanPin) {
            matchedDoc = docSnap;
            break;
          }
        }
      }
    }

    if (!matchedDoc) {
      return { success: false, error: GENERIC_ERROR };
    }

    const data = matchedDoc.data() as RankedPlayerProfile;
    // Verify PIN strictly
    if (!data.pin || data.pin.trim() !== cleanPin) {
      return { success: false, error: GENERIC_ERROR };
    }

    // Reconstruct full profile and competitor identity
    const comp = formatCompetitorIdentity(data);
    const tag = comp.formattedTag;
    const uid = matchedDoc.id || data.id;

    // Restore QR code data representation
    const qrData = data.qrData || JSON.stringify({
      app: 'billiard',
      type: 'player_profile',
      id: uid,
      tag,
      username: comp.username,
      discriminator: comp.discriminator,
      email: data.email || '',
      createdAt: data.createdAt || Date.now(),
    });

    const restoredProfile: RankedPlayerProfile = {
      ...data,
      id: uid,
      username: comp.username,
      discriminator: comp.discriminator,
      tag,
      name: tag,
      email: data.email || '',
      color: data.color || '#6366F1',
      avatarBg: data.avatarBg || data.color || '#6366F1',
      rating: typeof data.rating === 'number' ? data.rating : 100,
      totalMatches: data.totalMatches || 0,
      wins: data.wins || 0,
      losses: data.losses || 0,
      draws: data.draws || 0,
      totalPoints: data.totalPoints || 0,
      highestBreak: data.highestBreak || 0,
      qrData,
      updatedAt: Date.now(),
    };

    // Save restored profile to local storage so device is immediately authenticated
    saveLocalDeviceProfile(restoredProfile);

    return { success: true, profile: restoredProfile };
  } catch (err) {
    console.warn('[RankedSync] Failed to restore profile:', err);
    return {
      success: false,
      error: 'Unable to connect to the arena database. Please check your internet connection.',
    };
  }
}

// 2. Search Ranked Players in Database
export const SMART_FREQUENT_COMPETITORS_KEY = 'billiard_smart_frequent_competitors_v1';

export interface SmartCompetitorRecord extends PublicLeaderboardPlayer {
  searchCount: number;
  lastInteracted: number;
}

export function getFrequentCompetitors(): PublicLeaderboardPlayer[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SMART_FREQUENT_COMPETITORS_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as SmartCompetitorRecord[];
    if (!Array.isArray(list)) return [];
    const cleaned = list.filter((p) => {
      const u = p.username || p.name || p.tag || '';
      return !isBannedTestPlayer(u, p.id);
    });
    cleaned.sort(
      (a, b) =>
        (b.searchCount || 0) - (a.searchCount || 0) ||
        (b.lastInteracted || 0) - (a.lastInteracted || 0)
    );
    return cleaned.slice(0, 8);
  } catch {
    return [];
  }
}

export function recordCompetitorInteraction(
  player: {
    id?: string;
    username?: string;
    discriminator?: string;
    tag?: string;
    name?: string;
    email?: string;
    color?: string;
    rating?: number;
    totalMatches?: number;
    wins?: number;
    losses?: number;
    draws?: number;
  }
): void {
  if (typeof window === 'undefined') return;
  try {
    const comp = formatCompetitorIdentity(player);
    const id = player.id || `comp_${comp.username}_${comp.discriminator}`;
    const raw = localStorage.getItem(SMART_FREQUENT_COMPETITORS_KEY);
    const list: SmartCompetitorRecord[] = raw ? JSON.parse(raw) : [];

    const existingIdx = list.findIndex(
      (p) =>
        (player.id && p.id === player.id) ||
        (p.username.toLowerCase() === comp.username.toLowerCase() &&
          p.discriminator === comp.discriminator)
    );

    if (existingIdx >= 0) {
      list[existingIdx] = {
        ...list[existingIdx],
        ...player,
        id,
        username: comp.username,
        discriminator: comp.discriminator,
        tag: comp.formattedTag,
        searchCount: (list[existingIdx].searchCount || 1) + 1,
        lastInteracted: Date.now(),
      };
    } else {
      list.unshift({
        id,
        username: comp.username,
        discriminator: comp.discriminator,
        tag: comp.formattedTag,
        name: player.name || comp.formattedTag,
        email: player.email || '',
        color: player.color || '#6366F1',
        rating: player.rating || 100,
        totalMatches: player.totalMatches || 0,
        wins: player.wins || 0,
        losses: player.losses || 0,
        draws: player.draws || 0,
        totalPoints: 0,
        highestBreak: 0,
        updatedAt: Date.now(),
        searchCount: 1,
        lastInteracted: Date.now(),
      });
    }

    localStorage.setItem(SMART_FREQUENT_COMPETITORS_KEY, JSON.stringify(list.slice(0, 20)));
  } catch (err) {
    console.warn('[RankedSync] Failed to record frequent competitor:', err);
  }
}

// 2. Search Ranked Players in Database & Local Cache
export async function searchRankedPlayers(searchTerm: string): Promise<PublicLeaderboardPlayer[]> {
  const term = searchTerm.trim().toLowerCase();
  if (!term) return [];

  const resultsMap = new Map<string, PublicLeaderboardPlayer>();

  // 1. Check local frequent competitors first (instant)
  const frequent = getFrequentCompetitors();
  for (const f of frequent) {
    if (isBannedTestPlayer(f.username, f.id) || isBannedTestPlayer(f.tag, f.id) || isBannedTestPlayer(f.name, f.id)) continue;
    const comp = formatCompetitorIdentity(f);
    if (
      comp.username.toLowerCase().includes(term) ||
      comp.discriminator.includes(term) ||
      comp.formattedTag.toLowerCase().includes(term)
    ) {
      resultsMap.set(`${comp.username.toLowerCase()}#${comp.discriminator}`, f);
    }
  }

  // 2. Check cached leaderboard
  if (typeof window !== 'undefined') {
    const cached = localStorage.getItem(CACHED_LEADERBOARD_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as PublicLeaderboardPlayer[];
        for (const p of parsed) {
          if (isBannedTestPlayer(p.username, p.id) || isBannedTestPlayer(p.tag, p.id) || isBannedTestPlayer(p.name, p.id)) continue;
          const comp = formatCompetitorIdentity(p);
          if (
            comp.username.toLowerCase().includes(term) ||
            comp.discriminator.includes(term) ||
            comp.formattedTag.toLowerCase().includes(term)
          ) {
            resultsMap.set(`${comp.username.toLowerCase()}#${comp.discriminator}`, {
              ...p,
              username: comp.username,
              discriminator: comp.discriminator,
              tag: comp.formattedTag,
            });
          }
        }
      } catch {
        // ignore
      }
    }
  }

  // 3. Query Firestore if online
  try {
    const playersRef = collection(db, 'players');
    const q = query(playersRef, orderBy('rating', 'desc'), limit(50));
    const snapshot = await getDocs(q);

    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as RankedPlayerProfile;
      if (isBannedTestPlayer(data.username, docSnap.id) || isBannedTestPlayer(data.tag, docSnap.id) || isBannedTestPlayer(data.name, docSnap.id)) {
        return;
      }
      const comp = formatCompetitorIdentity({ ...data, id: docSnap.id });
      const matchName = (data.name || '').toLowerCase();
      const matchTag = comp.formattedTag.toLowerCase();
      const matchUser = comp.username.toLowerCase();
      const matchDisc = comp.discriminator;
      const matchEmail = (data.email || '').toLowerCase();

      if (
        matchName.includes(term) ||
        matchTag.includes(term) ||
        matchUser.includes(term) ||
        matchDisc.includes(term) ||
        matchEmail.includes(term)
      ) {
        // Exclude secret PIN from results
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { pin, ...publicData } = data;
        resultsMap.set(`${comp.username.toLowerCase()}#${comp.discriminator}`, {
          ...publicData,
          id: data.id || docSnap.id,
          username: comp.username,
          discriminator: comp.discriminator,
          tag: comp.formattedTag,
        });
      }
    });
  } catch (err) {
    console.warn('[RankedSync] Failed to search Firestore players:', err);
  }

  return Array.from(resultsMap.values());
}

// 3. Verify Player PIN for Ranked Matches
export async function verifyPlayerPin(playerId: string, enteredPin: string): Promise<boolean> {
  const cleanPin = enteredPin.trim();
  const local = getLocalDeviceProfile();
  if (local && local.id === playerId) {
    return local.pin === cleanPin;
  }

  try {
    const playerRef = doc(db, 'players', playerId);
    const snap = await getDoc(playerRef);
    if (!snap.exists()) return false;
    const data = snap.data() as RankedPlayerProfile;
    return data.pin === cleanPin;
  } catch (err) {
    console.warn('[RankedSync] Failed to verify player PIN via network:', err);
    if (local && local.id === playerId) {
      return local.pin === cleanPin;
    }
    return false;
  }
}

// 4. Verify Competitor Offline via Tag/Short Code & 4-Digit PIN
export async function verifyOfflineCompetitor(
  identifier: string,
  enteredPin: string
): Promise<{ success: boolean; player?: PublicLeaderboardPlayer; error?: string }> {
  const cleanId = identifier.trim();
  const cleanPin = enteredPin.trim();

  if (!cleanId) {
    return { success: false, error: 'Please enter a player username or tag' };
  }
  if (!/^\d{4}$/.test(cleanPin)) {
    return { success: false, error: 'Security PIN must be exactly 4 digits' };
  }

  // 1. If online, check Firestore
  try {
    const playersRef = collection(db, 'players');
    let q;
    if (cleanId.includes('#')) {
      const parts = cleanId.split('#');
      const u = parts[0].trim().toLowerCase();
      const d = parts[1].trim();
      q = query(playersRef, where('username_lower', '==', u), where('discriminator', '==', d));
    } else {
      q = query(playersRef, where('username_lower', '==', cleanId.toLowerCase()), limit(5));
    }
    const snap = await getDocs(q);
    if (!snap.empty) {
      const matchDoc = snap.docs[0];
      const data = matchDoc.data() as RankedPlayerProfile;
      if (data.pin && data.pin.trim() !== cleanPin) {
        return { success: false, error: 'Incorrect 4-digit security PIN for this player' };
      }
      const comp = formatCompetitorIdentity({ ...data, id: matchDoc.id });
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { pin, ...publicData } = data;
      const player: PublicLeaderboardPlayer = {
        ...publicData,
        id: data.id || matchDoc.id,
        username: comp.username,
        discriminator: comp.discriminator,
        tag: comp.formattedTag,
      };
      recordCompetitorInteraction(player);
      return { success: true, player };
    }
  } catch {
    // Continue to offline verification
  }

  // 2. Offline lookup: check local device profile & verified competitor roster
  const local = getLocalDeviceProfile();
  const comp = formatCompetitorIdentity({
    username: cleanId.includes('#') ? cleanId.split('#')[0].trim() : cleanId,
    discriminator: cleanId.includes('#') ? cleanId.split('#')[1].trim() : '',
  });

  // Check if it's the host player profile
  if (
    local &&
    (local.username.toLowerCase() === comp.username.toLowerCase() || local.id === cleanId)
  ) {
    if (local.pin && local.pin.trim() !== cleanPin) {
      return { success: false, error: 'Incorrect 4-digit security PIN for this player' };
    }
    const hostPlayer: PublicLeaderboardPlayer = {
      id: local.id,
      username: local.username,
      discriminator: local.discriminator,
      tag: local.tag,
      name: local.tag || local.username,
      email: local.email || '',
      color: local.color,
      rating: local.rating,
      wins: local.wins,
      losses: local.losses,
      draws: local.draws,
      totalMatches: local.totalMatches,
      totalPoints: local.totalPoints,
      highestBreak: local.highestBreak,
      updatedAt: local.updatedAt,
    };
    return { success: true, player: hostPlayer };
  }

  // Check Verified Competitor Roster
  const roster = getVerifiedRoster() as (PublicLeaderboardPlayer & { pin?: string })[];
  const rosterMatch = roster.find((p) => {
    const pComp = formatCompetitorIdentity(p);
    if (cleanId.includes('#') && comp.discriminator) {
      return (
        pComp.username.toLowerCase() === comp.username.toLowerCase() &&
        pComp.discriminator === comp.discriminator
      );
    }
    return (
      pComp.username.toLowerCase() === comp.username.toLowerCase() ||
      p.id === cleanId ||
      p.tag?.toLowerCase() === cleanId.toLowerCase()
    );
  });

  if (rosterMatch) {
    if (rosterMatch.pin && rosterMatch.pin.trim() !== cleanPin) {
      return {
        success: false,
        error: `Incorrect 4-digit PIN for ${rosterMatch.username} #${rosterMatch.discriminator}. Verification failed.`,
      };
    }
    recordCompetitorInteraction(rosterMatch);
    return { success: true, player: rosterMatch };
  }

  // If not found in local roster and offline:
  return {
    success: false,
    error: `Cannot verify "${cleanId}" offline. This player is not in your verified roster. Connect to the internet to verify new players or select from Roster.`,
  };
}

export interface RankedSyncProgressUpdate {
  stage: 'fetching' | 'calculating' | 'connecting' | 'pushing' | 'complete' | 'offline_queuing';
  percent: number;
  label: string;
  detail: string;
}

export interface SubmitRankedMatchResult {
  success: boolean;
  offlineQueued: boolean;
  eloResult?: MatchEloResult;
  error?: unknown;
}

// 4. Submit Ranked Match to Firestore & Update Player Ratings via Smart ELO Engine
export async function submitRankedMatch(
  session: GameSession,
  onProgress?: (update: RankedSyncProgressUpdate) => void
): Promise<SubmitRankedMatchResult> {
  if (session.mode !== 'ranked') {
    return { success: true, offlineQueued: false };
  }

  onProgress?.({
    stage: 'fetching',
    percent: 18,
    label: 'FETCHING STANDINGS & PROFILES',
    detail: 'Retrieving latest player ratings & records...',
  });

  // A. Gather competitor profile context for each participant
  const local = getLocalDeviceProfile();
  const roster = getVerifiedRoster();
  const profilesMap: Record<string, Partial<RankedPlayerProfile | PublicLeaderboardPlayer>> = {};

  for (const p of session.players) {
    const comp = formatCompetitorIdentity(p);
    let found: Partial<RankedPlayerProfile | PublicLeaderboardPlayer> | null = null;

    if (
      local &&
      (local.id === p.id ||
        (local.username.toLowerCase() === comp.username.toLowerCase() &&
          local.discriminator === comp.discriminator))
    ) {
      found = local;
    }

    if (!found) {
      const matchRoster = roster.find((cand) => {
        const rComp = formatCompetitorIdentity(cand);
        return (
          cand.id === p.id ||
          (rComp.username.toLowerCase() === comp.username.toLowerCase() &&
            rComp.discriminator === comp.discriminator)
        );
      });
      if (matchRoster) found = matchRoster;
    }

    // Try live Firestore profile if online
    try {
      const playerSnap = await getDoc(doc(db, 'players', p.id));
      if (playerSnap.exists()) {
        found = { ...playerSnap.data(), id: playerSnap.id } as RankedPlayerProfile;
      }
    } catch {
      // Offline fallback: keep local/roster or default
    }

    profilesMap[p.id] = found || {
      id: p.id,
      rating: typeof p.rating === 'number' ? p.rating : 100,
      totalMatches: 0,
      totalPoints: 0,
      highestBreak: 0,
    };
  }

  onProgress?.({
    stage: 'calculating',
    percent: 45,
    label: 'COMPUTING SMART ELO & METRICS',
    detail: 'Evaluating victory margin, PPG efficiency, breaks & clean play...',
  });

  // B. Run Smart ELO Engine with Points-per-game efficiency and break metrics
  const eloResult = calculateSmartMatchElo(session, profilesMap);

  // C. Enrich session players with computed ELO deltas, ranks, and event metrics
  const enrichedPlayers = session.players.map((p) => {
    const calc = eloResult.players[p.id];
    return {
      id: p.id,
      name: p.name,
      score: p.score,
      color: p.color,
      avatarBg: p.avatarBg,
      username: p.username,
      discriminator: p.discriminator,
      rank: calc?.rank || 1,
      ratingBefore: calc?.ratingBefore || 100,
      ratingAfter: calc?.ratingAfter || 100,
      ratingDelta: calc?.ratingDelta || 0,
      shotsCount: calc?.metrics.shotsCount || 0,
      foulsCount: calc?.metrics.foulsCount || 0,
      highestBreak: calc?.metrics.highestTurnBreak || 0,
      scoringEfficiency: calc?.metrics.scoringEfficiency || 0,
      ppg: calc?.careerPPG || 0,
    };
  });

  const payload = {
    matchId: session.id,
    mode: 'ranked',
    players: enrichedPlayers,
    winnerId: eloResult.summary.winnerId,
    winnerName: eloResult.summary.winnerName,
    isDraw: eloResult.summary.isDraw,
    maxScore: Math.max(...session.players.map((p) => p.score)),
    highestBreakInMatch: eloResult.summary.highestBreakInMatch,
    highestBreakerName: eloResult.summary.highestBreakerName,
    eloCalculations: eloResult.players,
    history: session.history || [],
    historyLength: session.history?.length || 0,
    createdAt: session.createdAt,
    endedAt: Date.now(),
  };

  try {
    onProgress?.({
      stage: 'connecting',
      percent: 70,
      label: 'CONNECTING TO RANKED DATABASE',
      detail: 'Establishing secure link to competitive server...',
    });

    await ensureAnonymousAuth();

    onProgress?.({
      stage: 'pushing',
      percent: 88,
      label: 'PUSHING VERIFIED RESULTS & STANDINGS',
      detail: 'Updating official standings and competitor records...',
    });

    const matchRef = doc(db, 'ranked_matches', session.id);
    await setDoc(matchRef, payload);

    // Update each player doc in Firestore with their new rating and career stats
    for (const p of session.players) {
      const calc = eloResult.players[p.id];
      if (!calc) continue;

      const competitor = formatCompetitorIdentity(p);
      const playerRef = doc(db, 'players', p.id);

      await setDoc(
        playerRef,
        {
          id: p.id,
          username: competitor.username,
          username_lower: competitor.username.toLowerCase(),
          discriminator: competitor.discriminator,
          tag: competitor.formattedTag,
          name: competitor.formattedTag,
          color: p.color,
          avatarBg: p.color,
          rating: calc.ratingAfter,
          totalMatches: calc.careerMatchesAfter,
          wins: increment(calc.isWinner ? 1 : 0),
          losses: increment(!calc.isDraw && !calc.isWinner ? 1 : 0),
          draws: increment(calc.isDraw ? 1 : 0),
          totalPoints: calc.careerPointsAfter,
          highestBreak: calc.careerHighestBreakAfter,
          pointsPerGame: calc.careerPPG,
          totalEventsLogged: increment(calc.metrics.shotsCount + calc.metrics.foulsCount),
          updatedAt: Date.now(),
        },
        { merge: true }
      );

      // Sync local device profile if host was in the game
      if (
        local &&
        (local.id === p.id ||
          (local.username.toLowerCase() === competitor.username.toLowerCase() &&
            local.discriminator === competitor.discriminator))
      ) {
        saveLocalDeviceProfile({
          ...local,
          rating: calc.ratingAfter,
          totalMatches: calc.careerMatchesAfter,
          totalPoints: calc.careerPointsAfter,
          highestBreak: calc.careerHighestBreakAfter,
          pointsPerGame: calc.careerPPG,
          wins: local.wins + (calc.isWinner ? 1 : 0),
          losses: local.losses + (!calc.isDraw && !calc.isWinner ? 1 : 0),
          draws: local.draws + (calc.isDraw ? 1 : 0),
          totalEventsLogged: (local.totalEventsLogged || 0) + (calc.metrics.shotsCount + calc.metrics.foulsCount),
          updatedAt: Date.now(),
        });
      }

      // Sync roster entry if opponent was in roster
      const rosterIdx = roster.findIndex((r) => {
        const rComp = formatCompetitorIdentity(r);
        return (
          r.id === p.id ||
          (rComp.username.toLowerCase() === competitor.username.toLowerCase() &&
            rComp.discriminator === competitor.discriminator)
        );
      });
      if (rosterIdx !== -1) {
        roster[rosterIdx] = {
          ...roster[rosterIdx],
          rating: calc.ratingAfter,
          totalMatches: calc.careerMatchesAfter,
          totalPoints: calc.careerPointsAfter,
          highestBreak: calc.careerHighestBreakAfter,
          pointsPerGame: calc.careerPPG,
          wins: (roster[rosterIdx].wins || 0) + (calc.isWinner ? 1 : 0),
          losses: (roster[rosterIdx].losses || 0) + (!calc.isDraw && !calc.isWinner ? 1 : 0),
          draws: (roster[rosterIdx].draws || 0) + (calc.isDraw ? 1 : 0),
          totalEventsLogged: (roster[rosterIdx].totalEventsLogged || 0) + (calc.metrics.shotsCount + calc.metrics.foulsCount),
          updatedAt: Date.now(),
        };
      }
    }

    if (roster.length > 0) {
      localStorage.setItem(VERIFIED_ROSTER_KEY, JSON.stringify(roster));
    }

    // Immediately update local tournament standings cache
    updateCachedLeaderboardAfterMatch(eloResult);

    onProgress?.({
      stage: 'complete',
      percent: 100,
      label: 'STANDINGS UPDATED & SECURED',
      detail: 'All competitor records synchronized successfully!',
    });

    return { success: true, offlineQueued: false, eloResult };
  } catch (err) {
    console.warn('[RankedSync] Network error while uploading ranked match. Storing in offline sync queue:', err);
    queuePendingRankedSync(session);
    onProgress?.({
      stage: 'offline_queuing',
      percent: 100,
      label: 'SAVED TO OFFLINE QUEUE',
      detail: 'Match stored safely on device — will auto-sync to tournament server once connected.',
    });
    return { success: true, offlineQueued: true, eloResult, error: err };
  }
}

/**
 * Synchronizes the locally cached tournament leaderboard immediately after a ranked match.
 * Keeps standings instantly fresh on the device without waiting for network re-fetch.
 */
function updateCachedLeaderboardAfterMatch(eloResult: MatchEloResult): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(CACHED_LEADERBOARD_KEY);
    const list: PublicLeaderboardPlayer[] = raw ? JSON.parse(raw) : [];

    for (const [playerId, calc] of Object.entries(eloResult.players)) {
      const idx = list.findIndex((p) => p.id === playerId || p.username.toLowerCase() === calc.playerName.toLowerCase());
      if (idx !== -1) {
        list[idx] = {
          ...list[idx],
          rating: calc.ratingAfter,
          totalMatches: calc.careerMatchesAfter,
          totalPoints: calc.careerPointsAfter,
          pointsPerGame: calc.careerPPG,
          highestBreak: Math.max(list[idx].highestBreak || 0, calc.metrics.highestTurnBreak),
          wins: (list[idx].wins || 0) + (calc.isWinner ? 1 : 0),
          losses: (list[idx].losses || 0) + (!calc.isDraw && !calc.isWinner ? 1 : 0),
          draws: (list[idx].draws || 0) + (calc.isDraw ? 1 : 0),
          updatedAt: Date.now(),
        };
      } else {
        const comp = formatCompetitorIdentity({ id: playerId, name: calc.playerName });
        list.push({
          id: playerId,
          username: comp.username,
          discriminator: comp.discriminator,
          tag: comp.formattedTag,
          name: comp.formattedTag,
          email: '',
          totalMatches: calc.careerMatchesAfter,
          wins: calc.isWinner ? 1 : 0,
          losses: !calc.isDraw && !calc.isWinner ? 1 : 0,
          draws: calc.isDraw ? 1 : 0,
          totalPoints: calc.careerPointsAfter,
          highestBreak: calc.careerHighestBreakAfter,
          rating: calc.ratingAfter,
          pointsPerGame: calc.careerPPG,
          updatedAt: Date.now(),
        });
      }
    }

    const sortedStandings = sortTournamentStandings(list);
    localStorage.setItem(CACHED_LEADERBOARD_KEY, JSON.stringify(sortedStandings));
    recordTournamentCheckTime();
  } catch (err) {
    console.warn('[RankedSync] Failed to update local leaderboard cache:', err);
  }
}

/**
 * Records casual match metrics for players with profiles (host device profile & roster competitors).
 * Captures shot events, fouls, scoring runs, and updates casual career counters and personal best breaks.
 */
export function recordCasualMatchForProfiles(session: GameSession): void {
  if (typeof window === 'undefined') return;
  try {
    const metricsMap = extractPlayerMatchMetrics(session);
    const local = getLocalDeviceProfile();
    const roster = getVerifiedRoster();
    let rosterChanged = false;

    for (const p of session.players) {
      const metrics = metricsMap[p.id] || {
        playerId: p.id,
        playerName: p.name,
        finalScore: p.score,
        shotsCount: 0,
        foulsCount: 0,
        foulPointsLost: 0,
        highestSingleShot: Math.max(0, p.score),
        highestTurnBreak: Math.max(0, p.score),
        scoringEfficiency: 0,
        isCleanPlay: true,
      };
      const comp = formatCompetitorIdentity(p);

      // 1. Check local host profile
      if (
        local &&
        (local.id === p.id ||
          (local.username.toLowerCase() === comp.username.toLowerCase() &&
            local.discriminator === comp.discriminator))
      ) {
        const casualMatches = (local.casualMatches || 0) + 1;
        const casualPoints = (local.casualPoints || 0) + Math.max(0, p.score);
        const casualHighestBreak = Math.max(local.casualHighestBreak || 0, metrics.highestTurnBreak);
        const allTimeHighestBreak = Math.max(local.highestBreak || 0, metrics.highestTurnBreak);
        const totalEventsLogged = (local.totalEventsLogged || 0) + (metrics.shotsCount + metrics.foulsCount);

        const updatedLocal: RankedPlayerProfile = {
          ...local,
          casualMatches,
          casualPoints,
          casualHighestBreak,
          highestBreak: allTimeHighestBreak,
          totalEventsLogged,
          updatedAt: Date.now(),
        };
        saveLocalDeviceProfile(updatedLocal);
      }

      // 2. Check verified roster
      const rosterIdx = roster.findIndex((r) => {
        const rComp = formatCompetitorIdentity(r);
        return (
          r.id === p.id ||
          (rComp.username.toLowerCase() === comp.username.toLowerCase() &&
            rComp.discriminator === comp.discriminator)
        );
      });

      if (rosterIdx !== -1) {
        const r = roster[rosterIdx];
        roster[rosterIdx] = {
          ...r,
          casualMatches: (r.casualMatches || 0) + 1,
          casualPoints: (r.casualPoints || 0) + Math.max(0, p.score),
          casualHighestBreak: Math.max(r.casualHighestBreak || 0, metrics.highestTurnBreak),
          highestBreak: Math.max(r.highestBreak || 0, metrics.highestTurnBreak),
          totalEventsLogged: (r.totalEventsLogged || 0) + (metrics.shotsCount + metrics.foulsCount),
          updatedAt: Date.now(),
        };
        rosterChanged = true;
      }
    }

    if (rosterChanged) {
      localStorage.setItem(VERIFIED_ROSTER_KEY, JSON.stringify(roster));
    }
  } catch (err) {
    console.warn('[RankedSync] Failed recording casual match for profiles:', err);
  }
}

// 5. Offline Queueing & Automatic Sync
function queuePendingRankedSync(session: GameSession): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(PENDING_SYNC_KEY);
    const queue = raw ? (JSON.parse(raw) as GameSession[]) : [];
    if (!queue.some((s) => s.id === session.id)) {
      queue.push(session);
      localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(queue));
    }
  } catch (err) {
    console.error('Failed to queue pending ranked sync:', err);
  }
}

export async function flushPendingRankedSync(): Promise<number> {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = localStorage.getItem(PENDING_SYNC_KEY);
    if (!raw) return 0;
    const queue = JSON.parse(raw) as GameSession[];
    if (queue.length === 0) return 0;

    let syncedCount = 0;
    const remaining: GameSession[] = [];

    for (const session of queue) {
      const res = await submitRankedMatch(session);
      if (res.success && !res.offlineQueued) {
        syncedCount++;
      } else {
        remaining.push(session);
      }
    }

    localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(remaining));
    return syncedCount;
  } catch (err) {
    console.error('Failed to flush pending ranked sync:', err);
    return 0;
  }
}

export function getPendingRankedSyncCount(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = localStorage.getItem(PENDING_SYNC_KEY);
    if (!raw) return 0;
    const queue = JSON.parse(raw);
    return Array.isArray(queue) ? queue.length : 0;
  } catch {
    return 0;
  }
}

/**
 * Global background listener that monitors device connectivity (window.online + document.visibilitychange)
 * and automatically flushes any queued offline ranked matches when internet becomes available.
 */
export function startOfflineRankedSyncListener(
  onSyncSuccess?: (syncedCount: number) => void
): () => void {
  if (typeof window === 'undefined') return () => {};

  let isFlushing = false;

  const checkAndFlush = async () => {
    if (isFlushing) return;
    try {
      const count = getPendingRankedSyncCount();
      if (count === 0) return;

      const health = await checkRealInternetConnectivity();
      if (health.hasInternet) {
        isFlushing = true;
        const synced = await flushPendingRankedSync();
        if (synced > 0 && onSyncSuccess) {
          onSyncSuccess(synced);
        }
      }
    } catch (e) {
      console.warn('[RankedSync] Background flush check failed:', e);
    } finally {
      isFlushing = false;
    }
  };

  const handleOnline = () => {
    checkAndFlush();
  };

  const handleVisibility = () => {
    if (document.visibilityState === 'visible') {
      checkAndFlush();
    }
  };

  window.addEventListener('online', handleOnline);
  document.addEventListener('visibilitychange', handleVisibility);

  // Check immediately upon initialization
  checkAndFlush();

  return () => {
    window.removeEventListener('online', handleOnline);
    document.removeEventListener('visibilitychange', handleVisibility);
  };
}

// 6. Online Leaderboard Query
export async function getOnlineLeaderboard(limitCount = 50): Promise<PublicLeaderboardPlayer[]> {
  try {
    const playersRef = collection(db, 'players');
    const q = query(playersRef, orderBy('rating', 'desc'), limit(limitCount));
    const snapshot = await getDocs(q);

    const leaderboard: PublicLeaderboardPlayer[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as RankedPlayerProfile;
      if (isBannedTestPlayer(data.username, docSnap.id) || isBannedTestPlayer(data.tag, docSnap.id) || isBannedTestPlayer(data.name, docSnap.id)) {
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { pin, ...publicData } = data;
      const comp = formatCompetitorIdentity({ ...publicData, id: publicData.id || docSnap.id });
      leaderboard.push({
        ...publicData,
        id: publicData.id || docSnap.id,
        username: comp.username,
        discriminator: comp.discriminator,
        tag: comp.formattedTag,
        name: publicData.name || comp.formattedTag,
      });
    });

    if (leaderboard.length > 0 && typeof window !== 'undefined') {
      localStorage.setItem(CACHED_LEADERBOARD_KEY, JSON.stringify(leaderboard));
      recordTournamentCheckTime();
    }

    return leaderboard;
  } catch (err) {
    console.warn('[RankedSync] Failed to fetch online leaderboard, using local cache:', err);
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(CACHED_LEADERBOARD_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as PublicLeaderboardPlayer[];
        return parsed
          .filter((p) => {
            const u = p.username || p.name || p.tag || '';
            return !isBannedTestPlayer(u, p.id);
          })
          .map((p) => {
            const comp = formatCompetitorIdentity(p);
            return {
              ...p,
              username: comp.username,
              discriminator: comp.discriminator,
              tag: comp.formattedTag,
              name: p.name || comp.formattedTag,
            };
          });
      }
    }
    return [];
  }
}

// 7. Get Player Rank Position from Database
export async function getPlayerRankPosition(
  playerId: string,
  rating = 100,
  username?: string,
  discriminator?: string
): Promise<number> {
  try {
    const playersRef = collection(db, 'players');
    // Fetch top 100 players ordered by rating desc
    const q = query(playersRef, orderBy('rating', 'desc'), limit(100));
    const snapshot = await getDocs(q);

    let rankIndex = -1;
    let index = 0;
    snapshot.forEach((docSnap) => {
      index++;
      const data = docSnap.data();
      const isMatch =
        docSnap.id === playerId ||
        data.id === playerId ||
        (username && data.username === username && discriminator && data.discriminator === discriminator);
      if (isMatch && rankIndex === -1) {
        rankIndex = index;
      }
    });

    if (rankIndex !== -1) {
      return rankIndex;
    }

    // If not found in top 100 docs, count players strictly above rating
    try {
      const countQuery = query(playersRef, where('rating', '>', rating));
      const countSnap = await getCountFromServer(countQuery);
      return countSnap.data().count + 1;
    } catch {
      return snapshot.size > 0 ? snapshot.size + 1 : 1;
    }
  } catch (err) {
    console.warn('[RankedSync] Failed to calculate rank position from database:', err);
    // Check cached leaderboard if offline
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(CACHED_LEADERBOARD_KEY);
      if (cached) {
        try {
          const list = JSON.parse(cached) as PublicLeaderboardPlayer[];
          const idx = list.findIndex(
            (p) =>
              p.id === playerId ||
              (username && p.username === username && discriminator && p.discriminator === discriminator)
          );
          if (idx !== -1) return idx + 1;
        } catch {
          // ignore
        }
      }
    }
    return 1;
  }
}

// 8. Query All Ranked Matches for a Specific Competitor
export interface RankedMatchLogItem {
  id: string;
  createdAt: number;
  players: {
    id: string;
    name: string;
    score: number;
    color?: string;
  }[];
  winnerId: string | null;
  winnerName: string;
  isDraw: boolean;
  myScore: number;
  myResult: 'win' | 'loss' | 'draw';
  ratingDelta: number;
  opponents: {
    id: string;
    name: string;
    score: number;
    color?: string;
  }[];
  events: Transaction[];
}

export async function getPlayerRankedMatches(
  playerId: string,
  username?: string,
  discriminator?: string
): Promise<RankedMatchLogItem[]> {
  const matchesMap = new Map<string, RankedMatchLogItem>();

  const matchesUser = (p: { id: string; name?: string; username?: string }) => {
    if (p.id === playerId) return true;
    if (username && p.name && p.name.toLowerCase().includes(username.toLowerCase())) {
      if (discriminator) {
        return p.name.includes(discriminator);
      }
      return true;
    }
    return false;
  };

  // 1. Scan local match history
  if (typeof window !== 'undefined') {
    try {
      const localHistory = getGameHistory();
      for (const session of localHistory) {
        if (session.mode === 'ranked') {
          const userParticipant = session.players.find(matchesUser);
          if (userParticipant) {
            const sorted = [...session.players].sort((a, b) => b.score - a.score);
            const isDraw = sorted.length > 1 && sorted[0].score === sorted[1].score;
            const winner = isDraw ? null : sorted[0];
            const isWinner = winner && winner.id === userParticipant.id;
            const myResult: 'win' | 'loss' | 'draw' = isDraw ? 'draw' : isWinner ? 'win' : 'loss';
            const calcMap = (session as unknown as { eloCalculations?: Record<string, { ratingDelta: number }> }).eloCalculations;
            const userWithDelta = userParticipant as unknown as { ratingDelta?: number };
            const ratingDelta =
              typeof userWithDelta.ratingDelta === 'number'
                ? userWithDelta.ratingDelta
                : calcMap && typeof calcMap[userParticipant.id]?.ratingDelta === 'number'
                ? calcMap[userParticipant.id].ratingDelta
                : isDraw ? 5 : isWinner ? 25 : -15;

            matchesMap.set(session.id, {
              id: session.id,
              createdAt: session.createdAt || session.updatedAt || Date.now(),
              players: session.players,
              winnerId: winner ? winner.id : null,
              winnerName: winner ? winner.name : 'Tie',
              isDraw,
              myScore: userParticipant.score,
              myResult,
              ratingDelta,
              opponents: session.players.filter((p) => p.id !== userParticipant.id),
              events: session.history || [],
            });
          }
        }
      }
    } catch (err) {
      console.warn('[RankedSync] Failed reading local ranked history:', err);
    }
  }

  // 2. Query Firestore ranked_matches
  try {
    const matchesRef = collection(db, 'ranked_matches');
    const q = query(matchesRef, orderBy('createdAt', 'desc'), limit(50));
    const snap = await getDocs(q);
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      const playersList = (data.players || []) as {
        id: string;
        name: string;
        score: number;
        color?: string;
        ratingDelta?: number;
      }[];
      const userParticipant = playersList.find(matchesUser);
      if (userParticipant) {
        const isWinner = data.winnerId === userParticipant.id;
        const isDraw = Boolean(data.isDraw);
        const myResult: 'win' | 'loss' | 'draw' = isDraw ? 'draw' : isWinner ? 'win' : 'loss';
        const calcMap = data.eloCalculations as Record<string, { ratingDelta: number }> | undefined;
        const ratingDelta =
          typeof userParticipant.ratingDelta === 'number'
            ? userParticipant.ratingDelta
            : calcMap && typeof calcMap[userParticipant.id]?.ratingDelta === 'number'
            ? calcMap[userParticipant.id].ratingDelta
            : isDraw ? 5 : isWinner ? 25 : -15;

        matchesMap.set(docSnap.id, {
          id: docSnap.id,
          createdAt: data.createdAt || Date.now(),
          players: playersList,
          winnerId: data.winnerId || null,
          winnerName: data.winnerName || 'Tie',
          isDraw,
          myScore: userParticipant.score,
          myResult,
          ratingDelta,
          opponents: playersList.filter((p) => p.id !== userParticipant.id),
          events: (data.history || []) as Transaction[],
        });
      }
    });
  } catch (err) {
    console.warn('[RankedSync] Failed querying online ranked matches:', err);
  }

  const result = Array.from(matchesMap.values());
  result.sort((a, b) => b.createdAt - a.createdAt);
  return result;
}

// 9. Verified Competitor Roster (Cached Footprints for Offline Verification)
export const VERIFIED_ROSTER_KEY = 'billiard_verified_competitor_roster_v1';

export function getVerifiedRoster(): PublicLeaderboardPlayer[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(VERIFIED_ROSTER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PublicLeaderboardPlayer[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((p) => {
        const u = p.username || p.name || p.tag || '';
        return !isBannedTestPlayer(u, p.id);
      })
      .map((p) => {
        const comp = formatCompetitorIdentity(p);
        return {
          ...p,
          username: comp.username,
          discriminator: comp.discriminator,
          tag: comp.formattedTag,
          name: p.name || comp.formattedTag,
        };
      });
  } catch (err) {
    console.warn('[RankedSync] Failed loading verified roster:', err);
    return [];
  }
}

export function isPlayerInRoster(player: {
  id?: string;
  username?: string;
  discriminator?: string;
  tag?: string;
}): boolean {
  if (typeof window === 'undefined') return false;
  const roster = getVerifiedRoster();
  const comp = formatCompetitorIdentity(player);
  return roster.some((p) => {
    const pComp = formatCompetitorIdentity(p);
    return (
      (player.id && p.id === player.id) ||
      (pComp.username.toLowerCase() === comp.username.toLowerCase() &&
        pComp.discriminator === comp.discriminator)
    );
  });
}

export function addPlayerToRoster(
  player: PublicLeaderboardPlayer | RankedPlayerProfile
): { success: boolean; message?: string } {
  if (typeof window === 'undefined') return { success: false, message: 'Window unavailable' };
  try {
    const comp = formatCompetitorIdentity(player);
    const local = getLocalDeviceProfile();

    // Prevent adding self
    if (
      local &&
      local.username.toLowerCase() === comp.username.toLowerCase() &&
      local.discriminator === comp.discriminator
    ) {
      return {
        success: false,
        message: 'You cannot add your own profile to your opponent roster',
      };
    }

    if (isPlayerInRoster(player)) {
      return {
        success: false,
        message: `${comp.formattedTag} is already in your verified roster`,
      };
    }

    const roster = getVerifiedRoster() as (PublicLeaderboardPlayer & { pin?: string })[];
    const playerWithPin = player as RankedPlayerProfile;
    const cleanPlayer: PublicLeaderboardPlayer & { pin?: string } = {
      ...player,
      pin: playerWithPin.pin ? playerWithPin.pin.trim() : undefined,
      id: player.id || `roster_${comp.username}_${comp.discriminator}`,
      username: comp.username,
      discriminator: comp.discriminator,
      tag: comp.formattedTag,
      name: player.name || comp.formattedTag,
      color: player.color || '#6366F1',
      rating: player.rating || 100,
      totalMatches: player.totalMatches || 0,
      wins: player.wins || 0,
      losses: player.losses || 0,
      draws: player.draws || 0,
      totalPoints: player.totalPoints || 0,
      highestBreak: player.highestBreak || 0,
      updatedAt: Date.now(),
    };

    roster.unshift(cleanPlayer);
    localStorage.setItem(VERIFIED_ROSTER_KEY, JSON.stringify(roster));
    return { success: true };
  } catch (err) {
    console.error('Failed to add player to roster:', err);
    return { success: false, message: 'Failed to save player to roster' };
  }
}

export function removePlayerFromRoster(playerIdOrTag: string): void {
  if (typeof window === 'undefined') return;
  try {
    const roster = getVerifiedRoster();
    const filtered = roster.filter((p) => {
      const comp = formatCompetitorIdentity(p);
      return p.id !== playerIdOrTag && comp.formattedTag !== playerIdOrTag;
    });
    localStorage.setItem(VERIFIED_ROSTER_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.error('Failed to remove player from roster:', err);
  }
}
