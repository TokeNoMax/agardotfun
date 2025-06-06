import { Player, Food, Rug, PlayerColor } from "@/types/game";
import { computeSpeedFromSize } from "./speedUtil";

export interface Bot extends Player {
  targetX: number;
  targetY: number;
  lastDirectionChange: number;
  aggressionLevel: number;
  reactionTime: number;
}

export class BotService {
  private static botNames = [
    "Alpha", "Beta", "Gamma", "Delta", "Epsilon", 
    "Zeta", "Theta", "Lambda", "Sigma", "Omega"
  ];

  private static botColors: PlayerColor[] = [
    "red", "green", "yellow", "purple", "orange", "cyan", "pink"
  ];

  static initSoloBots(gameWidth: number, gameHeight: number, playerPlayerId: string): Bot[] {
    const numBots = 4;
    const bots: Bot[] = [];

    for (let i = 0; i < numBots; i++) {
      const bot: Bot = {
        id: `bot-${i}`,
        walletAddress: `bot-${i}`,
        name: this.botNames[i % this.botNames.length],
        color: this.botColors[i % this.botColors.length],
        size: 15,
        x: Math.random() * (gameWidth - 200) + 100,
        y: Math.random() * (gameHeight - 200) + 100,
        isAlive: true,
        targetX: 0,
        targetY: 0,
        lastDirectionChange: Date.now(),
        aggressionLevel: Math.random() * 0.5 + 0.3, // 0.3 to 0.8
        reactionTime: Math.random() * 1000 + 500 // 500ms to 1.5s
      };

      // Set initial random target
      bot.targetX = Math.random() * gameWidth;
      bot.targetY = Math.random() * gameHeight;

      bots.push(bot);
    }

    return bots;
  }

  static updateSoloBots(
    bots: Bot[], 
    foods: Food[], 
    players: Player[], 
    gameWidth: number, 
    gameHeight: number,
    delta: number
  ): Bot[] {
    const currentTime = Date.now();

    return bots.map(bot => {
      if (!bot.isAlive) return bot;

      // Update bot AI every reaction time interval
      if (currentTime - bot.lastDirectionChange > bot.reactionTime) {
        this.updateBotTarget(bot, foods, players, gameWidth, gameHeight);
        bot.lastDirectionChange = currentTime;
      }

      // Move towards target using new speed system
      this.moveBotTowardsTarget(bot, delta);

      return bot;
    });
  }

  private static updateBotTarget(
    bot: Bot, 
    foods: Food[], 
    players: Player[], 
    gameWidth: number, 
    gameHeight: number
  ) {
    const nearbyFood = this.findNearestFood(bot, foods);
    const threats = this.findThreats(bot, players);
    const prey = this.findPrey(bot, players);

    // Priority 1: Avoid threats
    if (threats.length > 0) {
      this.setAvoidanceTarget(bot, threats, gameWidth, gameHeight);
      return;
    }

    // Priority 2: Chase prey if aggressive enough
    if (prey.length > 0 && bot.aggressionLevel > 0.6) {
      const closestPrey = prey[0];
      bot.targetX = closestPrey.x;
      bot.targetY = closestPrey.y;
      return;
    }

    // Priority 3: Go for food
    if (nearbyFood) {
      bot.targetX = nearbyFood.x;
      bot.targetY = nearbyFood.y;
      return;
    }

    // Default: Random movement
    bot.targetX = Math.random() * gameWidth;
    bot.targetY = Math.random() * gameHeight;
  }

  private static findNearestFood(bot: Bot, foods: Food[]): Food | null {
    let nearest: Food | null = null;
    let minDistance = Infinity;

    foods.forEach(food => {
      const distance = this.getDistance(bot, food);
      if (distance < minDistance && distance < 300) { // Only consider nearby food
        minDistance = distance;
        nearest = food;
      }
    });

    return nearest;
  }

  private static findThreats(bot: Bot, players: Player[]): Player[] {
    return players.filter(player => {
      if (!player.isAlive || player.id === bot.id) return false;
      
      const distance = this.getDistance(bot, player);
      const isThreat = player.size > bot.size * 1.2 && distance < 150;
      
      return isThreat;
    }).sort((a, b) => this.getDistance(bot, a) - this.getDistance(bot, b));
  }

