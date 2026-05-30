import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { polygonAmoy, hardhat, sepolia } from 'wagmi/chains';

// Suppress Reown API errors during build/dev
if (typeof window !== 'undefined') {
  const originalError = console.error;
  console.error = function(...args: any[]) {
    if (
      args[0]?.includes?.('Failed to fetch') ||
      args[0]?.includes?.('api.web3modal.org') ||
      args[0]?.includes?.('appkit') ||
      args[0]?.includes?.('403')
    ) {
      return; // Silently ignore Web3Modal API errors
    }
    originalError.apply(console, args);
  };
}

export const config = getDefaultConfig({
  appName: 'Aether Carbon',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '8259c77e3fb2bc61e1b8b8eb30090858',
  chains: [sepolia, hardhat, polygonAmoy],
  ssr: true,
});

export { contractAddress } from './constants';
