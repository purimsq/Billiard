export type TableFeltTheme = 'classic' | 'green' | 'navy' | 'dark';

export interface AppSettings {
  darkMode: boolean;
  feltTheme: TableFeltTheme;
  underworldDialogue: boolean; // default false (OFF)
  keepScreenAwake: boolean; // default false
  hotHandStreaks: boolean; // default true (On Fire flames)
  showLeaderCrown: boolean; // default true (👑 for #1)
}
