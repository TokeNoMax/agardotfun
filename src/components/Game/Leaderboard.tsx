
import { useEffect, useState, useCallback, useMemo } from "react";
import { Player } from "@/types/game";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useGame } from "@/context/GameContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { ChevronDown, ChevronUp } from "lucide-react";

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
  const [memeToasts, setMemeToasts] = useState<MemeToast[]>([]);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { customPhrases } = useGame();
  const isMobile = useIsMobile();

  // FIXED: Memoize sorted players to prevent unnecessary re-renders
  const sortedPlayers = useMemo(() => {
    return [...players]
      .filter(player => player.isAlive)
      .sort((a, b) => b.size - a.size);
  }, [players]);

  // FIXED: Memoize player IDs to detect actual changes
  const currentPlayerIds = useMemo(() => 
    players.map(p => `${p.id}-${p.isAlive}-${Math.floor(p.size)}`).join(','),
    [players]
  );

  // FIXED: Use ref to track previous state to avoid dependency issues
  const previousPlayerIdsRef = useState(currentPlayerIds)[0];

  // FIXED: Stable callback with proper dependencies
  const addMemeToast = useCallback((playerName: string) => {
    if (!customPhrases || customPhrases.length === 0) return;
    
    const randomPhrase = customPhrases[Math.floor(Math.random() * customPhrases.length)];
    const formattedMessage = randomPhrase.replace(/{playerName}/g, playerName);
    
    const newToast: MemeToast = {
      id: `${Date.now()}-${Math.random()}`,
      message: formattedMessage,
      timestamp: Date.now()
    };
    
    setMemeToasts(prev => [...prev, newToast]);
    
    setTimeout(() => {
      setMemeToasts(prev => prev.filter(toast => toast.id !== newToast.id));
    }, 3000);
  }, [customPhrases]);

  // FIXED: Only check for eliminations when player IDs actually change
  useEffect(() => {
    if (previousPlayerIdsRef !== currentPlayerIds && players.length > 0) {
      console.log('Leaderboard: Player state changed, checking for eliminations');
      
      // Simple elimination detection based on isAlive status change
      const eliminatedPlayers = players.filter(player => !player.isAlive);
      
      eliminatedPlayers.forEach(eliminatedPlayer => {
        // Find potential eliminator (alive player with increased size)
        const potentialEliminator = players.find(p => 
          p.isAlive && p.id !== eliminatedPlayer.id && p.size > 20 // Basic size threshold
        );
        
        if (potentialEliminator && onPlayerEaten) {
          console.log(`Leaderboard: ${eliminatedPlayer.name} eliminated by ${potentialEliminator.name}`);
          onPlayerEaten(eliminatedPlayer, potentialEliminator);
        }
        
        // Add meme toast
        addMemeToast(eliminatedPlayer.name);
      });
    }
  }, [currentPlayerIds, players, onPlayerEaten, addMemeToast, previousPlayerIdsRef]);

  if (!players || players.length === 0) {
    return null;
  }

  return (
    <>
      <Card className={`bg-black/80 backdrop-blur-sm text-white border-gray-700 ${
        isMobile ? 'w-full max-w-[200px]' : 'w-full max-w-xs'
      }`}>
        <CardHeader className={`${isMobile ? 'p-2' : 'p-3'} ${isMobile ? 'cursor-pointer' : ''}`} 
                   onClick={isMobile ? () => setIsCollapsed(!isCollapsed) : undefined}>
          <div className="flex items-center justify-between">
            <CardTitle className={`${isMobile ? 'text-sm' : 'text-lg'}`}>
              {isMobile ? 'Score' : 'Classement'}
            </CardTitle>
            {isMobile && (
              <div className="flex items-center text-xs text-white/70">
                {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
              </div>
            )}
          </div>
        </CardHeader>
        
        {(!isMobile || !isCollapsed) && (
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-700">
                  <TableHead className={`text-white ${isMobile ? 'p-1 w-6 text-xs' : 'p-2 w-10'}`}>#</TableHead>
                  <TableHead className={`text-white ${isMobile ? 'p-1 text-xs' : 'p-2'}`}>
                    {isMobile ? 'Nom' : 'Joueur'}
                  </TableHead>
                  <TableHead className={`text-white ${isMobile ? 'p-1 text-xs' : 'p-2'} text-right`}>
                    {isMobile ? 'Pts' : 'Taille'}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(isMobile ? sortedPlayers.slice(0, 5) : sortedPlayers).map((player, index) => (
                  <TableRow 
                    key={`${player.id}-${player.isAlive}-${Math.floor(player.size)}`}
                    className={`border-gray-700 ${player.id === currentPlayerId ? 'bg-primary/20' : ''}`}
                  >
                    <TableCell className={`${isMobile ? 'p-1 text-xs' : 'p-2'}`}>{index + 1}</TableCell>
                    <TableCell className={`${isMobile ? 'p-1' : 'p-2'}`}>
                      <div className="flex items-center gap-1">
                        <div 
                          className={`${isMobile ? 'w-2 h-2' : 'w-3 h-3'} rounded-full`}
                          style={{ backgroundColor: `#${getColorHex(player.color)}` }}
                        />
                        <span className={`${isMobile ? 'text-xs' : ''} ${isMobile && player.name.length > 8 ? 'truncate max-w-[60px]' : ''}`}>
                          {isMobile && player.name.length > 8 ? player.name.substring(0, 8) + '...' : player.name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className={`${isMobile ? 'p-1 text-xs' : 'p-2'} text-right`}>
                      {Math.round(player.size)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        )}
      </Card>
      
      {/* Meme toasts display */}
      <div className={`fixed ${isMobile ? 'bottom-16 left-2' : 'bottom-4 left-4'} z-50 flex flex-col gap-2`}>
        {memeToasts.map(toast => (
          <div 
            key={toast.id}
            className={`bg-gradient-to-r from-purple-600 to-blue-500 text-white ${
              isMobile ? 'px-2 py-1 text-xs' : 'px-4 py-2'
            } rounded-lg shadow-lg animate-fade-in flex items-center gap-2`}
          >
            <span className={`${isMobile ? 'text-lg' : 'text-2xl'}`}>🚀</span>
            <span className={`font-bold ${isMobile ? 'text-xs' : ''}`}>{toast.message}</span>
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
