
import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { siwsService } from '@/services/siws/siwsService';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export const useSIWS = () => {
  const { publicKey, signMessage } = useWallet();
  const { toast } = useToast();
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Check if wallet supports message signing
  const canSign = !!signMessage;

  const authenticate = async () => {
    if (!publicKey || !signMessage) {
      toast({
        title: "Wallet Required",
        description: "Please connect your wallet first.",
        variant: "destructive",
      });
      return false;
    }

    if (!canSign) {
      toast({
        title: "Signature Non Supportée",
        description: "Ce wallet ne supporte pas la signature de messages. Essayez Phantom Desktop ou Glow.",
        variant: "destructive",
      });
      return false;
    }

    setIsAuthenticating(true);

    try {
      const walletAddress = publicKey.toString();
      
      console.log("=== AUTHENTICATION START ===");
      console.log("Wallet address:", walletAddress);
      
      // Generate challenge
      const challenge = await siwsService.generateChallenge(walletAddress);
      console.log("Challenge received:", challenge);
      
      // Build message EXACTLY as expected by Edge Function
      const message = `Sign-in nonce: ${challenge.nonce}`;
      console.log("Message to sign:", JSON.stringify(message));
      console.log("Message length:", message.length);
      
      // Encode message to bytes
      const messageBytes = new TextEncoder().encode(message);
      console.log("Message bytes length:", messageBytes.length);
      console.log("Message bytes first 8:", Array.from(messageBytes.slice(0, 8)));
      
      // Sign the message
      console.log("Requesting signature from wallet...");
      const signature = await signMessage(messageBytes);
      
      console.log("Signature received from wallet:");
      console.log("- Type:", signature.constructor.name);
      console.log("- Length:", signature.length);
      console.log("- First 8 bytes:", Array.from(signature.slice(0, 8)));
      console.log("- Last 8 bytes:", Array.from(signature.slice(-8)));
      
      // Verify signature
      console.log("Sending to verification...");
      const result = await siwsService.verifySignature(
        challenge.nonce,
        signature,
        walletAddress
      );

      console.log("Verification result:", result);

      if (result.success) {
        // Check if user is now authenticated in Supabase
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          console.log("✅ Supabase session confirmed:", session.user.email);
        } else {
          console.log("⚠️ SIWS verification succeeded but no Supabase session");
        }
        
        toast({
          title: "Authentication Successful",
          description: "You are now signed in with Solana!",
        });
        
        return true;
      } else {
        throw new Error(result.error || 'Authentication failed');
      }
    } catch (error: any) {
      console.error('SIWS authentication error:', error);
      
      // Enhanced error handling
      let errorMessage = 'Unknown error occurred';
      
      if (error.code === 4100) {
        errorMessage = 'La signature de messages est désactivée dans votre wallet (Settings ▸ Developer ▸ Allow Message Signing).';
      } else if (error.message?.includes('signMessage')) {
        errorMessage = 'Votre wallet ne supporte pas signMessage.';
      } else if (error.message?.includes('User rejected')) {
        errorMessage = 'Signature annulée par l\'utilisateur.';
      } else if (error.message?.includes('Failed to connect')) {
        errorMessage = 'Impossible de se connecter au service d\'authentification. Vérifiez votre connexion.';
      } else if (error.message?.includes('Signature invalide')) {
        errorMessage = 'Signature invalide. Veuillez réessayer.';
      } else if (error.message?.includes('expiré')) {
        errorMessage = 'Challenge expiré. Veuillez recommencer.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Authentication Failed",
        description: errorMessage,
        variant: "destructive",
      });
      return false;
    } finally {
      setIsAuthenticating(false);
    }
  };

  return {
    authenticate,
    isAuthenticating,
    canSign
  };
};
