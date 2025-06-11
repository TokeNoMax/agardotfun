
import React, { Suspense, lazy } from 'react';
import { Skeleton } from "@/components/ui/skeleton";

// Lazy load the wallet adapter components
const WalletModalProvider = lazy(() => 
  import('@solana/wallet-adapter-react-ui').then(module => ({
    default: module.WalletModalProvider
  }))
);

interface LazyWalletProviderProps {
  children: React.ReactNode;
}

function WalletSkeleton() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="text-center space-y-4">
        <Skeleton className="h-8 w-48 mx-auto bg-cyber-cyan/20" />
        <Skeleton className="h-4 w-64 mx-auto bg-gray-700" />
        <Skeleton className="h-12 w-32 mx-auto bg-cyber-green/20" />
      </div>
    </div>
  );
}

export function LazyWalletProvider({ children }: LazyWalletProviderProps) {
  return (
    <Suspense fallback={<WalletSkeleton />}>
      <WalletModalProvider>
        {children}
      </WalletModalProvider>
    </Suspense>
  );
}
