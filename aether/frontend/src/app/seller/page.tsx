'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAccount, useReadContract, useWriteContract } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TreePine, Leaf, BarChart3, Package, ArrowLeft,
  ExternalLink, ShieldCheck, Loader2, RefreshCw,
  TrendingUp, Coins, Globe2, Sparkles, Copy, Check
} from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { contractAddress } from '@/lib/config';
import abi from '@/lib/abi.json';
import EarthBackground from '@/components/EarthBackground';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || '';

interface Listing {
  id: string;
  species: string;
  credits: number;
  price_inr: number;
  tx_hash: string;
  token_id: number;
  status: 'active' | 'sold';
  created_at: string;
  lat?: number;
  lng?: number;
}

function StatCard({ icon: Icon, label, value, sub, color = 'emerald' }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative glass-panel p-5 rounded-2xl flex flex-col gap-2 overflow-hidden group hover:border-[var(--accent)] transition-all"
    >
      <div className={`absolute top-0 right-0 w-20 h-20 bg-[var(--accent)]/5 rounded-full blur-2xl group-hover:bg-[var(--accent)]/10 transition-all`} />
      <div className={`p-2.5 rounded-xl bg-[var(--accent)]/10 border border-[var(--glass-border)] w-fit`}>
        <Icon className={`w-4 h-4 text-[var(--accent)]`} />
      </div>
      <div>
        <p className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-wider">{label}</p>
        <p className={`text-2xl font-black text-[var(--text-primary)] font-mono mt-0.5`}>{value}</p>
        {sub && <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">{sub}</p>}
      </div>
    </motion.div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button onClick={copy} className="p-1 rounded hover:bg-[var(--glass-border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer">
      {copied ? <Check className="w-3 h-3 text-[var(--accent)]" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

export default function SellerDashboard() {
  const { address, isConnected } = useAccount();
  const [session, setSession] = useState<any>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { writeContractAsync } = useWriteContract();
  const [growingTokenId, setGrowingTokenId] = useState<number | null>(null);
  const [loadingGrowth, setLoadingGrowth] = useState(false);
  const [cancellingTokenId, setCancellingTokenId] = useState<number | null>(null);

  // Read total minted from contract
  const { data: totalMinted } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi,
    functionName: 'totalMinted',
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  const fetchListings = useCallback(async () => {
    if (!address) return;
    setRefreshing(true);
    try {
      const { data, error } = await supabase
        .from('carbon_listings')
        .select('*')
        .eq('seller_address', address.toLowerCase())
        .order('created_at', { ascending: false });

      if (!error && data) {
        setListings(data);
      } else {
        setListings([]);
      }
    } catch {
      setListings([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [address, totalMinted]);

  const handleCancelListing = async (tokenId: number) => {
    if (!address) return;
    if (!window.confirm(`Are you sure you want to cancel Token #${tokenId} listing on-chain? The NFT will be active in your wallet, but removed from public sales.`)) {
      return;
    }

    setCancellingTokenId(tokenId);

    try {
      const tx = await writeContractAsync({
        address: contractAddress as `0x${string}`,
        abi,
        functionName: 'cancelListing',
        args: [BigInt(tokenId)],
      });

      console.log(`✅ On-chain cancel listing transaction sent: ${tx}`);

      const res = await fetch(`${BACKEND_URL}/api/listings`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenId,
          userAddress: address,
          txHash: tx,
        }),
      });

      const json = await res.json();
      if (json.success) {
        alert(`Successfully cancelled Token #${tokenId} listing! It is now inactive in the marketplace.`);
        fetchListings();
      } else {
        alert("Transaction recorded on-chain, but failed to update database.");
      }
    } catch (err: any) {
      console.error("Cancel listing failed:", err);
      alert(`Cancel listing failed: ${err.message || err}`);
    } finally {
      setCancellingTokenId(null);
    }
  };

  const handleRecordGrowth = async (tokenId: number) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        setGrowingTokenId(tokenId);
        setLoadingGrowth(true);

        try {
          const res = await fetch(`${BACKEND_URL}/api/listings/grow`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tokenId,
              imageBase64: base64,
              userAddress: address,
            }),
          });

          const json = await res.json();
          if (!res.ok || json.error) {
            throw new Error(json.error || 'Growth update failed');
          }

          alert(`🎉 Tree Evolved Successfully!\n\nAdded ${json.additionalCredits} kg of new carbon credits on-chain! Total credits: ${json.newTotalCredits} kg CO₂.\nTransaction: ${json.txHash}`);
          fetchListings();
        } catch (err: any) {
          console.error("Growth evolution failed:", err);
          alert(`Growth evolution failed: ${err.message || err}`);
        } finally {
          setGrowingTokenId(null);
          setLoadingGrowth(false);
        }
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  useEffect(() => {
    if (address) fetchListings();
    else setLoading(false);
  }, [address, fetchListings]);

  const totalCredits = listings.reduce((sum, l) => sum + l.credits, 0);
  const activeListings = listings.filter(l => l.status === 'active');
  const soldListings = listings.filter(l => l.status === 'sold');
  const totalEarnings = soldListings.reduce((sum, l) => sum + l.price_inr, 0);

  if (!isConnected) {
    return (
      <div className="min-h-screen relative flex flex-col items-center justify-center gap-6 px-4 theme-transition">
        <EarthBackground />
        <div className="text-center relative z-10">
          <h1 className="text-2xl font-black text-[var(--text-primary)] mb-2">Seller Dashboard</h1>
          <p className="text-[var(--text-secondary)] text-sm mb-6">Connect your wallet to view your carbon credit listings</p>
          <div className="flex justify-center items-center gap-3">
            <ConnectButton label="Connect Wallet to Access" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative theme-transition">
      <EarthBackground />

      {/* Header */}
      <header className="sticky top-0 z-50 w-full backdrop-blur-[12px] bg-[var(--glass-bg)] border-b border-[var(--glass-border)] transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <span className="text-lg font-black text-[var(--text-primary)]">Aether Carbon</span>
            </Link>
            <span className="text-[var(--text-muted)]">/</span>
            <span className="text-sm font-black text-[var(--accent)]">Seller Dashboard</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchListings}
              disabled={refreshing}
              className="p-2 rounded-lg bg-[var(--glass-bg)] border border-[var(--glass-border)] hover:bg-[var(--dry-sage)]/10 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <Link href="/" className="px-3.5 py-1.5 bg-[var(--glass-bg)] border border-[var(--glass-border)] hover:bg-[var(--dry-sage)]/10 text-xs font-bold rounded-xl text-[var(--text-primary)] transition-all cursor-pointer flex items-center gap-1.5">
              <ArrowLeft className="w-3 h-3" /> Back to Dashboard
            </Link>
            <ConnectButton showBalance={false} chainStatus="icon" />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 relative z-10">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <TreePine className="w-5 h-5 text-[var(--accent)]" />
            <span className="text-xs font-black text-[var(--accent)] uppercase tracking-widest">Carbon Credit Seller</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-[var(--text-primary)]">Your Credit Portfolio</h1>
          <p className="text-[var(--text-secondary)] mt-1 text-sm">Manage and track your verified carbon credit NFTs</p>
          {address && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-[var(--text-muted)] font-mono">
              <span>{address.slice(0, 10)}...{address.slice(-6)}</span>
              <CopyButton text={address} />
            </div>
          )}
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard icon={Leaf} label="Total Credits Minted" value={`${totalCredits.toLocaleString()} kg`} sub="CO₂ sequestered" />
          <StatCard icon={Package} label="Active Listings" value={activeListings.length} sub="Available to buyers" />
          <StatCard icon={ShieldCheck} label="Sold Credits" value={soldListings.length} sub="Completed sales" />
          <StatCard icon={Coins} label="Total Earnings" value={`₹${totalEarnings.toLocaleString()}`} sub="INR received" />
        </div>

        {/* Planter Stewardship Badges */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass-panel p-6 rounded-2xl mb-8"
        >
          <h2 className="text-sm font-black flex items-center gap-2 mb-4 text-[var(--accent)]">
            <Sparkles className="w-4 h-4" /> Stewardship Badges
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className={`p-4 rounded-xl border flex items-center gap-3 transition-all ${
              listings.length >= 1 
                ? 'bg-[var(--fern)]/10 border-[var(--fern)]/20 text-[var(--fern)]' 
                : 'bg-[var(--glass-bg)] border-[var(--glass-border)] text-[var(--text-muted)]'
            }`}>
              <div className="w-8 h-8 rounded-full bg-[var(--color-background)] flex items-center justify-center font-bold">🌱</div>
              <div>
                <p className="text-xs font-black">Sapling Guardian</p>
                <p className="text-[9px] opacity-75">Minted 1st tree NFT</p>
              </div>
            </div>
            <div className={`p-4 rounded-xl border flex items-center gap-3 transition-all ${
              listings.length >= 5 
                ? 'bg-[var(--accent)]/15 border-[var(--accent)]/30 text-[var(--text-primary)]' 
                : 'bg-[var(--glass-bg)] border-[var(--glass-border)] text-[var(--text-muted)]'
            }`}>
              <div className="w-8 h-8 rounded-full bg-[var(--color-background)] flex items-center justify-center font-bold">🌳</div>
              <div>
                <p className="text-xs font-black">Forest Guard</p>
                <p className="text-[9px] opacity-75">Minted 5+ tree NFTs</p>
              </div>
            </div>
            <div className={`p-4 rounded-xl border flex items-center gap-3 transition-all ${
              totalCredits >= 100 
                ? 'bg-[var(--dry-sage)]/25 border-[var(--dry-sage)]/40 text-[var(--text-primary)]' 
                : 'bg-[var(--glass-bg)] border-[var(--glass-border)] text-[var(--text-muted)]'
            }`}>
              <div className="w-8 h-8 rounded-full bg-[var(--color-background)] flex items-center justify-center font-bold">⚡</div>
              <div>
                <p className="text-xs font-black">CO₂ Offset Master</p>
                <p className="text-[9px] opacity-75">Offset 100+ kg CO₂e</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Listings Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-panel rounded-2xl overflow-hidden"
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--glass-border)]">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[var(--accent)]" />
              <h2 className="text-sm font-black text-[var(--text-primary)]">Credit Listings</h2>
            </div>
            <span className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-widest">{listings.length} total</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-[var(--accent)]" />
            </div>
          ) : listings.length === 0 ? (
            <div className="text-center py-20 px-8">
              <TreePine className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-3" />
              <p className="text-[var(--text-primary)] font-black text-sm">No credits minted yet</p>
              <p className="text-[var(--text-secondary)] text-xs mt-1 mb-5">Go to the main dashboard, upload a tree photo to mint your first carbon credit NFT.</p>
              <Link href="/" className="px-4 py-2 bg-[var(--fern)]/10 border border-[var(--fern)]/20 text-[var(--fern)] rounded-xl text-xs font-bold hover:bg-[var(--fern)]/20 transition-all">
                Mint Your First Credit →
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-[var(--glass-border)]">
              {listings.map((listing, i) => (
                <motion.div
                  key={listing.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-4 hover:bg-[var(--dry-sage)]/5 transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-9 h-9 rounded-xl bg-[var(--fern)]/10 border border-[var(--fern)]/20 flex items-center justify-center shrink-0">
                      <TreePine className="w-4 h-4 text-[var(--fern)]" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[var(--text-primary)] truncate max-w-[220px]">{listing.species}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-[var(--text-muted)] font-mono">Token #{listing.token_id}</span>
                        {listing.lat && (
                          <span className="text-[10px] text-[var(--text-secondary)] flex items-center gap-0.5">
                            <Globe2 className="w-2.5 h-2.5" />
                            {Number(listing.lat).toFixed(2)}°N, {Number(listing.lng).toFixed(2)}°E
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
                    <div className="text-left sm:text-right">
                      <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Credits</p>
                      <p className="text-sm font-black font-mono text-[var(--fern)]">{listing.credits} kg CO₂</p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Price</p>
                      <p className="text-sm font-black font-mono text-[var(--text-primary)]">₹{listing.price_inr.toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
                        listing.status === 'active'
                          ? 'bg-[var(--fern)]/10 border border-[var(--fern)]/20 text-[var(--fern)]'
                          : listing.status === 'sold'
                          ? 'bg-blue-500/10 border border-blue-500/20 text-blue-500'
                          : 'bg-zinc-700/30 border border-zinc-600/20 text-zinc-400'
                      }`}>
                        {listing.status}
                      </span>

                      {listing.status === 'active' && (
                        <div className="flex items-center gap-1.5">
                          <button
                            disabled={growingTokenId === listing.token_id || loadingGrowth}
                            onClick={() => handleRecordGrowth(listing.token_id)}
                            className="glass-btn px-2.5 py-1 text-[10px] rounded-lg cursor-pointer disabled:opacity-50 flex items-center gap-1"
                          >
                            {growingTokenId === listing.token_id ? (
                              <><Loader2 className="w-2.5 h-2.5 animate-spin" /> Evolving...</>
                            ) : (
                              "Record Growth"
                            )}
                          </button>

                          <button
                            disabled={cancellingTokenId === listing.token_id || loadingGrowth}
                            onClick={() => handleCancelListing(listing.token_id)}
                            className="px-2.5 py-1 bg-red-500/10 border border-red-500/25 hover:bg-red-500/20 text-red-400 backdrop-blur-[8px] text-[10px] font-black rounded-lg cursor-pointer transition-colors disabled:opacity-50 flex items-center gap-1"
                          >
                            {cancellingTokenId === listing.token_id ? (
                              <><Loader2 className="w-2.5 h-2.5 animate-spin" /> Cancelling...</>
                            ) : (
                              "Cancel"
                            )}
                          </button>
                        </div>
                      )}

                      <a
                        href={`https://sepolia.etherscan.io/tx/${listing.tx_hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg bg-[var(--glass-bg)] border border-[var(--glass-border)] hover:bg-[var(--dry-sage)]/10 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all opacity-0 group-hover:opacity-100"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        {/* How to mint more */}
        {listings.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-6 p-5 rounded-2xl bg-[var(--fern)]/5 border border-[var(--fern)]/15 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-[var(--fern)] shrink-0" />
              <div>
                <p className="text-sm font-black text-[var(--text-primary)]">Mint more carbon credits</p>
                <p className="text-xs text-[var(--text-secondary)]">Upload proof photos of your planted trees to earn more NFT credits.</p>
              </div>
            </div>
            <Link
              href="/"
              className="glass-btn-primary px-5 py-2.5 text-xs rounded-xl uppercase tracking-widest transition-all flex items-center gap-2 shrink-0 shadow-md"
            >
              <TreePine className="w-3.5 h-3.5" /> Go to Minting →
            </Link>
          </motion.div>
        )}
      </main>
    </div>
  );
}
