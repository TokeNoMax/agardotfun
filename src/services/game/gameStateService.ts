
import { supabase } from "@/integrations/supabase/client";
import { MapGenerator } from "./mapGenerator";

export interface GameState {
  mapSeed: string;
  consumedFoods: string[];
  gameStartTime: number;
  lastSyncTime: number;
}

export class GameStateService {
  static async initializeGameState(roomId: string): Promise<string> {
    console.log("Initializing game state for room:", roomId);
    
    // Generate new map seed
    const mapSeed = MapGenerator.generateSeed(roomId);
    
    const initialGameState: GameState = {
      mapSeed,
      consumedFoods: [],
      gameStartTime: Date.now(),
      lastSyncTime: Date.now()
    };

    // Update room with seed and initial state
    const { error } = await supabase
      .from('game_rooms')
      .update({
        game_seed: mapSeed,
        game_state: initialGameState
      })
      .eq('id', roomId);

    if (error) {
      console.error("Error initializing game state:", error);
      throw error;
    }

    console.log("Game state initialized with seed:", mapSeed);
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
      console.log("No game seed found, initializing...");
      const newSeed = await this.initializeGameState(roomId);
      return {
        mapSeed: newSeed,
        consumedFoods: [],
        gameStartTime: Date.now(),
        lastSyncTime: Date.now()
      };
    }

    return data.game_state as GameState;
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
            game_state: updatedState
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

  static async syncPlayerSpawn(roomId: string, playerId: string, spawnIndex: number): Promise<void> {
    try {
      const gameState = await this.getGameState(roomId);
      if (!gameState) return;

      const map = MapGenerator.generateMap(gameState.mapSeed);
      const spawnPoint = MapGenerator.getSpawnPoint(map.spawnPoints, spawnIndex);

      // Update player position in database
      const { error } = await supabase
        .from('game_room_players')
        .update({
          x: spawnPoint.x,
          y: spawnPoint.y,
          size: 15, // Initial size
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
