'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CreditCard, Leaf, ArrowLeft, Download, ShieldCheck,
  Loader2, RefreshCw, TreePine, Globe2, Calendar,
  CheckCircle2, Clock, TrendingDown, FileText, ExternalLink
} from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import HulyBackground from '@/components/HulyBackground';
import ThemeToggle from '@/components/ThemeToggle';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || '';

interface Purchase {
  id: string;
  payment_id: string;
  order_id: string;
  amount_inr: number;
  credits_kg: number;
  status: 'captured' | 'pending' | 'failed';
  created_at: string;
  species?: string;
}

function StatCard({ icon: Icon, label, value, sub, color = 'emerald', delay = 0 }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
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

function CertificateModal({ purchase, onClose }: { purchase: Purchase; onClose: () => void }) {
  const date = new Date(purchase.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-xl" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative w-full max-w-md z-10"
      >
        <div className="absolute -inset-[1px] bg-gradient-to-br from-[var(--fern)]/30 to-[var(--pine-teal)]/20 rounded-3xl blur-[1px] -z-10" />
        <div className="glass-panel p-8 rounded-3xl bg-[var(--color-background)] shadow-2xl">
          {/* Certificate Header */}
          <div className="text-center mb-6">
            <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-xl bg-[var(--fern)] font-bold text-white shadow-[0_0_20px_rgba(88,129,87,0.4)] text-xl mb-3">Æ</div>
            <div className="text-[9px] font-black uppercase tracking-[0.3em] text-[var(--accent)] mb-1">Certificate of Carbon Offset Retirement</div>
            <h2 className="text-xl font-black text-[var(--text-primary)]">Aether Carbon</h2>
            <div className="h-px bg-gradient-to-r from-transparent via-[var(--accent)]/30 to-transparent mt-3" />
          </div>

          <div className="flex flex-col gap-3 text-sm mb-6">
            {[
              { label: 'Payment ID', value: purchase.payment_id },
              { label: 'Order ID', value: purchase.order_id },
              { label: 'CO₂ Retired', value: `${purchase.credits_kg} kg CO₂e`, highlight: true },
              { label: 'Amount Paid', value: `₹${purchase.amount_inr.toLocaleString()} INR` },
              { label: 'Retirement Date', value: date },
              { label: 'Status', value: 'RETIRED', highlight: true },
            ].map(({ label, value, highlight }) => (
              <div key={label} className="flex justify-between items-center py-1.5 border-b border-[var(--glass-border)]">
                <span className="text-[var(--text-muted)] text-xs">{label}</span>
                <span className={`text-xs font-bold font-mono ${highlight ? 'text-[var(--fern)]' : 'text-[var(--text-primary)]'} max-w-[160px] text-right truncate`}>{value}</span>
              </div>
            ))}
          </div>

          <div className="bg-[var(--fern)]/5 border border-[var(--fern)]/15 rounded-xl p-3 text-center mb-5">
            <CheckCircle2 className="w-5 h-5 text-[var(--fern)] mx-auto mb-1" />
            <p className="text-[10px] text-[var(--fern)] font-black uppercase tracking-wider">Verified on Ethereum Sepolia</p>
            <p className="text-[9px] text-[var(--text-secondary)] mt-0.5">This retirement is permanently recorded on-chain</p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => window.print()}
              className="flex-1 py-2.5 bg-[var(--fern)] hover:bg-[var(--hunter-green)] text-white text-xs font-black rounded-xl uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md"
            >
              <Download className="w-3.5 h-3.5" /> Download / Print
            </button>
            <button
              onClick={onClose}
              className="py-2.5 px-4 bg-[var(--glass-bg)] border border-[var(--glass-border)] hover:bg-[var(--dry-sage)]/10 text-[var(--text-secondary)] text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function BuyerDashboard() {
  const [session, setSession] = useState<any>(null);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCert, setSelectedCert] = useState<Purchase | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  const fetchPurchases = useCallback(async () => {
    if (!session?.user) return;
    setRefreshing(true);
    try {
      const { data, error } = await supabase
        .from('carbon_purchases')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setPurchases(data);
      } else {
        setPurchases([]);
      }
    } catch {
      setPurchases([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session]);

  useEffect(() => {
    if (session?.user) fetchPurchases();
    else setLoading(false);
  }, [session, fetchPurchases]);

  const totalRetired = purchases.filter(p => p.status === 'captured').reduce((s, p) => s + p.credits_kg, 0);
  const totalSpent = purchases.filter(p => p.status === 'captured').reduce((s, p) => s + p.amount_inr, 0);
  const capturedCount = purchases.filter(p => p.status === 'captured').length;

  if (!session) {
    return (
      <div className="min-h-screen relative flex flex-col items-center justify-center gap-6 px-4 theme-transition">
        <HulyBackground />
        <div className="text-center relative z-10">
          <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-2xl bg-[var(--fern)] font-bold text-white shadow-[0_0_30px_rgba(88,129,87,0.4)] text-2xl mb-4">Æ</div>
          <h1 className="text-2xl font-black text-[var(--text-primary)] mb-2">Buyer Dashboard</h1>
          <p className="text-[var(--text-secondary)] text-sm mb-6">Sign in to view your carbon offset purchases and certificates</p>
          <div className="flex justify-center items-center gap-3">
            <ThemeToggle />
            <Link href="/" className="px-6 py-3 bg-[var(--fern)] hover:bg-[var(--hunter-green)] text-white text-xs font-black rounded-xl uppercase tracking-wider transition-all inline-flex items-center gap-2 shadow-md">
              Sign In via Home →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative theme-transition">
      <HulyBackground />

      {/* Header */}
      <header className="sticky top-0 z-50 w-full backdrop-blur-[12px] bg-[var(--glass-bg)] border-b border-[var(--glass-border)] transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--fern)] font-bold text-white text-sm">Æ</div>
              <span className="text-lg font-black text-[var(--text-primary)]">Aether Carbon</span>
            </Link>
            <span className="text-[var(--text-muted)]">/</span>
            <span className="text-sm font-black text-[var(--accent)]">Buyer Dashboard</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={fetchPurchases} disabled={refreshing} className="p-2 rounded-lg bg-[var(--glass-bg)] border border-[var(--glass-border)] hover:bg-[var(--dry-sage)]/10 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer">
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <Link href="/" className="px-3.5 py-1.5 bg-[var(--glass-bg)] border border-[var(--glass-border)] hover:bg-[var(--dry-sage)]/10 text-xs font-bold rounded-xl text-[var(--text-primary)] transition-all cursor-pointer flex items-center gap-1.5">
              <ArrowLeft className="w-3 h-3" /> Back
            </Link>
            <ThemeToggle />
            <ConnectButton showBalance={false} chainStatus="icon" />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 relative z-10">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-5 h-5 text-[var(--accent)]" />
            <span className="text-xs font-bold text-[var(--accent)] uppercase tracking-widest">ESG Carbon Buyer</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-[var(--text-primary)]">Your Carbon Offset History</h1>
          <p className="text-[var(--text-secondary)] mt-1 text-sm">
            Signed in as <span className="text-[var(--text-primary)] font-bold">{session.user.email || session.user.user_metadata?.full_name}</span>
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard icon={Leaf} label="Total CO₂ Retired" value={`${totalRetired} kg`} sub="Carbon sequestered" delay={0} />
          <StatCard icon={CheckCircle2} label="Successful Offsets" value={capturedCount} sub="Completed purchases" delay={0.05} />
          <StatCard icon={CreditCard} label="Total Spent" value={`₹${totalSpent.toLocaleString()}`} sub="INR invested" delay={0.1} />
          <StatCard icon={Globe2} label="Equiv. Tree Months" value={Math.round(totalRetired / 8)} sub="Rough equivalent" delay={0.15} />
        </div>

        {/* Environmental Impact Banner */}
        {totalRetired > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-8 p-5 rounded-2xl bg-gradient-to-r from-[var(--fern)]/10 to-[var(--pine-teal)]/10 border border-[var(--fern)]/20 flex flex-col sm:flex-row items-start sm:items-center gap-4"
          >
            <div className="p-3 bg-[var(--fern)]/15 rounded-xl border border-[var(--fern)]/20">
              <TreePine className="w-6 h-6 text-[var(--fern)]" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-[var(--text-primary)]">Your Environmental Impact</p>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                You have offset <span className="text-[var(--fern)] font-bold">{totalRetired} kg of CO₂</span> — equivalent to planting approximately <span className="text-[var(--fern)] font-bold">{Math.round(totalRetired / 20)} mature trees</span> for a full year. 🌍
              </p>
            </div>
            <div className="bg-[var(--fern)]/10 border border-[var(--fern)]/20 rounded-xl px-4 py-2 text-center shrink-0">
              <p className="text-2xl font-black text-[var(--fern)] font-mono">{totalRetired}</p>
              <p className="text-[9px] text-[var(--fern)] uppercase tracking-wider">kg CO₂e</p>
            </div>
          </motion.div>
        )}

        {/* Buyer Stewardship Badges */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-panel p-6 rounded-2xl mb-8"
        >
          <h2 className="text-sm font-black flex items-center gap-2 mb-4 text-[var(--accent)]">
            <CheckCircle2 className="w-4 h-4" /> Offset Stewardship Badges
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className={`p-4 rounded-xl border flex items-center gap-3 transition-all ${
              purchases.length >= 1 
                ? 'bg-[var(--accent)]/10 border-[var(--accent)]/20 text-[var(--text-primary)]' 
                : 'bg-[var(--glass-bg)] border-[var(--glass-border)] text-[var(--text-muted)]'
            }`}>
              <div className="w-8 h-8 rounded-full bg-[var(--color-background)] flex items-center justify-center font-bold">🍃</div>
              <div>
                <p className="text-xs font-black">Green Supporter</p>
                <p className="text-[9px] opacity-75">Retired 1st carbon credit</p>
              </div>
            </div>
            <div className={`p-4 rounded-xl border flex items-center gap-3 transition-all ${
              totalRetired >= 100 
                ? 'bg-[var(--fern)]/10 border-[var(--fern)]/20 text-[var(--fern)]' 
                : 'bg-[var(--glass-bg)] border-[var(--glass-border)] text-[var(--text-muted)]'
            }`}>
              <div className="w-8 h-8 rounded-full bg-[var(--color-background)] flex items-center justify-center font-bold">🌎</div>
              <div>
                <p className="text-xs font-black">Eco Guardian</p>
                <p className="text-[9px] opacity-75">Retired 100+ kg CO₂e</p>
              </div>
            </div>
            <div className={`p-4 rounded-xl border flex items-center gap-3 transition-all ${
              totalRetired >= 500 
                ? 'bg-[var(--dry-sage)]/25 border-[var(--dry-sage)]/40 text-[var(--text-primary)]' 
                : 'bg-[var(--glass-bg)] border-[var(--glass-border)] text-[var(--text-muted)]'
            }`}>
              <div className="w-8 h-8 rounded-full bg-[var(--color-background)] flex items-center justify-center font-bold">🏆</div>
              <div>
                <p className="text-xs font-black">Net-Zero Champion</p>
                <p className="text-[9px] opacity-75">Retired 500+ kg CO₂e</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Purchases List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="glass-panel rounded-2xl overflow-hidden"
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--glass-border)]">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[var(--accent)]" />
              <h2 className="text-sm font-black text-[var(--text-primary)]">Purchase History & Certificates</h2>
            </div>
            <span className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-widest">{purchases.length} total</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-[var(--accent)]" />
            </div>
          ) : purchases.length === 0 ? (
            <div className="text-center py-20 px-8">
              <CreditCard className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-3" />
              <p className="text-[var(--text-primary)] font-black text-sm">No purchases yet</p>
              <p className="text-[var(--text-secondary)] text-xs mt-1 mb-5">Head back to the dashboard and use the ESG Offset widget to buy carbon credits.</p>
              <Link href="/" className="px-4 py-2 bg-[var(--accent)]/10 border border-[var(--accent)]/20 text-[var(--accent)] rounded-xl text-xs font-bold hover:bg-[var(--accent)]/20 transition-all">
                Buy Carbon Credits →
              </Link>
            </div>
          ) : (
            <AnimatePresence>
              <div className="divide-y divide-[var(--glass-border)]">
                {purchases.map((purchase, i) => (
                  <motion.div
                    key={purchase.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-4 hover:bg-[var(--dry-sage)]/5 transition-colors group"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        purchase.status === 'captured'
                          ? 'bg-[var(--fern)]/10 border border-[var(--fern)]/20'
                          : purchase.status === 'pending'
                          ? 'bg-amber-500/10 border border-amber-500/20'
                          : 'bg-red-500/10 border border-red-500/20'
                      }`}>
                        {purchase.status === 'captured' ? (
                          <CheckCircle2 className="w-4 h-4 text-[var(--fern)]" />
                        ) : (
                          <Clock className="w-4 h-4 text-amber-500" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[var(--text-primary)] truncate max-w-[200px]">
                          {purchase.credits_kg} kg CO₂ Offset
                          {purchase.species && <span className="text-[var(--text-secondary)] font-normal"> · {purchase.species.split('(')[0].trim()}</span>}
                        </p>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-[10px] text-[var(--text-muted)] font-mono">{purchase.payment_id.slice(0, 20)}...</span>
                          <span className="text-[10px] text-[var(--text-secondary)] flex items-center gap-1">
                            <Calendar className="w-2.5 h-2.5" />
                            {new Date(purchase.created_at).toLocaleDateString('en-IN')}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 sm:gap-5 flex-wrap">
                      <div className="text-right">
                        <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Amount</p>
                        <p className="text-sm font-black font-mono text-[var(--text-primary)]">₹{purchase.amount_inr.toLocaleString()}</p>
                      </div>
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
                        purchase.status === 'captured'
                          ? 'bg-[var(--fern)]/10 border border-[var(--fern)]/20 text-[var(--fern)]'
                          : purchase.status === 'pending'
                          ? 'bg-amber-500/10 border border-amber-500/20 text-amber-500'
                          : 'bg-red-500/10 border border-red-500/20 text-red-500'
                      }`}>
                        {purchase.status === 'captured' ? 'Retired' : purchase.status}
                      </span>
                      {purchase.status === 'captured' && (
                        <button
                          onClick={() => setSelectedCert(purchase)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--fern)]/10 border border-[var(--fern)]/20 hover:bg-[var(--fern)]/20 text-[var(--fern)] text-[10px] font-bold rounded-lg transition-all cursor-pointer opacity-0 group-hover:opacity-100"
                        >
                          <FileText className="w-3 h-3" /> Certificate
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </AnimatePresence>
          )}
        </motion.div>

        {/* Buy more CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-6 p-5 rounded-2xl bg-[var(--accent)]/5 border border-[var(--accent)]/15 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <Leaf className="w-5 h-5 text-[var(--accent)] shrink-0" />
            <div>
              <p className="text-sm font-black text-[var(--text-primary)]">Offset more carbon today</p>
              <p className="text-xs text-[var(--text-secondary)]">Buy active carbon credits on-chain directly from the decentralized marketplace.</p>
            </div>
          </div>
          <Link
            href="/"
            className="px-5 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-black rounded-xl uppercase tracking-widest transition-all flex items-center gap-2 shrink-0 shadow-md"
          >
            <TreePine className="w-3.5 h-3.5" /> Open Marketplace →
          </Link>
        </motion.div>
      </main>

      {/* Certificate Modal */}
      <AnimatePresence>
        {selectedCert && (
          <CertificateModal purchase={selectedCert} onClose={() => setSelectedCert(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
