
import { useWallet } from '@solana/wallet-adapter-react';
import { useToast } from '@/hooks/use-toast';

export const useSimpleWallet = () => {
  const { publicKey, connected, connecting, disconnect } = useWallet();
  const { toast } = useToast();

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const disconnectWallet = async () => {
    try {
      await disconnect();
      toast({
        title: "Wallet Disconnected",
        description: "Your wallet has been disconnected successfully.",
      });
    } catch (error) {
      console.error('Error disconnecting wallet:', error);
      toast({
        title: "Disconnection Failed",
        description: "Failed to disconnect wallet. Please try again.",
        variant: "destructive",
      });
    }
  };

  const copyAddress = async () => {
    if (publicKey) {
      try {
        await navigator.clipboard.writeText(publicKey.toString());
        toast({
          title: "Address Copied",
          description: "Wallet address copied to clipboard",
        });
      } catch (error) {
        console.error('Error copying address:', error);
        toast({
          title: "Copy Failed",
          description: "Failed to copy address to clipboard",
          variant: "destructive",
        });
      }
    }
  };

  return {
    publicKey,
    connected,
    connecting,
    disconnect: disconnectWallet,
    formatAddress,
    copyAddress,
    address: publicKey?.toString() || null,
    shortAddress: publicKey ? formatAddress(publicKey.toString()) : null
  };
};
