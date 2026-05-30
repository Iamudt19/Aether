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
        accentColor: '#588157', // Fern green accent
        accentColorForeground: '#dad7cd', // Dust grey contrast
        borderRadius: 'large',
        fontStack: 'system',
        overlayBlur: 'small',
      }) : lightTheme({
        accentColor: '#3a5a40', // Hunter green accent
        accentColorForeground: '#f5f4f0', // Soft stone contrast
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
