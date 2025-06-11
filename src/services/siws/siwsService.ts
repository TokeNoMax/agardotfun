
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
    
    try {
      const { data, error } = await supabase.functions.invoke('siws-verify', {
        body: { 
          nonce, 
          signature: Array.from(signature), 
          walletAddress 
        }
      });

      if (error) {
        console.error("Signature verification error:", error);
        return { success: false, error: error.message || 'Verification failed' };
      }

      return data;
    } catch (error: any) {
      console.error("Verification request failed:", error);
      return { success: false, error: error.message || 'Failed to connect to verification service' };
    }
  }
};
