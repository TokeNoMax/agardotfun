
import React, { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Button } from '@/components/ui/button';
import { Wallet, Download, Info } from 'lucide-react';

interface MobileWalletButtonProps {
  className?: string;
}

export default function MobileWalletButton({ className }: MobileWalletButtonProps) {
  const { connected, publicKey } = useWallet();
  const [showInstallHelp, setShowInstallHelp] = useState(false);

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const handleInstallPhantom = () => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const url = isIOS 
      ? 'https://apps.apple.com/app/phantom-solana-wallet/id1598432977'
      : 'https://play.google.com/store/apps/details?id=app.phantom';
    window.open(url, '_blank');
  };

  const handleInstallSolflare = () => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const url = isIOS
      ? 'https://apps.apple.com/app/solflare/id1580902717'
      : 'https://play.google.com/store/apps/details?id=com.solflare.mobile';
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

  return (
    <div className={className}>
      <div className="space-y-3">
        {/* Bouton principal de connexion */}
        <WalletMultiButton />
        
        {/* Aide à l'installation - optionnelle */}
        <div className="text-center">
          <Button
            onClick={() => setShowInstallHelp(!showInstallHelp)}
            variant="ghost"
            size="sm"
            className="text-xs text-gray-600"
          >
            <Info className="h-3 w-3 mr-1" />
            {showInstallHelp ? 'Masquer' : 'Besoin d\'aide ?'}
          </Button>
        </div>
        
        {showInstallHelp && (
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 space-y-3">
            <p className="text-sm text-blue-800 text-center">
              Si vous n'avez pas de wallet Solana :
            </p>
            
            <div className="flex flex-col gap-2">
              <Button
                onClick={handleInstallPhantom}
                variant="outline"
                size="sm"
                className="w-full"
              >
                <Download className="h-4 w-4 mr-2" />
                Installer Phantom
              </Button>
              
              <Button
                onClick={handleInstallSolflare}
                variant="outline"
                size="sm"
                className="w-full"
              >
                <Download className="h-4 w-4 mr-2" />
                Installer Solflare
              </Button>
            </div>
            
            <div className="text-xs text-blue-600 space-y-1">
              <p>1. Installez un wallet depuis votre app store</p>
              <p>2. Créez ou importez votre wallet</p>
              <p>3. Revenez ici et connectez-vous</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
