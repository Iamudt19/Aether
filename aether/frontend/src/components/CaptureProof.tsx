'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, ImagePlus, MapPin, UploadCloud, X, Loader2, AlertTriangle, Video, Circle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccount } from 'wagmi';

interface CaptureProofProps {
  onCapture: (base64Image: string, lat: number, lng: number) => void;
}

// ─── EXIF GPS Extraction ──────────────────────────────────────────────────
function extractEXIFGPS(file: File): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const view = new DataView(e.target?.result as ArrayBuffer);
        if (view.getUint16(0) !== 0xFFD8) { resolve(null); return; }
        let offset = 2;
        while (offset < view.byteLength - 2) {
          const marker = view.getUint16(offset);
          if (marker === 0xFFE1) {
            resolve(null); return;
          } else if ((marker & 0xFF00) === 0xFF00) {
            offset += 2 + view.getUint16(offset + 2);
          } else { break; }
        }
        resolve(null);
      } catch { resolve(null); }
    };
    reader.readAsArrayBuffer(file.slice(0, 128 * 1024));
  });
}

type ViewState = 'picker' | 'camera' | 'preview';

export default function CaptureProof({ onCapture }: CaptureProofProps) {
  const { isConnected } = useAccount();
  const [viewState, setViewState] = useState<ViewState>('picker');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loadingLoc, setLoadingLoc] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [captureMode, setCaptureMode] = useState<'camera' | 'gallery' | null>(null);
  const [hasExifGPS, setHasExifGPS] = useState<boolean | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Initialize on mount
  useEffect(() => {
    requestLocation();
  }, []);

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => stopCamera();
  }, []);

  const requestLocation = () => {
    setLoadingLoc(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setLoadingLoc(false);
        },
        () => {
          setErrorMsg('GPS unavailable — using estimated region.');
          setLocation({ lat: 28.6139, lng: 77.2090 }); // Default
          setLoadingLoc(false);
        }
      );
    } else {
      setLocation({ lat: 28.6139, lng: 77.2090 });
      setLoadingLoc(false);
    }
  };

  // ─── Live Camera Logic ──────────────────────────────────────────────────
  const startCamera = async () => {
    setCameraError(null);
    setCameraReady(false);
    setViewState('camera');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Back camera on mobile
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setCameraReady(true);
        };
      }
    } catch (err: any) {
      console.error('Camera error:', err);
      if (err.name === 'NotAllowedError') {
        setCameraError('Camera permission denied. Please allow camera access in your browser settings.');
      } else if (err.name === 'NotFoundError') {
        setCameraError('No camera found on this device.');
      } else {
        setCameraError(`Camera error: ${err.message}`);
      }
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
  };

  const captureFrame = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const base64 = canvas.toDataURL('image/jpeg', 0.85);

    stopCamera();
    setImagePreview(base64);
    setCaptureMode('camera');
    setHasExifGPS(true); // Camera capture uses live GPS
    setViewState('preview');
  };

  // ─── Gallery Upload Logic ──────────────────────────────────────────────
  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select a valid image.'); return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Image must be under 5MB.'); return;
    }

    setCaptureMode('gallery');
    const exifGps = await extractEXIFGPS(file);
    setHasExifGPS(exifGps ? true : false);
    if (exifGps) setLocation(exifGps);

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setImagePreview(event.target.result as string);
        setViewState('preview');
        setErrorMsg(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const canSubmit = imagePreview && location && !loadingLoc && (captureMode === 'camera' || hasExifGPS !== false);

  const submitProof = () => {
    if (imagePreview && location) {
      onCapture(imagePreview, location.lat, location.lng);
    }
  };

  const resetState = () => {
    stopCamera();
    setImagePreview(null);
    setCaptureMode(null);
    setHasExifGPS(null);
    setErrorMsg(null);
    setCameraError(null);
    setViewState('picker');
  };



  return (
    <div className="glass-panel p-6 rounded-3xl w-full h-full flex flex-col items-center justify-center text-center relative overflow-hidden">
      {/* Hidden elements */}
      <canvas ref={canvasRef} className="hidden" />
      <input type="file" accept="image/*" ref={galleryInputRef} className="hidden" onChange={handleGalleryUpload} />

      <AnimatePresence mode="wait">
        {/* ─── PICKER VIEW ─── */}
        {viewState === 'picker' && (
          <motion.div key="picker" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center">
            <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(255,255,255,0.3)]">
              <Camera className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-2xl font-bold mb-2 tracking-tight">Active Plant Verification</h3>
            <p className="text-zinc-400 mb-8 max-w-sm">
              Take a clear photo of the planted tree. Aether AI will analyze its species and compute your CO₂ credit.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <button onClick={startCamera}
                className="glass-btn-primary py-4 px-8 rounded-full flex items-center gap-2 transform hover:-translate-y-1">
                <Video className="w-5 h-5" /> Open Camera
              </button>
              <button onClick={() => galleryInputRef.current?.click()}
                className="glass-btn py-4 px-8 rounded-full flex items-center gap-2 transform hover:-translate-y-1">
                <ImagePlus className="w-5 h-5" /> Upload Gallery
              </button>
            </div>
            {errorMsg && <p className="text-white text-sm mt-4">{errorMsg}</p>}
          </motion.div>
        )}

        {/* ─── CAMERA VIEW ─── */}
        {viewState === 'camera' && (
          <motion.div key="camera" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            className="w-full max-w-lg flex flex-col items-center">

            {cameraError ? (
              <div className="bg-white/10 border border-white/20 rounded-xl p-6 text-center w-full">
                <AlertTriangle className="w-10 h-10 text-white mx-auto mb-3" />
                <p className="text-white text-sm mb-4">{cameraError}</p>
                <div className="flex gap-3 justify-center">
                  <button onClick={resetState} className="glass-btn px-5 py-2 rounded-lg text-sm">
                    Go Back
                  </button>
                  <button onClick={() => galleryInputRef.current?.click()} className="glass-btn-primary px-5 py-2 rounded-lg text-sm">
                    Upload Instead
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Live Camera Feed */}
                <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-black border border-white/20 shadow-[0_0_30px_rgba(255,255,255,0.1)]">
                  <video ref={videoRef} autoPlay playsInline muted
                    className="w-full h-full object-cover" />

                  {!cameraReady && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                      <div className="flex flex-col items-center">
                        <Loader2 className="w-8 h-8 text-white animate-spin mb-2" />
                        <p className="text-zinc-400 text-sm">Initializing camera...</p>
                      </div>
                    </div>
                  )}

                  {/* Scanning overlay */}
                  {cameraReady && (
                    <>
                      {/* Corner guides */}
                      <div className="absolute top-6 left-6 w-12 h-12 border-t-2 border-l-2 border-emerald-400/60 rounded-tl-lg" />
                      <div className="absolute top-6 right-6 w-12 h-12 border-t-2 border-r-2 border-emerald-400/60 rounded-tr-lg" />
                      <div className="absolute bottom-16 left-6 w-12 h-12 border-b-2 border-l-2 border-emerald-400/60 rounded-bl-lg" />
                      <div className="absolute bottom-16 right-6 w-12 h-12 border-b-2 border-r-2 border-emerald-400/60 rounded-br-lg" />

                      {/* Scanning line animation */}
                      <div className="absolute left-6 right-6 h-[2px] bg-gradient-to-r from-transparent via-emerald-400/80 to-transparent animate-pulse"
                        style={{ top: '50%' }} />

                      {/* GPS badge */}
                      <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-full text-[10px] font-mono text-white flex items-center gap-1.5 border border-white/20">
                        <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                        LIVE {location ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : 'GPS...'}
                      </div>
                    </>
                  )}
                </div>

                {/* Camera Controls */}
                <div className="flex items-center gap-6 mt-5">
                  <button onClick={resetState}
                    className="glass-btn w-12 h-12 rounded-full flex items-center justify-center">
                    <X className="w-5 h-5 text-white" />
                  </button>

                  <button onClick={captureFrame} disabled={!cameraReady}
                    className="w-20 h-20 rounded-full bg-white flex items-center justify-center disabled:opacity-30 transition-all hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(255,255,255,0.3)] group">
                    <Circle className="w-16 h-16 text-zinc-300 group-hover:text-white transition-colors" fill="currentColor" />
                  </button>

                  <div className="w-12 h-12" /> {/* Spacer for symmetry */}
                </div>
              </>
            )}
          </motion.div>
        )}

        {/* ─── PREVIEW VIEW ─── */}
        {viewState === 'preview' && imagePreview && (
          <motion.div key="preview" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}
            className="w-full max-w-md bg-black/40 rounded-2xl overflow-hidden border border-emerald-500/20 flex flex-col">
            <div className="relative h-64 w-full bg-zinc-900 border-b border-white/5">
              <img src={imagePreview} className="object-cover w-full h-full" alt="Captured proof" />
              <button onClick={resetState}
                className="absolute top-3 right-3 bg-black/60 text-white p-1.5 rounded-full hover:bg-red-500/80 transition-colors backdrop-blur-md">
                <X className="w-4 h-4" />
              </button>
              <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 text-[10px] font-medium text-zinc-300">
                {captureMode === 'camera' ? '📸 Camera Capture' : '🖼️ Gallery Upload'}
              </div>
            </div>

            <div className="p-5 flex flex-col items-center gap-3">
              <div className="flex items-center gap-2">
                {loadingLoc ? (
                  <span className="text-zinc-400 text-sm flex items-center gap-2">
                    <Loader2 className="w-3 h-3 animate-spin" /> Acquiring GPS...
                  </span>
                ) : location ? (
                  <span className="bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full text-xs flex items-center gap-1 border border-emerald-500/20">
                    <MapPin className="w-3 h-3" /> {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                  </span>
                ) : null}
              </div>

              {captureMode === 'gallery' && hasExifGPS === false && (
                <div className="w-full bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-3 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                  <p className="text-amber-300 text-xs text-left">
                    No GPS data in image EXIF. Use <strong>Camera</strong> for verified coordinates.
                  </p>
                </div>
              )}

              <button onClick={submitProof} disabled={!canSubmit}
                className="glass-btn-primary w-full py-3.5 px-6 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                <UploadCloud className="w-5 h-5" /> Analyze Biomass & Mint
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
