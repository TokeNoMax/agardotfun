
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSimplePlayer } from "@/hooks/useSimplePlayer";
import { generateColor } from "@/utils/colorGenerator";
import { SimpleWalletButton } from "@/components/wallet/SimpleWalletButton";
import { Palette, User, Shuffle } from "lucide-react";
import { PlayerColor } from "@/types/game";

export default function PlayerCustomization() {
  const { player, updatePlayer, createGuestPlayer, hasWallet } = useSimplePlayer();
  const [tempName, setTempName] = useState(player?.name || "");

  const handleNameUpdate = () => {
    if (tempName.trim()) {
      updatePlayer({ name: tempName.trim() });
    }
  };

  const handleRandomColor = () => {
    const newColor = generateColor();
    updatePlayer({ color: newColor });
  };

  const handleCreateGuest = () => {
    const guest = createGuestPlayer();
    setTempName(guest.name);
  };

  const colorOptions: Array<{ name: PlayerColor; hex: string }> = [
    { name: 'blue', hex: '#3498db' },
    { name: 'red', hex: '#e74c3c' },
    { name: 'green', hex: '#2ecc71' },
    { name: 'yellow', hex: '#f1c40f' },
    { name: 'purple', hex: '#9b59b6' },
    { name: 'orange', hex: '#e67e22' },
    { name: 'cyan', hex: '#1abc9c' },
    { name: 'pink', hex: '#fd79a8' }
  ];

  if (!player && !hasWallet) {
    return (
      <Card className="w-full max-w-md mx-auto bg-black/90 backdrop-blur-sm border-cyber-cyan/50">
        <CardHeader>
          <CardTitle className="text-center text-cyber-cyan font-mono">
            PLAYER_SETUP
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-gray-400 mb-4 font-mono text-sm text-center">
            Connect your wallet or play as guest
          </p>
          
          <div className="space-y-3">
            <SimpleWalletButton className="w-full" />
            
            <div className="text-center text-gray-500 font-mono text-xs">OR</div>
            
            <Button 
              onClick={handleCreateGuest}
              variant="outline"
              className="w-full border-cyber-green/50 text-cyber-green hover:bg-cyber-green/10 font-mono"
            >
              <User className="mr-2 w-4 h-4" />
              Play as Guest
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!player) {
    handleCreateGuest();
    return null;
  }

  return (
    <Card className="w-full max-w-md mx-auto bg-black/90 backdrop-blur-sm border-cyber-cyan/50 shadow-[0_0_20px_rgba(0,255,255,0.2)]">
      <CardHeader>
        <CardTitle className="text-center text-cyber-cyan font-mono flex items-center justify-center gap-2">
          <User className="w-5 h-5" />
          PLAYER_CUSTOMIZATION
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Player Preview */}
        <div className="text-center">
          <div 
            className="w-20 h-20 rounded-full mx-auto mb-3 flex items-center justify-center text-white font-bold text-2xl shadow-lg"
            style={{ backgroundColor: colorOptions.find(c => c.name === player.color)?.hex || '#3498db' }}
          >
            {player.name ? player.name.substring(0, 2).toUpperCase() : 'P'}
          </div>
          <p className="text-cyber-cyan font-mono text-sm">
            {player.name || 'Unnamed Player'}
          </p>
        </div>

        {/* Name Input */}
        <div className="space-y-2">
          <Label htmlFor="player-name" className="text-cyber-green font-mono">
            PLAYER_NAME
          </Label>
          <div className="flex gap-2">
            <Input
              id="player-name"
              type="text"
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              placeholder="Enter your name..."
              className="bg-black/50 border-cyber-green/50 text-white font-mono"
              maxLength={20}
            />
            <Button 
              onClick={handleNameUpdate}
              className="bg-cyber-green text-black hover:bg-cyber-green/80 font-mono font-bold"
            >
              SET
            </Button>
          </div>
        </div>

        {/* Color Selection */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-cyber-purple font-mono">
              PLAYER_COLOR
            </Label>
            <Button
              onClick={handleRandomColor}
              variant="outline"
              size="sm"
              className="border-cyber-purple/50 text-cyber-purple hover:bg-cyber-purple/10 font-mono"
            >
              <Shuffle className="w-4 h-4 mr-1" />
              RANDOM
            </Button>
          </div>
          
          <div className="grid grid-cols-4 gap-2">
            {colorOptions.map((color) => (
              <button
                key={color.name}
                onClick={() => updatePlayer({ color: color.name })}
                className={`w-12 h-12 rounded-full border-2 transition-all hover:scale-110 ${
                  player.color === color.name 
                    ? 'border-white shadow-lg shadow-white/50' 
                    : 'border-gray-600 hover:border-gray-400'
                }`}
                style={{ backgroundColor: color.hex }}
                title={color.name}
              />
            ))}
          </div>
        </div>

        {/* Player Stats Preview */}
        <div className="bg-black/50 rounded-lg p-3 border border-cyber-cyan/30">
          <div className="flex items-center gap-2 mb-2">
            <Palette className="w-4 h-4 text-cyber-cyan" />
            <span className="text-cyber-cyan font-mono text-sm">PROFILE_PREVIEW</span>
          </div>
          <div className="text-xs font-mono space-y-1 text-gray-300">
            <div>Name: <span className="text-cyber-green">{player.name || 'Not set'}</span></div>
            <div>Color: <span className="text-cyber-purple">{player.color || 'blue'}</span></div>
            <div>Status: <span className="text-cyber-cyan">
              {hasWallet ? `Wallet: ${player.walletAddress?.slice(0, 6)}...${player.walletAddress?.slice(-4)}` : 'Guest Player'}
            </span></div>
          </div>
        </div>

        {/* Wallet Connection for Guests */}
        {!hasWallet && (
          <div className="text-center pt-2 border-t border-gray-700">
            <p className="text-gray-400 font-mono text-xs mb-2">
              Connect wallet for enhanced features
            </p>
            <SimpleWalletButton variant="minimal" className="w-full" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
