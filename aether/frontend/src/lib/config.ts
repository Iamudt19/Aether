import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { polygonAmoy, hardhat, sepolia } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'Aether Carbon',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '8259c77e3fb2bc61e1b8b8eb30090858', // Fallback to a valid public structure if not provided
  chains: [sepolia, hardhat, polygonAmoy],
  ssr: true,
});

export const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0x08f788B28CD521e527c38bb80B728e49d4867Aa9';
