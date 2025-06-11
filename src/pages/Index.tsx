import { useNavigate } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { Button } from "@/components/ui/button";
import { useGame, defaultPhrases } from "@/context/GameContext";
import { PlayIcon, Settings, Plus, Save, Trash2, Wallet } from "lucide-react";
import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
  SheetClose
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { LandingHero } from "@/components/Landing/LandingHero";
import WalletButton from "@/components/Wallet/WalletButton";

export default function Index() {
  const navigate = useNavigate();
  const { connected } = useWallet();
  const { customPhrases, setCustomPhrases } = useGame();
  const [editedPhrases, setEditedPhrases] = useState<string[]>([...customPhrases]);
  const [newPhrase, setNewPhrase] = useState("");
  const { toast } = useToast();
  
  const handleSavePhrases = () => {
    setCustomPhrases(editedPhrases);
    toast({
      title: "Modifications enregistrées",
      description: "Vos phrases personnalisées ont été sauvegardées",
      duration: 2000,
    });
  };

  const handleAddPhrase = () => {
    if (newPhrase.trim()) {
      setEditedPhrases(prev => [...prev, newPhrase]);
      setNewPhrase("");
    }
  };

  const handleDeletePhrase = (index: number) => {
    setEditedPhrases(prev => prev.filter((_, i) => i !== index));
  };

  const handleResetToDefault = () => {
    setEditedPhrases([...defaultPhrases]);
    toast({
      title: "Phrases réinitialisées",
      description: "Les phrases ont été restaurées aux valeurs par défaut",
      duration: 2000,
    });
  };
  
  const handleBulkEdit = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const phrases = e.target.value.split('\n').filter(line => line.trim() !== '');
    setEditedPhrases(phrases);
  };

  const handleEnterMainnet = () => {
    if (!connected) {
      toast({
        title: "WALLET_CONNECTION_REQUIRED",
        description: "Connectez votre wallet Solana pour accéder au lobby",
        variant: "destructive"
      });
      return;
    }
    navigate("/lobby");
  };
  
  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Tron Grid Background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 opacity-20">
          <div className="grid-background"></div>
        </div>
        {/* Animated scan lines */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="scan-line"></div>
        </div>
        {/* Floating particles */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-cyber-cyan rounded-full animate-float"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 6}s`,
                animationDuration: `${4 + Math.random() * 4}s`
              }}
            />
          ))}
        </div>
      </div>

      <div className="relative z-10 container mx-auto py-10">
        {/* Top bar with settings and wallet button */}
        <div className="flex justify-between items-center mb-4">
          {/* Settings button */}
          <Sheet>
            <SheetTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-cyber-cyan hover:text-cyber-magenta hover:bg-cyber-cyan/10 border border-cyber-cyan/30 hover:border-cyber-magenta/50 transition-all duration-300"
              >
                <Settings className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent className="w-[80%] sm:w-[500px] max-w-full overflow-y-auto bg-black border-cyber-cyan/30">
              
              <SheetHeader>
                <SheetTitle className="text-cyber-cyan font-mono">Messages personnalisés</SheetTitle>
                <SheetDescription className="text-gray-400">
                  Personnalisez les messages qui apparaissent quand un joueur est mangé. Utilisez {"{playerName}"} pour insérer le nom du joueur.
                </SheetDescription>
              </SheetHeader>
              
              <div className="py-6 space-y-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium text-cyber-green font-mono">Personnaliser les messages</h3>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={handleResetToDefault}
                      className="border-cyber-cyan/30 text-cyber-cyan hover:bg-cyber-cyan/10"
                    >
                      Réinitialiser
                    </Button>
                  </div>
                  
                  <div className="space-y-2">
                    {editedPhrases.map((phrase, index) => (
                      <div key={index} className="flex items-center justify-between bg-gray-900/50 p-2 rounded border border-cyber-cyan/20">
                        <span className="flex-1 mr-2 text-gray-300 font-mono text-sm">{phrase}</span>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleDeletePhrase(index)}
                          className="text-cyber-magenta hover:bg-cyber-magenta/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  
                  <div className="flex gap-2">
                    <Input 
                      placeholder="Nouveau message avec {playerName}"
                      value={newPhrase}
                      onChange={(e) => setNewPhrase(e.target.value)}
                      className="flex-1 bg-gray-900/50 border-cyber-cyan/30 text-gray-300 font-mono"
                    />
                    <Button 
                      onClick={handleAddPhrase} 
                      className="shrink-0 bg-cyber-green hover:bg-cyber-green/80 text-black"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Ajouter
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-lg font-medium text-cyber-green font-mono">Édition en bloc</h3>
                  <p className="text-sm text-gray-400 font-mono">
                    Vous pouvez aussi éditer toutes les phrases en bloc, une phrase par ligne.
                  </p>
                  <Textarea 
                    value={editedPhrases.join('\n')}
                    onChange={handleBulkEdit}
                    rows={10}
                    className="font-mono text-sm bg-gray-900/50 border-cyber-cyan/30 text-gray-300"
                    placeholder="Une phrase par ligne. Utilisez {playerName} pour le nom du joueur."
                  />
                </div>
                
                <Button 
                  className="w-full bg-cyber-green hover:bg-cyber-green/80 text-black font-mono" 
                  onClick={handleSavePhrases}
                >
                  <Save className="h-4 w-4 mr-2" />
                  Enregistrer les modifications
                </Button>
              </div>
              
              <SheetFooter>
                <SheetClose asChild>
                  <Button className="w-full bg-cyber-magenta hover:bg-cyber-magenta/80 text-white font-mono">Fermer</Button>
                </SheetClose>
              </SheetFooter>
            </SheetContent>
          </Sheet>

          {/* Wallet button */}
          <div className="flex items-center gap-2">
            {connected ? (
              <div className="flex items-center gap-2 text-cyber-green font-mono text-sm">
                <Wallet className="h-4 w-4" />
                <span>WALLET_CONNECTED</span>
              </div>
            ) : null}
            <WalletButton />
          </div>
        </div>

        {/* Hero section with new LandingHero component */}
        <LandingHero />
        
        {/* Enhanced Tutorial Section - increased top margin from mt-16 to mt-32 */}
        <div className="bg-black/90 backdrop-blur-sm rounded-lg p-8 border-2 border-cyber-green/30 shadow-[0_0_20px_rgba(0,255,0,0.2)] mb-20 mt-32 relative overflow-hidden">
          {/* Background effects */}
          <div className="absolute inset-0 bg-gradient-to-br from-cyber-green/5 via-transparent to-cyber-cyan/5"></div>
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyber-green to-transparent opacity-50"></div>
          
          {/* Terminal header */}
          <div className="flex items-center mb-8 relative z-10">
            <div className="w-3 h-3 bg-cyber-magenta rounded-full mr-2 animate-pulse"></div>
            <div className="w-3 h-3 bg-cyber-yellow rounded-full mr-2 animate-pulse" style={{animationDelay: '0.2s'}}></div>
            <div className="w-3 h-3 bg-cyber-green rounded-full mr-4 animate-pulse" style={{animationDelay: '0.4s'}}></div>
            <h2 className="text-3xl font-bold text-cyber-green font-mono relative">
              TUTORIAL.md
              <div className="absolute -inset-1 bg-cyber-green/20 blur-md -z-10 animate-pulse"></div>
            </h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
            {/* Step 1 */}
            <div className="group hover:bg-cyber-yellow/5 p-6 rounded-lg transition-all duration-300 border border-transparent hover:border-cyber-yellow/30 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-cyber-yellow/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="flex items-start relative z-10">
                <div className="bg-cyber-yellow text-black font-bold font-mono rounded-lg w-12 h-12 flex items-center justify-center mr-4 flex-shrink-0 shadow-[0_0_10px_rgba(255,255,0,0.5)] group-hover:shadow-[0_0_20px_rgba(255,255,0,0.8)] transition-all duration-300 text-lg">
                  0x1
                </div>
                <div className="flex-1">
                  <p className="text-gray-300 font-mono group-hover:text-white transition-colors duration-300 text-lg leading-relaxed">
                    Déplacez votre blob avec la souris pour absorber la <span className="text-cyber-cyan font-bold animate-pulse">FOOD</span> et grossir 🍰
                  </p>
                  <div className="mt-4 h-1 bg-cyber-yellow/20 rounded group-hover:bg-cyber-yellow/40 transition-all duration-300"></div>
                </div>
              </div>
            </div>
            
            {/* Step 2 */}
            <div className="group hover:bg-cyber-cyan/5 p-6 rounded-lg transition-all duration-300 border border-transparent hover:border-cyber-cyan/30 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-cyber-cyan/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="flex items-start relative z-10">
                <div className="bg-cyber-cyan text-black font-bold font-mono rounded-lg w-12 h-12 flex items-center justify-center mr-4 flex-shrink-0 shadow-[0_0_10px_rgba(0,255,255,0.5)] group-hover:shadow-[0_0_20px_rgba(0,255,255,0.8)] transition-all duration-300 text-lg">
                  0x2
                </div>
                <div className="flex-1">
                  <p className="text-gray-300 font-mono group-hover:text-white transition-colors duration-300 text-lg leading-relaxed">
                    Mangez les joueurs plus petits que vous (au moins <span className="text-cyber-magenta font-bold animate-pulse">10%</span> plus petits) 🥵
                  </p>
                  <div className="mt-4 h-1 bg-cyber-cyan/20 rounded group-hover:bg-cyber-cyan/40 transition-all duration-300"></div>
                </div>
              </div>
            </div>
            
            {/* Step 3 */}
            <div className="group hover:bg-cyber-magenta/5 p-6 rounded-lg transition-all duration-300 border border-transparent hover:border-cyber-magenta/30 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-cyber-magenta/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="flex items-start relative z-10">
                <div className="bg-cyber-magenta text-black font-bold font-mono rounded-lg w-12 h-12 flex items-center justify-center mr-4 flex-shrink-0 shadow-[0_0_10px_rgba(255,0,255,0.5)] group-hover:shadow-[0_0_20px_rgba(255,0,255,0.8)] transition-all duration-300 text-lg">
                  0x3
                </div>
                <div className="flex-1">
                  <p className="text-gray-300 font-mono group-hover:text-white transition-colors duration-300 text-lg leading-relaxed">
                    Évitez les <span className="text-cyber-purple font-bold animate-pulse">RUG_CARPETS</span> violets qui vous feront rétrécir 📉
                  </p>
                  <div className="mt-4 h-1 bg-cyber-magenta/20 rounded group-hover:bg-cyber-magenta/40 transition-all duration-300"></div>
                </div>
              </div>
            </div>
            
            {/* Step 4 */}
            <div className="group hover:bg-cyber-green/5 p-6 rounded-lg transition-all duration-300 border border-transparent hover:border-cyber-green/30 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-cyber-green/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="flex items-start relative z-10">
                <div className="bg-cyber-green text-black font-bold font-mono rounded-lg w-12 h-12 flex items-center justify-center mr-4 flex-shrink-0 shadow-[0_0_10px_rgba(0,255,0,0.5)] group-hover:shadow-[0_0_20px_rgba(0,255,0,0.8)] transition-all duration-300 text-lg">
                  0x4
                </div>
                <div className="flex-1">
                  <p className="text-gray-300 font-mono group-hover:text-white transition-colors duration-300 text-lg leading-relaxed">
                    Le dernier blob en vie devient le <span className="text-cyber-yellow font-bold animate-pulse">ULTIMATE_CHAD</span> ! 👑
                  </p>
                  <div className="mt-4 h-1 bg-cyber-green/20 rounded group-hover:bg-cyber-green/40 transition-all duration-300"></div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Bottom scan line */}
          <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyber-cyan to-transparent opacity-50 animate-pulse"></div>
        </div>
        
        <div className="text-center" id="mainnet">
          <Button 
            onClick={handleEnterMainnet} 
            className="bg-gradient-to-r from-cyber-green to-cyber-cyan hover:from-cyber-cyan hover:to-cyber-green text-black font-mono font-bold text-lg px-8 py-6 rounded-none border-2 border-cyber-green shadow-[0_0_20px_rgba(0,255,0,0.5)] hover:shadow-[0_0_30px_rgba(0,255,255,0.7)] transition-all duration-300 transform hover:scale-105"
          >
            <PlayIcon className="mr-2" />
            &gt; ENTER_THE_MAINNET
          </Button>
          
          {!connected && (
            <p className="text-cyber-cyan font-mono text-sm mt-4 animate-terminal-blink">
              📱 Connectez votre wallet Solana pour commencer
            </p>
          )}
        </div>
      </div>
      
      <footer className="relative z-10 mt-20 text-center">
        <p className="text-gray-500 text-sm font-mono">
          © 2025 agar.fun - <span className="text-cyber-cyan">HODLING</span> since genesis block 🚀
        </p>
        <p className="text-gray-600 text-xs font-mono mt-1">
          Not financial advice | DYOR | Diamond hands only 💎🙌
        </p>
      </footer>
    </div>
  );
}
