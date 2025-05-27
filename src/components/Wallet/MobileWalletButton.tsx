
import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Button } from '@/components/ui/button';
import { Wallet, Smartphone, Download } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

interface MobileWalletButtonProps {
  className?: string;
}

export default function MobileWalletButton({ className }: MobileWalletButtonProps) {
  const { connected, publicKey, wallet } = useWallet();
  const isMobile = useIsMobile();
  const [showMobileInstructions, setShowMobileInstructions] = useState(false);

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  // Check if popular mobile wallets are installed
  const checkMobileWallets = () => {
    if (typeof window === 'undefined') return { phantom: false, solflare: false };
    
    const phantom = !!(window as any).phantom?.solana;
    const solflare = !!(window as any).solflare;
    
    return { phantom, solflare };
  };

  const [walletStatus, setWalletStatus] = useState(checkMobileWallets());

  useEffect(() => {
    setWalletStatus(checkMobileWallets());
  }, []);

  const handleMobileWalletInstall = (walletName: 'phantom' | 'solflare') => {
    const urls = {
      phantom: {
        ios: 'https://apps.apple.com/app/phantom-solana-wallet/id1598432977',
        android: 'https://play.google.com/store/apps/details?id=app.phantom'
      },
      solflare: {
        ios: 'https://apps.apple.com/app/solflare/id1580902717',
        android: 'https://play.google.com/store/apps/details?id=com.solflare.mobile'
      }
    };

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const url = isIOS ? urls[walletName].ios : urls[walletName].android;
    
    window.open(url, '_blank');
  };

  if (connected && publicKey) {
    return (
      <div className={className}>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-2 bg-green-100 text-green-800 rounded-md border border-green-200">
            <Wallet className="h-4 w-4" />
            <span className="text-sm font-medium">
              {formatAddress(publicKey.toString())}
            </span>
          </div>
          <WalletMultiButton />
        </div>
      </div>
    );
  }

  if (isMobile && (!walletStatus.phantom && !walletStatus.solflare)) {
    return (
      <div className={className}>
        <div className="space-y-3">
          <div className="text-center">
            <Smartphone className="h-8 w-8 text-indigo-500 mx-auto mb-2" />
            <p className="text-sm text-gray-600 mb-3">
              Installez un wallet Solana pour continuer
            </p>
          </div>
          
          <div className="flex flex-col gap-2">
            <Button
              onClick={() => handleMobileWalletInstall('phantom')}
              variant="outline"
              className="w-full flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Installer Phantom
            </Button>
            
            <Button
              onClick={() => handleMobileWalletInstall('solflare')}
              variant="outline"
              className="w-full flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Installer Solflare
            </Button>
          </div>
          
          <div className="text-center">
            <Button
              onClick={() => setShowMobileInstructions(!showMobileInstructions)}
              variant="ghost"
              size="sm"
              className="text-xs"
            >
              {showMobileInstructions ? 'Masquer' : 'Voir'} les instructions
            </Button>
          </div>
          
          {showMobileInstructions && (
            <div className="text-xs text-gray-500 space-y-1 p-3 bg-gray-50 rounded-md">
              <p>1. Installez Phantom ou Solflare depuis votre app store</p>
              <p>2. Créez ou importez votre wallet</p>
              <p>3. Revenez ici et connectez-vous</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <WalletMultiButton />
      
      {isMobile && (
        <div className="mt-2 text-xs text-gray-500 text-center">
          <p>Connexion sécurisée via votre app wallet</p>
        </div>
      )}
    </div>
  );
}
