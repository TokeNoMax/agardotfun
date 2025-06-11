
import React from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Button } from "@/components/ui/button";
import { Wallet, LogOut } from "lucide-react";

interface MobileWalletButtonProps {
  className?: string;
}

const MobileWalletButton: React.FC<MobileWalletButtonProps> = ({ className = "" }) => {
  const { publicKey, disconnect } = useWallet();
  const connected = !!publicKey;

  if (connected) {
    return (
      <Button
        onClick={disconnect}
        variant="outline"
        size="sm"
        className={`bg-cyber-magenta/20 border-cyber-magenta text-cyber-magenta hover:bg-cyber-magenta/30 font-mono text-xs ${className}`}
      >
        <LogOut className="w-3 h-3 mr-1" />
        {publicKey ? `${publicKey.toString().slice(0, 3)}...${publicKey.toString().slice(-3)}` : 'Disconnect'}
      </Button>
    );
  }

  return (
    <div className={`wallet-adapter-button-container ${className}`}>
      <WalletMultiButton className="!bg-gradient-to-r !from-cyber-green !to-cyber-cyan hover:!from-cyber-cyan hover:!to-cyber-green !text-black !font-mono !font-bold !border !border-cyber-green/50 !rounded-md !px-3 !py-2 !text-xs !transition-all !duration-300">
        <Wallet className="w-3 h-3 mr-1" />
        Connect
      </WalletMultiButton>
    </div>
  );
};

export default MobileWalletButton;
