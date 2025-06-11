
import { useState } from "react";
import { useGame } from "@/context/GameContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Palette, User, Shuffle } from "lucide-react";
import { generateName } from "@/utils/nameGenerator";
import { generateColor } from "@/utils/colorGenerator";

export default function PlayerCustomization() {
  const { player, updatePlayerName, updatePlayerColor } = useGame();
  const [tempName, setTempName] = useState(player?.name || "");
  const [tempColor, setTempColor] = useState(player?.color || "#00FF00");

  const handleUpdateName = () => {
    if (tempName.trim()) {
      updatePlayerName(tempName.trim());
    }
  };

  const handleUpdateColor = (color: string) => {
    setTempColor(color);
    updatePlayerColor(color);
  };

  const handleRandomName = () => {
    const randomName = generateName();
    setTempName(randomName);
    updatePlayerName(randomName);
  };

  const handleRandomColor = () => {
    const randomColor = generateColor();
    handleUpdateColor(randomColor);
  };

  const predefinedColors = [
    "#FF0000", "#00FF00", "#0000FF", "#FFFF00", 
    "#FF00FF", "#00FFFF", "#FFA500", "#800080"
  ];

  return (
    <div className="w-full max-w-md bg-black/90 backdrop-blur-sm rounded-lg border-2 border-cyber-cyan/50 shadow-[0_0_20px_rgba(0,255,255,0.2)] p-6">
      <h2 className="text-xl font-bold text-cyber-cyan mb-4 font-mono">PLAYER_CONFIG</h2>
      
      <div className="space-y-4">
        {/* Name Configuration */}
        <div>
          <Label htmlFor="player-name" className="text-cyber-cyan font-mono text-sm">
            PLAYER_NAME
          </Label>
          <div className="flex gap-2 mt-1">
            <Input
              id="player-name"
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              onBlur={handleUpdateName}
              onKeyDown={(e) => e.key === 'Enter' && handleUpdateName()}
              placeholder="Entrez votre nom"
              className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan font-mono"
            />
            <Button
              onClick={handleRandomName}
              variant="outline"
              size="icon"
              className="text-cyber-cyan border-cyber-cyan/30 hover:bg-cyber-cyan/10"
              title="Nom aléatoire"
            >
              <Shuffle className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Color Configuration */}
        <div>
          <Label className="text-cyber-cyan font-mono text-sm">PLAYER_COLOR</Label>
          <div className="flex gap-2 mt-2 flex-wrap">
            {predefinedColors.map((color) => (
              <button
                key={color}
                onClick={() => handleUpdateColor(color)}
                className={`w-8 h-8 rounded-full border-2 transition-all duration-200 ${
                  tempColor === color 
                    ? 'border-cyber-cyan shadow-[0_0_10px_rgba(0,255,255,0.5)]' 
                    : 'border-gray-500 hover:border-cyber-cyan/50'
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
            <Button
              onClick={handleRandomColor}
              variant="outline"
              size="icon"
              className="w-8 h-8 text-cyber-cyan border-cyber-cyan/30 hover:bg-cyber-cyan/10"
              title="Couleur aléatoire"
            >
              <Palette className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Player Preview */}
        <div className="border border-cyber-cyan/30 rounded-lg p-3 bg-black/30">
          <p className="text-xs text-gray-400 font-mono mb-2">PREVIEW:</p>
          <div className="flex items-center gap-2">
            <div 
              className="w-6 h-6 rounded-full border border-cyber-cyan/50"
              style={{ backgroundColor: tempColor }}
            />
            <span className="text-cyber-cyan font-mono text-sm">
              {tempName || "Anonymous"}
            </span>
          </div>
        </div>

        {/* Player Status */}
        <div className="text-center">
          {player ? (
            <p className="text-cyber-green text-sm font-mono">
              ✓ PLAYER_READY
            </p>
          ) : (
            <p className="text-cyber-yellow text-sm font-mono">
              ⚠ CONFIGURATION_REQUIRED
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
