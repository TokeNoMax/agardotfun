
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useGame } from "@/context/GameContext";
import { PlayerColor } from "@/types/game";
import { generateName } from "@/utils/nameGenerator";
import { generateColor } from "@/utils/colorGenerator";
import { Dice6 } from "lucide-react";

const colors: PlayerColor[] = [
  'blue', 'red', 'green', 'yellow', 'purple', 'orange', 'cyan', 'pink'
];

export default function PlayerCustomization() {
  const { player, setPlayerDetails } = useGame();
  const [name, setName] = useState(player?.name || "");
  const [selectedColor, setSelectedColor] = useState<PlayerColor>(player?.color || 'blue');

  const handleSave = () => {
    if (name.trim()) {
      setPlayerDetails(name.trim(), selectedColor);
    }
  };

  const handleRandomize = () => {
    const randomName = generateName();
    const randomColor = generateColor();
    setName(randomName);
    setSelectedColor(randomColor);
  };

  const getColorHex = (color: PlayerColor): string => {
    const colorMap: Record<PlayerColor, string> = {
      blue: '#3498db',
      red: '#e74c3c',
      green: '#2ecc71',
      yellow: '#f1c40f',
      purple: '#9b59b6',
      orange: '#e67e22',
      cyan: '#1abc9c',
      pink: '#fd79a8'
    };
    return colorMap[color];
  };

  return (
    <div className="space-y-6 p-1">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-cyber-cyan font-mono mb-2">BLOB_PROTOCOL</h2>
        <p className="text-gray-400 text-sm font-mono">
          Configurez votre identité dans l'écosystème agar3.fun
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="name" className="text-cyber-green font-mono">NOM_DU_BLOB</Label>
          <div className="flex gap-2 mt-1">
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Entrez votre nom..."
              className="bg-gray-900/50 border-cyber-cyan/30 text-gray-300 font-mono"
              maxLength={20}
            />
            <Button 
              variant="outline" 
              size="icon"
              onClick={handleRandomize}
              className="border-cyber-yellow/50 text-cyber-yellow hover:bg-cyber-yellow/10"
            >
              <Dice6 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div>
          <Label className="text-cyber-green font-mono">COULEUR_PROTOCOL</Label>
          <div className="grid grid-cols-4 gap-3 mt-2">
            {colors.map((color) => (
              <button
                key={color}
                onClick={() => setSelectedColor(color)}
                className={`w-full h-12 rounded-lg border-2 transition-all duration-200 ${
                  selectedColor === color 
                    ? 'border-cyber-green shadow-[0_0_15px_rgba(0,255,0,0.5)]' 
                    : 'border-gray-600 hover:border-cyber-cyan/50'
                }`}
                style={{ backgroundColor: getColorHex(color) }}
              />
            ))}
          </div>
        </div>

        <div className="pt-4">
          <Button 
            onClick={handleSave}
            disabled={!name.trim()}
            className="w-full bg-gradient-to-r from-cyber-green to-cyber-cyan hover:from-cyber-cyan hover:to-cyber-green text-black font-mono font-bold"
          >
            VALIDER_PROTOCOL
          </Button>
        </div>

        {player && (
          <div className="mt-6 p-4 bg-cyber-green/10 rounded-lg border border-cyber-green/30">
            <div className="flex items-center justify-center gap-3">
              <div 
                className="w-8 h-8 rounded-full border border-cyber-green/50"
                style={{ backgroundColor: getColorHex(player.color) }}
              />
              <span className="text-cyber-green font-bold font-mono">{player.name}</span>
            </div>
            <p className="text-center text-xs text-gray-400 mt-2 font-mono">
              BLOB_PROTOCOL_ACTIVATED
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
