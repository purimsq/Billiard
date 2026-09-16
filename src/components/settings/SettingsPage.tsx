import React, { useState, useRef, useEffect, useSyncExternalStore } from 'react';
import {
  ArrowLeft,
  Check,
  Loader2,
  Smartphone,
  Share,
  MoreVertical,
  PlusSquare,
  Lock,
  Download,
  Info,
  Sparkles,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Wifi,
  WifiOff,
  Package,
  CheckCircle2,
  ArrowDownCircle,
} from 'lucide-react';
import { AppSettings } from '@/types/settings';
import {
  isStandaloneMode,
  detectPlatform,
  requestScreenWakeLock,
  releaseScreenWakeLock,
  MobilePlatform,
} from '@/lib/wakeLockManager';
import {
  subscribeNetworkHealth,
  getNetworkHealthSnapshot,
} from '@/lib/networkReachability';
import {
  getSystemUpdateSnapshot,
  subscribeSystemUpdate,
  runCheckForUpdates,
  applySystemUpdate,
  dismissAppliedBanner,
  RECENT_CHANGELOG,
  BUILD_DATE,
} from '@/lib/systemUpdateManager';

interface SettingsPageProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  onBack: () => void;
  returnToViewTitle?: string;
}

interface SettingToggleSwitchProps {
  checked: boolean;
  isLoading: boolean;
  disabled?: boolean;
  activeColor?: string;
  activeTextColor?: string;
  isDark: boolean;
}

const SettingToggleSwitch: React.FC<SettingToggleSwitchProps> = ({
  checked,
  isLoading,
  disabled = false,
  activeColor = 'bg-indigo-600',
  activeTextColor = 'text-indigo-600',
  isDark,
}) => {
  if (disabled) {
    return (
      <div
        className={`w-12 h-6 rounded-full transition-all relative flex items-center px-0.5 flex-shrink-0 cursor-not-allowed opacity-50 ${
          isDark ? 'bg-zinc-800' : 'bg-zinc-200'
        }`}
        title="Requires Add to Home Screen"
      >
        <div className="w-5 h-5 rounded-full bg-zinc-400 dark:bg-zinc-600 shadow-sm flex items-center justify-center">
          <Lock className="w-2.5 h-2.5 text-zinc-100 dark:text-zinc-300" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`w-12 h-6 rounded-full transition-all relative flex items-center px-0.5 flex-shrink-0 ${
        checked
          ? activeColor
          : isDark
          ? 'bg-zinc-700'
          : 'bg-zinc-300'
      } ${isLoading ? 'ring-2 ring-indigo-400/50 animate-pulse' : ''}`}
    >
      <div
        className={`w-5 h-5 rounded-full bg-white shadow-md flex items-center justify-center transform transition-transform duration-200 ${
          checked ? 'translate-x-6' : 'translate-x-0'
        }`}
      >
        {isLoading && (
          <Loader2
            className={`w-3 h-3 animate-spin ${
              checked ? activeTextColor : 'text-zinc-700'
            }`}
          />
        )}
      </div>
    </div>
  );
};

const emptySubscribe = () => () => {};

