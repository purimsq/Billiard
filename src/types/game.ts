export type GameState = 'home' | 'setup' | 'live' | 'ended';

export interface Player {
  id: string;
  name: string;
  score: number;
  color: string;
  avatarBg: string;
}

export interface Transaction {
  id: string;
  playerId: string;
  playerName: string;
  amount: number;
  type: 'add' | 'subtract';
  ballNumber?: number;
  timestamp: number;
  note?: string;
}

export interface GameSession {
  id: string;
  players: Player[];
  history: Transaction[];
  status: GameState;
  createdAt: number;
  updatedAt: number;
}

export interface BallInfo {
  number: number;
  points: number;
  bgHex: string;
  textHex: string;
  isStripe: boolean;
  name: string;
  specialNote?: string;
}
