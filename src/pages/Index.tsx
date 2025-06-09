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
import TutorialSection from "@/components/Landing/TutorialSection";
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
        
        {/* How to play section - Now simplified */}
        <TutorialSection />
        
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
