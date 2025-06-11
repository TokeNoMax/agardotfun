import React from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import MobileWalletButton from './MobileWalletButton';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Button } from '@/components/ui/button';
import { Wallet } from 'lucide-react';

interface WalletButtonProps {
  className?: string;
}

export default function WalletButton({ className }: WalletButtonProps) {
  const isMobile = useIsMobile();
  const { connected, publicKey } = useWallet();

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  // Use mobile-specific component on mobile devices
  if (isMobile) {
    return <MobileWalletButton className={className} />;
  }

  // Desktop behavior (unchanged)
  return (
    <div className={className}>
      {connected && publicKey ? (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-2 bg-green-100 text-green-800 rounded-md border border-green-200">
            <Wallet className="h-4 w-4" />
            <span className="text-sm font-medium">
              {formatAddress(publicKey.toString())}
            </span>
          </div>
          <WalletMultiButton />
        </div>
      ) : (
        <WalletMultiButton />
      )}
    </div>
  );
}
