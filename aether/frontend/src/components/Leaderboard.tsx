'use client';

import React from 'react';
import { Medal, Trophy, Award, Leaf, Zap, HelpCircle } from 'lucide-react';
import { motion } from 'framer-motion';

const topOffsetters = [
  {
    rank: 1,
    name: 'udit.eth',
    address: '0x32BE5d84ceA924F758A6056214c15D01f46b5ea1',
    credits: 5420,
    badges: [
      { name: 'Carbon Giant', icon: Trophy, color: 'text-amber-400 bg-amber-400/10 border-amber-400/20', desc: 'Offset over 5,000 kg of CO₂' },
      { name: 'Pioneer', icon: Zap, color: 'text-purple-400 bg-purple-400/10 border-purple-400/20', desc: 'Participated in Sepolia Launch' }
    ]
  },
  {
    rank: 2,
    name: 'greenforest.eth',
    address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    credits: 3120,
    badges: [
      { name: 'Botanist', icon: Leaf, color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20', desc: 'Offset 5+ different species' }
    ]
  },
  {
    rank: 3,
    name: 'ecotrust.eth',
    address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    credits: 1850,
    badges: [
      { name: 'Pioneer', icon: Zap, color: 'text-purple-400 bg-purple-400/10 border-purple-400/20', desc: 'Participated in Sepolia Launch' }
    ]
  },
  {
    rank: 4,
    name: 'solarseeker.eth',
    address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    credits: 920,
    badges: []
  }
];

export default function Leaderboard() {
  return (
    <div className="glass-panel p-6 rounded-2xl border border-white/5 bg-zinc-950/40 w-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Award className="text-emerald-500 w-5 h-5" /> Global Offset Leaders
          </h2>
          <p className="text-xs text-zinc-400 mt-1">Top environmental advocates and organizations ranked by active CO₂ offset capacity.</p>
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="overflow-x-auto w-full">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/5 text-[10px] text-zinc-500 uppercase font-bold tracking-wider">
              <th className="py-3 px-4 w-16">Rank</th>
              <th className="py-3 px-4">Advocate</th>
              <th className="py-3 px-4 text-right">CO₂ Credits Offset</th>
              <th className="py-3 px-4 hidden md:block">Impact Badges</th>
            </tr>
          </thead>
          <tbody>
            {topOffsetters.map((user, idx) => {
              const isTopThree = user.rank <= 3;
              const RankIcon = user.rank === 1 ? Trophy : user.rank === 2 ? Medal : Medal;
              const rankColor = user.rank === 1 ? 'text-amber-400' : user.rank === 2 ? 'text-zinc-300' : 'text-amber-600';

              return (
                <motion.tr
                  key={user.address}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="border-b border-white/5 hover:bg-white/2.5 transition-colors group"
                >
                  {/* Rank Column */}
                  <td className="py-4 px-4">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full">
                      {isTopThree ? (
                        <RankIcon className={`w-5 h-5 ${rankColor}`} />
                      ) : (
                        <span className="text-xs font-mono font-bold text-zinc-500">{user.rank}</span>
                      )}
                    </div>
                  </td>

                  {/* Identity Column */}
                  <td className="py-4 px-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-zinc-200 group-hover:text-emerald-400 transition-colors">
                        {user.name}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-500 truncate max-w-[120px] md:max-w-none">
                        {user.address}
                      </span>
                    </div>
                  </td>

                  {/* Carbon Credits Column */}
                  <td className="py-4 px-4 text-right">
                    <span className="text-sm font-mono font-bold text-zinc-100">
                      {user.credits.toLocaleString()} kg
                    </span>
                  </td>

                  {/* Impact Badges Column */}
                  <td className="py-4 px-4 hidden md:table-cell">
                    <div className="flex items-center gap-2">
                      {user.badges.length > 0 ? (
                        user.badges.map((badge) => {
                          const BadgeIcon = badge.icon;
                          return (
                            <div
                              key={badge.name}
                              title={badge.desc}
                              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold border ${badge.color} cursor-help transition-all hover:scale-105`}
                            >
                              <BadgeIcon className="w-3 h-3" />
                              {badge.name}
                            </div>
                          );
                        })
                      ) : (
                        <span className="text-xs text-zinc-600 font-medium">No badges earned yet</span>
                      )}
                    </div>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
