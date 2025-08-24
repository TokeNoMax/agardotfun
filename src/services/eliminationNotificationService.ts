import { toast } from "@/hooks/use-toast";
import { EliminationToast } from "@/components/Game/EliminationToast";

export interface EliminationEvent {
  eliminatedId: string;
  eliminatedName: string;
  eliminatorId?: string;
  eliminatorName?: string;
  type: 'absorption' | 'zone' | 'bot';
  currentPlayerId?: string;
}

export class EliminationNotificationService {
  private static readonly NOTIFICATION_DURATION = 5000; // 5 seconds as requested

  /**
   * Shows an elimination notification with cyberpunk styling
   */
  static showEliminationNotification(event: EliminationEvent): void {
    const { eliminatedId, eliminatedName, eliminatorId, eliminatorName, type, currentPlayerId } = event;
    
    const isPlayerEliminated = eliminatedId === currentPlayerId;
    const isPlayerInvolved = eliminatedId === currentPlayerId || eliminatorId === currentPlayerId;
    
    // Determine variant based on type and player involvement
    let variant: "elimination" | "death" | "zone" | "victory" = "elimination";
    
    if (isPlayerEliminated) {
      variant = type === 'zone' ? "zone" : "death";
    } else if (isPlayerInvolved && type === 'absorption') {
      variant = "victory";
    } else if (type === 'zone') {
      variant = "zone";
    }

    // Show the cyberpunk toast notification
    this.showCyberpunkToast(event, variant, isPlayerInvolved, isPlayerEliminated);
  }

  /**
   * Shows cyberpunk-styled elimination toast
   */
  private static showCyberpunkToast(
    event: EliminationEvent, 
    variant: "elimination" | "death" | "zone" | "victory",
    isPlayerInvolved: boolean,
    isPlayerEliminated: boolean
  ): void {
    const { eliminatedName, eliminatorName, type } = event;
    
    toast({
      variant: variant as any,
      duration: this.NOTIFICATION_DURATION,
      description: `${eliminatedName} ${type === 'zone' ? 'est mort dans la zone' : eliminatorName ? `a été éliminé par ${eliminatorName}` : 'a été éliminé'}`
    });
  }

  /**
   * Utility to get player name from player list
   */
  static getPlayerName(playerId: string, players: Array<{ id: string; name: string }>): string {
    const player = players.find(p => p.id === playerId);
    return player?.name || playerId;
  }
}