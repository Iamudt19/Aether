'use client';

import React, { useState } from 'react';
import CaptureProof from '@/components/CaptureProof';
import VerificationPanel from '@/components/VerificationPanel';
import MarketplaceGallery from '@/components/MarketplaceGallery';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import UserAuthButton from '@/components/UserAuthButton';

const MapDashboard = dynamic(() => import('@/components/MapDashboard'), { ssr: false });
const AnalyticsHub = dynamic(() => import('@/components/AnalyticsHub'), { ssr: false });
const Leaderboard = dynamic(() => import('@/components/Leaderboard'), { ssr: false });
const HeroGate = dynamic(() => import('@/components/HeroGate'), { ssr: false });

export default function Home() {
  const [selectedCoords, setSelectedCoords] = useState<{ lat: number | null; lng: number | null }>({ lat: null, lng: null });
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [refreshToggle, setRefreshToggle] = useState(0);
  const [showDashboard, setShowDashboard] = useState(false);

  const handleProofCapture = (base64: string, lat: number, lng: number) => {
    setImageBase64(base64);
    setSelectedCoords({ lat, lng });
  };

  const handleVerificationSuccess = React.useCallback(() => {
    setRefreshToggle(prev => prev + 1);
    setImageBase64(null);
    setSelectedCoords({ lat: null, lng: null });
  }, []);

  return (
    <div className="w-full relative mx-auto">
      <AnimatePresence mode="wait">
        {!showDashboard ? (
          <motion.div
            key="hero-gate"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="w-full"
          >
            <HeroGate onEnter={() => setShowDashboard(true)} />
          </motion.div>
        ) : (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-7xl mx-auto pb-24"
          >
            {/* Background glow */}
            <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-emerald-600/20 rounded-full blur-[120px] -z-10 pointer-events-none" />
            <div className="absolute top-[40%] right-1/4 w-[400px] h-[400px] bg-teal-600/10 rounded-full blur-[100px] -z-10 pointer-events-none" />

            {/* Dashboard Sticky Header */}
            <header className="sticky top-0 z-50 w-full backdrop-blur-[12px] bg-zinc-950/60 border-b border-white/5">
              <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 font-bold text-black shadow-[0_0_15px_rgba(16,185,129,0.5)]">
                    Æ
                  </div>
                  <span className="text-xl font-bold tracking-tight text-white">Aether Carbon</span>
                </div>
                <div className="flex items-center gap-2 sm:gap-3">
                  <button
                    onClick={() => setShowDashboard(false)}
                    className="hidden sm:flex px-3.5 py-1.5 bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-semibold rounded-xl text-zinc-300 hover:text-white transition-all cursor-pointer shadow-sm items-center gap-1"
                  >
                    ← Home
                  </button>
                  <Link
                    href="/seller"
                    className="px-3.5 py-1.5 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 text-xs font-bold rounded-xl text-emerald-400 hover:text-emerald-300 transition-all cursor-pointer shadow-sm"
                  >
                    Seller
                  </Link>
                  <Link
                    href="/buyer"
                    className="hidden sm:inline-flex px-3.5 py-1.5 bg-teal-500/10 border border-teal-500/20 hover:bg-teal-500/20 text-xs font-bold rounded-xl text-teal-400 hover:text-teal-300 transition-all cursor-pointer shadow-sm"
                  >
                    My Offsets
                  </Link>
                  <UserAuthButton />
                  <ConnectButton label="Connect Wallet" chainStatus="icon" showBalance={false} />
                </div>
              </div>
            </header>

            {/* Dashboard Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-8 px-4 sm:px-6 lg:px-8 border-b border-white/5 mb-8 mt-4 gap-4">
              <div>
                <span className="text-xs font-semibold text-emerald-400 font-mono tracking-wider uppercase">Live Sepolia Session</span>
                <h1 className="text-3xl font-extrabold tracking-tight text-white mt-1">Æther Carbon Dashboard</h1>
              </div>
            </div>

            {/* Step 1 + 2: Capture & Verify */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 px-4 sm:px-6 lg:px-8">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="lg:col-span-2 flex flex-col min-h-[450px]"
              >
                <div className="mb-4">
                  <h2 className="text-xl font-semibold">Step 1: Upload Proof</h2>
                  <p className="text-zinc-500 text-sm">Submit a geotagged photo of your planted tree. Location metadata is extracted automatically.</p>
                </div>
                <CaptureProof onCapture={handleProofCapture} />
              </motion.div>

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

            {/* Live Map */}
            <div className="px-4 sm:px-6 lg:px-8 mt-16">
              <MapDashboard />
            </div>

            {/* Analytics */}
            <div className="px-4 sm:px-6 lg:px-8 mt-16">
              <AnalyticsHub />
            </div>

            {/* Leaderboard */}
            <div className="px-4 sm:px-6 lg:px-8 mt-16">
              <Leaderboard />
            </div>

            {/* NFT Marketplace */}
            <div className="px-4 sm:px-6 lg:px-8 mt-16">
              <MarketplaceGallery refreshToggle={refreshToggle} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
