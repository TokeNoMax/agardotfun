
import React, { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useSIWS } from "@/hooks/useSIWS";
import { supabase } from "@/integrations/supabase/client";
import WalletButton from "./WalletButton";
import { Button } from "@/components/ui/button";
import { Shield, Zap } from "lucide-react";

interface WalletGateProps {
  children: React.ReactNode;
}

export const WalletGate: React.FC<WalletGateProps> = ({ children }) => {
  const { publicKey } = useWallet();
  const { authenticate, isAuthenticating } = useSIWS();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const connected = !!publicKey;

  useEffect(() => {
    // Vérifier l'état d'authentification au montage
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
      }
      setIsLoading(false);
    };

    checkAuth();

    // Écouter les changements d'état d'authentification
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user || null);
        setIsLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-black">
        <div className="text-cyber-cyan animate-pulse font-mono">
          Loading authentication...
        </div>
      </div>
    );
  }

  if (!connected || !user) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-6 bg-black relative overflow-hidden">
        {/* Tron Grid Background */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 opacity-20">
            <div className="grid-background"></div>
          </div>
          {/* Animated scan lines */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="scan-line"></div>
          </div>
        </div>

        <div className="relative z-10 text-center">
          <h1 className="text-4xl neon-gradient font-extrabold mb-6 font-mono animate-neon-pulse">
            Secure Authentication
          </h1>
          
          {!connected ? (
            <>
              {/* Wallet Button Component */}
              <div className="mb-6">
                <WalletButton className="transform scale-110" />
              </div>
              
              <p className="text-gray-400 font-mono text-sm mt-4 max-w-md mx-auto">
                Connectez votre wallet Solana pour accéder au jeu
              </p>
            </>
          ) : (
            <>
              <div className="mb-6 p-6 bg-black/80 backdrop-blur-sm rounded-lg border border-cyber-cyan/50">
                <div className="flex items-center justify-center mb-4">
                  <Shield className="h-8 w-8 text-cyber-green mr-3" />
                  <span className="text-cyber-green font-mono font-bold">WALLET_CONNECTED</span>
                </div>
                
                <p className="text-gray-300 font-mono text-sm mb-4">
                  Wallet: {publicKey?.toString().slice(0, 4)}...{publicKey?.toString().slice(-4)}
                </p>
                
                <Button 
                  onClick={authenticate}
                  disabled={isAuthenticating}
                  className="bg-gradient-to-r from-cyber-green to-cyber-cyan hover:from-cyber-cyan hover:to-cyber-green text-black font-mono font-bold border border-cyber-green/50 shadow-[0_0_20px_rgba(0,255,255,0.3)]"
                >
                  <Zap className="mr-2 h-4 w-4" />
                  {isAuthenticating ? 'AUTHENTICATING...' : 'SIGN_MESSAGE'}
                </Button>
              </div>
              
              <p className="text-gray-400 font-mono text-sm max-w-md mx-auto">
                Signez un message pour prouver que vous possédez cette wallet
              </p>
            </>
          )}
          
          {/* Message mobile */}
          <p className="text-sm italic text-cyber-cyan md:hidden font-mono animate-terminal-blink mt-4">
            📱 Pour jouer sur mobile, utilisez le navigateur Phantom
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
