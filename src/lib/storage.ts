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

export function saveGameToHistory(session: GameSession): void {
  if (typeof window === 'undefined') return;
  try {
    const history = getGameHistory();
    const filtered = history.filter(g => g.id !== session.id);
    filtered.unshift({ ...session, status: 'ended', updatedAt: Date.now() });
    localStorage.setItem(HISTORY_KEY, JSON.stringify(filtered.slice(0, 20))); // Keep last 20 games
  } catch (err) {
    console.error('Failed to save game to history:', err);
  }
}

export function getGameHistory(): GameSession[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as GameSession[];
  } catch (err) {
    console.error('Failed to load game history:', err);
    return [];
  }
}
