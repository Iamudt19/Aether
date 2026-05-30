'use client';

import * as React from 'react';
import {
  RainbowKitProvider,
  darkTheme,
  lightTheme,
} from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { config } from '../lib/config';
import { ThemeProvider, useTheme } from '../context/ThemeContext';

const queryClient = new QueryClient();

function RainbowKitThemeWrapper({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  
  return (
    <RainbowKitProvider 
      theme={theme === 'dark' ? darkTheme({
        accentColor: '#c0c0c0', // Silver accent for monochrome
        accentColorForeground: '#0a0a0a', // Black contrast
        borderRadius: 'large',
        fontStack: 'system',
        overlayBlur: 'small',
      }) : darkTheme({
        accentColor: '#c0c0c0', // Silver accent
        accentColorForeground: '#0a0a0a', // Black contrast
        borderRadius: 'large',
        fontStack: 'system',
        overlayBlur: 'small',
      })}
    >
      {children}
    </RainbowKitProvider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <RainbowKitThemeWrapper>
            {children}
          </RainbowKitThemeWrapper>
        </ThemeProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
