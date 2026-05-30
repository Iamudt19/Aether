'use client';

import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { BarChart3, TreePine, DollarSign, Activity } from 'lucide-react';

const offsetHistory = [
  { month: 'Jan', co2: 45 },
  { month: 'Feb', co2: 95 },
  { month: 'Mar', co2: 120 },
  { month: 'Apr', co2: 210 },
  { month: 'May', co2: 345 },
];

const speciesData = [
  { name: 'Neem', value: 82, color: '#10b981' },
  { name: 'Sacred Fig', value: 145, color: '#3b82f6' },
  { name: 'Mango', value: 95, color: '#f59e0b' },
  { name: 'Cedar', value: 210, color: '#ec4899' },
];

export default function AnalyticsHub() {
  const totalOffset = speciesData.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="w-full flex flex-col gap-6">
      {/* ─── Metric Cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Metric 1 */}
        <div className="glass-panel p-5 rounded-2xl border border-white/5 bg-zinc-950/40 relative overflow-hidden group hover:border-emerald-500/20 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl pointer-events-none"></div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500/10 rounded-xl border border-emerald-500/20 flex items-center justify-center">
              <TreePine className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Total CO₂ Sequestered</p>
              <h3 className="text-2xl font-bold font-mono text-zinc-100 mt-0.5">{totalOffset} kg</h3>
            </div>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="glass-panel p-5 rounded-2xl border border-white/5 bg-zinc-950/40 relative overflow-hidden group hover:border-blue-500/20 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-xl pointer-events-none"></div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/10 rounded-xl border border-blue-500/20 flex items-center justify-center">
              <Activity className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Active Verified Nodes</p>
              <h3 className="text-2xl font-bold font-mono text-zinc-100 mt-0.5">4 Trees</h3>
            </div>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="glass-panel p-5 rounded-2xl border border-white/5 bg-zinc-950/40 relative overflow-hidden group hover:border-amber-500/20 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-xl pointer-events-none"></div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500/10 rounded-xl border border-amber-500/20 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Marketplace Volume</p>
              <h3 className="text-2xl font-bold font-mono text-zinc-100 mt-0.5">1,240 MATIC</h3>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Charts Section ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Historical Line/Area Chart */}
        <div className="glass-panel p-6 rounded-2xl border border-white/5 bg-zinc-950/40 lg:col-span-2 flex flex-col h-[350px]">
          <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <BarChart3 className="text-emerald-500 w-5 h-5" /> Sequestration Over Time
          </h3>
          <div className="flex-1 w-full relative">
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
                <Tooltip 
                  contentStyle={{ backgroundColor: '#09090b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                  labelStyle={{ color: '#a1a1aa', fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey="co2" name="CO2 (kg)" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorCo2)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right Side: Species Doughnut Chart */}
        <div className="glass-panel p-6 rounded-2xl border border-white/5 bg-zinc-950/40 lg:col-span-1 flex flex-col h-[350px] items-center justify-between">
          <div className="w-full text-left">
            <h3 className="text-lg font-semibold">Species Contribution</h3>
            <p className="text-xs text-zinc-400 mt-0.5">Which species absorb the most CO₂.</p>
          </div>

          <div className="relative w-full flex items-center justify-center flex-1">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={speciesData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {speciesData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute flex flex-col items-center justify-center text-center">
              <span className="text-2xl font-bold font-mono text-zinc-100">{totalOffset}</span>
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Total kg</span>
            </div>
          </div>

          {/* Legend */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 w-full">
            {speciesData.map((entry) => (
              <div key={entry.name} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }}></div>
                <span className="text-xs font-medium text-zinc-300 truncate">{entry.name}</span>
                <span className="text-xs font-mono font-bold text-zinc-500 ml-auto">{entry.value}kg</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
