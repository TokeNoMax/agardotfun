
import React from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import WalletButton from "./WalletButton";

interface WalletGateProps {
  children: React.ReactNode;
}

export const WalletGate: React.FC<WalletGateProps> = ({ children }) => {
  const { publicKey } = useWallet();
  const connected = !!publicKey;

  if (!connected) {
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
            Connect Wallet
          </h1>
          
          {/* Wallet Button Component */}
          <div className="mb-6">
            <WalletButton className="transform scale-110" />
          </div>
          
          {/* Message mobile */}
          <p className="text-sm italic text-cyber-cyan md:hidden font-mono animate-terminal-blink">
            📱 Pour jouer sur mobile, utilisez le navigateur Phantom
          </p>
          
          <p className="text-gray-400 font-mono text-sm mt-4 max-w-md mx-auto">
            Connectez votre wallet Solana pour accéder au jeu et profiter de l'expérience complète
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
