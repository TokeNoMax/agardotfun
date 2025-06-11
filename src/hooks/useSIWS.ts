
import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { siwsService } from '@/services/siws/siwsService';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export const useSIWS = () => {
  const { publicKey, signMessage } = useWallet();
  const { toast } = useToast();
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Vérifier si le wallet supporte la signature de messages
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
      
      // Générer le challenge
      console.log("Generating challenge for wallet:", walletAddress);
      const challenge = await siwsService.generateChallenge(walletAddress);
      
      // Construire le message simplifié EXACTEMENT comme dans l'Edge Function
      const msg = `Sign-in nonce: ${challenge.nonce}`;
      console.log('Message à signer:', msg);
      
      // Encoder le message en Uint8Array
      const bytes = new TextEncoder().encode(msg);
      
      // Signer le message
      console.log("Requesting signature...");
      const signature = await signMessage(bytes);
      console.log('Signature obtenue:', {
        length: signature.length,
        first8: Array.from(signature.slice(0, 8))
      });
      
      // Vérifier la signature
      console.log("Verifying signature...");
      const result = await siwsService.verifySignature(
        challenge.nonce,
        signature,
        walletAddress
      );

      console.log("Verification result:", result);

      if (result.success) {
        if (result.session) {
          // Établir la session Supabase si disponible
          await supabase.auth.setSession({
            access_token: result.session.access_token,
            refresh_token: result.session.refresh_token
          });
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
      
      // Gestion d'erreurs granularisée
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
