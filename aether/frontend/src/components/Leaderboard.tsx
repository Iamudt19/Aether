'use client';

import React, { useEffect, useState } from 'react';
import { Award, Medal, Trophy, Leaf, Zap, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useReadContract } from 'wagmi';
import { contractAddress } from '@/lib/config';
import abi from '@/lib/abi.json';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || '';

interface Leader {
  rank: number;
  address: string;
  credits: number;
  species_count: number;
}

export default function Leaderboard() {
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaders = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/listings`);
        const json = await res.json();

        if (json.success && json.listings.length > 0) {
          // Aggregate credits per seller address from real data
          const addressMap: Record<string, { credits: number; species: Set<string> }> = {};
          json.listings.forEach((l: any) => {
            const addr = l.seller_address?.toLowerCase();
            if (!addr) return;
            if (!addressMap[addr]) addressMap[addr] = { credits: 0, species: new Set() };
            addressMap[addr].credits += l.credits || 0;
            if (l.species) addressMap[addr].species.add(l.species);
          });

          const sorted = Object.entries(addressMap)
            .sort(([, a], [, b]) => b.credits - a.credits)
            .slice(0, 10)
            .map(([address, data], i) => ({
              rank: i + 1,
              address,
              credits: data.credits,
              species_count: data.species.size,
            }));

          setLeaders(sorted);
        } else {
          setLeaders([]);
        }
      } catch {
        setLeaders([]);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaders();
  }, []);

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="w-5 h-5 text-amber-400" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-zinc-300" />;
    if (rank === 3) return <Medal className="w-5 h-5 text-amber-600" />;
    return <span className="text-xs font-mono font-bold text-zinc-500">{rank}</span>;
  };

  const getBadge = (leader: Leader) => {
    if (leader.credits >= 5000) return { label: 'Carbon Giant', color: 'text-amber-400 bg-amber-400/10 border-amber-400/20', icon: Trophy };
    if (leader.credits >= 1000) return { label: 'Botanist', color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20', icon: Leaf };
    if (leader.species_count >= 3) return { label: 'Pioneer', color: 'text-purple-400 bg-purple-400/10 border-purple-400/20', icon: Zap };
    return null;
  };

  return (
    <div className="glass-panel p-6 rounded-2xl border border-white/5 bg-zinc-950/40 w-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Award className="text-emerald-500 w-5 h-5" /> Global Offset Leaders
          </h2>
          <p className="text-xs text-zinc-400 mt-1">Live on-chain ranking by verified CO₂ sequestration.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
        </div>
      ) : leaders.length === 0 ? (
        <div className="text-center py-16 flex flex-col items-center gap-3">
          <Trophy className="w-10 h-10 text-zinc-700" />
          <p className="text-zinc-400 font-semibold text-sm">No leaders yet</p>
          <p className="text-zinc-600 text-xs max-w-xs">Be the first! Mint a carbon credit NFT to appear on the global leaderboard.</p>
        </div>
      ) : (
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 text-[10px] text-zinc-500 uppercase font-bold tracking-wider">
                <th className="py-3 px-4 w-16">Rank</th>
                <th className="py-3 px-4">Wallet Address</th>
                <th className="py-3 px-4 text-right">CO₂ Credits</th>
                <th className="py-3 px-4 hidden md:table-cell">Badge</th>
              </tr>
            </thead>
            <tbody>
              {leaders.map((user, idx) => {
                const badge = getBadge(user);
                return (
                  <motion.tr
                    key={user.address}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group"
                  >
                    <td className="py-4 px-4">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full">
                        {getRankIcon(user.rank)}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-sm font-mono text-zinc-300 group-hover:text-emerald-400 transition-colors">
                        {user.address.slice(0, 8)}...{user.address.slice(-6)}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <span className="text-sm font-mono font-bold text-zinc-100">
                        {user.credits.toLocaleString()} kg
                      </span>
                    </td>
                    <td className="py-4 px-4 hidden md:table-cell">
                      {badge ? (
                        <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold border ${badge.color}`}>
                          <badge.icon className="w-3 h-3" />
                          {badge.label}
                        </div>
                      ) : (
                        <span className="text-xs text-zinc-600">—</span>
                      )}
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
