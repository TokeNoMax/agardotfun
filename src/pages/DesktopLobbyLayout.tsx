
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { useGame } from "@/context/GameContext";
import { Target } from "lucide-react";
import PlayerCustomization from "@/features/lobby/components/PlayerCustomization";
import RoomList from "@/features/rooms/components/RoomList";
import QuickPlayButton from "@/features/rooms/components/QuickPlayButton";
import WalletButton from "@/features/wallet/components/WalletButton";
import AdminSheet from "@/features/admin/components/AdminSheet";

export default function DesktopLobbyLayout() {
  const { player } = useGame();

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Tron Grid Background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 opacity-20">
          <div className="grid-background"></div>
        </div>
        {/* Animated scan lines */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="scan-line"></div>
        </div>
      </div>

      {/* Header */}
      <div className="relative z-10 flex justify-between items-center p-6 border-b border-cyber-cyan/30 bg-black/50 backdrop-blur-sm">
        <div>
          <h1 className="text-3xl font-bold neon-gradient font-mono">BLOB_BATTLE</h1>
          <p className="text-cyber-cyan font-mono text-sm">Neural Network Gaming Protocol</p>
        </div>
        <div className="flex items-center gap-4">
          <WalletButton />
          <AdminSheet />
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Player & Quick Play */}
          <div className="space-y-6">
            <PlayerCustomization />
            
            {/* Game Mode Display */}
            <div className="bg-black/90 backdrop-blur-sm rounded-lg border-2 border-cyber-cyan/50 p-4">
              <h3 className="text-lg font-bold text-cyber-cyan font-mono mb-3">ACTIVE_MODE</h3>
              <Badge className="bg-cyber-green/20 text-cyber-green border-cyber-green/50 font-mono">
                <Target className="mr-2 h-4 w-4" />
                CLASSIC MODE
              </Badge>
              <p className="text-sm text-gray-400 font-mono mt-2">
                Survivez et grandissez en absorbant vos adversaires dans un combat épique.
              </p>
            </div>

            {/* Quick Play */}
            <div className="bg-black/90 backdrop-blur-sm rounded-lg border-2 border-cyber-cyan/50 p-4">
              <h3 className="text-lg font-bold text-cyber-cyan font-mono mb-3">QUICK_ACCESS</h3>
              <QuickPlayButton
                disabled={!player}
                className="w-full"
              />
            </div>
          </div>

          {/* Right Column - Room List */}
          <div className="lg:col-span-2">
            <RoomList />
          </div>
        </div>
      </div>
    </div>
  );
}
