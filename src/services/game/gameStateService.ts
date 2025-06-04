
import { supabase } from "@/integrations/supabase/client";
import { MapGenerator } from "./mapGenerator";

export interface GameState {
  mapSeed: string;
  consumedFoods: string[];
  gameStartTime: number;
  lastSyncTime: number;
  [key: string]: any; // Add index signature to make it compatible with Json type
}

export class GameStateService {
  // FIXED: Enhanced seed generation with timestamp and random component
  static async initializeGameState(roomId: string): Promise<string> {
    console.log("Initializing game state for room:", roomId);
    
    // FIXED: Generate more unique map seed with timestamp and random component
    const timestamp = Date.now();
    const randomComponent = Math.random().toString(36).substring(2, 15);
    const mapSeed = `${roomId}_${timestamp}_${randomComponent}`;
    
    console.log("Generated unique map seed:", mapSeed);
    
    const initialGameState: GameState = {
      mapSeed,
      consumedFoods: [],
      gameStartTime: timestamp,
      lastSyncTime: timestamp
    };

    // Update room with seed and initial state
    const { error } = await supabase
      .from('game_rooms')
      .update({
        game_seed: mapSeed,
        game_state: initialGameState as any // Cast to any to satisfy Json type
      })
      .eq('id', roomId);

    if (error) {
      console.error("Error initializing game state:", error);
      throw error;
    }

    console.log("Game state initialized with unique seed:", mapSeed);
    return mapSeed;
  }

  static async getGameState(roomId: string): Promise<GameState | null> {
    const { data, error } = await supabase
      .from('game_rooms')
      .select('game_seed, game_state')
      .eq('id', roomId)
      .single();

    if (error || !data) {
      console.error("Error getting game state:", error);
      return null;
    }

    if (!data.game_seed) {
      console.log("No game seed found, initializing with unique seed...");
      const newSeed = await this.initializeGameState(roomId);
      return {
        mapSeed: newSeed,
        consumedFoods: [],
        gameStartTime: Date.now(),
        lastSyncTime: Date.now()
      };
    }

    // Safely cast the game_state with proper type checking
    const gameState = data.game_state as unknown as GameState;
    
    // Validate the structure and provide defaults if needed
    if (!gameState || typeof gameState !== 'object') {
      console.warn("Invalid game state found, reinitializing with unique seed...");
      const newSeed = await this.initializeGameState(roomId);
      return {
        mapSeed: newSeed,
        consumedFoods: [],
        gameStartTime: Date.now(),
        lastSyncTime: Date.now()
      };
    }

    return {
      mapSeed: gameState.mapSeed || data.game_seed,
      consumedFoods: Array.isArray(gameState.consumedFoods) ? gameState.consumedFoods : [],
      gameStartTime: gameState.gameStartTime || Date.now(),
      lastSyncTime: gameState.lastSyncTime || Date.now()
    };
  }

  static async consumeFood(roomId: string, foodId: string): Promise<void> {
    try {
      // Get current state
      const currentState = await this.getGameState(roomId);
      if (!currentState) return;

      // Add food to consumed list if not already consumed
      if (!currentState.consumedFoods.includes(foodId)) {
        const updatedState: GameState = {
          ...currentState,
          consumedFoods: [...currentState.consumedFoods, foodId],
          lastSyncTime: Date.now()
        };

        // Update database
        const { error } = await supabase
          .from('game_rooms')
          .update({
            game_state: updatedState as any // Cast to any to satisfy Json type
          })
          .eq('id', roomId);

        if (error) {
          console.error("Error updating consumed foods:", error);
        } else {
          console.log("Food consumed and synced:", foodId);
        }
      }
    } catch (error) {
      console.error("Error in consumeFood:", error);
    }
  }

  // FIXED: Enhanced spawn synchronization with unique positions
  static async syncPlayerSpawn(roomId: string, playerId: string, spawnIndex: number): Promise<void> {
    try {
      const gameState = await this.getGameState(roomId);
      if (!gameState) return;

      const map = MapGenerator.generateMap(gameState.mapSeed);
      const spawnPoint = MapGenerator.getSpawnPoint(map.spawnPoints, spawnIndex);

      console.log(`Syncing spawn for player ${playerId} at index ${spawnIndex}:`, spawnPoint);

      // Update player position in database
      const { error } = await supabase
        .from('game_room_players')
        .update({
          x: spawnPoint.x,
          y: spawnPoint.y,
          size: 15, // Initial size
          is_alive: true, // Ensure player is alive
          last_position_update: new Date().toISOString()
        })
        .eq('room_id', roomId)
        .eq('player_id', playerId);

      if (error) {
        console.error("Error syncing player spawn:", error);
      } else {
        console.log(`Player ${playerId} spawned at:`, spawnPoint);
      }
    } catch (error) {
      console.error("Error in syncPlayerSpawn:", error);
    }
  }
}
