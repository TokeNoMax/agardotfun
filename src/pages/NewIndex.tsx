
import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { SimpleWalletButton } from "@/components/wallet/SimpleWalletButton";
import { WalletStatus } from "@/components/wallet/WalletStatus";
import { LandingHero } from "@/components/Landing/LandingHero";
import { Play, Users, Gamepad2 } from "lucide-react";

const NewIndex = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Cyber Background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 opacity-20">
          <div className="grid-background"></div>
        </div>
        <div className="absolute inset-0 pointer-events-none">
          <div className="scan-line"></div>
        </div>
      </div>

      {/* Header */}
      <header className="relative z-10 flex justify-between items-center p-6">
        <div className="flex items-center">
          <svg width="32" height="32" viewBox="0 0 397.7 311.7" className="text-cyber-cyan mr-3" fill="currentColor">
            <linearGradient id="headerGradient" x1="360.8791" y1="351.4553" x2="141.213" y2="-69.2936" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#00FFF0"/>
              <stop offset="1" stopColor="#DC1FFF"/>
            </linearGradient>
            <path d="M64.6,237.9c2.4-2.4,5.7-3.8,9.2-3.8h317.4c5.8,0,8.7,7,4.6,11.1l-62.7,62.7c-2.4,2.4-5.7,3.8-9.2,3.8H6.5c-5.8,0-8.7-7-4.6-11.1L64.6,237.9z" fill="url(#headerGradient)"/>
            <path d="M64.6,3.8C67.1,1.4,70.4,0,73.8,0h317.4c5.8,0,8.7,7,4.6,11.1l-62.7,62.7c-2.4,2.4-5.7,3.8-9.2,3.8H6.5c-5.8,0-8.7-7-4.6-11.1L64.6,3.8z" fill="url(#headerGradient)"/>
            <path d="M333.1,120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8,0-8.7,7-4.6,11.1l62.7,62.7c2.4,2.4,5.7,3.8,9.2,3.8h317.4c5.8,0,8.7-7,4.6-11.1L333.1,120.1z" fill="url(#headerGradient)"/>
          </svg>
          <h1 className="text-2xl font-pixel text-cyber-cyan">
            agar<span className="text-cyber-yellow">.fun</span>
          </h1>
        </div>
        
        <div className="flex items-center gap-4">
          <WalletStatus showDetails />
          <SimpleWalletButton variant="minimal" />
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex flex-col items-center justify-center min-h-[80vh] px-4">
        <LandingHero />
        
        {/* Action Buttons */}
        <div className="mt-12 flex flex-col sm:flex-row gap-4 w-full max-w-md">
          <Button
            onClick={() => navigate("/lobby")}
            className="flex-1 bg-gradient-to-r from-cyber-green to-cyber-cyan text-black font-mono font-bold py-4 text-lg transform hover:scale-105 transition-all duration-300 shadow-[0_0_20px_rgba(0,255,255,0.3)]"
          >
            <Play className="mr-2 h-5 w-5" />
            PLAY NOW
          </Button>
          
          <Button
            onClick={() => navigate("/lobby")}
            variant="outline"
            className="flex-1 border-cyber-magenta/50 text-cyber-magenta hover:bg-cyber-magenta/10 font-mono font-bold py-4 text-lg"
          >
            <Users className="mr-2 h-5 w-5" />
            LOBBY
          </Button>
        </div>

        {/* Quick Info */}
        <div className="mt-8 text-center">
          <p className="text-gray-400 font-mono text-sm mb-2">
            🎮 Wallet connection is optional - you can play instantly!
          </p>
          <p className="text-cyber-cyan font-mono text-xs">
            Connect your Solana wallet for advanced features
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 text-center p-6">
        <p className="text-gray-500 text-xs font-mono">
          © 2025 agar.fun - Powered by <span className="text-cyber-green">Solana</span> 🚀
        </p>
      </footer>
    </div>
  );
};

export default NewIndex;
