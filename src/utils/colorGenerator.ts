
import { PlayerColor } from '@/types/game';

const colors: PlayerColor[] = [
  'cyber-yellow',
  'cyber-cyan',
  'cyber-magenta',
  'cyber-green',
  'cyber-blue',
  'cyber-purple',
  'cyber-orange',
  'cyber-red'
];

export function generateColor(): PlayerColor {
  return colors[Math.floor(Math.random() * colors.length)];
}