  private static findPrey(bot: Bot, players: Player[]): Player[] {
    return players.filter(player => {
      if (!player.isAlive || player.id === bot.id) return false;
      
      const distance = this.getDistance(bot, player);
      const isPrey = bot.size > player.size * 1.2 && distance < 200;
      
      return isPrey;
    }).sort((a, b) => this.getDistance(bot, a) - this.getDistance(bot, b));
  }

  private static setAvoidanceTarget(
    bot: Bot, 
    threats: Player[], 
    gameWidth: number, 
    gameHeight: number
  ) {
    const threat = threats[0];
    
    // Calculate direction away from threat
    const dx = bot.x - threat.x;
    const dy = bot.y - threat.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > 0) {
      const avoidDistance = 200;
      bot.targetX = bot.x + (dx / distance) * avoidDistance;
      bot.targetY = bot.y + (dy / distance) * avoidDistance;
      
      // Keep within bounds
      bot.targetX = Math.max(50, Math.min(gameWidth - 50, bot.targetX));
      bot.targetY = Math.max(50, Math.min(gameHeight - 50, bot.targetY));
    }
  }

  private static moveBotTowardsTarget(bot: Bot, delta: number) {
    const dx = bot.targetX - bot.x;
    const dy = bot.targetY - bot.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > 5) {
      const speed = computeSpeedFromSize(bot.size);
      const normalizedDx = dx / distance;
      const normalizedDy = dy / distance;
      
      // Convert speed from px/s to px/frame using delta time
      const frameSpeed = speed * delta;
      
      bot.x += normalizedDx * frameSpeed;
      bot.y += normalizedDy * frameSpeed;
    }
  }

  private static getDistance(obj1: { x: number; y: number }, obj2: { x: number; y: number }): number {
    const dx = obj1.x - obj2.x;
    const dy = obj1.y - obj2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  static checkBotCollisions(
    bots: Bot[], 
    foods: Food[], 
    rugs: Rug[]
  ): { updatedBots: Bot[], updatedFoods: Food[] } {
    const updatedBots = [...bots];
    let updatedFoods = [...foods];

    updatedBots.forEach(bot => {
      if (!bot.isAlive) return;

      // Bot-Food collisions
      updatedFoods = updatedFoods.filter(food => {
        const dx = bot.x - food.x;
        const dy = bot.y - food.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < bot.size) {
          bot.size += 1; // Food value
          return false; // Remove food
        }
        return true;
      });

      // Bot-Rug collisions
      rugs.forEach(rug => {
        const dx = bot.x - rug.x;
        const dy = bot.y - rug.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < bot.size + rug.size) {
          bot.size = Math.max(10, bot.size - 5); // Rug penalty
          
          // Push bot away from rug
          if (distance > 0) {
            const pushFactor = 8;
            bot.x += (dx / distance) * pushFactor;
            bot.y += (dy / distance) * pushFactor;
          }
        }
      });
    });

    // Bot-Bot collisions
    for (let i = 0; i < updatedBots.length; i++) {
      for (let j = i + 1; j < updatedBots.length; j++) {
        const botA = updatedBots[i];
        const botB = updatedBots[j];
        
        if (!botA.isAlive || !botB.isAlive) continue;
        
        const dx = botA.x - botB.x;
        const dy = botA.y - botB.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < botA.size + botB.size) {
          if (botA.size > botB.size * 1.2) {
            botB.isAlive = false;
            botA.size += botB.size / 2;
          } else if (botB.size > botA.size * 1.2) {
            botA.isAlive = false;
            botB.size += botA.size / 2;
          } else {
            // Push apart
            const angle = Math.atan2(dy, dx);
            const pushDistance = 5;
            botA.x += Math.cos(angle) * pushDistance;
            botA.y += Math.sin(angle) * pushDistance;
            botB.x -= Math.cos(angle) * pushDistance;
            botB.y -= Math.sin(angle) * pushDistance;
          }
        }
      }
    }

    return { updatedBots, updatedFoods };
  }
}
