import { toast } from "@/hooks/use-toast";

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
   * Shows an elimination notification with personalized message
   */
  static showEliminationNotification(event: EliminationEvent): void {
    const { eliminatedId, eliminatedName, eliminatorId, eliminatorName, type, currentPlayerId } = event;
    
    let title = "";
    let description = "";
    let variant: "default" | "destructive" = "default";

    // If current player was eliminated, show destructive variant
    if (eliminatedId === currentPlayerId) {
      variant = "destructive";
    }

    switch (type) {
      case 'absorption':
        if (eliminatorId && eliminatorName) {
          if (eliminatedId === currentPlayerId) {
            title = "Vous avez été éliminé !";
            description = `Vous avez été avalé par ${eliminatorName}`;
          } else if (eliminatorId === currentPlayerId) {
            title = "Élimination !";
            description = `Vous avez avalé ${eliminatedName}`;
          } else {
            title = "Élimination";
            description = `${eliminatedName} a été avalé par ${eliminatorName}`;
          }
        }
        break;

      case 'zone':
        if (eliminatedId === currentPlayerId) {
          title = "Vous avez été éliminé !";
          description = "Vous êtes mort dans la zone dangereuse";
        } else {
          title = "Mort dans la zone";
          description = `${eliminatedName} est mort dans la zone`;
        }
        break;

      case 'bot':
        if (eliminatedId === currentPlayerId) {
          title = "Vous avez été éliminé !";
          description = "Vous avez été éliminé par un bot";
        } else {
          title = "Élimination par bot";
          description = `${eliminatedName} a été éliminé par un bot`;
        }
        break;
    }

    // Show the toast notification for exactly 5 seconds
    this.showEliminationToast(title, description, variant);
  }

  /**
   * Shows elimination toast with custom duration (5 seconds)
   */
  private static showEliminationToast(title: string, description: string, variant: "default" | "destructive"): void {
    toast({
      title,
      description,
      variant,
      duration: this.NOTIFICATION_DURATION
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