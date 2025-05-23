
import { useEffect, useState, useCallback } from "react";
import { Player } from "@/types/game";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface LeaderboardProps {
  players: Player[];
  currentPlayerId?: string;
  onPlayerEaten?: (eatenPlayer: Player, eatenBy: Player) => void;
}

interface MemeToast {
  id: string;
  message: string;
  timestamp: number;
}

export default function Leaderboard({ players, currentPlayerId, onPlayerEaten }: LeaderboardProps) {
  const [sortedPlayers, setSortedPlayers] = useState<Player[]>([]);
  const [memeToasts, setMemeToasts] = useState<MemeToast[]>([]);
  const [previousPlayers, setPreviousPlayers] = useState<Player[]>([]);

  // Sort players by size in descending order
  useEffect(() => {
    const sorted = [...players]
      .filter(player => player.isAlive)
      .sort((a, b) => b.size - a.size);
    setSortedPlayers(sorted);
    
    // Check if any player was eaten
    if (previousPlayers.length > 0) {
      const eatenPlayers = previousPlayers.filter(
        prevPlayer => prevPlayer.isAlive && 
        !players.find(p => p.id === prevPlayer.id)?.isAlive
      );
      
      eatenPlayers.forEach(eatenPlayer => {
        // Find who potentially ate this player (player with increased size)
        const eatenBy = players.find(currentPlayer => 
          currentPlayer.isAlive && 
          previousPlayers.find(p => p.id === currentPlayer.id)?.size < currentPlayer.size
        );
        
        if (eatenBy && onPlayerEaten) {
          onPlayerEaten(eatenPlayer, eatenBy);
        }
        
        // Add meme toast regardless of callback
        addMemeToast(eatenPlayer.name);
      });
    }
    
    // Update previous players for next comparison
    setPreviousPlayers([...players]);
  }, [players, onPlayerEaten, previousPlayers]);

  // Function to add a new meme toast
  const addMemeToast = useCallback((playerName: string) => {
    const memePhrases = [
      `${playerName} s'est fait NFTiser! 🖼️`,
      `${playerName} a été liquidé comme un altcoin! 📉`,
      `${playerName} a dépensé tout son gas! ⛽`,
      `${playerName} est parti sur la blockchain! 🔗`,
      `${playerName} a été rugged! 💸`,
      `${playerName} a fait un bad trade! 📊`,
      `HODL raté pour ${playerName}! 💎`,
      `${playerName} a été mintable! 🔮`,
      `${playerName} est devenu un memecoin! 🪙`,
      `${playerName} a été forké! 🍴`
    ];
    
    const randomMeme = memePhrases[Math.floor(Math.random() * memePhrases.length)];
    
    const newToast: MemeToast = {
      id: Math.random().toString(36).substring(2, 9),
      message: randomMeme,
      timestamp: Date.now()
    };
    
    setMemeToasts(prev => [...prev, newToast]);
    
    // Remove toast after 3 seconds
    setTimeout(() => {
      setMemeToasts(prev => prev.filter(toast => toast.id !== newToast.id));
    }, 3000);
  }, []);

  if (!players || players.length === 0) {
    return null;
  }

  return (
    <>
      <Card className="w-full max-w-xs bg-black/80 backdrop-blur-sm text-white border-gray-700">
        <CardHeader className="p-3">
          <CardTitle className="text-lg">Classement</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-gray-700">
                <TableHead className="text-white p-2 w-10">#</TableHead>
                <TableHead className="text-white p-2">Joueur</TableHead>
                <TableHead className="text-white p-2 text-right">Taille</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedPlayers.map((player, index) => (
                <TableRow 
                  key={player.id} 
                  className={`border-gray-700 ${player.id === currentPlayerId ? 'bg-primary/20' : ''}`}
                >
                  <TableCell className="p-2">{index + 1}</TableCell>
                  <TableCell className="p-2">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: `#${getColorHex(player.color)}` }}
                      />
                      {player.name}
                    </div>
                  </TableCell>
                  <TableCell className="p-2 text-right">{Math.round(player.size)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      {/* Meme toasts display */}
      <div className="fixed bottom-4 left-4 z-50 flex flex-col gap-2">
        {memeToasts.map(toast => (
          <div 
            key={toast.id}
            className="bg-gradient-to-r from-purple-600 to-blue-500 text-white px-4 py-2 rounded-lg shadow-lg animate-fade-in flex items-center gap-2"
          >
            <span className="text-2xl">🚀</span>
            <span className="font-bold">{toast.message}</span>
          </div>
        ))}
      </div>
    </>
  );
}

// Helper function to get color hex (same as in Canvas.tsx)
const getColorHex = (color: string): string => {
  const colorMap: Record<string, string> = {
    blue: '3498db',
    red: 'e74c3c',
    green: '2ecc71',
    yellow: 'f1c40f',
    purple: '9b59b6',
    orange: 'e67e22',
    cyan: '1abc9c',
    pink: 'fd79a8'
  };
  return colorMap[color] || '3498db';
};
