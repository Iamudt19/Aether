'use client';

import React, { useState } from 'react';
import CaptureProof from '@/components/CaptureProof';
import VerificationPanel from '@/components/VerificationPanel';
import MarketplaceGallery from '@/components/MarketplaceGallery';
import { motion } from 'framer-motion';
import dynamic from 'next/dynamic';

const MapDashboard = dynamic(() => import('@/components/MapDashboard'), {
  ssr: false,
});

const AnalyticsHub = dynamic(() => import('@/components/AnalyticsHub'), {
  ssr: false,
});

const Leaderboard = dynamic(() => import('@/components/Leaderboard'), {
  ssr: false,
});

const RazorpayOffset = dynamic(() => import('@/components/RazorpayOffset'), {
  ssr: false,
});

export default function Home() {
  const [selectedCoords, setSelectedCoords] = useState<{lat: number | null, lng: number | null}>({ lat: null, lng: null });
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [refreshToggle, setRefreshToggle] = useState(0);

  const handleProofCapture = (base64: string, lat: number, lng: number) => {
    setImageBase64(base64);
    setSelectedCoords({ lat, lng });
  };

  const handleVerificationSuccess = React.useCallback(() => {
    // Triggers the gallery to refresh its content
    setRefreshToggle(prev => prev + 1);
    // Reset state for new capture
    setImageBase64(null);
    setSelectedCoords({ lat: null, lng: null });
  }, []);

  return (
    <div className="w-full max-w-7xl relative mx-auto pb-24">
      {/* Background glow effects */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-emerald-600/20 rounded-full blur-[120px] -z-10 pointer-events-none"></div>
      <div className="absolute top-[40%] right-1/4 w-[400px] h-[400px] bg-teal-600/10 rounded-full blur-[100px] -z-10 pointer-events-none"></div>

      {/* Hero Section */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center py-16 px-4"
      >
        <h1 className="text-5xl md:text-7xl font-bold tracking-tighter bg-gradient-to-br from-white to-zinc-500 bg-clip-text text-transparent mb-6">
          Capture Impact.<br/>Mint the Future.
        </h1>
        <p className="max-w-2xl mx-auto text-lg text-zinc-400">
          Aether uses AI Plant identification and GPS verification to autonomously verify carbon sequestration from your photos and issue verifiable credits on the blockchain.
        </p>
      </motion.div>

      {/* Core App Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 px-4 sm:px-6 lg:px-8">
        
        {/* Left Col: Capture Proof */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-2 flex flex-col min-h-[450px]"
        >
          <div className="mb-4">
             <h2 className="text-xl font-semibold">Step 1: Upload Proof</h2>
             <p className="text-zinc-500 text-sm">Submit a photo of your planted tree. We will extract location metadata.</p>
          </div>
          <CaptureProof onCapture={handleProofCapture} />
        </motion.div>

        {/* Right Col: Verification */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-1 h-full min-h-[400px]"
        >
          <VerificationPanel 
            lat={selectedCoords.lat} 
            lng={selectedCoords.lng} 
            imageBase64={imageBase64}
            onSuccess={handleVerificationSuccess}
          />
        </motion.div>
      </div>

      {/* GIS Map Dashboard */}
      <div className="px-4 sm:px-6 lg:px-8 mt-16">
        <MapDashboard />
      </div>

      {/* Analytics Hub */}
      <div className="px-4 sm:px-6 lg:px-8 mt-16">
        <AnalyticsHub />
      </div>

      {/* Leaderboard & Corporate Offset Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 px-4 sm:px-6 lg:px-8 mt-16">
        <div className="lg:col-span-2">
          <Leaderboard />
        </div>
        <div className="lg:col-span-1">
          <RazorpayOffset />
        </div>
      </div>

      {/* Marketplace Section */}
      <div className="px-4 sm:px-6 lg:px-8 mt-16">
        <MarketplaceGallery refreshToggle={refreshToggle} />
      </div>

    </div>
  );
}
