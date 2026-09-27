import React from 'react';
import { GameHistoryPage } from './GameHistoryPage';

/**
 * @deprecated GameHistorySection was superseded by GameHistoryPage.
 * You can safely close this file tab in your editor.
 */
interface GameHistorySectionProps {
  onBack?: () => void;
  isDark?: boolean;
}

export const GameHistorySection: React.FC<GameHistorySectionProps> = ({
  onBack = () => {},
  isDark = false,
}) => {
  return <GameHistoryPage onBack={onBack} isDark={isDark} />;
};

export default GameHistorySection;
