
/**
 * Pure utility functions for formatting data
 * No React dependencies - pure functions only
 */

/**
 * Format time duration in milliseconds to human readable string
 * @param milliseconds Duration in milliseconds
 * @returns Formatted time string
 */
export function formatGameDuration(milliseconds: number): string {
  if (milliseconds < 0) {
    return '00:00';
  }
  
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Format player size for display
 * @param size Player size (can be float)
 * @returns Formatted size string
 */
export function formatPlayerSize(size: number): string {
  if (size < 0) {
    return '0';
  }
  
  if (size < 100) {
    return Math.round(size).toString();
  }
  
  if (size < 1000) {
    return Math.round(size).toString();
  }
  
  // For large sizes, show with K suffix
  return `${Math.round(size / 100) / 10}K`;
}

/**
 * Format score for leaderboard display
 * @param score Numeric score
 * @returns Formatted score string
 */
export function formatScore(score: number): string {
  if (score < 0) {
    return '0';
  }
  
  if (score < 1000) {
    return score.toString();
  }
  
  if (score < 1000000) {
    return `${Math.round(score / 100) / 10}K`;
  }
  
  return `${Math.round(score / 100000) / 10}M`;
}

/**
 * Format wallet address for display (truncated)
 * @param address Full wallet address
 * @param prefixLength Length of prefix to show
 * @param suffixLength Length of suffix to show
 * @returns Truncated address
 */
export function formatWalletAddress(
  address: string,
  prefixLength: number = 6,
  suffixLength: number = 4
): string {
  if (!address || address.length <= prefixLength + suffixLength) {
    return address || '';
  }
  
  return `${address.slice(0, prefixLength)}...${address.slice(-suffixLength)}`;
}

/**
 * Format percentage for display
 * @param value Decimal value (0-1)
 * @param decimals Number of decimal places
 * @returns Formatted percentage string
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  if (value < 0 || value > 1) {
    return '0%';
  }
  
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Format distance for display
 * @param distance Distance value
 * @returns Formatted distance string
 */
export function formatDistance(distance: number): string {
  if (distance < 0) {
    return '0';
  }
  
  if (distance < 1000) {
    return `${Math.round(distance)}`;
  }
  
  return `${Math.round(distance / 100) / 10}K`;
}

/**
 * Format room status for display
 * @param status Room status code
 * @returns Human readable status
 */
export function formatRoomStatus(status: string): string {
  switch (status.toLowerCase()) {
    case 'waiting':
      return 'En attente';
    case 'playing':
      return 'En cours';
    case 'finished':
      return 'Terminée';
    default:
      return 'Inconnu';
  }
}

/**
 * Format player count for room display
 * @param current Current player count
 * @param max Maximum player count
 * @returns Formatted player count string
 */
export function formatPlayerCount(current: number, max: number): string {
  return `${current}/${max}`;
}

/**
 * Format elimination type for display
 * @param eliminationType Type of elimination
 * @returns Human readable elimination type
 */
export function formatEliminationType(eliminationType: string): string {
  switch (eliminationType.toLowerCase()) {
    case 'absorption':
      return 'Absorbé';
    case 'zone':
      return 'Zone de mort';
    case 'timeout':
      return 'Temps écoulé';
    default:
      return 'Éliminé';
  }
}
