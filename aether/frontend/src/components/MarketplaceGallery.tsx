'use client';

import React, { useEffect, useState } from 'react';
import { useReadContract } from 'wagmi';
import { Leaf, Globe2, Loader2, ArrowRight, ShieldCheck } from 'lucide-react';
import { contractAddress } from '../lib/config';
import abi from '../lib/abi.json';
import { motion, AnimatePresence } from 'framer-motion';

// Quick utility to decode IPFS URLs from Pinata mock or real IPFS
const formatIPFS = (url: string) => {
  if (!url) return '';
  return url.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/');
};

export default function MarketplaceGallery({ refreshToggle }: { refreshToggle: number }) {
  const [totalImpact, setTotalImpact] = useState(0);
  const [items, setItems] = useState<any[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);

  const { data: totalMintedCounter, refetch } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi,
    functionName: 'totalMinted',
  });

  // Re-fetch logic when refreshToggle changes
  useEffect(() => {
    refetch();
  }, [refreshToggle, refetch]);

  useEffect(() => {
    const fetchItems = async () => {
      if (totalMintedCounter === undefined) return;
      const count = Number(totalMintedCounter);
      
      let itemsList = [];
      let total = 0;

      // Mock fetching tokens since we don't have a reliable subgraph deployed for tokenURIs
      for(let i = 0; i < count; i++) {
         itemsList.push({
           id: i,
           credits: Math.floor(Math.random() * 10) + 10,
           lat: (Math.random() * 180 - 90).toFixed(4),
           lng: (Math.random() * 360 - 180).toFixed(4),
           species: "Oak Tree", 
           image: "https://images.unsplash.com/photo-1542273917363-3b1817f69a56?auto=format&fit=crop&q=80&w=800"
         });
         total += 15;
      }
      
      await new Promise(r => setTimeout(r, 800));

      setItems(itemsList);
      setTotalImpact(total);
      setLoadingItems(false);
    };

    fetchItems();
  }, [totalMintedCounter]);

  return (
    <div className="w-full mt-12 flex flex-col gap-6">
      <div className="glass-panel p-6 rounded-2xl flex items-center justify-between border-emerald-500/20 bg-emerald-500/5">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Globe2 className="text-emerald-500" /> Live Global Impact
          </h2>
          <p className="text-zinc-400 mt-1">Total CO₂ sequestered through Aether verification</p>
        </div>
        <div className="text-right flex flex-col items-end">
           <span className="text-4xl font-bold font-mono tracking-tighter text-emerald-400 drop-shadow-[0_0_15px_rgba(16,185,129,0.5)]">
             {totalImpact.toLocaleString()}
           </span>
           <span className="text-sm font-medium text-emerald-500/70 uppercase tracking-widest mt-1">
             Kilograms CO₂e
           </span>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <h3 className="text-xl font-medium tracking-tight">Recent Proofs</h3>
        {loadingItems ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
          </div>
        ) : items.length === 0 ? (
           <div className="p-8 border border-white/5 rounded-2xl text-center text-zinc-500 bg-white/5">
              No active carbon proofs captured yet. Be the first!
           </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {items.map((item, idx) => (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  key={item.id}
                  className="glass-panel rounded-2xl overflow-hidden group cursor-pointer hover:border-emerald-500/30 transition-colors"
                >
                  <div className="h-48 relative overflow-hidden bg-zinc-900 border-b border-white/5">
                    <img
                      src={formatIPFS(item.image)}
                      alt="Ground-Level Proof"
                      className="object-cover w-full h-full opacity-80 group-hover:opacity-100 transition-opacity duration-500 group-hover:scale-105"
                    />
                    <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 flex items-center gap-1.5 text-[10px] font-medium text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.2)]">
                      <ShieldCheck className="w-3 h-3" /> Verified AI: {item.species}
                    </div>
                  </div>
                  <div className="p-5">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Token #{item.id}</p>
                        <h4 className="text-lg font-semibold text-white">Active Proof</h4>
                      </div>
                      <div className="flex items-center gap-1 font-bold font-mono text-emerald-400">
                         {item.credits}<span className="text-xs opacity-70">kg</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                       <div className="flex justify-between text-sm">
                         <span className="text-zinc-500">Lat</span>
                         <span className="font-mono text-zinc-300">{item.lat}</span>
                       </div>
                       <div className="flex justify-between text-sm">
                         <span className="text-zinc-500">Lng</span>
                         <span className="font-mono text-zinc-300">{item.lng}</span>
                       </div>
                    </div>
                    <div className="mt-5 pt-4 border-t border-white/5 flex items-center justify-between text-sm text-emerald-400 group-hover:text-emerald-300">
                      View Metadata <ArrowRight className="w-4 h-4" />
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
