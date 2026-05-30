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
      className="relative glass-panel p-5 rounded-2xl border border-white/5 bg-zinc-950/40 flex flex-col gap-2 overflow-hidden group hover:border-white/10 transition-all"
    >
      <div className={`absolute top-0 right-0 w-20 h-20 bg-${color}-500/5 rounded-full blur-2xl group-hover:bg-${color}-500/10 transition-all`} />
      <div className={`p-2.5 rounded-xl bg-${color}-500/10 border border-${color}-500/15 w-fit`}>
        <Icon className={`w-4 h-4 text-${color}-400`} />
      </div>
      <div>
        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">{label}</p>
        <p className={`text-2xl font-black text-${color}-400 font-mono mt-0.5`}>{value}</p>
        {sub && <p className="text-[10px] text-zinc-500 mt-0.5">{sub}</p>}
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
    <button onClick={copy} className="p-1 rounded hover:bg-white/5 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer">
      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
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
      // Fetch from Supabase purchases/listings table
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
      <div className="min-h-screen bg-[#07070a] flex flex-col items-center justify-center gap-6 px-4">
        <div className="absolute top-[-10%] left-[-5%] w-[600px] h-[600px] bg-emerald-500/8 rounded-full blur-[160px] -z-10" />
        <div className="text-center">
          <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-2xl bg-emerald-500 font-bold text-black shadow-[0_0_30px_rgba(16,185,129,0.4)] text-2xl mb-4">Æ</div>
          <h1 className="text-2xl font-black text-white mb-2">Seller Dashboard</h1>
          <p className="text-zinc-400 text-sm mb-6">Connect your wallet to view your carbon credit listings</p>
          <ConnectButton label="Connect Wallet to Access" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07070a] text-white">
      {/* Ambient glows */}
      <div className="fixed top-0 left-1/4 w-[500px] h-[500px] bg-emerald-600/10 rounded-full blur-[120px] -z-10 pointer-events-none" />
      <div className="fixed bottom-0 right-1/4 w-[400px] h-[400px] bg-teal-600/8 rounded-full blur-[100px] -z-10 pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-50 w-full backdrop-blur-[12px] bg-zinc-950/70 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 font-bold text-black shadow-[0_0_15px_rgba(16,185,129,0.4)] text-sm">Æ</div>
              <span className="text-lg font-bold text-white">Aether Carbon</span>
            </Link>
            <span className="text-zinc-600">/</span>
            <span className="text-sm font-semibold text-emerald-400">Seller Dashboard</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchListings}
              disabled={refreshing}
              className="p-2 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <Link href="/" className="px-3.5 py-1.5 bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-semibold rounded-xl text-zinc-300 hover:text-white transition-all cursor-pointer flex items-center gap-1.5">
              <ArrowLeft className="w-3 h-3" /> Back to Dashboard
            </Link>
            <ConnectButton showBalance={false} chainStatus="icon" />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <TreePine className="w-5 h-5 text-emerald-400" />
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Carbon Credit Seller</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight">Your Credit Portfolio</h1>
          <p className="text-zinc-400 mt-1 text-sm">Manage and track your verified carbon credit NFTs</p>
          {address && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-zinc-500 font-mono">
              <span>{address.slice(0, 10)}...{address.slice(-6)}</span>
              <CopyButton text={address} />
            </div>
          )}
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard icon={Leaf} label="Total Credits Minted" value={`${totalCredits.toLocaleString()} kg`} sub="CO₂ sequestered" />
          <StatCard icon={Package} label="Active Listings" value={activeListings.length} sub="Available to buyers" color="teal" />
          <StatCard icon={ShieldCheck} label="Sold Credits" value={soldListings.length} sub="Completed sales" color="blue" />
          <StatCard icon={Coins} label="Total Earnings" value={`₹${totalEarnings.toLocaleString()}`} sub="INR received" color="amber" />
        </div>

        {/* Planter Stewardship Badges */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass-panel p-6 rounded-2xl border border-white/5 bg-zinc-950/20 mb-8"
        >
          <h2 className="text-sm font-bold flex items-center gap-2 mb-4 text-emerald-400">
            <Sparkles className="w-4 h-4" /> Stewardship Badges
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className={`p-4 rounded-xl border flex items-center gap-3 transition-all ${
              listings.length >= 1 
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' 
                : 'bg-zinc-900/30 border-white/5 text-zinc-600'
            }`}>
              <div className="w-8 h-8 rounded-full bg-black/40 flex items-center justify-center font-bold">🌱</div>
              <div>
                <p className="text-xs font-bold">Sapling Guardian</p>
                <p className="text-[9px] opacity-75">Minted 1st tree NFT</p>
              </div>
            </div>
            <div className={`p-4 rounded-xl border flex items-center gap-3 transition-all ${
              listings.length >= 5 
                ? 'bg-teal-500/10 border-teal-500/20 text-teal-300' 
                : 'bg-zinc-900/30 border-white/5 text-zinc-600'
            }`}>
              <div className="w-8 h-8 rounded-full bg-black/40 flex items-center justify-center font-bold">🌳</div>
              <div>
                <p className="text-xs font-bold">Forest Guard</p>
                <p className="text-[9px] opacity-75">Minted 5+ tree NFTs</p>
              </div>
            </div>
            <div className={`p-4 rounded-xl border flex items-center gap-3 transition-all ${
              totalCredits >= 100 
                ? 'bg-amber-500/10 border-amber-500/20 text-amber-300' 
                : 'bg-zinc-900/30 border-white/5 text-zinc-600'
            }`}>
              <div className="w-8 h-8 rounded-full bg-black/40 flex items-center justify-center font-bold">⚡</div>
              <div>
                <p className="text-xs font-bold">CO₂ Offset Master</p>
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
          className="glass-panel rounded-2xl border border-white/5 bg-zinc-950/40 overflow-hidden"
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-bold">Credit Listings</h2>
            </div>
            <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">{listings.length} total</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
            </div>
          ) : listings.length === 0 ? (
            <div className="text-center py-20 px-8">
              <TreePine className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
              <p className="text-zinc-400 font-semibold text-sm">No credits minted yet</p>
              <p className="text-zinc-600 text-xs mt-1 mb-5">Go to the main dashboard, upload a tree photo to mint your first carbon credit NFT.</p>
              <Link href="/" className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-bold hover:bg-emerald-500/20 transition-all">
                Mint Your First Credit →
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {listings.map((listing, i) => (
                <motion.div
                  key={listing.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-4 hover:bg-white/[0.02] transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/15 flex items-center justify-center shrink-0">
                      <TreePine className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-zinc-100 truncate max-w-[220px]">{listing.species}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-zinc-500 font-mono">Token #{listing.token_id}</span>
                        {listing.lat && (
                          <span className="text-[10px] text-zinc-600 flex items-center gap-0.5">
                            <Globe2 className="w-2.5 h-2.5" />
                            {Number(listing.lat).toFixed(2)}°N, {Number(listing.lng).toFixed(2)}°E
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
                    <div className="text-left sm:text-right">
                      <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Credits</p>
                      <p className="text-sm font-bold font-mono text-emerald-400">{listing.credits} kg CO₂</p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Price</p>
                      <p className="text-sm font-bold font-mono text-zinc-200">₹{listing.price_inr.toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
                        listing.status === 'active'
                          ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                          : listing.status === 'sold'
                          ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400'
                          : 'bg-zinc-700/30 border border-zinc-600/20 text-zinc-400'
                      }`}>
                        {listing.status}
                      </span>

                      {listing.status === 'active' && (
                        <div className="flex items-center gap-1.5">
                          <button
                            disabled={growingTokenId === listing.token_id || loadingGrowth}
                            onClick={() => handleRecordGrowth(listing.token_id)}
                            className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/25 hover:bg-emerald-500/20 text-emerald-400 text-[10px] font-black rounded-lg cursor-pointer transition-colors disabled:opacity-50 flex items-center gap-1"
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
                            className="px-2.5 py-1 bg-red-500/10 border border-red-500/25 hover:bg-red-500/20 text-red-400 text-[10px] font-black rounded-lg cursor-pointer transition-colors disabled:opacity-50 flex items-center gap-1"
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
                        className="p-1.5 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 text-zinc-500 hover:text-zinc-300 transition-all opacity-0 group-hover:opacity-100"
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
            className="mt-6 p-5 rounded-2xl bg-emerald-950/20 border border-emerald-500/15 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <p className="text-sm font-bold text-white">Mint more carbon credits</p>
                <p className="text-xs text-zinc-400">Upload proof photos of your planted trees to earn more NFT credits.</p>
              </div>
            </div>
            <Link
              href="/"
              className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-extrabold rounded-xl uppercase tracking-widest transition-all flex items-center gap-2 shrink-0 shadow-[0_0_20px_rgba(16,185,129,0.25)]"
            >
              <TreePine className="w-3.5 h-3.5" /> Go to Minting →
            </Link>
          </motion.div>
        )}
      </main>
    </div>
  );
}
