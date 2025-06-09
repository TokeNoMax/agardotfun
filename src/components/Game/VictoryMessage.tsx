
import { Player } from "@/types/game";

interface VictoryMessageProps {
  winner: Player | null;
  gameMode: 'multiplayer' | 'zone' | 'local';
  eliminationType: 'absorption' | 'zone' | 'timeout';
}

export default function VictoryMessage({ winner, gameMode, eliminationType }: VictoryMessageProps) {
  // Get victory message based on context
  const getVictoryMessage = () => {
    if (!winner || !winner.name) return "Partie terminée";
    
    const messages = {
      multiplayer: [
        `${winner.name} domine totalement !`,
        `${winner.name} écrase la concurrence !`,
        `${winner.name} règne en maître !`,
        `${winner.name} est invincible !`,
        `${winner.name} terrasse ses adversaires !`
      ],
      zone: [
        `${winner.name} survit à l'apocalypse !`,
        `${winner.name} maîtrise la zone !`,
        `${winner.name} défie les éléments !`,
        `${winner.name} est un survivant !`
      ],
      local: [
        `Excellent travail !`,
        `Performance remarquable !`,
        `Tu progresses bien !`,
        `Continue comme ça !`
      ]
    };
    
    const modeMessages = messages[gameMode] || messages.multiplayer;
    return modeMessages[Math.floor(Math.random() * modeMessages.length)];
  };

  // Get elimination description
  const getEliminationDescription = () => {
    switch (eliminationType) {
      case 'absorption':
        return "Un adversaire a été éliminé par absorption";
      case 'zone':
        return "L'adversaire n'a pas survécu à la zone mortelle";
      case 'timeout':
        return "Temps écoulé - victoire par taille";
      default:
        return "Victoire éclatante !";
    }
  };

  return (
    <>
      <p className="text-xl font-bold text-green-600 mb-2 flex items-center justify-center gap-2">
        🏆 {getVictoryMessage()} 🏆
      </p>
      <p className="text-sm text-muted-foreground mt-2 flex items-center justify-center gap-1">
        {getEliminationDescription()}
      </p>
    </>
  );
}
