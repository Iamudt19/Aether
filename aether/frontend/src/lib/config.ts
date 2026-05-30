import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { polygonAmoy, hardhat, sepolia } from 'wagmi/chains';

// Suppress Reown API errors during build and runtime
if (typeof globalThis !== 'undefined') {
  // Suppress console errors
  const originalError = console.error;
  const originalWarn = console.warn;
  
  console.error = function(...args: any[]) {
    const message = args[0]?.toString?.() || '';
    if (
      message.includes('Failed to fetch') ||
      message.includes('api.web3modal.org') ||
      message.includes('appkit') ||
      message.includes('403') ||
      message.includes('Reown') ||
      message.includes('WalletConnect')
    ) {
      return;
    }
    originalError.apply(console, args);
  };

  console.warn = function(...args: any[]) {
    const message = args[0]?.toString?.() || '';
    if (
      message.includes('Failed to fetch') ||
      message.includes('api.web3modal.org') ||
      message.includes('appkit')
    ) {
      return;
    }
    originalWarn.apply(console, args);
  };

  // Suppress fetch errors for Web3Modal API
  if (typeof fetch === 'function') {
    const originalFetch = fetch;
    globalThis.fetch = function(...args: any[]) {
      const url = args[0]?.toString?.() || '';
      if (url.includes('api.web3modal.org')) {
        // Return an empty response instead of making the request during build
        if (typeof window === 'undefined') {
          return Promise.resolve(new Response('{}', { status: 200 }));
        }
      }
      return originalFetch(...(args as [RequestInfo, RequestInit?])).catch((error: any) => {
        if (url.includes('api.web3modal.org')) {
          return new Response('{}', { status: 200 });
        }
        throw error;
      });
    } as any;
  }
}

export const config = getDefaultConfig({
  appName: 'Aether Carbon',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '8259c77e3fb2bc61e1b8b8eb30090858',
  chains: [sepolia, hardhat, polygonAmoy],
  ssr: true,
});

export { contractAddress } from './constants';
