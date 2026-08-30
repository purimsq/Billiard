import { BallInfo } from '@/types/game';

export const BALL_DEFINITIONS: BallInfo[] = [
  { number: 1, points: 16, bgHex: '#EAB308', textHex: '#000000', isStripe: false, name: '1-Ball', specialNote: 'Late Rotation' },
  { number: 2, points: 17, bgHex: '#2563EB', textHex: '#FFFFFF', isStripe: false, name: '2-Ball', specialNote: 'Late Rotation' },
  { number: 3, points: 6,  bgHex: '#DC2626', textHex: '#FFFFFF', isStripe: false, name: '3-Ball' },
  { number: 4, points: 6,  bgHex: '#7C3AED', textHex: '#FFFFFF', isStripe: false, name: '4-Ball' },
  { number: 5, points: 6,  bgHex: '#EA580C', textHex: '#FFFFFF', isStripe: false, name: '5-Ball' },
  { number: 6, points: 6,  bgHex: '#059669', textHex: '#FFFFFF', isStripe: false, name: '6-Ball' },
  { number: 7, points: 7,  bgHex: '#B91C1C', textHex: '#FFFFFF', isStripe: false, name: '7-Ball' },
  { number: 8, points: 8,  bgHex: '#18181B', textHex: '#FFFFFF', isStripe: false, name: '8-Ball' },
  { number: 9, points: 9,  bgHex: '#EAB308', textHex: '#000000', isStripe: true,  name: '9-Ball' },
  { number: 10, points: 10, bgHex: '#2563EB', textHex: '#FFFFFF', isStripe: true,  name: '10-Ball' },
  { number: 11, points: 11, bgHex: '#DC2626', textHex: '#FFFFFF', isStripe: true,  name: '11-Ball' },
  { number: 12, points: 12, bgHex: '#7C3AED', textHex: '#FFFFFF', isStripe: true,  name: '12-Ball' },
  { number: 13, points: 13, bgHex: '#EA580C', textHex: '#FFFFFF', isStripe: true,  name: '13-Ball' },
  { number: 14, points: 14, bgHex: '#059669', textHex: '#FFFFFF', isStripe: true,  name: '14-Ball' },
  { number: 15, points: 15, bgHex: '#B91C1C', textHex: '#FFFFFF', isStripe: true,  name: '15-Ball' },
];

export function getBallByNumber(ballNum: number): BallInfo | undefined {
  return BALL_DEFINITIONS.find(b => b.number === ballNum);
}

export function calculateBallPoints(ballNum: number): number {
  const ball = getBallByNumber(ballNum);
  return ball ? ball.points : 0;
}

export const PLAYER_COLORS = [
  '#4F46E5', // Indigo
  '#059669', // Emerald
  '#D97706', // Amber
  '#DC2626', // Red
  '#7C3AED', // Violet
  '#0284C7', // Sky
  '#EC4899', // Pink
  '#65A30D', // Lime
];

export function getRandomPlayerColor(index: number): string {
  return PLAYER_COLORS[index % PLAYER_COLORS.length];
}
