import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Gamepad2, Users, Zap, Shield, Trophy, Rocket, Star, ArrowRight, Play } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function Index() {
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    // Redirect authenticated users to lobby
    if (user) {
      navigate('/lobby');
    }
  }, [user, navigate]);

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
        {/* Settings button */}
        <div className="absolute top-2 right-2">
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
        </div>

        {/* Hero section */}
        <div className="text-center mb-16">
          <div className="flex justify-center items-center mb-6">
            <div className="relative flex items-center">
              {/* Solana Logo */}
              <svg width="42" height="42" viewBox="0 0 397.7 311.7" className="text-cyber-cyan mr-3 animate-neon-pulse" fill="currentColor">
                <linearGradient id="logosGradient" x1="360.8791" y1="351.4553" x2="141.213" y2="-69.2936" gradientUnits="userSpaceOnUse">
                  <stop offset="0" stopColor="#00FFF0"/>
                  <stop offset="1" stopColor="#DC1FFF"/>
                </linearGradient>
                <path d="M64.6,237.9c2.4-2.4,5.7-3.8,9.2-3.8h317.4c5.8,0,8.7,7,4.6,11.1l-62.7,62.7c-2.4,2.4-5.7,3.8-9.2,3.8H6.5c-5.8,0-8.7-7-4.6-11.1L64.6,237.9z" fill="url(#logosGradient)"/>
                <path d="M64.6,3.8C67.1,1.4,70.4,0,73.8,0h317.4c5.8,0,8.7,7,4.6,11.1l-62.7,62.7c-2.4,2.4-5.7,3.8-9.2,3.8H6.5c-5.8,0-8.7-7-4.6-11.1L64.6,3.8z" fill="url(#logosGradient)"/>
                <path d="M333.1,120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8,0-8.7,7-4.6,11.1l62.7,62.7c2.4,2.4,5.7,3.8,9.2,3.8h317.4c5.8,0,8.7-7,4.6-11.1L333.1,120.1z" fill="url(#logosGradient)"/>
              </svg>
              <div className="absolute inset-0 bg-cyber-cyan/20 rounded-full blur-xl animate-pulse"></div>
              <h1 className="text-6xl md:text-7xl font-pixel text-cyber-cyan tracking-wider animate-neon-pulse">
                agar<span className="text-cyber-yellow animate-glitch">.fun</span>
              </h1>
            </div>
          </div>
          
          {/* Subtitle with crypto vibes */}
          <div className="mb-4">
            <p className="text-cyber-green font-mono text-lg animate-terminal-blink">
              &gt; RETRO_GAMING_PROTOCOL_INITIATED
            </p>
            <p className="text-gray-400 font-mono text-sm mt-2">
              [HODL_MODE] Diamond hands only 💎🚀
            </p>
            {/* Mobile info */}
            <p className="text-cyber-cyan font-mono text-xs mt-3 opacity-80">
              📱 Pour jouer sur mobile, utilisez le browser Phantom
            </p>
          </div>
          
          <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto font-mono leading-relaxed">
            Move, Eat, Hodl to the <span className="text-cyber-magenta">Moon</span> ! 
            <br />
            <span className="text-cyber-yellow">Time to become THE ULTIMATE WHALE</span> 🎮
          </p>
          
          <Button 
            onClick={() => navigate("/lobby")} 
            className="bg-gradient-to-r from-cyber-magenta to-cyber-cyan hover:from-cyber-cyan hover:to-cyber-magenta text-black font-mono font-bold text-lg px-8 py-6 rounded-none border-2 border-cyber-cyan shadow-[0_0_20px_rgba(0,255,255,0.5)] hover:shadow-[0_0_30px_rgba(255,0,255,0.7)] transition-all duration-300 transform hover:scale-105"
          >
            <PlayIcon className="mr-2" />
            &gt; ENTER_THE_MAINNET
          </Button>
        </div>
        
        {/* Features section with hexagonal cyber design - MUCH LARGER CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-16 text-center mb-12">
          {/* Multiplayer Card - MUCH LARGER */}
          <div className="group relative">
            <div className="absolute inset-0 bg-gradient-to-r from-cyber-cyan/20 to-cyber-magenta/20 rounded-lg blur-xl group-hover:blur-2xl transition-all duration-300"></div>
            <div className="relative bg-black/80 backdrop-blur-sm p-20 rounded-lg border-2 border-cyber-cyan/50 hover:border-cyber-magenta/70 transition-all duration-300 min-h-[550px] flex flex-col justify-center">
              <div className="bg-gradient-to-r from-cyber-cyan to-cyber-blue w-32 h-32 rounded-lg flex items-center justify-center mx-auto mb-10 shadow-[0_0_15px_rgba(0,255,255,0.5)]">
                <Users className="text-black" size={48} />
              </div>
              <h3 className="text-3xl font-bold text-white mb-8 font-mono drop-shadow-[0_0_10px_rgba(0,255,255,0.8)]">MULTIPLAYER.exe</h3>
              <p className="text-gray-200 font-mono text-lg leading-relaxed drop-shadow-[0_0_5px_rgba(0,0,0,0.8)]">
                Battle royale avec des joueurs du monde entier ou créez une <span className="text-cyber-yellow">PRIVATE_ROOM</span> avec vos crew 👥
              </p>
            </div>
          </div>

          {/* Customization Card - MUCH LARGER */}
          <div className="group relative">
            <div className="absolute inset-0 bg-gradient-to-r from-cyber-magenta/20 to-cyber-yellow/20 rounded-lg blur-xl group-hover:blur-2xl transition-all duration-300"></div>
            <div className="relative bg-black/80 backdrop-blur-sm p-20 rounded-lg border-2 border-cyber-magenta/50 hover:border-cyber-yellow/70 transition-all duration-300 min-h-[550px] flex flex-col justify-center">
              <div className="bg-gradient-to-r from-cyber-magenta to-cyber-purple w-32 h-32 rounded-lg flex items-center justify-center mx-auto mb-10 shadow-[0_0_15px_rgba(255,0,255,0.5)]">
                <Zap className="text-black" size={48} />
              </div>
              <h3 className="text-3xl font-bold text-white mb-8 font-mono drop-shadow-[0_0_10px_rgba(255,0,255,0.8)]">CUSTOM.cfg</h3>
              <p className="text-gray-200 font-mono text-lg leading-relaxed drop-shadow-[0_0_5px_rgba(0,0,0,0.8)]">
                Personnalisez votre <span className="text-cyber-cyan">blob avec votre NFT</span> et créez un avatar unique. 
                <br />Time to <span className="text-cyber-yellow">FLEX</span> 💪
              </p>
            </div>
          </div>

          {/* Competitive Card - MUCH LARGER */}
          <div className="group relative">
            <div className="absolute inset-0 bg-gradient-to-r from-cyber-green/20 to-cyber-orange/20 rounded-lg blur-xl group-hover:blur-2xl transition-all duration-300"></div>
            <div className="relative bg-black/80 backdrop-blur-sm p-20 rounded-lg border-2 border-cyber-green/50 hover:border-cyber-orange/70 transition-all duration-300 min-h-[550px] flex flex-col justify-center">
              <div className="bg-gradient-to-r from-cyber-green to-cyber-yellow w-32 h-32 rounded-lg flex items-center justify-center mx-auto mb-10 shadow-[0_0_15px_rgba(0,255,0,0.5)]">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 text-black">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" />
                </svg>
              </div>
              <h3 className="text-3xl font-bold text-white mb-8 font-mono drop-shadow-[0_0_10px_rgba(0,255,0,0.8)]">TO_THE_MOON.sol</h3>
              <p className="text-gray-200 font-mono text-lg leading-relaxed drop-shadow-[0_0_5px_rgba(0,0,0,0.8)]">
                Mangez les autres blobs, esquivez les <span className="text-cyber-magenta">RUG_PULLS</span> violets et devenez le 
                <span className="text-cyber-yellow"> WHALE</span> ultime ! 🐋
              </p>
            </div>
          </div>
        </div>
        
        {/* How to play section - Terminal style */}
        <div className="bg-black/90 backdrop-blur-sm rounded-lg p-8 mb-12 border-2 border-cyber-green/30 shadow-[0_0_20px_rgba(0,255,0,0.2)]">
          <div className="flex items-center mb-6">
            <div className="w-3 h-3 bg-cyber-magenta rounded-full mr-2 animate-pulse"></div>
            <div className="w-3 h-3 bg-cyber-yellow rounded-full mr-2 animate-pulse" style={{animationDelay: '0.2s'}}></div>
            <div className="w-3 h-3 bg-cyber-green rounded-full mr-4 animate-pulse" style={{animationDelay: '0.4s'}}></div>
            <h2 className="text-3xl font-bold text-cyber-green font-mono">TUTORIAL.md</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-start">
              <div className="bg-cyber-yellow text-black font-bold font-mono rounded w-8 h-8 flex items-center justify-center mr-3 flex-shrink-0 shadow-[0_0_10px_rgba(255,255,0,0.5)]">0x1</div>
              <p className="text-gray-300 font-mono">Déplacez votre blob avec la souris pour absorber la <span className="text-cyber-cyan">FOOD</span> et grossir 🍰</p>
            </div>
            <div className="flex items-start">
              <div className="bg-cyber-cyan text-black font-bold font-mono rounded w-8 h-8 flex items-center justify-center mr-3 flex-shrink-0 shadow-[0_0_10px_rgba(0,255,255,0.5)]">0x2</div>
              <p className="text-gray-300 font-mono">Mangez les joueurs plus petits que vous (au moins <span className="text-cyber-magenta">10%</span> plus petits) 🥵</p>
            </div>
            <div className="flex items-start">
              <div className="bg-cyber-magenta text-black font-bold font-mono rounded w-8 h-8 flex items-center justify-center mr-3 flex-shrink-0 shadow-[0_0_10px_rgba(255,0,255,0.5)]">0x3</div>
              <p className="text-gray-300 font-mono">Évitez les <span className="text-cyber-purple">RUG_CARPETS</span> violets qui vous feront rétrécir 📉</p>
            </div>
            <div className="flex items-start">
              <div className="bg-cyber-green text-black font-bold font-mono rounded w-8 h-8 flex items-center justify-center mr-3 flex-shrink-0 shadow-[0_0_10px_rgba(0,255,0,0.5)]">0x4</div>
              <p className="text-gray-300 font-mono">Le dernier blob en vie devient le <span className="text-cyber-yellow">ULTIMATE_CHAD</span> ! 👑</p>
            </div>
          </div>
        </div>
        
        <div className="text-center">
          <Button 
            onClick={() => navigate("/lobby")} 
            className="bg-gradient-to-r from-cyber-green to-cyber-cyan hover:from-cyber-cyan hover:to-cyber-green text-black font-mono font-bold text-lg px-8 py-6 rounded-none border-2 border-cyber-green shadow-[0_0_20px_rgba(0,255,0,0.5)] hover:shadow-[0_0_30px_rgba(0,255,255,0.7)] transition-all duration-300 transform hover:scale-105"
          >
            <PlayIcon className="mr-2" />
            &gt; ENTER_THE_MAINNET
          </Button>
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
