import { GameSession } from '@/types/game';

const ACTIVE_GAME_KEY = 'billard_active_game_session_v1';
const HISTORY_KEY = 'billard_game_history_v1';

export function saveActiveGame(session: GameSession): void {
  if (typeof window === 'undefined') return;
  try {
    const updated = { ...session, updatedAt: Date.now() };
    localStorage.setItem(ACTIVE_GAME_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to save active game state to localStorage:', err);
  }
}

export function getActiveGame(): GameSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(ACTIVE_GAME_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GameSession;
  } catch (err) {
    console.error('Failed to parse active game state:', err);
    return null;
  }
}

export function clearActiveGame(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(ACTIVE_GAME_KEY);
  } catch (err) {
    console.error('Failed to clear active game:', err);
  }
}

export const CASUAL_HISTORY_LIMIT_KEY = 'billiard_casual_history_limit_v1';
export const DEFAULT_CASUAL_HISTORY_LIMIT = 20;
export const MIN_CASUAL_HISTORY_LIMIT = 10;
export const MAX_CASUAL_HISTORY_LIMIT = 50;

/**
 * Returns the maximum number of casual matches retained on device.
 * Default is 20, configurable up to 50.
 */
export function getCasualHistoryLimit(): number {
  if (typeof window === 'undefined') return DEFAULT_CASUAL_HISTORY_LIMIT;
  try {
    const raw = localStorage.getItem(CASUAL_HISTORY_LIMIT_KEY);
    if (!raw) return DEFAULT_CASUAL_HISTORY_LIMIT;
    const parsed = parseInt(raw, 10);
    if (isNaN(parsed) || parsed < MIN_CASUAL_HISTORY_LIMIT) return DEFAULT_CASUAL_HISTORY_LIMIT;
    return Math.min(parsed, MAX_CASUAL_HISTORY_LIMIT);
  } catch {
    return DEFAULT_CASUAL_HISTORY_LIMIT;
  }
}

/**
 * Sets the casual match retention limit. Prunes excess records if reduced.
 */
export function setCasualHistoryLimit(limit: number): void {
  if (typeof window === 'undefined') return;
  try {
    const clamped = Math.max(MIN_CASUAL_HISTORY_LIMIT, Math.min(limit, MAX_CASUAL_HISTORY_LIMIT));
    localStorage.setItem(CASUAL_HISTORY_LIMIT_KEY, String(clamped));
    pruneCasualHistoryToLimit(clamped);
  } catch (err) {
    console.error('Failed to set casual history limit:', err);
  }
}

/**
 * Prunes casual games exceeding the specified limit (FIFO: oldest deleted first).
 */
export function pruneCasualHistoryToLimit(limit: number): number {
  if (typeof window === 'undefined') return 0;
  try {
    const history = getGameHistory();
    const casualGames = history.filter(g => (g.mode || 'casual') === 'casual');
    const rankedGames = history.filter(g => g.mode === 'ranked');

    if (casualGames.length > limit) {
      const prunedCount = casualGames.length - limit;
      const retainedCasual = casualGames.slice(0, limit);
      localStorage.setItem(HISTORY_KEY, JSON.stringify([...retainedCasual, ...rankedGames]));
      return prunedCount;
    }
    return 0;
  } catch (err) {
    console.error('Failed to prune casual history:', err);
    return 0;
  }
}

export function saveGameToHistory(session: GameSession): void {
  if (typeof window === 'undefined') return;
  try {
    const history = getGameHistory();
    const mode = session.mode || 'casual';
    const updatedGame: GameSession = {
      ...session,
      mode,
      status: 'ended',
      updatedAt: Date.now(),
    };

    if (mode === 'casual') {
      const limit = getCasualHistoryLimit();
      const existingCasual = history.filter(
        g => (g.mode || 'casual') === 'casual' && g.id !== session.id
      );
      const rankedGames = history.filter(g => g.mode === 'ranked');

      // Prepend newest game
      const combinedCasual = [updatedGame, ...existingCasual];
      // FIFO eviction: retain up to limit, oldest games beyond limit are permanently purged
      const trimmedCasual = combinedCasual.slice(0, limit);

      localStorage.setItem(HISTORY_KEY, JSON.stringify([...trimmedCasual, ...rankedGames]));
    } else {
      // Ranked match
      const existingRanked = history.filter(
        g => g.mode === 'ranked' && g.id !== session.id
      );
      const casualGames = history.filter(g => (g.mode || 'casual') === 'casual');
      localStorage.setItem(HISTORY_KEY, JSON.stringify([updatedGame, ...existingRanked, ...casualGames]));
    }
  } catch (err) {
    console.error('Failed to save game to history:', err);
  }
}

export function getGameHistory(): GameSession[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) {
      return [];
    }
    const list = JSON.parse(raw) as GameSession[];
    if (!Array.isArray(list)) return [];

    // Automatically purge legacy sample matches (IDs starting with 'sample_')
    const genuineGames = list.filter((item) => !item.id.startsWith('sample_'));
    if (genuineGames.length !== list.length) {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(genuineGames));
    }

    return genuineGames.map((item) => ({
      ...item,
      mode: item.mode || 'casual',
    }));
  } catch (err) {
    console.error('Failed to load game history:', err);
    return [];
  }
}

export function resetGameHistoryToSample(): GameSession[] {
  if (typeof window === 'undefined') return [];
  try {
    localStorage.removeItem(HISTORY_KEY);
    return [];
  } catch (err) {
    console.error('Failed to clear game history:', err);
    return [];
  }
}

export function deleteGameFromHistory(gameId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const history = getGameHistory();
    const filtered = history.filter(g => g.id !== gameId);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.error('Failed to delete game from history:', err);
  }
}

export function clearGameHistory(mode?: 'casual' | 'ranked'): void {
  if (typeof window === 'undefined') return;
  try {
    if (!mode) {
      localStorage.removeItem(HISTORY_KEY);
    } else {
      const history = getGameHistory();
      const filtered = history.filter(g => g.mode !== mode);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(filtered));
    }
  } catch (err) {
    console.error('Failed to clear game history:', err);
  }
}
