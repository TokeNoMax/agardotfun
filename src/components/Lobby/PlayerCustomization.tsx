
import { useState } from "react";
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      setPlayerDetails(name, selectedColor);
    }
  };

  return (
    <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold text-center mb-6">Customize Your Blob</h2>
      
      {player ? (
        <div className="text-center">
          <div 
            className={`w-24 h-24 rounded-full mx-auto mb-4 bg-game-${player.color} animate-pulse`}
          >
            <span className="flex items-center justify-center h-full text-white font-bold">
              {player.name.substring(0, 2)}
            </span>
          </div>
          <p className="text-lg font-medium">Ready to play as <span className="font-bold">{player.name}</span></p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Blob Name</Label>
            <Input
              id="name"
              placeholder="Enter your blob name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={15}
            />
          </div>
          
          <div className="space-y-2">
            <Label>Choose Color</Label>
            <div className="grid grid-cols-4 gap-2">
              {COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`w-12 h-12 rounded-full bg-game-${color} transition-all ${
                    selectedColor === color ? "ring-4 ring-offset-2 ring-black" : "hover:opacity-80"
                  }`}
                  onClick={() => setSelectedColor(color)}
                  aria-label={`Select ${color} color`}
                />
              ))}
            </div>
          </div>
          
          <Button type="submit" className="w-full">
            Confirm
          </Button>
        </form>
      )}
    </div>
  );
}
