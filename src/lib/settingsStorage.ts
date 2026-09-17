import { AppSettings } from '@/types/settings';

const SETTINGS_STORAGE_KEY = 'billiard_app_settings_v2';

export const DEFAULT_SETTINGS: AppSettings = {
  darkMode: false,
  feltTheme: 'classic',
  underworldDialogue: false, // OFF by default as instructed
  underworldSoundEffects: false, // OFF by default (child tree setting)
  keepScreenAwake: false,
  hotHandStreaks: true,
  showLeaderCrown: true,
};

export function getStoredSettings(): AppSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
    };
  } catch (err) {
    console.error('Failed to parse settings from storage:', err);
    return DEFAULT_SETTINGS;
  }
}

export function saveStoredSettings(settings: AppSettings): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error('Failed to save settings to storage:', err);
  }
}
