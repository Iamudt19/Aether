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
import HulyBackground from '@/components/HulyBackground';
import ThemeToggle from '@/components/ThemeToggle';

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
    <div className="w-full relative mx-auto theme-transition">
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
            className="w-full max-w-7xl mx-auto pb-24 relative"
          >
            {/* Interactive tracking canvas particles background */}
            <HulyBackground />

            {/* Dashboard Sticky Header */}
            <header className="sticky top-0 z-50 w-full backdrop-blur-[12px] bg-[var(--glass-bg)] border-b border-[var(--glass-border)] transition-all duration-300">
              <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--fern)] font-bold text-white shadow-[0_0_15px_rgba(88,129,87,0.4)]">
                    Æ
                  </div>
                  <span className="text-xl font-black tracking-tight text-[var(--text-primary)]">Aether Carbon</span>
                </div>
                <div className="flex items-center gap-2 sm:gap-3">
                  <button
                    onClick={() => setShowDashboard(false)}
                    className="hidden sm:flex px-3.5 py-1.5 bg-[var(--glass-bg)] border border-[var(--glass-border)] hover:bg-[var(--dry-sage)]/10 hover:border-[var(--accent)] text-xs font-bold rounded-xl text-[var(--text-primary)] transition-all cursor-pointer shadow-sm items-center gap-1"
                  >
                    ← Home
                  </button>
                  <Link
                    href="/seller"
                    className="px-3.5 py-1.5 bg-[var(--fern)]/10 border border-[var(--fern)]/20 hover:bg-[var(--fern)]/20 text-xs font-black rounded-xl text-[var(--fern)] transition-all cursor-pointer shadow-sm"
                  >
                    Seller
                  </Link>
                  <Link
                    href="/buyer"
                    className="hidden sm:inline-flex px-3.5 py-1.5 bg-[var(--accent)]/10 border border-[var(--accent)]/20 hover:bg-[var(--accent)]/20 text-xs font-black rounded-xl text-[var(--accent)] transition-all cursor-pointer shadow-sm"
                  >
                    My Offsets
                  </Link>
                  <UserAuthButton />
                  <ThemeToggle />
                  <ConnectButton label="Connect Wallet" chainStatus="icon" showBalance={false} />
                </div>
              </div>
            </header>

            {/* Dashboard Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-8 px-4 sm:px-6 lg:px-8 border-b border-[var(--glass-border)] mb-8 mt-4 gap-4">
              <div>
                <span className="text-xs font-black text-[var(--accent)] font-mono tracking-wider uppercase">Live Sepolia Session</span>
                <h1 className="text-3xl font-black tracking-tight text-[var(--text-primary)] mt-1">Æther Carbon Dashboard</h1>
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
                  <h2 className="text-xl font-black text-[var(--text-primary)]">Step 1: Upload Proof</h2>
                  <p className="text-[var(--text-secondary)] text-sm">Submit a geotagged photo of your planted tree. Location metadata is extracted automatically.</p>
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
