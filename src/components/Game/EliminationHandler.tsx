import { EliminationNotificationService } from "@/services/eliminationNotificationService";
import { Player } from "@/types/game";
import { Bot } from "@/services/game/botService";

export const handleBotElimination = (
  me: Player,
  bot: Bot,
  isPlayerEliminator: boolean
) => {
  if (isPlayerEliminator) {
    // Player eliminated bot
    EliminationNotificationService.showEliminationNotification({
      eliminatedId: bot.id,
      eliminatedName: bot.name,
      eliminatorId: me.id,
      eliminatorName: me.name,
      type: 'absorption',
      currentPlayerId: me.id
    });
  } else {
    // Bot eliminated player
    EliminationNotificationService.showEliminationNotification({
      eliminatedId: me.id,
      eliminatedName: me.name,
      eliminatorId: bot.id,
      eliminatorName: bot.name,
      type: 'bot',
      currentPlayerId: me.id
    });
  }
};

export const handleZoneDeath = (player: Player) => {
  EliminationNotificationService.showEliminationNotification({
    eliminatedId: player.id,
    eliminatedName: player.name,
    type: 'zone',
    currentPlayerId: player.id
  });
};