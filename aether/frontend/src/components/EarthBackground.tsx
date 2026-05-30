'use client';

import React from 'react';

export default function EarthBackground() {
  return (
    <div className="fixed inset-0 w-full h-full -z-20 overflow-hidden pointer-events-none">
      
      {/* Organic dark blend overlay */}
      <div 
        className="absolute inset-0 pointer-events-none z-10"
        style={{
          background: 'linear-gradient(180deg, rgba(13, 17, 14, 0.45) 0%, rgba(13, 17, 14, 0.85) 100%)',
        }}
      />

      {/* Earth Animation Iframe cropped to hide the 'Made in Framer' watermark */}
      <div className="absolute w-[calc(100%+80px)] h-[calc(100%+80px)] -bottom-20 -right-20 pointer-events-auto">
        <iframe
          src="https://long-forms-992661.framer.app"
          title="Aether Earth Background"
          className="w-full h-full border-none select-none"
          style={{
            opacity: 0.35,
            filter: 'hue-rotate(130deg) brightness(0.78) saturate(1.1)',
          }}
        />
      </div>

      {/* Subtle depth blur blobs */}
      <div className="absolute top-[15%] left-[5%] w-[400px] h-[400px] rounded-full bg-[var(--fern)]/8 blur-[140px] -z-10 pointer-events-none" />
      <div className="absolute bottom-[15%] right-[5%] w-[450px] h-[450px] rounded-full bg-[var(--pine-teal)]/8 blur-[160px] -z-10 pointer-events-none" />
    </div>
  );
}
