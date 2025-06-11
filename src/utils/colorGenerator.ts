
import { PlayerColor } from '@/types/game';

const colors: PlayerColor[] = [
  'blue',
  'red',
  'green',
  'yellow',
  'purple',
  'orange',
  'cyan',
  'pink'
];

export function generateColor(): PlayerColor {
  return colors[Math.floor(Math.random() * colors.length)];
}
