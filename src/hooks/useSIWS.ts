
import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { siwsService } from '@/services/siws/siwsService';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export const useSIWS = () => {
  const { publicKey, signMessage } = useWallet();
  const { toast } = useToast();
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const authenticate = async () => {
    if (!publicKey || !signMessage) {
      toast({
        title: "Wallet Required",
        description: "Please connect your wallet first.",
        variant: "destructive",
      });
      return false;
    }

    setIsAuthenticating(true);

    try {
      const walletAddress = publicKey.toString();
      
      // Générer le challenge
      const challenge = await siwsService.generateChallenge(walletAddress);
      
      // Signer le message
      const messageBytes = new TextEncoder().encode(challenge.message);
      const signature = await signMessage(messageBytes);
      
      // Vérifier la signature
      const result = await siwsService.verifySignature(
        challenge.nonce,
        signature,
        walletAddress
      );

      if (result.success && result.session) {
        // Établir la session Supabase
        await supabase.auth.setSession({
          access_token: result.session.access_token,
          refresh_token: result.session.refresh_token
        });

        toast({
          title: "Authentication Successful",
          description: "You are now signed in with Solana!",
        });
        
        return true;
      } else {
        throw new Error(result.error || 'Authentication failed');
      }
    } catch (error) {
      console.error('SIWS authentication error:', error);
      toast({
        title: "Authentication Failed",
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: "destructive",
      });
      return false;
    } finally {
      setIsAuthenticating(false);
    }
  };

  return {
    authenticate,
    isAuthenticating
  };
};
