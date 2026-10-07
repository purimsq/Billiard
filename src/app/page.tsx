'use client';

import React, { useState, useEffect, useSyncExternalStore, useCallback } from 'react';
import { GameSession, Player, GameMode } from '@/types/game';
import { getActiveGame, saveActiveGame, clearActiveGame, saveGameToHistory } from '@/lib/storage';
import { HomeHero } from '@/components/home/HomeHero';
import { RulesCard } from '@/components/home/RulesCard';
import { PlayerSetupModal } from '@/components/game/PlayerSetupModal';
import { LiveGameView } from '@/components/game/LiveGameView';
import { EndGameModal } from '@/components/game/EndGameModal';
import { CancelGameModal } from '@/components/game/CancelGameModal';
import { LoadingScreen, LoadingVariant } from '@/components/ui/LoadingScreen';
import { SettingsPage } from '@/components/settings/SettingsPage';
import { GameHistoryPage } from '@/components/settings/GameHistoryPage';
import { TournamentTablePage } from '@/components/tournament/TournamentTablePage';
import { GlobalUpdateBanner } from '@/components/ui/GlobalUpdateBanner';
import { AppSettings } from '@/types/settings';
import { getStoredSettings, saveStoredSettings, DEFAULT_SETTINGS } from '@/lib/settingsStorage';
import { requestScreenWakeLock, releaseScreenWakeLock, isStandaloneMode } from '@/lib/wakeLockManager';
import { runCheckForUpdates } from '@/lib/systemUpdateManager';
import { checkRealInternetConnectivity } from '@/lib/networkReachability';
import {
  submitRankedMatch,
  recordCasualMatchForProfiles,
  getLocalDeviceProfile,
  checkAndSyncTournamentResults,
  startOfflineRankedSyncListener,
} from '@/lib/rankedSync';
import { RankedSyncProgressModal } from '@/components/game/RankedSyncProgressModal';
import { MatchEloResult } from '@/lib/smartElo';

const emptySubscribe = () => () => {};

// Returns a random duration in milliseconds between min and max
const randMs = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

