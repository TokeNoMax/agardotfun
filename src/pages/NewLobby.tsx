
import React from "react";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { useGame } from "@/context/GameContext";
import { useWallet } from "@solana/wallet-adapter-react";
import { SimpleWalletButton } from "@/components/wallet/SimpleWalletButton";
import { WalletStatus } from "@/components/wallet/WalletStatus";
import PlayerCustomization from "@/features/lobby/components/PlayerCustomization";
import RoomList from "@/features/rooms/components/RoomList";
import AdminSheet from "@/features/admin/components/AdminSheet";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetTrigger 
} from "@/components/ui/sheet";
import { 
  ArrowLeft, 
  Users, 
  User, 
  Gamepad2, 
  Menu, 
  Settings,
  Play
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const NewLobby = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { publicKey } = useWallet();
  const { player } = useGame();
  const { toast } = useToast();
  const connected = !!publicKey;

  const handleLocalGame = () => {
    navigate("/game");
  };

  const handleZoneBattle = () => {
    navigate("/game");
  };

  if (isMobile) {
    return (
      <div className="min-h-screen bg-black relative overflow-hidden">
        {/* Mobile Background */}
        <div className="absolute inset-0 opacity-10">
          <div className="grid-background"></div>
        </div>
        
        {/* Mobile Header */}
        <div className="sticky top-0 z-50 bg-black/90 backdrop-blur-md border-b border-cyber-cyan">
          <div className="flex items-center justify-between p-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate("/")}
              className="text-cyber-cyan hover:text-cyber-magenta border border-cyber-cyan/30"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            
            <h1 className="text-lg font-pixel text-cyber-cyan">
              agar<span className="text-cyber-yellow">.fun</span>
            </h1>
            
            <Sheet>
              <SheetTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="text-cyber-cyan hover:text-cyber-magenta border border-cyber-cyan/30"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="bg-black/95 backdrop-blur-md border-cyber-cyan/30 w-80">
                <SheetHeader className="mb-6">
                  <SheetTitle className="text-cyber-cyan font-mono">MENU</SheetTitle>
                </SheetHeader>
                <div className="space-y-4">
                  <WalletStatus showDetails className="mb-4" />
                  <SimpleWalletButton variant="mobile" className="w-full" />
                  <AdminSheet />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        <div className="p-4 space-y-6">
          {/* Status */}
          <div className="text-center">
            <p className="text-cyber-green font-mono text-sm animate-terminal-blink">
              &gt; LOBBY_ACTIVE
            </p>
            <h2 className="text-xl font-pixel text-cyber-cyan mt-2">GAME LOBBY</h2>
          </div>
          
          {/* Game Modes */}
          <Tabs defaultValue="multiplayer" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4 bg-black/50 backdrop-blur-sm border border-cyber-cyan/30">
              <TabsTrigger 
                value="multiplayer" 
                className="text-sm py-2 font-mono data-[state=active]:bg-cyber-cyan/20 data-[state=active]:text-cyber-cyan"
              >
                <Users className="mr-1 h-4 w-4" /> MULTI
              </TabsTrigger>
              <TabsTrigger 
                value="solo" 
                className="text-sm py-2 font-mono data-[state=active]:bg-cyber-magenta/20 data-[state=active]:text-cyber-magenta"
              >
                <User className="mr-1 h-4 w-4" /> SOLO
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="multiplayer" className="space-y-4">
              <div className="relative bg-black/80 backdrop-blur-sm rounded-lg p-4 border border-cyber-cyan/50">
                <RoomList />
              </div>
            </TabsContent>
            
            <TabsContent value="solo" className="space-y-4">
              <div className="relative bg-black/80 backdrop-blur-sm rounded-lg p-4 border border-cyber-magenta/50">
                <h2 className="text-lg font-bold mb-3 text-cyber-magenta font-mono">SOLO_PROTOCOLS</h2>
                <div className="space-y-3">
                  <Button 
                    onClick={handleLocalGame}
                    className="w-full bg-gradient-to-r from-cyber-green to-cyber-cyan text-black font-mono font-bold text-sm py-3"
                  >
                    <Gamepad2 className="mr-2 h-4 w-4" />
                    classic_mode
                  </Button>

                  <Button 
                    onClick={handleZoneBattle}
                    className="w-full bg-gradient-to-r from-cyber-purple to-cyber-magenta text-white font-mono font-bold text-sm py-3"
                  >
                    <Gamepad2 className="mr-2 h-4 w-4" />
                    battle_royale
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* Player Customization - Optional */}
          {connected && (
            <div className="bg-black/80 backdrop-blur-sm rounded-lg p-4 border border-cyber-green/50">
              <Sheet>
                <SheetTrigger asChild>
                  <Button className="w-full bg-gradient-to-r from-cyber-green to-cyber-cyan text-black font-mono font-bold">
                    <Settings className="mr-2 h-4 w-4" />
                    CUSTOMIZE_PLAYER
                  </Button>
                </SheetTrigger>
                <SheetContent className="bg-black/95 backdrop-blur-md border-cyber-cyan/30">
                  <SheetHeader className="mb-5">
                    <SheetTitle className="text-cyber-cyan font-mono">PLAYER_CONFIG</SheetTitle>
                  </SheetHeader>
                  <PlayerCustomization />
                </SheetContent>
              </Sheet>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Desktop Version
  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Desktop Background */}
      <div className="absolute inset-0 opacity-20">
        <div className="grid-background"></div>
      </div>
      
      {/* Header */}
      <header className="relative z-10 flex justify-between items-center p-6 border-b border-cyber-cyan/30">
        <div className="flex items-center">
          <Button 
            variant="ghost" 
            onClick={() => navigate("/")}
            className="text-cyber-cyan hover:text-cyber-magenta mr-4"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to Home
          </Button>
          <h1 className="text-2xl font-pixel text-cyber-cyan">
            agar<span className="text-cyber-yellow">.fun</span> <span className="text-cyber-green">LOBBY</span>
          </h1>
        </div>
        
        <div className="flex items-center gap-4">
          <WalletStatus showDetails />
          <SimpleWalletButton />
          <AdminSheet />
        </div>
      </header>

      {/* Main Content */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 max-w-7xl mx-auto">
        {/* Left Column - Game Modes */}
        <div className="space-y-6">
          <div className="bg-black/80 backdrop-blur-sm rounded-lg p-6 border border-cyber-cyan/50">
            <h2 className="text-xl font-bold text-cyber-cyan mb-4 font-mono">GAME_MODES</h2>
            <div className="space-y-3">
              <Button 
                onClick={handleLocalGame}
                className="w-full bg-gradient-to-r from-cyber-green to-cyber-cyan text-black font-mono font-bold py-3"
              >
                <Play className="mr-2 h-5 w-5" />
                Classic Mode
              </Button>
              
              <Button 
                onClick={handleZoneBattle}
                className="w-full bg-gradient-to-r from-cyber-purple to-cyber-magenta text-white font-mono font-bold py-3"
              >
                <Play className="mr-2 h-5 w-5" />
                Battle Royale
              </Button>
            </div>
          </div>

          {/* Player Customization */}
          {connected && (
            <div className="bg-black/80 backdrop-blur-sm rounded-lg p-6 border border-cyber-green/50">
              <PlayerCustomization />
            </div>
          )}
        </div>

        {/* Center Column - Room List */}
        <div className="lg:col-span-2">
          <div className="bg-black/80 backdrop-blur-sm rounded-lg p-6 border border-cyber-cyan/50">
            <h2 className="text-xl font-bold text-cyber-cyan mb-4 font-mono">MULTIPLAYER_ROOMS</h2>
            <RoomList />
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewLobby;
