import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { polygonAmoy, hardhat, sepolia } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'Aether Carbon',
  projectId: 'aether-frontend-1234', // In a real app this should be replaced with WalletConnect ID
  chains: [sepolia, hardhat, polygonAmoy],
  ssr: true,
});

export const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0x47e8b7626aD4388E86904c883b72ef31654f4256';
