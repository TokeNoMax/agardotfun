
import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useGame } from "@/context/GameContext";
import { PlayerColor } from "@/types/game";
import WalletButton from "@/components/Wallet/WalletButton";
import { Wallet } from "lucide-react";

const COLORS: PlayerColor[] = ['blue', 'red', 'green', 'yellow', 'purple', 'orange', 'cyan', 'pink'];

export default function PlayerCustomization() {
  const [name, setName] = useState("");
  const [selectedColor, setSelectedColor] = useState<PlayerColor>("blue");
  const { setPlayerDetails, player } = useGame();
  const { connected, publicKey } = useWallet();

  // Pre-fill form with player data if exists
  useEffect(() => {
    if (player) {
      setName(player.name);
      setSelectedColor(player.color);
    }
  }, [player]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!connected || !publicKey) {
      return; // Wallet must be connected
    }
    
    if (name.trim()) {
      await setPlayerDetails(name, selectedColor, publicKey.toString());
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (!connected || !publicKey) {
    return (
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold text-center mb-6">Connectez votre wallet</h2>
        
        <div className="text-center space-y-4">
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <Wallet className="h-12 w-12 text-blue-500 mx-auto mb-3" />
            <p className="text-blue-800 text-sm">
              Votre adresse wallet Solana sera votre identité unique dans le jeu.
              Connectez votre wallet pour continuer.
            </p>
          </div>
          
          <WalletButton className="w-full flex justify-center" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold text-center mb-6">Personnalisez votre blob</h2>
      
      <div className="mb-4 p-3 bg-green-50 rounded-lg border border-green-200">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-green-600" />
          <span className="text-sm font-medium text-green-800">
            Wallet connecté: {formatAddress(publicKey.toString())}
          </span>
        </div>
      </div>
      
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
                  <p className="text-xs text-gray-500">{formatAddress(player.walletAddress)}</p>
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
