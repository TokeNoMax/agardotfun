
import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useGame } from "@/context/GameContext";
import { PlayerColor } from "@/types/game";
import WalletButton from "@/components/Wallet/WalletButton";
import { Wallet, Smartphone, Image } from "lucide-react";
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
    if (player) {
      setName(player.name);
      setSelectedColor(player.color);
      setNftImageUrl(player.nftImageUrl || "");
      setPreviewImage(player.nftImageUrl || null);
    }
  }, [player]);

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
        title: "Erreur",
        description: "Veuillez connecter votre wallet pour continuer.",
        variant: "destructive"
      });
      return;
    }
    
    if (!name.trim()) {
      toast({
        title: "Erreur",
        description: "Veuillez entrer un nom pour votre blob.",
        variant: "destructive"
      });
      return;
    }

    if (name.trim().length > 15) {
      toast({
        title: "Erreur",
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
        nftImageUrl: nftImageUrl.trim() || undefined
      });

      await setPlayerDetails(
        name.trim(),
        selectedColor,
        nftImageUrl.trim() || undefined
      );

      toast({
        title: "Succès",
        description: `Votre blob "${name}" a été configuré avec succès !`
      });
    } catch (error) {
      console.error("Error creating player:", error);
      toast({
        title: "Erreur de configuration",
        description: error instanceof Error ? error.message : "Impossible de configurer votre joueur. Vérifiez votre connexion et réessayez.",
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
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold text-center mb-6">Connectez votre wallet</h2>
        
        <div className="text-center space-y-4">
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            {isMobile ? (
              <Smartphone className="h-12 w-12 text-blue-500 mx-auto mb-3" />
            ) : (
              <Wallet className="h-12 w-12 text-blue-500 mx-auto mb-3" />
            )}
            <p className="text-blue-800 text-sm">
              {isMobile 
                ? "Connectez votre wallet mobile Solana pour jouer. Votre adresse sera votre identité unique dans le jeu."
                : "Votre adresse wallet Solana sera votre identité unique dans le jeu. Connectez votre wallet pour continuer."
              }
            </p>
          </div>
          
          <WalletButton className="w-full flex justify-center" />
          
          {isMobile && (
            <div className="text-xs text-gray-500 mt-2">
              <p>⚠️ Ne partagez jamais votre clé privée</p>
              <p>✅ Connexion sécurisée via votre app wallet</p>
            </div>
          )}
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
            disabled={isLoading}
          />
          <p className="text-xs text-gray-500">{name.length}/15 caractères</p>
        </div>
        
        <Tabs defaultValue="color" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="color">Couleurs</TabsTrigger>
            <TabsTrigger value="nft">NFT Image</TabsTrigger>
          </TabsList>
          
          <TabsContent value="color" className="space-y-2 mt-4">
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
                  disabled={isLoading}
                />
              ))}
            </div>
          </TabsContent>
          
          <TabsContent value="nft" className="space-y-2 mt-4">
            <Label htmlFor="nftUrl">URL de l'image NFT</Label>
            <Input
              id="nftUrl"
              placeholder="https://example.com/mon-nft.png"
              value={nftImageUrl}
              onChange={(e) => handleNftImageChange(e.target.value)}
              type="url"
              disabled={isLoading}
            />
            
            {imageError && (
              <p className="text-sm text-red-600">
                Impossible de charger cette image. Vérifiez l'URL.
              </p>
            )}
            
            {previewImage && !imageError && (
              <div className="mt-3 text-center">
                <Label className="text-sm text-gray-600">Aperçu:</Label>
                <div className="mt-2 inline-block relative">
                  <div 
                    className="w-16 h-16 rounded-full border-2 border-gray-300 overflow-hidden bg-white"
                  >
                    <img 
                      src={previewImage} 
                      alt="NFT Preview" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              </div>
            )}
            
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 mt-3">
              <div className="flex items-start gap-2">
                <Image className="h-4 w-4 text-blue-600 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium">Comment utiliser un NFT:</p>
                  <ul className="mt-1 text-xs space-y-1">
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
          {player ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div 
                  className="w-12 h-12 rounded-full flex items-center justify-center overflow-hidden border-2 border-gray-300"
                  style={{ backgroundColor: previewImage ? 'transparent' : `#${getColorHex(player.color)}` }}
                >
                  {previewImage ? (
                    <img 
                      src={previewImage} 
                      alt="Current NFT" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-white font-bold text-sm">
                      {player.name.substring(0, 2)}
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium">Actuellement</p>
                  <p className="font-bold">{player.name}</p>
                  <p className="text-xs text-gray-500">{formatAddress(player.walletAddress)}</p>
                </div>
              </div>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Modification..." : "Modifier"}
              </Button>
            </div>
          ) : (
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Configuration..." : "Confirmer"}
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
