
import React, { createContext, useContext, ReactNode } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { 
  PhantomWalletAdapter,
  SolflareWalletAdapter
} from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';
import { LazyWalletProvider } from '@/components/lazy/LazyWalletProvider';

// Import default styles
import '@solana/wallet-adapter-react-ui/styles.css';

interface WalletContextProviderProps {
  children: ReactNode;
}

export const WalletContextProvider: React.FC<WalletContextProviderProps> = ({ children }) => {
  // Use devnet for development, mainnet-beta for production
  const network = WalletAdapterNetwork.Devnet;
  const endpoint = clusterApiUrl(network);
  
  // Configure wallets - simplified for mobile compatibility
  const wallets = [
    // Phantom - most popular mobile wallet
    new PhantomWalletAdapter({
      network,
    }),
    
    // Solflare - second most popular mobile wallet
    new SolflareWalletAdapter({
      network,
    })
  ];

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider 
        wallets={wallets} 
        autoConnect={true}
        localStorageKey="solana-wallet"
      >
        <LazyWalletProvider>
          {children}
        </LazyWalletProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};
