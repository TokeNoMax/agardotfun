
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useGame } from "@/context/GameContext";
import { PlayerColor } from "@/types/game";

const COLORS: PlayerColor[] = ['blue', 'red', 'green', 'yellow', 'purple', 'orange', 'cyan', 'pink'];

export default function PlayerCustomization() {
  const [name, setName] = useState("");
  const [selectedColor, setSelectedColor] = useState<PlayerColor>("blue");
  const { setPlayerDetails, player } = useGame();

  // Pre-fill form with player data if exists
  useEffect(() => {
    if (player) {
      setName(player.name);
      setSelectedColor(player.color);
    }
  }, [player]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      await setPlayerDetails(name, selectedColor);
    }
  };

  return (
    <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold text-center mb-6">Personnalisez votre blob</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Nom du blob</Label>
          <Input
            id="name"
            placeholder="Entrez le nom de votre blob"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={15}
          />
        </div>
        
        <div className="space-y-2">
          <Label>Choisissez une couleur</Label>
          <div className="grid grid-cols-4 gap-2">
            {COLORS.map((color) => (
              <button
                key={color}
                type="button"
                className={`w-12 h-12 rounded-full transition-all ${
                  selectedColor === color ? "ring-4 ring-offset-2 ring-black" : "hover:opacity-80"
                }`}
                style={{ backgroundColor: `#${getColorHex(color)}` }}
                onClick={() => setSelectedColor(color)}
                aria-label={`Sélectionner la couleur ${color}`}
              />
            ))}
          </div>
        </div>
        
        <div className="pt-2">
          {player ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div 
                  className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: `#${getColorHex(player.color)}` }}
                >
                  <span className="text-white font-bold">
                    {player.name.substring(0, 2)}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium">Actuellement</p>
                  <p className="font-bold">{player.name}</p>
                </div>
              </div>
              <Button type="submit">
                Modifier
              </Button>
            </div>
          ) : (
            <Button type="submit" className="w-full">
              Confirmer
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

// Helper function to get color hex
function getColorHex(color: string): string {
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
}
