import React, { createContext, useContext, ReactNode } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { 
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  TorusWalletAdapter
} from '@solana/wallet-adapter-wallets';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';

// Import default styles
import '@solana/wallet-adapter-react-ui/styles.css';

interface WalletContextProviderProps {
  children: ReactNode;
}

// Mobile detection utility
const isMobile = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

// Mobile wallet detection
const detectMobileWallets = () => {
  if (typeof window === 'undefined') return { phantom: false, solflare: false };
  
  const phantom = !!(window as any).phantom?.solana;
  const solflare = !!(window as any).solflare;
  
  return { phantom, solflare };
};

export const WalletContextProvider: React.FC<WalletContextProviderProps> = ({ children }) => {
  // Use devnet for development, mainnet-beta for production
  const network = WalletAdapterNetwork.Devnet;
  const endpoint = clusterApiUrl(network);
  
  // Configure wallets with mobile-specific options
  const wallets = [
    // Phantom with mobile deep link support
    new PhantomWalletAdapter({
      network,
    }),
    
    // Solflare with mobile support
    new SolflareWalletAdapter({
      network,
    }),
    
    // Keep Torus as fallback for web-based wallet
    new TorusWalletAdapter({
      clientId: 'BOM5Cl7PXgE9Ylq1Z1tqzhpydY0RVr8k90QQ85N7AKI5QGSrr9iDC-3rvmy0K_hF0JfpLMiXoDhta68JwcxS1LQ'
    })
  ];

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider 
        wallets={wallets} 
        autoConnect={true}
        localStorageKey="solana-wallet"
      >
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};
