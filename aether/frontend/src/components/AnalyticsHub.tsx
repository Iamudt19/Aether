'use client';

import React, { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { BarChart3, TreePine, Activity, Loader2 } from 'lucide-react';
import { useReadContract } from 'wagmi';
import { contractAddress } from '@/lib/config';
import abi from '@/lib/abi.json';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || '';

const SPECIES_COLORS: Record<string, string> = {
  'Neem': '#10b981',
  'Sacred Fig': '#3b82f6',
  'Mango': '#f59e0b',
  'Cedar': '#ec4899',
  'Oak': '#8b5cf6',
  'Pine': '#06b6d4',
  'Other': '#6b7280',
};

export default function AnalyticsHub() {
  const [speciesData, setSpeciesData] = useState<{ name: string; value: number; color: string }[]>([]);
  const [offsetHistory, setOffsetHistory] = useState<{ month: string; co2: number }[]>([]);
  const [totalOffset, setTotalOffset] = useState(0);
  const [totalNodes, setTotalNodes] = useState(0);
  const [loading, setLoading] = useState(true);

  const { data: totalMinted } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi,
    functionName: 'totalMinted',
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/listings`);
        const json = await res.json();

        if (json.success && json.listings.length > 0) {
          const listings = json.listings;

          // Build species breakdown
          const speciesMap: Record<string, number> = {};
          let total = 0;
          listings.forEach((l: any) => {
            const key = l.species?.split('(')[0]?.trim() || 'Other';
            speciesMap[key] = (speciesMap[key] || 0) + l.credits;
            total += l.credits;
          });

          const speciesArr = Object.entries(speciesMap).map(([name, value], i) => ({
            name,
            value,
            color: SPECIES_COLORS[name] || Object.values(SPECIES_COLORS)[i % Object.values(SPECIES_COLORS).length],
          }));

          setSpeciesData(speciesArr);
          setTotalOffset(total);
          setTotalNodes(listings.length);

          // Build monthly history from created_at
          const monthMap: Record<string, number> = {};
          const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
          listings.forEach((l: any) => {
            const d = new Date(l.created_at);
            const label = months[d.getMonth()];
            monthMap[label] = (monthMap[label] || 0) + l.credits;
          });
          const history = Object.entries(monthMap).map(([month, co2]) => ({ month, co2 }));
          setOffsetHistory(history.length > 0 ? history : []);
        } else {
          // No data yet — show empty state
          setSpeciesData([]);
          setOffsetHistory([]);
          setTotalOffset(0);
          setTotalNodes(Number(totalMinted || 0));
        }
      } catch (err) {
        // Network error — silent fail, show zeros
        setTotalNodes(Number(totalMinted || 0));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [totalMinted]);

  if (loading) {
    return (
      <div className="w-full flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-white" />
      </div>
    );
  }

  const noData = speciesData.length === 0;

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass-panel p-5 rounded-2xl border border-white/5 bg-zinc-950/40 relative overflow-hidden group hover:border-emerald-500/20 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500/10 rounded-xl border border-emerald-500/20 flex items-center justify-center">
              <TreePine className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Total CO₂ Sequestered</p>
              <h3 className="text-2xl font-bold font-mono text-zinc-100 mt-0.5">
                {totalOffset > 0 ? `${totalOffset.toLocaleString()} kg` : '—'}
              </h3>
            </div>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-white/5 bg-zinc-950/40 relative overflow-hidden group hover:border-white/20 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/10 rounded-xl border border-blue-500/20 flex items-center justify-center">
              <Activity className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Verified Trees On-Chain</p>
              <h3 className="text-2xl font-bold font-mono text-zinc-100 mt-0.5">
                {totalNodes > 0 ? `${totalNodes} Trees` : '0 Trees'}
              </h3>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      {noData ? (
        <div className="glass-panel p-10 rounded-2xl border border-white/5 bg-zinc-950/40 flex flex-col items-center justify-center text-center gap-3">
          <TreePine className="w-10 h-10 text-zinc-700" />
          <p className="text-zinc-400 font-semibold text-sm">No analytics data yet</p>
          <p className="text-zinc-600 text-xs max-w-xs">Upload a tree photo above to mint your first carbon credit NFT. Analytics will populate automatically from real on-chain data.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Area Chart */}
          <div className="glass-panel p-6 rounded-2xl border border-white/5 bg-zinc-950/40 lg:col-span-2 flex flex-col h-[350px]">
            <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
              <BarChart3 className="text-white w-5 h-5" /> Sequestration Over Time
            </h3>
            <div className="flex-1 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={offsetHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCo2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" stroke="#71717a" fontSize={11} tickLine={false} />
                  <YAxis stroke="#71717a" fontSize={11} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#09090b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }} labelStyle={{ color: '#a1a1aa', fontWeight: 'bold' }} />
                  <Area type="monotone" dataKey="co2" name="CO2 (kg)" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorCo2)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Species Pie */}
          <div className="glass-panel p-6 rounded-2xl border border-white/5 bg-zinc-950/40 lg:col-span-1 flex flex-col h-[350px] items-center justify-between">
            <div className="w-full text-left">
              <h3 className="text-lg font-semibold">Species Breakdown</h3>
              <p className="text-xs text-zinc-400 mt-0.5">Live from on-chain verified credits</p>
            </div>
            <div className="relative w-full flex items-center justify-center flex-1">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={speciesData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                    {speciesData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-bold font-mono text-zinc-100">{totalOffset}</span>
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Total kg</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 w-full">
              {speciesData.map((entry) => (
                <div key={entry.name} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                  <span className="text-xs font-medium text-zinc-300 truncate">{entry.name}</span>
                  <span className="text-xs font-mono font-bold text-zinc-500 ml-auto">{entry.value}kg</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
