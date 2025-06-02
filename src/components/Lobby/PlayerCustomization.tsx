
import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useGame } from "@/context/GameContext";
import { PlayerColor } from "@/types/game";
import WalletButton from "@/components/Wallet/WalletButton";
import { Wallet, Smartphone, Image, Zap, AlertTriangle } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

const COLORS: PlayerColor[] = ['blue', 'red', 'green', 'yellow', 'purple', 'orange', 'cyan', 'pink'];

export default function PlayerCustomization() {
  const [name, setName] = useState("");
  const [selectedColor, setSelectedColor] = useState<PlayerColor>("blue");
  const [nftImageUrl, setNftImageUrl] = useState("");
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { setPlayerDetails, player } = useGame();
  const { connected, publicKey } = useWallet();
  const isMobile = useIsMobile();
  const { toast } = useToast();

  // Pre-fill form with player data if exists
  useEffect(() => {
    if (player && connected && publicKey && player.walletAddress === publicKey.toString()) {
      setName(player.name);
      setSelectedColor(player.color);
      setNftImageUrl(player.nftImageUrl || "");
      setPreviewImage(player.nftImageUrl || null);
    }
  }, [player, connected, publicKey]);

  // Handle NFT image URL change and validation
  const handleNftImageChange = (url: string) => {
    setNftImageUrl(url);
    setImageError(false);
    
    if (url.trim()) {
      // Test if the image loads
      const img = document.createElement('img');
      img.onload = () => {
        setPreviewImage(url);
        setImageError(false);
      };
      img.onerror = () => {
        setPreviewImage(null);
        setImageError(true);
      };
      img.src = url;
    } else {
      setPreviewImage(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!connected || !publicKey) {
      toast({
        title: "WALLET_ERROR",
        description: "Veuillez connecter votre wallet pour continuer.",
        variant: "destructive"
      });
      return;
    }
    
    if (!name.trim()) {
      toast({
        title: "INPUT_ERROR",
        description: "Veuillez entrer un nom pour votre blob.",
        variant: "destructive"
      });
      return;
    }

    if (name.trim().length > 15) {
      toast({
        title: "LENGTH_ERROR",
        description: "Le nom ne peut pas dépasser 15 caractères.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    
    try {
      console.log("Submitting player configuration:", {
        name: name.trim(),
        color: selectedColor,
        walletAddress: publicKey.toString(),
        connected: connected,
        nftImageUrl: nftImageUrl.trim() || undefined
      });

      await setPlayerDetails(
        name.trim(),
        selectedColor,
        nftImageUrl.trim() || undefined
      );

      console.log("Player configuration successful");
    } catch (error) {
      console.error("Error creating/updating player:", error);
      
      // More specific error handling
      let errorMessage = "Impossible de configurer votre joueur.";
      
      if (error instanceof Error) {
        if (error.message.includes('duplicate key')) {
          errorMessage = "Une erreur de synchronisation s'est produite. Réessayez dans quelques secondes.";
        } else if (error.message.includes('Wallet not connected')) {
          errorMessage = "Votre wallet s'est déconnecté. Reconnectez-vous et réessayez.";
        } else {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: "CONFIGURATION_ERROR",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (!connected || !publicKey) {
    return (
      <div className="w-full max-w-md bg-black/90 backdrop-blur-sm rounded-lg border-2 border-cyber-cyan/50 shadow-[0_0_20px_rgba(0,255,255,0.2)] p-6">
        <h2 className="text-2xl font-bold text-center mb-6 text-cyber-cyan font-mono">WALLET_CONNECTION</h2>
        
        <div className="text-center space-y-4">
          <div className="p-4 bg-cyber-blue/10 rounded-lg border border-cyber-blue/30">
            {isMobile ? (
              <Smartphone className="h-12 w-12 text-cyber-blue mx-auto mb-3" />
            ) : (
              <Wallet className="h-12 w-12 text-cyber-blue mx-auto mb-3" />
            )}
            <p className="text-cyber-blue text-sm font-mono">
              {isMobile 
                ? "Connectez votre wallet mobile Solana pour jouer. Votre adresse sera votre identité unique dans le jeu."
                : "Votre adresse wallet Solana sera votre identité unique dans le jeu. Connectez votre wallet pour continuer."
              }
            </p>
          </div>
          
          <div className="p-3 bg-amber-900/20 rounded-lg border border-amber-600/30">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5" />
              <div className="text-sm text-amber-200 font-mono">
                <p className="font-bold">IMPORTANT:</p>
                <p className="mt-1">Votre wallet doit rester connecté pendant toute la session de jeu pour pouvoir rejoindre des salles.</p>
              </div>
            </div>
          </div>
          
          <WalletButton className="w-full flex justify-center bg-gradient-to-r from-cyber-cyan to-cyber-magenta hover:from-cyber-magenta hover:to-cyber-cyan text-black font-mono font-bold" />
          
          {isMobile && (
            <div className="text-xs text-gray-400 mt-2 font-mono">
              <p>⚠️ Ne partagez jamais votre clé privée</p>
              <p>✅ Connexion sécurisée via votre app wallet</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md bg-black/90 backdrop-blur-sm rounded-lg border-2 border-cyber-magenta/50 shadow-[0_0_20px_rgba(255,0,255,0.2)] p-6">
      <h2 className="text-2xl font-bold text-center mb-6 text-cyber-magenta font-mono">BLOB_PROTOCOL_CONFIG</h2>
      
      <div className="mb-4 p-3 bg-cyber-green/10 rounded-lg border border-cyber-green/30">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-cyber-green" />
          <span className="text-sm font-medium text-cyber-green font-mono">
            Wallet: {formatAddress(publicKey.toString())}
          </span>
        </div>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name" className="text-cyber-cyan font-mono">BLOB_NAME</Label>
          <Input
            id="name"
            placeholder="Entrez le nom de votre blob"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={15}
            disabled={isLoading}
            className="bg-black/50 border-cyber-cyan/30 text-cyber-cyan font-mono focus:border-cyber-cyan"
          />
          <p className="text-xs text-gray-400 font-mono">{name.length}/15 caractères</p>
        </div>
        
        <Tabs defaultValue="color" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-black/50 border border-cyber-cyan/30">
            <TabsTrigger 
              value="color" 
              className="font-mono data-[state=active]:bg-cyber-cyan/20 data-[state=active]:text-cyber-cyan text-gray-400"
            >
              COLORS
            </TabsTrigger>
            <TabsTrigger 
              value="nft" 
              className="font-mono data-[state=active]:bg-cyber-magenta/20 data-[state=active]:text-cyber-magenta text-gray-400"
            >
              NFT_SKIN
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="color" className="space-y-2 mt-4">
            <Label className="text-cyber-cyan font-mono">CHOOSE_COLOR</Label>
            <div className="grid grid-cols-4 gap-2">
              {COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`w-12 h-12 rounded-full transition-all border-2 ${
                    selectedColor === color 
                      ? "ring-4 ring-offset-2 ring-cyber-cyan ring-offset-black border-cyber-cyan" 
                      : "border-gray-600 hover:border-cyber-cyan/50"
                  }`}
                  style={{ backgroundColor: `#${getColorHex(color)}` }}
                  onClick={() => setSelectedColor(color)}
                  aria-label={`Sélectionner la couleur ${color}`}
                  disabled={isLoading}
                />
              ))}
            </div>
          </TabsContent>
          
          <TabsContent value="nft" className="space-y-2 mt-4">
            <Label htmlFor="nftUrl" className="text-cyber-magenta font-mono">NFT_IMAGE_URL</Label>
            <Input
              id="nftUrl"
              placeholder="https://example.com/mon-nft.png"
              value={nftImageUrl}
              onChange={(e) => handleNftImageChange(e.target.value)}
              type="url"
              disabled={isLoading}
              className="bg-black/50 border-cyber-magenta/30 text-cyber-magenta font-mono focus:border-cyber-magenta"
            />
            
            {imageError && (
              <p className="text-sm text-red-400 font-mono">
                IMAGE_LOAD_ERROR: Impossible de charger cette image. Vérifiez l'URL.
              </p>
            )}
            
            {previewImage && !imageError && (
              <div className="mt-3 text-center">
                <Label className="text-sm text-gray-400 font-mono">PREVIEW:</Label>
                <div className="mt-2 inline-block relative">
                  <div className="w-16 h-16 rounded-full border-2 border-cyber-magenta/50 overflow-hidden bg-black">
                    <img 
                      src={previewImage} 
                      alt="NFT Preview" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="absolute inset-0 bg-cyber-magenta/10 rounded-full blur-sm animate-pulse"></div>
                </div>
              </div>
            )}
            
            <div className="p-3 bg-cyber-blue/10 rounded-lg border border-cyber-blue/30 mt-3">
              <div className="flex items-start gap-2">
                <Image className="h-4 w-4 text-cyber-blue mt-0.5" />
                <div className="text-sm text-cyber-blue font-mono">
                  <p className="font-bold">NFT_PROTOCOL_INFO:</p>
                  <ul className="mt-1 text-xs space-y-1 text-gray-300">
                    <li>• Collez l'URL de l'image de votre NFT</li>
                    <li>• L'image s'affichera sur votre blob dans le jeu</li>
                    <li>• Si l'image ne charge pas, la couleur sera utilisée</li>
                  </ul>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
        
        <div className="pt-2">
          {player && player.walletAddress === publicKey.toString() ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div 
                  className="w-12 h-12 rounded-full flex items-center justify-center overflow-hidden border-2 border-cyber-green/50"
                  style={{ backgroundColor: previewImage ? 'transparent' : `#${getColorHex(player.color)}` }}
                >
                  {previewImage ? (
                    <img 
                      src={previewImage} 
                      alt="Current NFT" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-white font-bold text-sm font-mono">
                      {player.name.substring(0, 2)}
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-cyber-green font-mono">CURRENT_CONFIG</p>
                  <p className="font-bold text-cyber-cyan font-mono">{player.name}</p>
                  <p className="text-xs text-gray-400 font-mono">{formatAddress(player.walletAddress)}</p>
                </div>
              </div>
              <Button 
                type="submit" 
                disabled={isLoading}
                className="bg-gradient-to-r from-cyber-yellow to-cyber-orange hover:from-cyber-orange hover:to-cyber-yellow text-black font-mono font-bold"
              >
                {isLoading ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent"></div>
                    UPDATING...
                  </>
                ) : (
                  <>
                    <Zap className="mr-2 h-4 w-4" />
                    UPDATE
                  </>
                )}
              </Button>
            </div>
          ) : (
            <Button 
              type="submit" 
              className="w-full bg-gradient-to-r from-cyber-cyan to-cyber-magenta hover:from-cyber-magenta hover:to-cyber-cyan text-black font-mono font-bold" 
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent"></div>
                  INITIALIZING...
                </>
              ) : (
                <>
                  <Zap className="mr-2 h-4 w-4" />
                  INITIALIZE_BLOB
                </>
              )}
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
