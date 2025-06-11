
import React from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Button } from "@/components/ui/button";
import { Wallet, LogOut, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

interface SimpleWalletButtonProps {
  variant?: "default" | "minimal" | "mobile";
  className?: string;
}

export const SimpleWalletButton: React.FC<SimpleWalletButtonProps> = ({ 
  variant = "default", 
  className = "" 
}) => {
  const { publicKey, disconnect } = useWallet();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const connected = !!publicKey;

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const copyAddress = async () => {
    if (publicKey) {
      await navigator.clipboard.writeText(publicKey.toString());
      setCopied(true);
      toast({
        title: "Address Copied",
        description: "Wallet address copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (connected) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {variant !== "minimal" && (
          <div className="flex items-center gap-2 bg-cyber-green/10 border border-cyber-green/30 rounded-lg px-3 py-2">
            <div className="w-2 h-2 bg-cyber-green rounded-full animate-pulse"></div>
            <span className="text-cyber-green font-mono text-sm">
              {formatAddress(publicKey.toString())}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={copyAddress}
              className="h-6 w-6 p-0 text-cyber-green hover:text-cyber-cyan"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </Button>
          </div>
        )}
        <Button
          onClick={disconnect}
          variant="outline"
          size={variant === "mobile" ? "sm" : "default"}
          className="border-cyber-magenta/50 text-cyber-magenta hover:bg-cyber-magenta/10 font-mono"
        >
          <LogOut className="w-4 h-4 mr-2" />
          {variant === "mobile" ? "Disconnect" : "Disconnect Wallet"}
        </Button>
      </div>
    );
  }

  return (
    <div className={`wallet-adapter-button-container ${className}`}>
      <WalletMultiButton className="!bg-gradient-to-r !from-cyber-green !to-cyber-cyan hover:!from-cyber-cyan hover:!to-cyber-green !text-black !font-mono !font-bold !border !border-cyber-green/50 !rounded-lg !px-6 !py-3 !transition-all !duration-300 !transform hover:!scale-105 !shadow-[0_0_20px_rgba(0,255,255,0.3)]">
        <Wallet className="w-5 h-5 mr-2" />
        {variant === "mobile" ? "Connect" : "Connect Wallet"}
      </WalletMultiButton>
    </div>
  );
};
