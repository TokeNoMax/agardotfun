
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useGame } from "@/context/GameContext";
import { Users, Settings, Gamepad2, Crown, Target } from "lucide-react";
import PlayerCustomization from "./PlayerCustomization";
import RoomList from "../../rooms/components/RoomList";
import QuickPlayButton from "../../rooms/components/QuickPlayButton";
import MobileWalletButton from "../../wallet/components/MobileWalletButton";
import AdminSheet from "../../admin/components/AdminSheet";

export default function MobileLobbyLayout() {
  const { player } = useGame();
  const [activeTab, setActiveTab] = useState("rooms");

  return (
    <div className="min-h-screen bg-black text-white p-4">
      {/* Header Mobile */}
      <div className="flex justify-between items-center mb-6 bg-black/90 backdrop-blur-sm rounded-lg border border-cyber-cyan/50 p-3">
        <div>
          <h1 className="text-lg font-bold text-cyber-cyan font-mono">BLOB_BATTLE</h1>
          <p className="text-xs text-gray-400 font-mono">Mobile Command Center</p>
        </div>
        <div className="flex items-center gap-2">
          <MobileWalletButton />
          <AdminSheet />
        </div>
      </div>

      {/* Quick Play Button - Mobile */}
      <div className="mb-4">
        <QuickPlayButton
          disabled={!player}
          className="w-full py-4 text-lg"
        />
      </div>

      {/* Mode selector mobile */}
      <div className="mb-4 bg-black/90 backdrop-blur-sm rounded-lg border border-cyber-cyan/50 p-3">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-bold text-cyber-cyan font-mono">GAME_MODE:</span>
          <div className="flex gap-2">
            <Badge className="bg-cyber-green/20 text-cyber-green border-cyber-green/50 text-xs font-mono">
              <Target className="mr-1 h-3 w-3" />
              CLASSIC
            </Badge>
          </div>
        </div>
        <p className="text-xs text-gray-400 font-mono">
          Survivez et grandissez en absorbant vos adversaires
        </p>
      </div>

      {/* Tabs Mobile */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-black/90 border border-cyber-cyan/50">
          <TabsTrigger 
            value="rooms" 
            className="font-mono text-cyber-cyan data-[state=active]:bg-cyber-cyan data-[state=active]:text-black"
          >
            <Gamepad2 className="mr-2 h-4 w-4" />
            ROOMS
          </TabsTrigger>
          <TabsTrigger 
            value="player" 
            className="font-mono text-cyber-cyan data-[state=active]:bg-cyber-cyan data-[state=active]:text-black"
          >
            <Settings className="mr-2 h-4 w-4" />
            PLAYER
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rooms" className="mt-4">
          <RoomList />
        </TabsContent>

        <TabsContent value="player" className="mt-4">
          <div className="flex justify-center">
            <PlayerCustomization />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