export const SettingsPage: React.FC<SettingsPageProps> = ({
  settings,
  onUpdateSettings,
  onBack,
  returnToViewTitle = 'Home',
}) => {
  const [loadingKey, setLoadingKey] = useState<keyof AppSettings | null>(null);

  const isStandalone = useSyncExternalStore(
    emptySubscribe,
    () => isStandaloneMode(),
    () => false
  );

  const platform = useSyncExternalStore(
    emptySubscribe,
    () => detectPlatform(),
    () => 'other' as MobilePlatform
  );

  const network = useSyncExternalStore(
    subscribeNetworkHealth,
    getNetworkHealthSnapshot,
    getNetworkHealthSnapshot
  );

  const updateState = useSyncExternalStore(
    subscribeSystemUpdate,
    getSystemUpdateSnapshot,
    getSystemUpdateSnapshot
  );

  const [isChangelogOpen, setIsChangelogOpen] = useState<boolean>(false);
  const [activeInstallTab, setActiveInstallTab] = useState<'ios' | 'android'>(() =>
    detectPlatform() === 'android' ? 'android' : 'ios'
  );
  const [highlightInstructions, setHighlightInstructions] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<any>(null);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const instructionsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Capture beforeinstallprompt event for Android 1-tap install if available
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredInstallPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleScrollToInstructions = (targetPlatform?: 'ios' | 'android') => {
    const chosen = targetPlatform || (platform === 'android' ? 'android' : 'ios');
    setActiveInstallTab(chosen);

    setToastMessage('Keep Screen Awake requires adding Billiard to your Home Screen.');
    setTimeout(() => setToastMessage(null), 4000);

    if (instructionsRef.current) {
      instructionsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setHighlightInstructions(true);
      setTimeout(() => setHighlightInstructions(false), 2500);
    }
  };

  const handleTriggerInstallPrompt = async () => {
    if (!deferredInstallPrompt) return;
    try {
      deferredInstallPrompt.prompt();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const choice = await (deferredInstallPrompt as any).userChoice;
      if (choice?.outcome === 'accepted') {
        setToastMessage('App install started! Open Billiard from your Home Screen.');
        setTimeout(() => setToastMessage(null), 5000);
      }
      setDeferredInstallPrompt(null);
    } catch (err) {
      console.error('Install prompt failed:', err);
    }
  };

  const handleToggle = (key: keyof AppSettings) => {
    if (loadingKey !== null) return;

    // Safety guard: keepScreenAwake is strictly only activatable in standalone mode
    if (key === 'keepScreenAwake' && !isStandalone) {
      handleScrollToInstructions();
      return;
    }

    setLoadingKey(key);

    timeoutRef.current = setTimeout(() => {
      const nextValue = !settings[key];
      const updated = {
        ...settings,
        [key]: nextValue,
      };
      onUpdateSettings(updated);
      setLoadingKey(null);

      // Connect directly to phone's Lock API when on Home Screen
      if (key === 'keepScreenAwake' && isStandalone) {
        if (nextValue) {
          requestScreenWakeLock();
        } else {
          releaseScreenWakeLock();
        }
      }
    }, 600);
  };

  const isDark = settings.darkMode;

  return (
    <div
      className={`w-full max-w-2xl mx-auto min-h-screen px-4 py-3 space-y-6 animate-fadeIn pb-12 ${
        isDark ? 'text-zinc-100' : 'text-zinc-900'
      }`}
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl bg-zinc-900/95 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-2xl border border-zinc-700/60 dark:border-zinc-300 text-xs font-extrabold flex items-center gap-2 animate-fadeIn max-w-[92vw]">
          <Info className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header matching app standard */}
      <div
        className={`flex items-center justify-between pb-2 border-b-2 ${
          isDark ? 'border-zinc-700' : 'border-zinc-900'
        }`}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            aria-label="Back"
            className={`p-1.5 -ml-1 rounded-full transition-all active:scale-90 flex items-center gap-1 ${
              isDark
                ? 'text-zinc-300 hover:text-white hover:bg-zinc-800'
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/70'
            }`}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1
            className={`text-xl sm:text-2xl font-black italic tracking-widest bg-clip-text text-transparent font-serif uppercase ${
              isDark
                ? 'bg-gradient-to-r from-red-500 via-blue-500 to-purple-400'
                : 'bg-gradient-to-r from-red-600 via-black to-purple-600'
            }`}
          >
            BILLIARD
          </h1>
        </div>

        <span
          className={`text-[10px] font-extrabold uppercase tracking-widest font-serif italic ${
            isDark ? 'text-zinc-400' : 'text-zinc-600'
          }`}
        >
          SETTINGS
        </span>
      </div>

      {/* Hero Title on the Page */}
      <div className="space-y-1">
        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 block">
          Preferences & Rules
        </span>
        <h2 className="text-2xl sm:text-3xl font-black tracking-tight uppercase font-serif">
          TABLE SETTINGS
        </h2>
        <p className={`text-xs font-medium ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
          Configure theme display, gameplay drama, screen wake lock, and table options.
        </p>
      </div>

      {/* SECTION 1: THEME & DISPLAY */}
      <div className="space-y-2">
        <h3
          className={`text-[11px] font-extrabold uppercase tracking-wider px-1 ${
            isDark ? 'text-zinc-400' : 'text-zinc-500'
          }`}
        >
          Theme & Display
        </h3>

        <div
          className={`rounded-3xl border shadow-sm divide-y overflow-hidden transition-colors ${
            isDark
              ? 'bg-zinc-900 border-zinc-800 divide-zinc-800'
              : 'bg-white border-zinc-200/90 divide-zinc-100'
          }`}
        >
          {/* Dark Mode */}
          <div
            onClick={() => handleToggle('darkMode')}
            className={`p-4 sm:p-5 flex items-center justify-between gap-4 transition ${
              loadingKey === 'darkMode' ? 'cursor-wait opacity-90' : 'cursor-pointer'
            } ${
              isDark ? 'hover:bg-zinc-800/60' : 'hover:bg-zinc-50/80'
            }`}
          >
            <div className="space-y-1 pr-2">
              <div className="flex items-center gap-2">
                <h4 className="font-extrabold text-sm sm:text-base leading-tight">
                  Dark Mode
                </h4>
                {loadingKey === 'darkMode' && (
                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider bg-indigo-500/20 text-indigo-500 animate-pulse flex items-center gap-1">
                    <Loader2 className="w-2.5 h-2.5 animate-spin" /> SAVING...
                  </span>
                )}
              </div>
              <p
                className={`text-xs font-medium leading-relaxed ${
                  isDark ? 'text-zinc-400' : 'text-zinc-500'
                }`}
              >
                Obsidian dark palette tailored for low-light pool hall environments.
              </p>
            </div>

            {/* Pill Switch */}
            <SettingToggleSwitch
              checked={isDark}
              isLoading={loadingKey === 'darkMode'}
              activeColor="bg-indigo-600"
              activeTextColor="text-indigo-600"
              isDark={isDark}
            />
          </div>

          {/* Keep Screen Awake - STRICTLY ONLY ACTIVATABLE WHEN ADDED TO HOME SCREEN */}
          <div
            onClick={() => {
              if (!isStandalone) {
                handleScrollToInstructions();
              } else {
                handleToggle('keepScreenAwake');
              }
            }}
            className={`p-4 sm:p-5 flex items-start justify-between gap-4 transition-all ${
              !isStandalone
                ? isDark
                  ? 'bg-zinc-900/40 hover:bg-zinc-900/70 cursor-pointer'
                  : 'bg-zinc-50/70 hover:bg-zinc-100/80 cursor-pointer'
                : loadingKey === 'keepScreenAwake'
                ? 'cursor-wait opacity-90'
                : isDark
                ? 'hover:bg-zinc-800/60 cursor-pointer'
                : 'hover:bg-zinc-50/80 cursor-pointer'
            }`}
          >
            <div className="space-y-1.5 pr-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h4
                  className={`font-extrabold text-sm sm:text-base leading-tight ${
                    !isStandalone ? (isDark ? 'text-zinc-300' : 'text-zinc-700') : ''
                  }`}
                >
                  Keep Screen Awake
                </h4>

                {/* Status Badges */}
                {loadingKey === 'keepScreenAwake' ? (
                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider bg-indigo-500/20 text-indigo-500 animate-pulse flex items-center gap-1">
                    <Loader2 className="w-2.5 h-2.5 animate-spin" /> CONNECTING...
                  </span>
                ) : !isStandalone ? (
                  <span className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                    <Lock className="w-2.5 h-2.5" /> ADD TO HOME SCREEN FIRST
                  </span>
                ) : settings.keepScreenAwake ? (
                  <span className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                    <Check className="w-2.5 h-2.5 stroke-[3]" /> PHONE LOCK ACTIVE
                  </span>
                ) : (
                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider bg-zinc-500/20 text-zinc-500 dark:text-zinc-400">
                    OFF
                  </span>
                )}
              </div>

              {/* Description & Instruction Link */}
              {!isStandalone ? (
                <div className="space-y-2">
                  <p
                    className={`text-xs font-medium leading-relaxed ${
                      isDark ? 'text-zinc-400' : 'text-zinc-500'
                    }`}
                  >
                    Disabled in web browser tabs. Web browsers automatically timeout and lock your screen to preserve battery. Adding Billiard to your Home Screen unlocks the phone&apos;s native Screen Wake Lock API.
                  </p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleScrollToInstructions();
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-all active:scale-95"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>
                      How to Add on {platform === 'android' ? 'Android' : platform === 'ios' ? 'iPhone' : 'Your Phone'} ➔
                    </span>
                  </button>
                </div>
              ) : (
                <p
                  className={`text-xs font-medium leading-relaxed ${
                    isDark ? 'text-zinc-400' : 'text-zinc-500'
                  }`}
                >
                  Connected to phone&apos;s native Screen Wake Lock API. Your display will remain continuously awake during matches so it never dims or sleeps mid-turn.
                </p>
              )}
            </div>

            {/* Pill Switch */}
            <div className="pt-0.5">
              <SettingToggleSwitch
                checked={isStandalone && settings.keepScreenAwake}
                isLoading={loadingKey === 'keepScreenAwake'}
                disabled={!isStandalone}
                activeColor={isDark ? 'bg-indigo-600' : 'bg-zinc-900'}
                activeTextColor={isDark ? 'text-indigo-600' : 'text-zinc-900'}
                isDark={isDark}
              />
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: GAMEPLAY DRAMA & SCORING */}
      <div className="space-y-2">
        <h3
          className={`text-[11px] font-extrabold uppercase tracking-wider px-1 ${
            isDark ? 'text-zinc-400' : 'text-zinc-500'
          }`}
        >
          Gameplay Drama & Rules
        </h3>

        <div
          className={`rounded-3xl border shadow-sm divide-y overflow-hidden transition-colors ${
            isDark
              ? 'bg-zinc-900 border-zinc-800 divide-zinc-800'
              : 'bg-white border-zinc-200/90 divide-zinc-100'
          }`}
        >
          {/* Underworld Dialogue */}
          <div
            onClick={() => handleToggle('underworldDialogue')}
            className={`p-4 sm:p-5 flex items-center justify-between gap-4 transition ${
              loadingKey === 'underworldDialogue' ? 'cursor-wait opacity-90' : 'cursor-pointer'
            } ${
              isDark ? 'hover:bg-zinc-800/60' : 'hover:bg-zinc-50/80'
            }`}
          >
            <div className="space-y-1 pr-2">
              <div className="flex items-center gap-2">
                <h4 className="font-extrabold text-sm sm:text-base leading-tight">
                  Underworld Dialogue
                </h4>
                {loadingKey === 'underworldDialogue' ? (
                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider bg-rose-500/20 text-rose-500 animate-pulse flex items-center gap-1">
                    <Loader2 className="w-2.5 h-2.5 animate-spin" /> SAVING...
                  </span>
                ) : !settings.underworldDialogue ? (
                  <span
                    className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider ${
                      isDark
                        ? 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                        : 'bg-zinc-100 text-zinc-600 border border-zinc-200'
                    }`}
                  >
                    OFF
                  </span>
                ) : null}
              </div>
              <p
                className={`text-xs font-medium leading-relaxed ${
                  isDark ? 'text-zinc-400' : 'text-zinc-500'
                }`}
              >
                Tombstone cutscenes, typewriter quotes, and cracked cards when score drops to ≤ -50 points.
              </p>
            </div>

            <SettingToggleSwitch
              checked={settings.underworldDialogue}
              isLoading={loadingKey === 'underworldDialogue'}
              activeColor="bg-rose-600"
              activeTextColor="text-rose-600"
              isDark={isDark}
            />
          </div>

          {/* Hot Hand Streaks */}
          <div
            onClick={() => handleToggle('hotHandStreaks')}
            className={`p-4 sm:p-5 flex items-center justify-between gap-4 transition ${
              loadingKey === 'hotHandStreaks' ? 'cursor-wait opacity-90' : 'cursor-pointer'
            } ${
              isDark ? 'hover:bg-zinc-800/60' : 'hover:bg-zinc-50/80'
            }`}
          >
            <div className="space-y-1 pr-2">
              <div className="flex items-center gap-2">
                <h4 className="font-extrabold text-sm sm:text-base leading-tight">
                  &quot;On Fire&quot; Hot Hand Streaks
                </h4>
                {loadingKey === 'hotHandStreaks' ? (
                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider bg-amber-500/20 text-amber-600 animate-pulse flex items-center gap-1">
                    <Loader2 className="w-2.5 h-2.5 animate-spin" /> SAVING...
                  </span>
                ) : settings.hotHandStreaks ? (
                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 uppercase tracking-wider">
                    ACTIVE
                  </span>
                ) : null}
              </div>
              <p
                className={`text-xs font-medium leading-relaxed ${
                  isDark ? 'text-zinc-400' : 'text-zinc-500'
                }`}
              >
                Player cards catch fire with glowing flame embers on consecutive scores; extinguished on fouls.
              </p>
            </div>

            <SettingToggleSwitch
              checked={settings.hotHandStreaks}
              isLoading={loadingKey === 'hotHandStreaks'}
              activeColor="bg-amber-500"
              activeTextColor="text-amber-600"
              isDark={isDark}
            />
          </div>

          {/* Table Leader Crown */}
          <div
            onClick={() => handleToggle('showLeaderCrown')}
            className={`p-4 sm:p-5 flex items-center justify-between gap-4 transition ${
              loadingKey === 'showLeaderCrown' ? 'cursor-wait opacity-90' : 'cursor-pointer'
            } ${
              isDark ? 'hover:bg-zinc-800/60' : 'hover:bg-zinc-50/80'
            }`}
          >
            <div className="space-y-1 pr-2">
              <div className="flex items-center gap-2">
                <h4 className="font-extrabold text-sm sm:text-base leading-tight">
                  Table Leader Crown
                </h4>
                {loadingKey === 'showLeaderCrown' && (
                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider bg-amber-500/20 text-amber-600 animate-pulse flex items-center gap-1">
                    <Loader2 className="w-2.5 h-2.5 animate-spin" /> SAVING...
                  </span>
                )}
              </div>
              <p
                className={`text-xs font-medium leading-relaxed ${
                  isDark ? 'text-zinc-400' : 'text-zinc-500'
                }`}
              >
                Displays a gold crown badge on the #1 ranked player once the match begins.
              </p>
            </div>

            <SettingToggleSwitch
              checked={settings.showLeaderCrown}
              isLoading={loadingKey === 'showLeaderCrown'}
              activeColor="bg-amber-500"
              activeTextColor="text-amber-600"
              isDark={isDark}
            />
          </div>
        </div>
      </div>

      {/* SECTION 3: INSTRUCTIONS TO ADD TO HOME SCREEN */}
      <div
        ref={instructionsRef}
        id="install-instructions"
        className={`p-5 rounded-3xl border space-y-4 transition-all duration-500 scroll-mt-6 ${
          isDark
            ? 'bg-zinc-900 border-zinc-800'
            : 'bg-white border-zinc-200/90'
        } ${
          highlightInstructions
            ? 'ring-4 ring-indigo-500 shadow-2xl scale-[1.01]'
            : 'shadow-sm'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-indigo-500 flex-shrink-0" />
              <h4 className="font-black text-sm sm:text-base uppercase tracking-tight font-serif">
                How to Add to Home Screen
              </h4>
            </div>
            <p className={`text-xs font-medium ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
              Install Billiard on your phone for full-screen table mode, persistent Screen Wake Lock, and offline scoring.
            </p>
          </div>

          <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-500 border border-indigo-500/30 flex-shrink-0">
            PWA APP
          </span>
        </div>

        {/* Current Status Confirmation if already added */}
        {isStandalone ? (
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 flex items-center gap-3 text-xs font-bold">
            <div className="w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
              <Check className="w-4 h-4 text-emerald-500 stroke-[3]" />
            </div>
            <div>
              <span className="font-black uppercase block text-[11px] tracking-wider text-emerald-600 dark:text-emerald-400">
                Already Running from Home Screen
              </span>
              <span>Billiard is in native standalone mode. Keep Screen Awake is fully supported and enabled!</span>
            </div>
          </div>
        ) : (
          <>
            {/* Android 1-Tap Quick Install Button (if browser supports it) */}
            {deferredInstallPrompt && (
              <button
                type="button"
                onClick={handleTriggerInstallPrompt}
                className="w-full py-3 px-5 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-black text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              >
                <Download className="w-4 h-4" />
                <span>⚡ 1-Tap Install Billiard App Now</span>
              </button>
            )}

            {/* Platform Tab Switcher */}
            <div className="flex rounded-2xl p-1 bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/60">
              <button
                type="button"
                onClick={() => setActiveInstallTab('ios')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                  activeInstallTab === 'ios'
                    ? isDark
                      ? 'bg-zinc-700 text-white shadow-sm'
                      : 'bg-white text-zinc-900 shadow-sm'
                    : isDark
                    ? 'text-zinc-400 hover:text-zinc-200'
                    : 'text-zinc-500 hover:text-zinc-800'
                }`}
              >
                <span>🍏 iPhone (Safari)</span>
                {platform === 'ios' && (
                  <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-indigo-500/20 text-indigo-500 font-bold uppercase">
                    Your Device
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveInstallTab('android')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                  activeInstallTab === 'android'
                    ? isDark
                      ? 'bg-zinc-700 text-white shadow-sm'
                      : 'bg-white text-zinc-900 shadow-sm'
                    : isDark
                    ? 'text-zinc-400 hover:text-zinc-200'
                    : 'text-zinc-500 hover:text-zinc-800'
                }`}
              >
                <span>🤖 Android (Chrome)</span>
                {platform === 'android' && (
                  <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-indigo-500/20 text-indigo-500 font-bold uppercase">
                    Your Device
                  </span>
                )}
              </button>
            </div>

            {/* Step by Step Guides */}
            {activeInstallTab === 'ios' ? (
              <div className="space-y-3 pt-1">
                <div className="flex items-start gap-3 p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-black flex items-center justify-center flex-shrink-0">
                    1
                  </span>
                  <div className="text-xs leading-relaxed">
                    <strong className="block font-bold">Open in Safari</strong>
                    <span>Make sure you are viewing this page in Apple <strong>Safari</strong> (iOS restricts Home Screen installation in Chrome or social app in-app browsers).</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-black flex items-center justify-center flex-shrink-0">
                    2
                  </span>
                  <div className="text-xs leading-relaxed">
                    <strong className="block font-bold flex items-center gap-1.5">
                      Tap the Share Button <Share className="w-3.5 h-3.5 text-indigo-500 inline" />
                    </strong>
                    <span>Tap the <strong>Share</strong> button (the square icon with an upward arrow) in the bottom toolbar of Safari.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-black flex items-center justify-center flex-shrink-0">
                    3
                  </span>
                  <div className="text-xs leading-relaxed">
                    <strong className="block font-bold flex items-center gap-1.5">
                      Tap &quot;Add to Home Screen&quot; <PlusSquare className="w-3.5 h-3.5 text-indigo-500 inline" />
                    </strong>
                    <span>Scroll down the action sheet options and tap <strong>&quot;Add to Home Screen&quot;</strong>.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-black flex items-center justify-center flex-shrink-0">
                    4
                  </span>
                  <div className="text-xs leading-relaxed">
                    <strong className="block font-bold">Tap &quot;Add&quot; in Top Right</strong>
                    <span>Confirm by tapping <strong>Add</strong>. Then open Billiard from your phone&apos;s Home Screen to unlock persistent screen lock!</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3 pt-1">
                <div className="flex items-start gap-3 p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-black flex items-center justify-center flex-shrink-0">
                    1
                  </span>
                  <div className="text-xs leading-relaxed">
                    <strong className="block font-bold">Open in Google Chrome</strong>
                    <span>Open this website in <strong>Google Chrome</strong> or Samsung Internet.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-black flex items-center justify-center flex-shrink-0">
                    2
                  </span>
                  <div className="text-xs leading-relaxed">
                    <strong className="block font-bold flex items-center gap-1.5">
                      Tap the Menu (⋮) <MoreVertical className="w-3.5 h-3.5 text-indigo-500 inline" />
                    </strong>
                    <span>Tap the <strong>three vertical dots</strong> in the top-right corner of Chrome.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-black flex items-center justify-center flex-shrink-0">
                    3
                  </span>
                  <div className="text-xs leading-relaxed">
                    <strong className="block font-bold flex items-center gap-1.5">
                      Tap &quot;Install App&quot; / &quot;Add to Home screen&quot; <Download className="w-3.5 h-3.5 text-indigo-500 inline" />
                    </strong>
                    <span>Select <strong>&quot;Install app&quot;</strong> or <strong>&quot;Add to Home screen&quot;</strong> from the menu options.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-black flex items-center justify-center flex-shrink-0">
                    4
                  </span>
                  <div className="text-xs leading-relaxed">
                    <strong className="block font-bold">Confirm &amp; Launch</strong>
                    <span>Tap <strong>Install</strong> on the confirmation prompt. Open Billiard from your home screen or app drawer to enjoy full screen wake lock!</span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* SECTION 4: TABLE STAKES & FORFEITS (COMING SOON) */}
      <div className="space-y-2">
        <h3
          className={`text-[11px] font-extrabold uppercase tracking-wider px-1 ${
            isDark ? 'text-zinc-400' : 'text-zinc-500'
          }`}
        >
          Upcoming Feature
        </h3>

        <div
          className={`p-5 rounded-3xl border space-y-2 transition-colors ${
            isDark
              ? 'bg-zinc-900/80 border-indigo-900/60'
              : 'bg-white border-zinc-200/90'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <h4 className="font-black text-sm sm:text-base uppercase tracking-tight">
                Table Stakes & Forfeits
              </h4>
            </div>
            <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 border border-amber-500/30">
              COMING SOON
            </span>
          </div>

          <p
            className={`text-xs font-medium leading-relaxed ${
              isDark ? 'text-zinc-400' : 'text-zinc-600'
            }`}
          >
            Set friendly table forfeits for friends around the pool table: <em>Loser buys next round 🍺</em>, <em>racks next 3 games 🎱</em>, or <em>20 pushups 💪</em>. Proclaimed officially on the winner podium!
          </p>
        </div>
      </div>

      {/* SECTION 5: SYSTEM & SOFTWARE UPDATES */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3
            className={`text-[11px] font-extrabold uppercase tracking-wider ${
              isDark ? 'text-zinc-400' : 'text-zinc-500'
            }`}
          >
            System Updates
          </h3>
          <div className="flex items-center gap-1.5">
            {network.hasInternet ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <Wifi className="w-2.5 h-2.5" />
                Online
              </span>
            ) : network.hasRadio ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                <WifiOff className="w-2.5 h-2.5" />
                No Data / Bundles
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-zinc-500/15 text-zinc-500 border border-zinc-500/20">
                <WifiOff className="w-2.5 h-2.5" />
                Offline
              </span>
            )}
          </div>
        </div>

        {/* Celebratory Banner: Shown after reload when an update has just been applied */}
        {updateState.recentlyAppliedVersion && (
          <div
            className={`p-4 rounded-3xl border flex items-start justify-between gap-3 animate-fadeIn ${
              isDark
                ? 'bg-emerald-950/40 border-emerald-600/40 text-emerald-100'
                : 'bg-emerald-50 border-emerald-300 text-emerald-950'
            }`}
          >
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <div className="text-xs font-black uppercase tracking-wide flex items-center gap-2">
                  <span>New Version Applied!</span>
                  <span className="px-1.5 py-0.5 text-[9px] rounded-md bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 font-black font-mono">
                    {updateState.recentlyAppliedVersion}
                  </span>
                </div>
                <p className="text-xs font-medium leading-relaxed opacity-90">
                  Billiard has been refreshed and updated with the latest draw &amp; tie rules, wake lock upgrades, and performance enhancements.
                </p>
              </div>
            </div>
            <button
              onClick={() => dismissAppliedBanner()}
              className="text-xs font-bold px-2 py-1 rounded-lg opacity-70 hover:opacity-100 transition-opacity flex-shrink-0"
              title="Dismiss"
            >
              ✕
            </button>
          </div>
        )}

        {/* System Updates Card */}
        <div
          className={`p-5 rounded-3xl border space-y-4 transition-all ${
            isDark
              ? 'bg-zinc-900/90 border-zinc-800'
              : 'bg-white border-zinc-200 shadow-sm'
          }`}
        >
          {/* Top: App Version & Installation Status */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                  updateState.status === 'installing'
                    ? 'bg-indigo-600 text-white animate-pulse'
                    : updateState.status === 'ready'
                    ? 'bg-emerald-500 text-white'
                    : isDark
                    ? 'bg-zinc-800 text-indigo-400'
                    : 'bg-indigo-50 text-indigo-600'
                }`}
              >
                {updateState.status === 'installing' ? (
                  <ArrowDownCircle className="w-5 h-5 animate-bounce" />
                ) : updateState.status === 'ready' ? (
                  <Sparkles className="w-5 h-5" />
                ) : (
                  <Package className="w-5 h-5" />
                )}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-black text-sm sm:text-base uppercase tracking-tight">
                    Billiard Scoreboard
                  </h4>
                  <span
                    className={`text-[10px] font-black px-2 py-0.5 rounded-full border font-mono ${
                      isDark
                        ? 'bg-zinc-800 text-zinc-300 border-zinc-700'
                        : 'bg-zinc-100 text-zinc-700 border-zinc-200'
                    }`}
                  >
                    v{updateState.currentVersion}
                  </span>
                </div>
                <p
                  className={`text-[11px] font-medium ${
                    isDark ? 'text-zinc-400' : 'text-zinc-500'
                  }`}
                >
                  Build: {BUILD_DATE} • Last checked: {updateState.lastCheckTime}
                </p>
              </div>
            </div>

            {/* Status Pill Badge */}
            {updateState.status === 'installing' && (
              <span className="text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 animate-pulse flex-shrink-0">
                INSTALLING...
              </span>
            )}
            {updateState.status === 'ready' && (
              <span className="text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex-shrink-0">
                READY TO APPLY
              </span>
            )}
            {updateState.status === 'checking' && (
              <span className="text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex-shrink-0">
                CHECKING...
              </span>
            )}
            {(updateState.status === 'idle' || updateState.status === 'up_to_date') && (
              <span className="text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-zinc-500/15 text-zinc-500 border border-zinc-500/20 flex-shrink-0">
                UP TO DATE
              </span>
            )}
          </div>

          {/* Real Network Notice (Handles Depleted Bundles & Offline Wi-Fi) */}
          {!network.hasInternet && (
            <div
              className={`p-3.5 rounded-2xl border flex items-start gap-2.5 text-xs font-semibold ${
                isDark
                  ? 'bg-amber-950/30 border-amber-900/50 text-amber-300'
                  : 'bg-amber-50 border-amber-200 text-amber-800'
              }`}
            >
              <WifiOff className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">
                  {network.hasRadio
                    ? 'No Active Data Connection Detected'
                    : 'You are currently offline'}
                </p>
                <p className="text-[11px] opacity-90 mt-0.5 leading-relaxed">
                  {network.hasRadio
                    ? 'Your device is connected to a network, but actual HTTP traffic cannot reach the internet (data bundles may be depleted or Wi-Fi requires sign-in). Updates will resume automatically once active internet is verified.'
                    : 'Connect to Wi-Fi or cellular data to check and install updates automatically.'}
                </p>
              </div>
            </div>
          )}

          {/* INSTALLING STATE: Automatic background installation, cannot be stopped */}
          {updateState.status === 'installing' && (
            <div
              className={`p-4 rounded-2xl border space-y-3 ${
                isDark
                  ? 'bg-indigo-950/25 border-indigo-800/40'
                  : 'bg-indigo-50/60 border-indigo-100'
              }`}
            >
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-tight">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Installing Update ({updateState.availableVersion || 'v1.2.1'})</span>
                </div>
                <span className="font-black text-xs text-indigo-600 dark:text-indigo-400 font-mono">
                  {updateState.installProgress}%
                </span>
              </div>

              {/* Progress Track */}
              <div className="w-full h-2.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden p-0.5">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full transition-all duration-300 relative overflow-hidden"
                  style={{ width: `${updateState.installProgress}%` }}
                >
                  <div className="absolute inset-0 bg-white/20 animate-[pulse_1s_infinite]" />
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] gap-2">
                <p className="font-medium text-zinc-600 dark:text-zinc-400 truncate">
                  {updateState.installStepMessage}
                </p>
                <div className="flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20 flex-shrink-0">
                  <Lock className="w-2.5 h-2.5" />
                  <span>Automatic (Cannot Stop)</span>
                </div>
              </div>
            </div>
          )}

          {/* READY STATE: Update ready, refresh button */}
          {updateState.status === 'ready' && (
            <div
              className={`p-4 rounded-2xl border space-y-3 ${
                isDark
                  ? 'bg-emerald-950/25 border-emerald-800/40'
                  : 'bg-emerald-50/70 border-emerald-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                  Update Successfully Installed ({updateState.availableVersion || 'v1.2.1'})
                </span>
              </div>
              <p
                className={`text-xs font-medium leading-relaxed ${
                  isDark ? 'text-zinc-300' : 'text-zinc-700'
                }`}
              >
                A new version has been downloaded and cached in the background. Tap the button below to refresh Billiard and apply the new version.
              </p>

              <button
                onClick={() => applySystemUpdate()}
                disabled={updateState.isRefreshing}
                className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider shadow-md hover:shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${updateState.isRefreshing ? 'animate-spin' : ''}`} />
                <span>{updateState.isRefreshing ? 'Applying & Refreshing...' : 'Refresh App & Apply New Version'}</span>
              </button>
            </div>
          )}

          {/* CHECKING STATE */}
          {updateState.status === 'checking' && (
            <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-500 flex-shrink-0" />
              <div className="text-xs font-medium">
                <p className="font-bold text-zinc-900 dark:text-zinc-100">Checking for updates...</p>
                <p className="text-zinc-500 dark:text-zinc-400 text-[11px]">Connecting to update manifest and service worker cache...</p>
              </div>
            </div>
          )}

          {/* UP TO DATE NOTICE (Shown when checked and no update is available) */}
          {updateState.status === 'up_to_date' && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between text-xs animate-fadeIn">
              <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                Your app is up to date! (v{updateState.currentVersion} is the latest release). No updates available.
              </span>
            </div>
          )}

          {/* IDLE STATE: Manual Check Action & Dev Simulator */}
          {updateState.status === 'idle' && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1 border-t border-zinc-100 dark:border-zinc-800">
              <span
                className={`text-[11px] font-medium flex items-center gap-1.5 ${
                  isDark ? 'text-zinc-400' : 'text-zinc-500'
                }`}
              >
                <Check className="w-3.5 h-3.5 text-emerald-500 stroke-[3]" />
                You are on the latest verified release (v{updateState.currentVersion}).
              </span>

              <div className="flex items-center">
                <button
                  onClick={() => runCheckForUpdates({ isAutomatic: false })}
                  disabled={!network.hasInternet}
                  className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                    network.hasInternet
                      ? isDark
                        ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 shadow-sm active:scale-95'
                        : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800 shadow-sm active:scale-95'
                      : 'opacity-40 cursor-not-allowed bg-zinc-100 dark:bg-zinc-800 text-zinc-400'
                  }`}
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Check for Updates</span>
                </button>
              </div>
            </div>
          )}

          {/* Release Notes / What's New Accordion */}
          <div className="pt-1 border-t border-zinc-100 dark:border-zinc-800">
            <button
              onClick={() => setIsChangelogOpen(!isChangelogOpen)}
              className={`w-full flex items-center justify-between py-1 text-xs font-bold ${
                isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-zinc-600 hover:text-zinc-900'
              } transition-colors`}
            >
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                <span>What&apos;s New in Recent Updates</span>
              </span>
              {isChangelogOpen ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>

            {isChangelogOpen && (
              <div className="mt-2.5 space-y-3 animate-fadeIn">
                {RECENT_CHANGELOG.map((log) => (
                  <div
                    key={log.version}
                    className={`p-3 rounded-2xl border text-xs space-y-1.5 ${
                      isDark
                        ? 'bg-zinc-800/30 border-zinc-800'
                        : 'bg-zinc-50 border-zinc-200/70'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-indigo-600 dark:text-indigo-400">
                        {log.version}
                      </span>
                      <span className="text-[10px] text-zinc-400 font-semibold">{log.date}</span>
                    </div>
                    <ul className="space-y-1 pl-3 list-disc marker:text-indigo-500 text-[11px] leading-relaxed">
                      {log.highlights.map((h, i) => (
                        <li key={i} className={isDark ? 'text-zinc-300' : 'text-zinc-600'}>
                          {h}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Button on the Page */}
      <div className="pt-2">
        <button
          onClick={onBack}
          className="w-full py-3.5 px-6 rounded-2xl bg-zinc-900 text-white font-black text-sm uppercase tracking-wider shadow-lg hover:bg-indigo-600 transition-all active:scale-[0.99] flex items-center justify-center gap-2"
        >
          <Check className="w-4 h-4 stroke-[3]" />
          <span>DONE & RETURN TO {returnToViewTitle.toUpperCase()}</span>
        </button>
      </div>
    </div>
  );
};
