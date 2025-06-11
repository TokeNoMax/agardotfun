
/**
 * Pure validation logic for game inputs
 * No React dependencies - pure functions only
 */

import { PlayerColor } from '@/types/game';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validate player name
 * @param name Player name to validate
 * @returns Validation result
 */
export function validatePlayerName(name: string): ValidationResult {
  const errors: string[] = [];
  
  if (!name || typeof name !== 'string') {
    errors.push('Name is required');
  } else {
    if (name.trim().length === 0) {
      errors.push('Name cannot be empty');
    }
    
    if (name.trim().length > 20) {
      errors.push('Name must be 20 characters or less');
    }
    
    if (name.trim().length < 2) {
      errors.push('Name must be at least 2 characters');
    }
    
    // Check for invalid characters
    const validNameRegex = /^[a-zA-Z0-9\s\-_]+$/;
    if (!validNameRegex.test(name.trim())) {
      errors.push('Name can only contain letters, numbers, spaces, hyphens, and underscores');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate player color
 * @param color Player color to validate
 * @returns Validation result
 */
export function validatePlayerColor(color: any): ValidationResult {
  const errors: string[] = [];
  const validColors: PlayerColor[] = [
    'blue', 'red', 'green', 'yellow', 'purple', 'orange', 'cyan', 'pink'
  ];
  
  if (!color) {
    errors.push('Color is required');
  } else if (!validColors.includes(color)) {
    errors.push(`Color must be one of: ${validColors.join(', ')}`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate wallet address format
 * @param address Wallet address to validate
 * @returns Validation result
 */
export function validateWalletAddress(address: string): ValidationResult {
  const errors: string[] = [];
  
  if (!address || typeof address !== 'string') {
    errors.push('Wallet address is required');
  } else {
    // Basic Solana address validation (base58, 32-44 characters)
    const solanaAddressRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    if (!solanaAddressRegex.test(address)) {
      errors.push('Invalid Solana wallet address format');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate room name
 * @param name Room name to validate
 * @returns Validation result
 */
export function validateRoomName(name: string): ValidationResult {
  const errors: string[] = [];
  
  if (!name || typeof name !== 'string') {
    errors.push('Room name is required');
  } else {
    if (name.trim().length === 0) {
      errors.push('Room name cannot be empty');
    }
    
    if (name.trim().length > 50) {
      errors.push('Room name must be 50 characters or less');
    }
    
    if (name.trim().length < 3) {
      errors.push('Room name must be at least 3 characters');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate game coordinates
 * @param x X coordinate
 * @param y Y coordinate
 * @param mapWidth Map width limit
 * @param mapHeight Map height limit
 * @returns Validation result
 */
export function validateCoordinates(
  x: number,
  y: number,
  mapWidth: number = 3000,
  mapHeight: number = 3000
): ValidationResult {
  const errors: string[] = [];
  
  if (typeof x !== 'number' || isNaN(x)) {
    errors.push('X coordinate must be a valid number');
  } else if (x < 0 || x > mapWidth) {
    errors.push(`X coordinate must be between 0 and ${mapWidth}`);
  }
  
  if (typeof y !== 'number' || isNaN(y)) {
    errors.push('Y coordinate must be a valid number');
  } else if (y < 0 || y > mapHeight) {
    errors.push(`Y coordinate must be between 0 and ${mapHeight}`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate player size
 * @param size Player size to validate
 * @returns Validation result
 */
export function validatePlayerSize(size: number): ValidationResult {
  const errors: string[] = [];
  
  if (typeof size !== 'number' || isNaN(size)) {
    errors.push('Size must be a valid number');
  } else {
    if (size <= 0) {
      errors.push('Size must be greater than 0');
    }
    
    if (size > 10000) {
      errors.push('Size cannot exceed 10000');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}