export default function Home() {
  const isMounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const [activeSession, setActiveSession] = useState<GameSession | null>(() => {
    if (typeof window !== 'undefined') {
      return getActiveGame();
    }
    return null;
  });

  const [currentView, setCurrentView] = useState<'home' | 'live' | 'settings' | 'history' | 'tournament'>(() => {
    if (typeof window !== 'undefined') {
      const saved = getActiveGame();
      if (saved && saved.players.length > 0 && saved.status === 'live') {
        return 'live';
      }
    }
    return 'home';
  });

  const [hasProfile, setHasProfile] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const p = getLocalDeviceProfile();
      return Boolean(p && p.username);
    }
    return false;
  });

  useEffect(() => {
    const checkProfile = () => {
      const p = getLocalDeviceProfile();
      setHasProfile(Boolean(p && p.username));
    };
    checkProfile();
    window.addEventListener('storage', checkProfile);
    return () => window.removeEventListener('storage', checkProfile);
  }, [currentView]);

  const [previousView, setPreviousView] = useState<'home' | 'live'>('home');

  const [isSetupOpen, setIsSetupOpen] = useState<boolean>(false);
  const [isEndGameOpen, setIsEndGameOpen] = useState<boolean>(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState<boolean>(false);
  const [isRankedSyncModalOpen, setIsRankedSyncModalOpen] = useState<boolean>(false);
  const [rankedSyncStatus, setRankedSyncStatus] = useState<'synced' | 'queued' | undefined>(undefined);
  const [rankedMatchAlreadySaved, setRankedMatchAlreadySaved] = useState<boolean>(false);

  const [settings, setSettings] = useState<AppSettings>(() => {
    if (typeof window !== 'undefined') {
      return getStoredSettings();
    }
    return DEFAULT_SETTINGS;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (settings.darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [settings.darkMode]);

  // Screen Wake Lock: Persistent across app when in standalone mode
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isStandalone = isStandaloneMode();
    if (settings.keepScreenAwake && isStandalone) {
      requestScreenWakeLock();
    } else {
      releaseScreenWakeLock();
    }
  }, [settings.keepScreenAwake]);

  const handleUpdateSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    saveStoredSettings(newSettings);
  };

  const handleOpenSettings = () => {
    if (currentView === 'home' || currentView === 'live') {
      setPreviousView(currentView);
    }
    setCurrentView('settings');
  };

  const handleBackFromSettings = () => {
    setCurrentView(previousView);
  };

  const handleOpenHistory = () => {
    setCurrentView('history');
  };

  const handleBackFromHistory = () => {
    setCurrentView('settings');
  };

  const handleOpenTournamentTable = () => {
    setCurrentView('tournament');
  };

  // loading overlay state
  const [loadingVariant, setLoadingVariant] = useState<LoadingVariant>('quick');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // shows a loading screen, then runs the action after ms milliseconds
  const withLoader = useCallback(
    (variant: LoadingVariant, ms: number, action: () => void) => {
      setLoadingVariant(variant);
      setIsLoading(true);
      setTimeout(() => {
        action();
        setIsLoading(false);
      }, ms);
    },
    []
  );

  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.log('ServiceWorker registration failed: ', err);
      });
    }

    // Automatic offline ranked match listener: flushes whenever device reconnects or returns to foreground
    const stopSyncListener = startOfflineRankedSyncListener((count) => {
      console.log(`[RankedSync] Automatically synchronized ${count} offline ranked match(es).`);
      checkAndSyncTournamentResults({ isAutomatic: true });
    });

    // When entering the app, check if online, check tournament results & updates
    checkRealInternetConnectivity().then((health) => {
      if (health.hasInternet) {
        checkAndSyncTournamentResults({ isAutomatic: true });
        setTimeout(() => {
          runCheckForUpdates({ isAutomatic: true });
        }, 1800);
      }
    });

    return () => {
      stopSyncListener();
    };
  }, []);

  const handleUpdateSession = (updated: GameSession) => {
    setActiveSession(updated);
    saveActiveGame(updated);
  };

  // tap start game on home → brief loader → open player setup
  const handleOpenSetup = () => {
    withLoader('quick', randMs(2500, 3500), () => setIsSetupOpen(true));
  };

  // confirm players in setup modal → full preparing game loader → go live
  const handleStartGame = (players: Player[], mode: GameMode = 'casual') => {
    setIsSetupOpen(false); // close the setup modal right away
    withLoader('game', randMs(3500, 5500), () => {
      const newSession: GameSession = {
        id: `game_${Date.now()}`,
        players,
        history: [],
        status: 'live',
        mode,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      setActiveSession(newSession);
      saveActiveGame(newSession);
      setCurrentView('live');
    });
  };

  const handleResumeGame = () => {
    if (activeSession) {
      setCurrentView('live');
    }
  };

  // Open confirmation modal before discarding active game
  const handleRequestCancelGame = () => {
    setIsCancelModalOpen(true);
  };

  // Confirmed cancellation: show loading state, then wipe session without saving to history or remote database
  const handleConfirmCancelGame = () => {
    setIsCancelModalOpen(false);
    setIsEndGameOpen(false);
    withLoader('cancel', randMs(2000, 3000), () => {
      clearActiveGame();
      setActiveSession(null);
      setCurrentView('home');
    });
  };

  // end game button → for ranked: calculate ELO & sync live via progress bar; for casual: standard quick loader
  const handleEndGameClick = () => {
    if (activeSession?.mode === 'ranked') {
      setIsRankedSyncModalOpen(true);
    } else {
      withLoader('results', randMs(2500, 4000), () => setIsEndGameOpen(true));
    }
  };

  const handleRankedSyncComplete = (
    completedSession: GameSession,
    eloResult: MatchEloResult | null,
    syncStatus: 'synced' | 'queued'
  ) => {
    // Save to local device match history immediately so it's guaranteed safe
    saveGameToHistory(completedSession);
    setRankedSyncStatus(syncStatus);
    setRankedMatchAlreadySaved(true);
    setIsRankedSyncModalOpen(false);
    setIsEndGameOpen(true);
  };

  const handleDoneEndGame = () => {
    if (activeSession) {
      if (activeSession.mode === 'ranked') {
        if (!rankedMatchAlreadySaved) {
          saveGameToHistory(activeSession);
          submitRankedMatch(activeSession).catch((err) => {
            console.warn('[RankedSync] Match submission deferred/offline:', err);
          });
        }
      } else {
        saveGameToHistory(activeSession);
        recordCasualMatchForProfiles(activeSession);
      }
    }
    setRankedMatchAlreadySaved(false);
    setRankedSyncStatus(undefined);
    clearActiveGame();
    setActiveSession(null);
    setIsEndGameOpen(false);
    setCurrentView('home');
  };

  // play again → brief rack up loader → save finished game, reset scores and arrange so loser starts up to winner last
  const handlePlayAgain = () => {
    if (!activeSession) return;
    const completedSession = { ...activeSession };
    // Save the finished match to local history (and sync if ranked, if not already submitted)
    if (completedSession.mode === 'ranked') {
      if (!rankedMatchAlreadySaved) {
        saveGameToHistory(completedSession);
        submitRankedMatch(completedSession).catch((err) => {
          console.warn('[RankedSync] Match submission deferred/offline:', err);
        });
      }
    } else {
      saveGameToHistory(completedSession);
      recordCasualMatchForProfiles(completedSession);
    }
    setRankedMatchAlreadySaved(false);
    setRankedSyncStatus(undefined);

    setIsEndGameOpen(false);
    withLoader('again', randMs(2000, 3500), () => {
      // Arrange players so lowest score (loser) starts first, ascending up to 1st place (winner) who plays last
      const orderedPlayers = [...completedSession.players]
        .sort((a, b) => a.score - b.score)
        .map((p) => ({ ...p, score: 0 }));

      const newSession: GameSession = {
        id: `game_${Date.now()}`,
        players: orderedPlayers,
        history: [],
        status: 'live',
        mode: completedSession.mode || 'casual',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      setActiveSession(newSession);
      saveActiveGame(newSession);
      setCurrentView('live');
    });
  };

  if (!isMounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F4F2EC]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
            Loading Billiard...
          </p>
        </div>
      </div>
    );
  }

  const handleScrollToRules = () => {
    const el = document.getElementById('rules-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <main
      className={`min-h-screen selection:bg-indigo-500 selection:text-white transition-colors ${
        settings.darkMode ? 'bg-[#121214] text-zinc-100' : 'bg-[#F4F2EC] text-[#1C1C1E]'
      }`}
    >
      {/* loading overlay — sits above everything */}
      <LoadingScreen
        variant={loadingVariant}
        visible={isLoading}
        isDark={settings.darkMode}
      />

      {/* Global background update notification */}
      <GlobalUpdateBanner
        currentView={currentView}
        onOpenSettings={handleOpenSettings}
        isDark={settings.darkMode}
      />

      {currentView === 'home' && (
        <div className="animate-fadeIn space-y-4">
          <HomeHero
            activeSession={activeSession}
            onStartNewGame={handleOpenSetup}
            onResumeGame={handleResumeGame}
            onClearSession={handleRequestCancelGame}
            onScrollToRules={handleScrollToRules}
            onOpenSettings={handleOpenSettings}
            onOpenTournamentTable={handleOpenTournamentTable}
            hasProfile={hasProfile}
            isDark={settings.darkMode}
          />
          <RulesCard isDark={settings.darkMode} />
        </div>
      )}

      {currentView === 'live' && activeSession && (
        <LiveGameView
          session={activeSession}
          settings={settings}
          onUpdateSession={handleUpdateSession}
          onEndGame={handleEndGameClick}
          onCancelGame={handleRequestCancelGame}
          onOpenSettings={handleOpenSettings}
        />
      )}

      {/* settings page (renders on the page, not a card/modal) */}
      {currentView === 'settings' && (
        <SettingsPage
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
          onBack={handleBackFromSettings}
          onOpenHistory={handleOpenHistory}
          returnToViewTitle={previousView === 'live' ? 'Live Game' : 'Home'}
        />
      )}

      {/* game history page (renders on the page, not a card/modal) */}
      {currentView === 'history' && (
        <GameHistoryPage
          onBack={handleBackFromHistory}
          isDark={settings.darkMode}
        />
      )}

      {/* tournament table page */}
      {currentView === 'tournament' && (
        <TournamentTablePage
          onBack={() => setCurrentView('home')}
          isDark={settings.darkMode}
        />
      )}

      {/* player setup modal */}
      <PlayerSetupModal
        isOpen={isSetupOpen}
        onClose={() => setIsSetupOpen(false)}
        onStartGame={handleStartGame}
        isDark={settings.darkMode}
      />

      {/* ranked results live sync & ELO progress modal */}
      {activeSession && activeSession.mode === 'ranked' && (
        <RankedSyncProgressModal
          key={activeSession.id}
          session={activeSession}
          isOpen={isRankedSyncModalOpen}
          isDark={settings.darkMode}
          onComplete={handleRankedSyncComplete}
        />
      )}

      {/* end game results modal */}
      {activeSession && (
        <EndGameModal
          session={activeSession}
          isOpen={isEndGameOpen}
          onDone={handleDoneEndGame}
          onNewGame={handlePlayAgain}
          onCancelGame={handleRequestCancelGame}
          isDark={settings.darkMode}
          syncStatus={rankedSyncStatus}
        />
      )}

      {/* cancel game confirmation modal */}
      {activeSession && (
        <CancelGameModal
          isOpen={isCancelModalOpen}
          session={activeSession}
          onClose={() => setIsCancelModalOpen(false)}
          onConfirmCancel={handleConfirmCancelGame}
          isDark={settings.darkMode}
        />
      )}
    </main>
  );
}
