'use client';

import React from 'react';
import { motion } from 'framer-motion';

export default function DepthGlobe() {
  return (
    <div className="relative w-full h-[350px] sm:h-[450px] md:h-[550px] flex items-center justify-center overflow-hidden">
      
      {/* 3D Glass Orbit Rings background */}
      <div className="absolute w-[280px] h-[280px] sm:w-[380px] sm:h-[380px] md:w-[480px] md:h-[480px] rounded-full border border-[var(--glass-border)] animate-[spin_40s_linear_infinite] opacity-40 pointer-events-none -z-10" />
      <div className="absolute w-[290px] h-[290px] sm:w-[395px] sm:h-[395px] md:w-[495px] md:h-[495px] rounded-full border border-dashed border-[var(--dry-sage)]/20 animate-[spin_60s_linear_infinite_reverse] opacity-30 pointer-events-none -z-10" />

      {/* WebGL Globe Container */}
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
        className="relative w-[320px] h-[320px] sm:w-[420px] sm:h-[420px] md:w-[500px] md:h-[500px] rounded-full overflow-hidden border border-[var(--glass-border)] shadow-2xl bg-[#030705]/10 backdrop-blur-[2px]"
      >
        <iframe
          src="https://encouraging-motivation-804026.framer.app"
          title="Aether Depth Globe WebGL"
          className="w-full h-full border-none pointer-events-auto"
          style={{
            transform: 'scale(1.22) translateY(5%)',
            filter: 'hue-rotate(15deg) saturate(1.1)',
          }}
        />

        {/* Ambient Overlay to blend iframe edges seamlessly */}
        <div className="absolute inset-0 pointer-events-none rounded-full" 
             style={{
               background: 'radial-gradient(circle at center, transparent 40%, var(--color-background) 95%)',
               mixBlendMode: 'normal'
             }} 
        />
        
        {/* Soft emerald inner glow */}
        <div className="absolute inset-0 pointer-events-none rounded-full shadow-[inset_0_0_50px_rgba(88,129,87,0.25)]" />
      </motion.div>

      {/* Dynamic Floating Telemetry Tags */}
      <div className="absolute bottom-6 right-[10%] sm:right-[15%] glass-panel px-3.5 py-1.5 rounded-xl border border-[var(--glass-border)] text-[10px] font-mono text-[var(--text-secondary)] shadow-md flex items-center gap-1.5 animate-bounce select-none">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-ping" />
        <span>SEPOLIA NODE: CONNECTED</span>
      </div>
    </div>
  );
}
