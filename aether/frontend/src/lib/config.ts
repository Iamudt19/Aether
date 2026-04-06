import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { polygonAmoy, hardhat } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'Aether Carbon',
  projectId: 'aether-frontend-1234', // In a real app this should be replaced with WalletConnect ID
  chains: [hardhat, polygonAmoy],
  ssr: true,
});

export const contractAddress = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
