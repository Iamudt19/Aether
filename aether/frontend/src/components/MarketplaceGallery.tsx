'use client';

import React, { useEffect, useState } from 'react';
import { useReadContract, useAccount, useSendTransaction } from 'wagmi';
import { parseEther } from 'viem';
import { supabase } from '../lib/supabaseClient';
import { Leaf, Globe2, Loader2, ArrowRight, ShieldCheck, TreePine, Coins, HeartHandshake } from 'lucide-react';
import { contractAddress } from '../lib/config';
import abi from '../lib/abi.json';
import { motion, AnimatePresence } from 'framer-motion';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || '';

const formatIPFS = (url: string) => {
  if (!url) return '';
  return url.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/');
};

export default function MarketplaceGallery({ refreshToggle }: { refreshToggle: number }) {
  const [totalImpact, setTotalImpact] = useState(0);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [localRefresh, setLocalRefresh] = useState(0);

  const { address } = useAccount();
  const { sendTransactionAsync } = useSendTransaction();
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [session, setSession] = useState<any>(null);

  const { data: totalMintedCounter, refetch } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi,
    functionName: 'totalMinted',
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    refetch();
  }, [refreshToggle, localRefresh, refetch]);

  useEffect(() => {
    const fetchItems = async () => {
      setLoading(true);
      try {
        // Fetch real listings from backend/Supabase
        const res = await fetch(`${BACKEND_URL}/api/listings`);
        const json = await res.json();

        if (json.success && json.listings.length > 0) {
          const verifiedList = json.listings.filter(
            (l: any) => l.token_id !== null && typeof l.tx_hash === 'string' && /^0x[a-fA-F0-9]{64}$/.test(l.tx_hash)
          );
          const mapped = verifiedList.map((l: any) => ({
            id: l.id,
            credits: l.credits,
            lat: l.lat?.toFixed(4) || 'N/A',
            lng: l.lng?.toFixed(4) || 'N/A',
            species: l.species,
            image: l.image_url || '',
            seller: l.seller_address,
            created_at: l.created_at,
            token_id: l.token_id,
            price_inr: l.price_inr || l.credits * 10,
          }));
          setItems(mapped);
          setTotalImpact(mapped.reduce((s: number, i: any) => s + i.credits, 0));
        } else {
          setItems([]);
          setTotalImpact(0);
        }
      } catch {
        setItems([]);
        setTotalImpact(0);
      } finally {
        setLoading(false);
      }
    };

    fetchItems();
  }, [totalMintedCounter, refreshToggle, localRefresh]);

  const handleBuy = async (item: any) => {
    if (!address) {
      alert("Please connect your Web3 wallet first!");
      return;
    }
    if (address.toLowerCase() === item.seller.toLowerCase()) {
      alert("You cannot buy your own carbon credit!");
      return;
    }

    setBuyingId(item.id);

    try {
      // Send Sepolia ETH directly to the seller's wallet on-chain as a purchase!
      // Price: 0.0001 ETH per 10 kg credits (or price_inr * 0.00001 ETH)
      const ethAmount = (item.credits * 0.00001).toFixed(5);
      
      const tx = await sendTransactionAsync({
        to: item.seller as `0x${string}`,
        value: parseEther(ethAmount),
      });

      console.log(`✅ On-chain payment transaction sent: ${tx}`);

      // Record in Supabase
      const res = await fetch(`${BACKEND_URL}/api/listings/buy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          txHash: tx,
          tokenId: item.token_id || 0,
          buyerAddress: address,
          userSessionId: session?.user?.id || null,
        }),
      });

      const json = await res.json();
      if (json.success) {
        alert(`Direct P2P Purchase Successful!\n\nYou have transferred the Sepolia ETH directly to the seller's wallet via MetaMask. Retired ${item.credits} kg of CO₂! The record is now updated on your Buyer Dashboard.`);
        setLocalRefresh(prev => prev + 1);
      } else {
        alert("Transaction recorded on-chain, but failed to update database.");
      }
    } catch (err: any) {
      console.error("Purchase failed:", err);
      alert(`Purchase failed: ${err.message || err}`);
    } finally {
      setBuyingId(null);
    }
  };

  return (
    <div className="w-full mt-12 flex flex-col gap-6">
      <div className="glass-panel p-6 rounded-2xl flex items-center justify-between border-white/20 bg-white/5">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Globe2 className="text-white" /> Live Global Impact
          </h2>
          <p className="text-zinc-400 mt-1">Total CO₂ sequestered via verified Aether credits</p>
        </div>
        <div className="text-right flex flex-col items-end">
          <span className="text-4xl font-bold font-mono tracking-tighter text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]">
            {totalImpact.toLocaleString()}
          </span>
          <span className="text-sm font-medium text-white/70 uppercase tracking-widest mt-1">Kilograms CO₂e</span>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <h3 className="text-xl font-medium tracking-tight">On-Chain Proofs</h3>
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 border border-white/5 rounded-2xl flex flex-col items-center gap-3 bg-white/[0.02] text-center">
            <TreePine className="w-10 h-10 text-zinc-700" />
            <p className="text-zinc-400 font-semibold text-sm">No carbon proofs minted yet</p>
            <p className="text-zinc-600 text-xs max-w-xs">Upload a geotagged tree photo above to mint your first NFT and have it appear here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {items.map((item, idx) => (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.07 }}
                  key={item.id}
                  className="glass-panel rounded-2xl overflow-hidden group cursor-pointer hover:border-white/30 transition-colors border border-white/5"
                >
                  <div className="h-48 relative overflow-hidden bg-zinc-900 border-b border-white/5">
                    {item.image ? (
                      <img
                        src={formatIPFS(item.image)}
                        alt="Ground-Level Proof"
                        className="object-cover w-full h-full opacity-80 group-hover:opacity-100 transition-opacity duration-500 group-hover:scale-105"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <TreePine className="w-10 h-10 text-zinc-700" />
                      </div>
                    )}
                    <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 flex items-center gap-1.5 text-[10px] font-medium text-white">
                      <ShieldCheck className="w-3 h-3" /> {item.species?.split('(')[0]?.trim() || 'Verified'}
                    </div>
                  </div>
                  <div className="p-5">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">
                          {new Date(item.created_at).toLocaleDateString('en-IN')}
                        </p>
                        <h4 className="text-sm font-semibold text-white truncate max-w-[160px]">{item.species}</h4>
                      </div>
                      <div className="flex items-center gap-1 font-bold font-mono text-white">
                        {item.credits}<span className="text-xs opacity-70">kg</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-zinc-500">Seller</span>
                        <span className="font-mono text-zinc-300">{item.seller?.slice(0, 8)}...{item.seller?.slice(-4)}</span>
                      </div>
                      {item.lat !== 'N/A' && (
                        <div className="flex justify-between text-xs">
                          <span className="text-zinc-500">Location</span>
                          <span className="font-mono text-zinc-400">{item.lat}°N, {item.lng}°E</span>
                        </div>
                      )}
                    </div>
                    <div className="mt-5 pt-4 border-t border-white/5 flex flex-col gap-3">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-zinc-500">P2P Purchase Price</span>
                        <span className="font-bold text-zinc-300">{(item.credits * 0.00001).toFixed(5)} Sepolia ETH</span>
                      </div>
                      
                      {address && address.toLowerCase() === item.seller.toLowerCase() ? (
                        <div className="w-full text-center py-2 bg-white/5 border border-white/10 text-white rounded-xl text-xs font-semibold">
                          Your Listing (Active)
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1.5 w-full">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleBuy(item);
                            }}
                            disabled={buyingId === item.id}
                            className="glass-btn-primary w-full py-2.5 text-xs rounded-xl uppercase tracking-wider flex items-center justify-center gap-1.5 disabled:opacity-50"
                          >
                            {buyingId === item.id ? (
                              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Purchasing...</>
                            ) : (
                              <><Coins className="w-3.5 h-3.5" /> Buy & Offset</>
                            )}
                          </button>
                          <span className="text-[9px] text-zinc-500 text-center block">
                            ⚡ Direct P2P MetaMask payment to seller's wallet
                          </span>
                        </div>
                      )}

                      <a
                        href={formatIPFS(item.image)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-zinc-500 hover:text-white transition-colors flex items-center justify-center gap-1 mt-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        View Proof on IPFS <ArrowRight className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
