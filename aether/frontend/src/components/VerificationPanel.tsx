'use client';

import React, { useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { Loader2, ShieldCheck, TreePine, ExternalLink, XCircle, AlertTriangle } from 'lucide-react';
import { contractAddress } from '../lib/config';
import abi from '../lib/abi.json';
import { motion, AnimatePresence } from 'framer-motion';

interface VerificationPanelProps {
  lat: number | null;
  lng: number | null;
  imageBase64: string | null;
  onSuccess: () => void;
}

export default function VerificationPanel({ lat, lng, imageBase64, onSuccess }: VerificationPanelProps) {
  const { address } = useAccount();
  
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const { writeContract, data: hash, isPending: isMinting } = useWriteContract();
  const { isLoading: isWaiting, isSuccess: isMintSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const handleVerify = async () => {
    if (!lat || !lng || !address || !imageBase64) return;
    setLoading(true);
    setError(null);
    setResult(null);

    // Client-side blank/dark image check to avoid sending unusable images
    const isMostlyDarkClient = await (async () => {
      try {
        return await new Promise<boolean>((resolve) => {
          const img = new Image();
          img.src = imageBase64 as string;
          img.crossOrigin = 'Anonymous';
          img.onload = () => {
            const w = 50; const h = 50;
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            const ctx = canvas.getContext('2d');
            if (!ctx) return resolve(false);
            ctx.drawImage(img, 0, 0, w, h);
            const data = ctx.getImageData(0, 0, w, h).data;
            let darkCount = 0;
            const total = w * h;
            for (let i = 0; i < data.length; i += 4) {
              const r = data[i], g = data[i+1], b = data[i+2];
              const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
              if (lum < 20) darkCount++;
            }
            resolve((darkCount / total) >= 0.85);
          };
          img.onerror = () => resolve(false);
        });
      } catch (_) { return false; }
    })();

    if (isMostlyDarkClient) {
      setError('Image appears blank or too dark. Please upload a clear, well-lit photo of your tree.');
      setLoading(false);
      return;
    }

    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || '';
      const res = await fetch(`${backendUrl}/api/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng, imageBase64, userAddress: address })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Server error');
      }

      // Handle rejection (anti-fraud) vs success
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMint = () => {
    if (!result) return;
    
    writeContract({
      address: contractAddress as `0x${string}`,
      abi,
      functionName: 'mintWithSignature',
      args: [
        BigInt(result.credits),
        result.species,
        result.imageIPFSHash,
        result.tokenURI,
        result.signature as `0x${string}`
      ],
    });
  };

  const calledOnSuccess = React.useRef(false);

  React.useEffect(() => {
    const confirmMint = async () => {
      if (isMintSuccess && hash && result && address) {
        try {
          const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || '';
          await fetch(`${backendUrl}/api/listings/confirm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              txHash: hash,
              userAddress: address,
              signature: result.signature,
            }),
          });
        } catch (err) {
          console.error("Failed to confirm listing update in Supabase:", err);
        }
      }
    };

    if (isMintSuccess) {
      if (!calledOnSuccess.current) {
        calledOnSuccess.current = true;
        confirmMint().then(() => {
          onSuccess();
        });
      }
    } else {
      calledOnSuccess.current = false;
    }
  }, [isMintSuccess, hash, result, address, onSuccess]);

  // Trigger verify automatically when props exist but only if we don't have a result and aren't loading.
  React.useEffect(() => {
     if (imageBase64 && lat && lng && address && !result && !loading && !error) {
         handleVerify();
     }
  }, [imageBase64, lat, lng, address]);

  if (!address) {
    return (
      <div className="glass-panel p-6 rounded-2xl flex flex-col items-center justify-center text-center h-full min-h-[300px]">
        <h3 className="text-xl font-semibold mb-2">Connect Wallet</h3>
        <p className="text-zinc-400">Please connect your wallet to verify proof and mint credits.</p>
      </div>
    );
  }

  if (!imageBase64) {
    return (
      <div className="glass-panel p-6 rounded-2xl flex flex-col items-center justify-center text-center h-full min-h-[300px]">
        <h3 className="text-xl font-semibold mb-2">Awaiting Photo Proof</h3>
        <p className="text-zinc-400">Capture a photo of the planted tree to begin active AI verification.</p>
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-2xl overflow-hidden h-full flex flex-col">
      <div className="p-6 border-b border-white/5">
        <h2 className="text-2xl font-semibold flex items-center gap-2">
          <ShieldCheck className="text-emerald-500" /> Active AI View
        </h2>
        <p className="text-sm text-zinc-400 mt-1 flex items-center gap-2">
            Status: {loading ? "Analyzing..." : result ? "Verified" : "Ready"}
        </p>
      </div>

      <div className="p-6 flex-1 flex flex-col items-center justify-center">
        <AnimatePresence mode="wait">
          {loading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center py-8">
              <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mb-4" />
              <p className="text-white font-medium animate-pulse text-center">Processing with Plant.id & IPFS...<br/><span className="text-xs opacity-70">This takes ~5 seconds</span></p>
            </motion.div>
          )}

          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full bg-white/10 border border-white/20 p-4 rounded-xl text-center">
              <p className="text-white mb-4 text-sm">{error}</p>
              <button onClick={() => { setError(null); handleVerify(); }} className="glass-btn px-4 py-2 rounded-lg">
                Retry Verification
              </button>
            </motion.div>
          )}

          {result && result.rejected && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full flex flex-col gap-4">
              <div className="bg-white/10 border border-white/20 rounded-xl p-5 flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-3">
                  <XCircle className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-white mb-1">Verification Rejected</h3>
                <p className="text-zinc-300 mb-3 text-sm">{result.message}</p>
                <div className="w-full mb-4 bg-black/40 rounded-lg p-3 text-left">
                  <p className="text-xs text-zinc-500 mb-0.5">Detected Object</p>
                  <p className="text-sm text-white font-medium">{result.species}</p>
                </div>
                <button
                  onClick={() => { setResult(null); setError(null); }}
                  className="glass-btn px-6 py-2 rounded-lg text-sm font-medium"
                >
                  Upload a Different Photo
                </button>
              </div>
            </motion.div>
          )}

          {result && result.success && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full flex flex-col gap-4">
              <div className="bg-white/10 border border-white/20 rounded-xl p-4 flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-3">
                  <TreePine className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-white mb-1">Tree Verification Success!</h3>
                <p className="text-zinc-300 mb-2 font-medium">Species: <span className="text-white">{result.species}</span></p>
                {result.showConfidence !== false && (
                  <div className="w-full bg-black/40 rounded-lg p-3 mb-2">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-zinc-500">AI Confidence</span>
                      <span className="text-white font-mono font-semibold">
                        {result.probability ? `${(result.probability * 100).toFixed(1)}%` : '—'}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-white to-slate-400 rounded-full transition-all duration-700"
                        style={{ width: `${(result.probability || 0) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
                <div className="flex gap-4 w-full">
                   <div className="flex-1 bg-black/40 rounded-lg p-3">
                     <p className="text-xs text-zinc-500 mb-0.5">IPFS Image Hash</p>
                     <p className="text-[10px] sm:text-xs text-zinc-300 break-all">{result.imageIPFSHash.replace("ipfs://", "")}</p>
                   </div>
                   <div className="flex-1 bg-black/40 rounded-lg p-3">
                     <p className="text-xs text-zinc-500">Allocated Credits</p>
                     <p className="text-lg font-semibold font-mono text-white">{result.credits} kg CO₂</p>
                   </div>
                </div>
              </div>

              {!isMintSuccess ? (
                <button
                  onClick={handleMint}
                  disabled={isMinting || isWaiting}
                  className="glass-btn-primary w-full py-4 px-6 gap-2 rounded-xl disabled:opacity-50 flex items-center justify-center transform hover:-translate-y-0.5"
                >
                  {(isMinting || isWaiting) ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Minting Verified NFT...</>
                  ) : (
                    "Mint Credit to Wallet"
                  )}
                </button>
              ) : (
                <div className="w-full py-4 px-6 rounded-xl bg-white/20 text-white border border-white/30 text-center font-bold">
                  NFT Minted Successfully!
                  {hash && (
                     <a href={`https://amoy.polygonscan.com/tx/${hash}`} target="_blank" rel="noreferrer" className="block text-xs underline mt-1 font-normal opacity-80 hover:opacity-100 flex items-center justify-center gap-1">
                       View Tx <ExternalLink className="w-3 h-3"/>
                     </a>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
