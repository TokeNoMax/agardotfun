
import { supabase } from "@/integrations/supabase/client";
import { GameState } from "../game/gameStateService";

export interface GameStateSyncCallbacks {
  onGameStateUpdate?: (gameState: GameState) => void;
  onFoodConsumed?: (foodId: string) => void;
  onMapUpdate?: (mapSeed: string) => void;
}

export class GameStateSyncService {
  private roomId: string;
  private channel: any;
  private callbacks: GameStateSyncCallbacks;

  constructor(roomId: string, callbacks: GameStateSyncCallbacks) {
    this.roomId = roomId;
    this.callbacks = callbacks;
  }

  async connect() {
    console.log("Connecting to game state sync for room:", this.roomId);

    this.channel = supabase
      .channel(`game-state-${this.roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'game_rooms',
          filter: `id=eq.${this.roomId}`
        },
        this.handleGameRoomUpdate.bind(this)
      )
      .subscribe((status) => {
        console.log('Game state sync status:', status);
      });

    return this.channel;
  }

  private handleGameRoomUpdate(payload: any) {
    console.log('Game room updated:', payload);
    
    if (payload.new && payload.new.game_state) {
      // Safely cast and validate the game state
      const gameState = payload.new.game_state as unknown as GameState;
      
      // Validate the structure before using it
      if (gameState && typeof gameState === 'object' && gameState.mapSeed) {
        this.callbacks.onGameStateUpdate?.(gameState);
        
        // Check for newly consumed foods
        if (payload.old && payload.old.game_state) {
          const oldState = payload.old.game_state as unknown as GameState;
          
          // Safely handle consumedFoods arrays
          const newFoods = Array.isArray(gameState.consumedFoods) ? gameState.consumedFoods : [];
          const oldFoods = Array.isArray(oldState.consumedFoods) ? oldState.consumedFoods : [];
          
          const newlyConsumedFoods = newFoods.filter(
            foodId => !oldFoods.includes(foodId)
          );
          
          newlyConsumedFoods.forEach(foodId => {
            this.callbacks.onFoodConsumed?.(foodId);
          });
        }
        
        // Check for map seed changes
        if (payload.new.game_seed !== payload.old?.game_seed) {
          this.callbacks.onMapUpdate?.(payload.new.game_seed);
        }
      } else {
        console.warn('Invalid game state structure received:', gameState);
      }
    }
  }

  disconnect() {
    if (this.channel) {
      console.log('Disconnecting from game state sync');
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
  }
}
