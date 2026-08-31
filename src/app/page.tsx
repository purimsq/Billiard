'use client';

import React, { useState, useEffect, useSyncExternalStore, useCallback } from 'react';
import { GameSession, Player } from '@/types/game';
import { getActiveGame, saveActiveGame, clearActiveGame, saveGameToHistory } from '@/lib/storage';
import { HomeHero } from '@/components/home/HomeHero';
import { RulesCard } from '@/components/home/RulesCard';
import { PlayerSetupModal } from '@/components/game/PlayerSetupModal';
import { LiveGameView } from '@/components/game/LiveGameView';
import { EndGameModal } from '@/components/game/EndGameModal';
import { LoadingScreen, LoadingVariant } from '@/components/ui/LoadingScreen';

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

  const [currentView, setCurrentView] = useState<'home' | 'live'>(() => {
    if (typeof window !== 'undefined') {
      const saved = getActiveGame();
      if (saved && saved.players.length > 0 && saved.status === 'live') {
        return 'live';
      }
    }
    return 'home';
  });

  const [isSetupOpen, setIsSetupOpen] = useState<boolean>(false);
  const [isEndGameOpen, setIsEndGameOpen] = useState<boolean>(false);

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
  const handleStartGame = (players: Player[]) => {
    setIsSetupOpen(false); // close the setup modal right away
    withLoader('game', randMs(3500, 5500), () => {
      const newSession: GameSession = {
        id: `game_${Date.now()}`,
        players,
        history: [],
        status: 'live',
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

  const handleClearSession = () => {
    clearActiveGame();
    setActiveSession(null);
    setCurrentView('home');
  };

  // end game button → preparing results loader → open the results modal
  const handleEndGameClick = () => {
    withLoader('results', randMs(2500, 4000), () => setIsEndGameOpen(true));
  };

  const handleDoneEndGame = () => {
    if (activeSession) {
      saveGameToHistory(activeSession);
    }
    clearActiveGame();
    setActiveSession(null);
    setIsEndGameOpen(false);
    setCurrentView('home');
  };

  // play again → brief rack up loader → reset scores and start fresh
  const handlePlayAgain = () => {
    if (!activeSession) return;
    setIsEndGameOpen(false);
    withLoader('again', randMs(2000, 3500), () => {
      const resetPlayers = activeSession.players.map((p) => ({ ...p, score: 0 }));
      const newSession: GameSession = {
        id: `game_${Date.now()}`,
        players: resetPlayers,
        history: [],
        status: 'live',
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
    <main className="min-h-screen bg-[#F4F2EC] selection:bg-indigo-500 selection:text-white">
      {/* loading overlay — sits above everything */}
      <LoadingScreen variant={loadingVariant} visible={isLoading} />

      {currentView === 'home' && (
        <div className="animate-fadeIn space-y-4">
          <HomeHero
            activeSession={activeSession}
            onStartNewGame={handleOpenSetup}
            onResumeGame={handleResumeGame}
            onClearSession={handleClearSession}
            onScrollToRules={handleScrollToRules}
          />
          <RulesCard />
        </div>
      )}

      {currentView === 'live' && activeSession && (
        <LiveGameView
          session={activeSession}
          onUpdateSession={handleUpdateSession}
          onEndGame={handleEndGameClick}
        />
      )}

      {/* player setup modal */}
      <PlayerSetupModal
        isOpen={isSetupOpen}
        onClose={() => setIsSetupOpen(false)}
        onStartGame={handleStartGame}
      />

      {/* end game results modal */}
      {activeSession && (
        <EndGameModal
          session={activeSession}
          isOpen={isEndGameOpen}
          onDone={handleDoneEndGame}
          onNewGame={handlePlayAgain}
        />
      )}
    </main>
  );
}
