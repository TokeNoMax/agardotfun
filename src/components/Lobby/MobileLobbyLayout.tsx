import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { useGame } from "@/context/GameContext";
import PlayerCustomization from "@/components/Lobby/PlayerCustomization";
import RoomList from "@/components/Lobby/RoomList";
import MobileWalletButton from "@/components/Wallet/MobileWalletButton";
import AdminSheet from "@/components/Admin/AdminSheet";
import TutorialSection from "@/components/Landing/TutorialSection";
import { Button } from "@/components/ui/button";
import { Gamepad2Icon, Users, User, ArrowLeft, Wallet, Zap, Menu } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetTrigger 
} from "@/components/ui/sheet";

interface MobileLobbyLayoutProps {
  player: any;
  connected: boolean;
  publicKey: any;
  handleTestGame: () => Promise<void>;
  handleLocalGame: () => void;
  handleZoneBattle: () => void;
  isCreatingTestGame: boolean;
  formatAddress: (address: string) => string;
  getColorHex: (color: string) => string;
}

export default function MobileLobbyLayout({
  player,
  connected,
  publicKey,
  handleTestGame,
  handleLocalGame,
  handleZoneBattle,
  isCreatingTestGame,
  formatAddress,
  getColorHex
}: MobileLobbyLayoutProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showMobileMenu, setShowMobileMenu] = useState(false);

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
          
          <div className="flex items-center">
            <div className="relative mr-2">
              <svg width="24" height="24" viewBox="0 0 397.7 311.7" className="text-cyber-cyan" fill="currentColor">
                <linearGradient id="mobileGradient" x1="360.8791" y1="351.4553" x2="141.213" y2="-69.2936" gradientUnits="userSpaceOnUse">
                  <stop offset="0" stopColor="#00FFF0"/>
                  <stop offset="1" stopColor="#DC1FFF"/>
                </linearGradient>
                <path d="M64.6,237.9c2.4-2.4,5.7-3.8,9.2-3.8h317.4c5.8,0,8.7,7,4.6,11.1l-62.7,62.7c-2.4,2.4-5.7,3.8-9.2,3.8H6.5c-5.8,0-8.7-7-4.6-11.1L64.6,237.9z" fill="url(#mobileGradient)"/>
                <path d="M64.6,3.8C67.1,1.4,70.4,0,73.8,0h317.4c5.8,0,8.7,7,4.6,11.1l-62.7,62.7c-2.4,2.4-5.7,3.8-9.2,3.8H6.5c-5.8,0-8.7-7-4.6-11.1L64.6,3.8z" fill="url(#mobileGradient)"/>
                <path d="M333.1,120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8,0-8.7,7-4.6,11.1l62.7,62.7c2.4,2.4,5.7,3.8,9.2,3.8h317.4c5.8,0,8.7-7,4.6-11.1L333.1,120.1z" fill="url(#mobileGradient)"/>
              </svg>
            </div>
            <h1 className="text-lg font-pixel text-cyber-cyan">
              agar<span className="text-cyber-yellow">.fun</span>
            </h1>
          </div>
          
          <Sheet open={showMobileMenu} onOpenChange={setShowMobileMenu}>
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
                <AdminSheet />
                <MobileWalletButton className="w-full" />
                
                {connected && publicKey && (
                  <Sheet>
                    <SheetTrigger asChild>
                      <Button 
                        variant="ghost"
                        className={`w-full font-mono border ${player ? 
                          "border-cyber-green/50 text-cyber-green hover:bg-cyber-green/10" : 
                          "border-cyber-cyan/50 text-cyber-cyan hover:bg-cyber-cyan/10"
                        } bg-black/50 transition-all duration-300`}
                      >
                        {player ? (
                          <>
                            <div 
                              className="w-4 h-4 rounded-full mr-2 border"
                              style={{ backgroundColor: `#${getColorHex(player.color)}` }}
                            ></div>
                            <span className="text-sm">{player.name}</span>
                          </>
                        ) : (
                          <>
                            <Zap className="w-4 h-4 mr-2" />
                            <span className="text-sm">CONFIGURE_BLOB</span>
                          </>
                        )}
                      </Button>
                    </SheetTrigger>
                    <SheetContent className="bg-black/95 backdrop-blur-md border-cyber-cyan/30">
                      <SheetHeader className="mb-5">
                        <SheetTitle className="text-cyber-cyan font-mono">BLOB_CONFIG</SheetTitle>
                      </SheetHeader>
                      <PlayerCustomization />
                    </SheetContent>
                  </Sheet>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Status Indicator */}
        <div className="text-center">
          <p className="text-cyber-green font-mono text-sm animate-terminal-blink">
            &gt; MOBILE_LOBBY_ACTIVE
          </p>
          <h2 className="text-xl font-pixel text-cyber-cyan mt-2">GAME LOBBY</h2>
        </div>
        
        {!connected || !publicKey ? (
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-cyber-cyan/20 to-cyber-magenta/20 rounded-lg blur-xl"></div>
            <div className="relative bg-black/80 backdrop-blur-sm p-6 rounded-lg border border-cyber-cyan/50 text-center">
              <div className="bg-gradient-to-r from-cyber-cyan to-cyber-blue w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Wallet className="text-black" size={20} />
              </div>
              <h3 className="text-lg font-bold text-cyber-cyan mb-3 font-mono">WALLET_REQUIRED</h3>
              <p className="text-gray-300 mb-4 font-mono text-sm">
                Connectez votre wallet Solana pour continuer.
              </p>
              <MobileWalletButton className="w-full" />
            </div>
          </div>
        ) : !player ? (
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-cyber-magenta/20 to-cyber-yellow/20 rounded-lg blur-xl"></div>
            <div className="relative bg-black/80 backdrop-blur-sm p-6 rounded-lg border border-cyber-magenta/50 text-center">
              <div className="bg-gradient-to-r from-cyber-magenta to-cyber-purple w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Zap className="text-black" size={20} />
              </div>
              <h3 className="text-lg font-bold text-cyber-magenta mb-3 font-mono">BLOB_CONFIG_REQUIRED</h3>
              <p className="text-gray-300 mb-4 font-mono text-sm">
                Configurez votre <span className="text-cyber-cyan">BLOB_PROTOCOL</span> pour jouer.
              </p>
              <div className="mb-4 p-3 bg-cyber-green/10 rounded-lg border border-cyber-green/30">
                <div className="flex items-center justify-center gap-2">
                  <Wallet className="h-4 w-4 text-cyber-green" />
                  <span className="text-xs font-medium text-cyber-green font-mono">
                    {formatAddress(publicKey.toString())}
                  </span>
                </div>
              </div>
              <Sheet>
                <SheetTrigger asChild>
                  <Button className="w-full bg-gradient-to-r from-cyber-magenta to-cyber-cyan text-black font-mono font-bold">
                    CONFIGURE_BLOB
                  </Button>
                </SheetTrigger>
                <SheetContent className="bg-black/95 backdrop-blur-md border-cyber-cyan/30">
                  <SheetHeader className="mb-5">
                    <SheetTitle className="text-cyber-cyan font-mono">BLOB_CONFIG</SheetTitle>
                  </SheetHeader>
                  <PlayerCustomization />
                </SheetContent>
              </Sheet>
            </div>
          </div>
        ) : (
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
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-cyber-cyan/20 to-cyber-green/20 rounded-lg blur-xl"></div>
                <div className="relative bg-black/80 backdrop-blur-sm rounded-lg p-4 border border-cyber-cyan/50">
                  <RoomList />
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="solo" className="space-y-4">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-cyber-magenta/20 to-cyber-purple/20 rounded-lg blur-xl"></div>
                <div className="relative bg-black/80 backdrop-blur-sm rounded-lg p-4 border border-cyber-magenta/50">
                  <h2 className="text-lg font-bold mb-3 text-cyber-magenta font-mono">SOLO_PROTOCOLS</h2>
                  <p className="text-gray-300 mb-4 font-mono text-sm">
                    Lancez une session rapide en solo, sans attendre d'autres <span className="text-cyber-cyan">NODES</span>.
                  </p>
                  <div className="space-y-3">
                    <Button 
                      onClick={handleLocalGame}
                      className="w-full bg-gradient-to-r from-cyber-green to-cyber-cyan text-black font-mono font-bold text-sm py-3"
                    >
                      <Gamepad2Icon className="mr-2 h-4 w-4" />
                      classic_mode
                    </Button>

                    <Button 
                      onClick={handleZoneBattle}
                      className="w-full bg-gradient-to-r from-cyber-purple to-cyber-magenta text-white font-mono font-bold text-sm py-3"
                    >
                      <Gamepad2Icon className="mr-2 h-4 w-4" />
                      battle_royale
                    </Button>
                  </div>
                  
                  <div className="mt-4 space-y-3">
                    <div className="p-3 bg-cyber-green/10 rounded-lg border border-cyber-green/30">
                      <h4 className="font-bold text-cyber-green font-mono text-sm mb-1">classic_mode.sol</h4>
                      <p className="text-xs text-gray-300 font-mono">Jeu en solo classique, idéal pour perfectionner votre technique.</p>
                    </div>
                    
                    <div className="p-3 bg-cyber-purple/10 rounded-lg border border-cyber-purple/30">
                      <h4 className="font-bold text-cyber-purple font-mono text-sm mb-1">battle_royale.war</h4>
                      <p className="text-xs text-gray-300 font-mono">
                        Mode de survie avec une zone qui rétrécit toutes les 2 minutes. Restez dans la <span className="text-cyber-green">SAFE_ZONE</span> ou perdez de la taille !
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}
        
        {/* Mobile Tutorial - Now simplified */}
        <TutorialSection isMobile={true} />
      </div>
      
      <footer className="text-center p-4 mt-8">
        <p className="text-gray-500 text-xs font-mono">
          © 2025 agar.fun - <span className="text-cyber-cyan">HODLING</span> since genesis 🚀
        </p>
      </footer>
    </div>
  );
}
