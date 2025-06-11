
import { supabase } from "@/integrations/supabase/client";

export interface SIWSChallenge {
  nonce: string;
  message: string;
  expiresAt: string;
}

export interface SIWSVerification {
  success: boolean;
  user?: any;
  verified?: boolean;
  error?: string;
  session?: any;
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
    console.log("=== FRONTEND VERIFICATION START ===");
    console.log("Verifying SIWS signature for:", walletAddress);
    console.log("Nonce:", nonce);
    console.log("Signature type:", signature.constructor.name);
    console.log("Signature length:", signature.length);
    console.log("Signature first 8 bytes:", Array.from(signature.slice(0, 8)));
    console.log("Signature last 8 bytes:", Array.from(signature.slice(-8)));
    
    try {
      // Convert Uint8Array to regular array for transmission
      const signatureArray = Array.from(signature);
      console.log("Converted signature array length:", signatureArray.length);
      console.log("All elements are numbers:", signatureArray.every(x => typeof x === 'number'));
      
      const requestBody = { 
        nonce, 
        signature: signatureArray,
        walletAddress 
      };
      
      console.log("Request body structure:", {
        hasNonce: !!requestBody.nonce,
        hasSignature: !!requestBody.signature,
        hasWalletAddress: !!requestBody.walletAddress,
        signatureLength: requestBody.signature.length
      });
      
      const { data, error } = await supabase.functions.invoke('siws-verify', {
        body: requestBody
      });

      console.log("Edge Function response:", { data, error });

      if (error) {
        console.error("Edge Function error:", error);
        
        let errorMessage = 'Verification failed';
        if (error.message?.includes('non-2xx status code')) {
          errorMessage = 'Erreur de vérification côté serveur. Veuillez réessayer.';
        }
        
        return { success: false, error: errorMessage };
      }

      // Check for application-level errors in response
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
          case 'invalid-signature-format':
            errorMessage = 'Format de signature invalide. Veuillez réessayer.';
            break;
          default:
            errorMessage = `Erreur de vérification : ${data.error}`;
        }
        
        return { success: false, error: errorMessage };
      }

      // If we have session data, try to establish the Supabase session
      if (data?.session?.access_token) {
        console.log("Attempting to establish Supabase session...");
        
        try {
          // Use the magic link to establish session
          const url = new URL(data.session.access_token);
          const accessToken = url.searchParams.get('access_token');
          const refreshToken = url.searchParams.get('refresh_token');
          
          if (accessToken && refreshToken) {
            const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken
            });
            
            if (sessionError) {
              console.warn("Failed to set session:", sessionError);
            } else {
              console.log("✅ Supabase session established:", sessionData);
            }
          }
        } catch (sessionErr) {
          console.warn("Session establishment failed:", sessionErr);
        }
      }

      console.log("✅ Verification successful:", data);
      return data;
    } catch (error: any) {
      console.error("Verification request failed:", error);
      return { success: false, error: error.message || 'Failed to connect to verification service' };
    }
  }
};
