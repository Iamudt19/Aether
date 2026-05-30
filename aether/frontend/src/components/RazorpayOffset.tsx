'use client';

import React, { useState } from 'react';
import { CreditCard, ShieldCheck, TreePine, Loader2, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function RazorpayOffset() {
  const [credits, setCredits] = useState(50); // Default to 50 kg CO2 offset
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [orderData, setOrderData] = useState<any>(null);

  const pricePerKg = 10; // ₹10 INR per kg of carbon offset
  const totalAmount = credits * pricePerKg;

  // Dynamically load Razorpay Checkout script
  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleFiatOffset = async () => {
    setLoading(true);

    try {
      const resScript = await loadRazorpayScript();
      if (!resScript) {
        alert('Razorpay SDK failed to load. Are you offline?');
        setLoading(false);
        return;
      }

      // 1. Create order on Express backend
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const orderRes = await fetch(`${backendUrl}/api/razorpay/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: totalAmount }),
      });

      const data = await orderRes.json();
      if (!orderRes.ok || !data.success) {
        throw new Error(data.error || 'Failed to create Razorpay Order');
      }

      // 2. Open Razorpay Checkout popup
      const options = {
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        name: 'Aether Carbon',
        description: `Verify & Retire ${credits} kg CO₂ Carbon Offset`,
        image: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%2310b981" width="32" height="32"><rect width="24" height="24" rx="4" fill="%23064e3b"/><path d="M12 2C7.58 2 4 5.58 4 10c0 4.5 8 12 8 12s8-7.5 8-12c0-4.42-3.58-8-8-8zm0 11c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z" fill="%2310b981"/></svg>',
        order_id: data.orderId,
        handler: async function (response: any) {
          // Verify payment on mock backend (webhook captures this, but we simulate success here)
          setOrderData({
            paymentId: response.razorpay_payment_id,
            orderId: response.razorpay_order_id,
          });
          setSuccess(true);
        },
        prefill: {
          name: 'Aether ESG Client',
          email: 'esg@aether.carbon',
          contact: '9999999999',
        },
        theme: {
          color: '#10b981', // Emerald green brand color
        },
      };

      const paymentObject = new (window as any).Razorpay(options);
      paymentObject.open();
    } catch (err: any) {
      alert(`Payment checkout failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel p-6 rounded-2xl border border-white/5 bg-zinc-950/40 w-full flex flex-col h-full justify-between relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none"></div>

      <AnimatePresence mode="wait">
        {!success ? (
          <motion.div
            key="checkout-form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col gap-4 h-full"
          >
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                <CreditCard className="text-emerald-500 w-5 h-5" /> ESG Corporate Offset
              </h2>
              <p className="text-xs text-zinc-400 mt-1">Offset instantly with UPI or credit card. No Web3 wallet required.</p>
            </div>

            {/* Slider or Credits input */}
            <div className="bg-black/30 p-4 rounded-xl border border-white/5 flex flex-col gap-3 my-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-zinc-500">Offset Target</span>
                <span className="text-lg font-bold font-mono text-emerald-400">{credits} kg CO₂</span>
              </div>
              <input
                type="range"
                min="10"
                max="1000"
                step="10"
                value={credits}
                onChange={(e) => setCredits(Number(e.target.value))}
                className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                <span>10 kg</span>
                <span>500 kg</span>
                <span>1,000 kg</span>
              </div>
            </div>

            {/* Pricing Summary */}
            <div className="flex items-center justify-between py-2 border-b border-white/5">
              <span className="text-xs text-zinc-400">Price (₹10 / kg)</span>
              <span className="text-sm font-semibold font-mono text-zinc-200">₹{totalAmount.toLocaleString()} INR</span>
            </div>

            <button
              onClick={handleFiatOffset}
              disabled={loading}
              className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-sm shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:shadow-[0_0_25px_rgba(16,185,129,0.3)] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Launching Gateway...</>
              ) : (
                <><Sparkles className="w-4 h-4" /> Secure Offset with UPI/Card</>
              )}
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="success-receipt"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center text-center py-4 h-full"
          >
            <div className="w-14 h-14 bg-emerald-500/20 rounded-full flex items-center justify-center border border-emerald-500/30 mb-4 animate-bounce">
              <TreePine className="w-7 h-7 text-emerald-400" />
            </div>
            <h3 className="text-lg font-bold text-emerald-400 mb-1">Offset Successful!</h3>
            <p className="text-xs text-zinc-300 max-w-[240px] mb-4">
              Thank you! You have programmatically retired **{credits} kg of CO₂** on the Sepolia network.
            </p>

            <div className="bg-black/40 p-4 rounded-xl border border-white/5 w-full flex flex-col gap-2 text-left mb-6 text-xs font-mono">
              <div className="flex justify-between text-zinc-500">
                <span>Payment ID:</span>
                <span className="text-zinc-300 truncate max-w-[120px]">{orderData?.paymentId}</span>
              </div>
              <div className="flex justify-between text-zinc-500">
                <span>Order ID:</span>
                <span className="text-zinc-300 truncate max-w-[120px]">{orderData?.orderId}</span>
              </div>
              <div className="flex justify-between text-zinc-500">
                <span>Status:</span>
                <span className="text-emerald-400 font-bold">RETIRED (Web3 Vault)</span>
              </div>
            </div>

            <button
              onClick={() => setSuccess(false)}
              className="px-6 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 hover:border-emerald-500/30 rounded-xl transition-all font-semibold text-xs cursor-pointer"
            >
              Offset More Carbon
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
