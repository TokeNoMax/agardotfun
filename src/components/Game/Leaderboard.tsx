
import { useEffect, useState } from "react";
import { Player } from "@/types/game";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface LeaderboardProps {
  players: Player[];
  currentPlayerId?: string;
}

export default function Leaderboard({ players, currentPlayerId }: LeaderboardProps) {
  const [sortedPlayers, setSortedPlayers] = useState<Player[]>([]);

  // Sort players by size in descending order
  useEffect(() => {
    const sorted = [...players]
      .filter(player => player.isAlive)
      .sort((a, b) => b.size - a.size);
    setSortedPlayers(sorted);
  }, [players]);

  if (!players || players.length === 0) {
    return null;
  }

  return (
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
