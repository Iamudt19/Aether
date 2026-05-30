'use client';

import React from 'react';
import { useTheme } from '../context/ThemeContext';

export default function HulyBackground() {
  const { theme } = useTheme();

  return (
    <div className="fixed inset-0 w-full h-full -z-20 pointer-events-auto overflow-hidden">
      
      {/* Dynamic Dark/Light color blend mask */}
      <div 
        className="absolute inset-0 transition-colors duration-500 pointer-events-none z-10"
        style={{
          background: theme === 'dark' 
            ? 'linear-gradient(180deg, rgba(9, 16, 13, 0.4) 0%, rgba(9, 16, 13, 0.7) 100%)'
            : 'linear-gradient(180deg, rgba(234, 231, 225, 0.5) 0%, rgba(234, 231, 225, 0.85) 100%)',
        }}
      />

      {/* Iframe hosting Framer Huly Effect tracking canvas */}
      <iframe
        src="https://attractive-turtle-542513.framer.app"
        title="Aether Huly Particle Background"
        className="w-full h-full border-none select-none"
        style={{
          opacity: theme === 'dark' ? 0.38 : 0.25,
          filter: theme === 'dark' 
            ? 'hue-rotate(140deg) brightness(0.85) saturate(1.2)' 
            : 'hue-rotate(140deg) brightness(1.1) saturate(0.9)',
          transition: 'all 0.5s ease',
          pointerEvents: 'auto'
        }}
      />

      {/* Interactive depth blur blobs */}
      <div className="absolute top-[20%] left-[10%] w-[350px] h-[350px] rounded-full bg-[var(--fern)]/10 blur-[130px] -z-10 pointer-events-none animate-pulse" />
      <div className="absolute bottom-[20%] right-[10%] w-[450px] h-[450px] rounded-full bg-[var(--pine-teal)]/10 blur-[150px] -z-10 pointer-events-none" />
    </div>
  );
}
