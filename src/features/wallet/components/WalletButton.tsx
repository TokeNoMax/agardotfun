
import React from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Button } from "@/components/ui/button";
import { Wallet, LogOut } from "lucide-react";

interface WalletButtonProps {
  className?: string;
}

const WalletButton: React.FC<WalletButtonProps> = ({ className = "" }) => {
  const { publicKey, disconnect } = useWallet();
  const connected = !!publicKey;

  if (connected) {
    return (
      <Button
        onClick={disconnect}
        variant="outline"
        className={`bg-cyber-magenta/20 border-cyber-magenta text-cyber-magenta hover:bg-cyber-magenta/30 font-mono ${className}`}
      >
        <LogOut className="w-4 h-4 mr-2" />
        {publicKey ? `${publicKey.toString().slice(0, 4)}...${publicKey.toString().slice(-4)}` : 'Disconnect'}
      </Button>
    );
  }

  return (
    <div className={`wallet-adapter-button-container ${className}`}>
      <WalletMultiButton className="!bg-gradient-to-r !from-cyber-green !to-cyber-cyan hover:!from-cyber-cyan hover:!to-cyber-green !text-black !font-mono !font-bold !border !border-cyber-green/50 !rounded-lg !px-6 !py-3 !transition-all !duration-300 !transform hover:!scale-105 !shadow-[0_0_20px_rgba(0,255,255,0.3)]">
        <Wallet className="w-5 h-5 mr-2" />
        Connect Wallet
      </WalletMultiButton>
    </div>
  );
};

export default WalletButton;
