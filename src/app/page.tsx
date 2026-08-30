'use client';

import React, { useState, useEffect, useSyncExternalStore } from 'react';
import { GameSession, Player } from '@/types/game';
import { getActiveGame, saveActiveGame, clearActiveGame, saveGameToHistory } from '@/lib/storage';
import { HomeHero } from '@/components/home/HomeHero';
import { RulesCard } from '@/components/home/RulesCard';
import { PlayerSetupModal } from '@/components/game/PlayerSetupModal';
import { LiveGameView } from '@/components/game/LiveGameView';
import { EndGameModal } from '@/components/game/EndGameModal';

const emptySubscribe = () => () => {};

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

  useEffect(() => {
    // Register Service Worker for offline PWA functionality
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.log('ServiceWorker registration failed: ', err);
      });
    }
  }, []);

  // Save active session changes to localStorage
  const handleUpdateSession = (updated: GameSession) => {
    setActiveSession(updated);
    saveActiveGame(updated);
  };

  // Start new game handler from Setup Modal
  const handleStartGame = (players: Player[]) => {
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
    setIsSetupOpen(false);
    setCurrentView('live');
  };

  // Resume active saved game
  const handleResumeGame = () => {
    if (activeSession) {
      setCurrentView('live');
    }
  };

  // Clear current saved session
  const handleClearSession = () => {
    clearActiveGame();
    setActiveSession(null);
    setCurrentView('home');
  };

  // Open end game confirmation/scoreboard modal
  const handleEndGameClick = () => {
    setIsEndGameOpen(true);
  };

  // Done button on End Game modal (clears scoreboard & returns home)
  const handleDoneEndGame = () => {
    if (activeSession) {
      saveGameToHistory(activeSession);
    }
    clearActiveGame();
    setActiveSession(null);
    setIsEndGameOpen(false);
    setCurrentView('home');
  };

  // Play Again button on End Game modal
  const handlePlayAgain = () => {
    if (!activeSession) return;
    // Reset player scores to 0
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
    setIsEndGameOpen(false);
    setCurrentView('live');
  };

  if (!isMounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F4F2EC]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
            Loading Billard...
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
      {currentView === 'home' && (
        <div className="animate-fadeIn space-y-4">
          <HomeHero
            activeSession={activeSession}
            onStartNewGame={() => setIsSetupOpen(true)}
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

      {/* Player Setup Modal */}
      <PlayerSetupModal
        isOpen={isSetupOpen}
        onClose={() => setIsSetupOpen(false)}
        onStartGame={handleStartGame}
      />

      {/* End Game Modal */}
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
