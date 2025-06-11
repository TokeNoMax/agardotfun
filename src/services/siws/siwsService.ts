
import { supabase } from "@/integrations/supabase/client";

export interface SIWSChallenge {
  nonce: string;
  message: string;
  expiresAt: string;
}

export interface SIWSVerification {
  success: boolean;
  user?: any;
  session?: any;
  error?: string;
  verified?: boolean;
}

export const siwsService = {
  async generateChallenge(walletAddress: string): Promise<SIWSChallenge> {
    console.log("Generating SIWS challenge for:", walletAddress);
    
    try {
      const { data, error } = await supabase.functions.invoke('siws-challenge', {
        body: { walletAddress }
      });

      if (error) {
        console.error("Challenge generation error:", error);
        throw new Error(error.message || 'Failed to generate challenge');
      }

      return data;
    } catch (error: any) {
      console.error("Challenge generation failed:", error);
      throw new Error(error.message || 'Failed to connect to authentication service');
    }
  },

  async verifySignature(
    nonce: string, 
    signature: Uint8Array, 
    walletAddress: string
  ): Promise<SIWSVerification> {
    console.log("Verifying SIWS signature for:", walletAddress);
    console.log("Nonce:", nonce);
    console.log("Signature length:", signature.length);
    console.log("Signature first 8 bytes:", Array.from(signature.slice(0, 8)));
    
    try {
      const { data, error } = await supabase.functions.invoke('siws-verify', {
        body: { 
          nonce, 
          signature: Array.from(signature), // Convertir Uint8Array en array normal
          walletAddress 
        }
      });

      if (error) {
        console.error("Signature verification error:", error);
        
        // Gestion d'erreurs granularisée basée sur les codes d'erreur de l'Edge Function
        let errorMessage = 'Verification failed';
        if (error.message?.includes('non-2xx status code')) {
          errorMessage = 'Erreur de vérification côté serveur. Veuillez réessayer.';
        }
        
        return { success: false, error: errorMessage };
      }

      // Vérifier si la réponse contient une erreur de l'Edge Function
      if (data?.error) {
        let errorMessage = 'Verification failed';
        
        switch (data.error) {
          case 'invalid-signature':
            errorMessage = 'Signature invalide. Veuillez signer à nouveau le message.';
            break;
          case 'invalid-nonce':
            errorMessage = 'Nonce invalide ou expiré. Veuillez recommencer.';
            break;
          case 'nonce-expired':
            errorMessage = 'Le délai de signature a expiré. Veuillez recommencer.';
            break;
          case 'missing-parameters':
            errorMessage = 'Paramètres manquants. Veuillez réessayer.';
            break;
          case 'user-creation-failed':
            errorMessage = 'Impossible de créer le compte utilisateur.';
            break;
          case 'internal-server-error':
            errorMessage = 'Erreur serveur interne. Veuillez réessayer plus tard.';
            break;
          default:
            errorMessage = `Erreur de vérification : ${data.error}`;
        }
        
        return { success: false, error: errorMessage };
      }

      return data;
    } catch (error: any) {
      console.error("Verification request failed:", error);
      return { success: false, error: error.message || 'Failed to connect to verification service' };
    }
  }
};
