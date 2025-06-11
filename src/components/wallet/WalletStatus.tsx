
import React from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Shield, AlertTriangle, CheckCircle } from "lucide-react";

interface WalletStatusProps {
  showDetails?: boolean;
  className?: string;
}

export const WalletStatus: React.FC<WalletStatusProps> = ({ 
  showDetails = false, 
  className = "" 
}) => {
  const { publicKey, connected, connecting } = useWallet();

  if (connecting) {
    return (
      <div className={`flex items-center gap-2 text-cyber-cyan ${className}`}>
        <Shield className="h-4 w-4 animate-spin" />
        <span className="font-mono text-sm">Connecting...</span>
      </div>
    );
  }

  if (connected && publicKey) {
    return (
      <div className={`flex items-center gap-2 text-cyber-green ${className}`}>
        <CheckCircle className="h-4 w-4" />
        <span className="font-mono text-sm">
          Wallet Connected
          {showDetails && (
            <span className="text-gray-400 ml-2">
              ({publicKey.toString().slice(0, 4)}...{publicKey.toString().slice(-4)})
            </span>
          )}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 text-gray-400 ${className}`}>
      <AlertTriangle className="h-4 w-4" />
      <span className="font-mono text-sm">No Wallet Connected</span>
    </div>
  );
};
