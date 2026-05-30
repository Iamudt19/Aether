'use client';

import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ExternalLink, Compass, ShieldCheck, Loader2, TreePine } from 'lucide-react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || '';

const createCustomIcon = (color: string) =>
  new L.Icon({
    iconUrl: `data:image/svg+xml;utf8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" width="32" height="32">
        <path d="M12 2C7.58 2 4 5.58 4 10c0 4.5 8 12 8 12s8-7.5 8-12c0-4.42-3.58-8-8-8zm0 11c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z"/>
      </svg>
    `)}`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });

const defaultIcon = createCustomIcon('#10b981');

interface TreeNode {
  id: string;
  species: string;
  lat: number;
  lng: number;
  credits: number;
  seller_address: string;
  tx_hash?: string;
  image_url?: string;
  created_at: string;
}

export default function MapDashboard() {
  const [trees, setTrees] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchListings = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/listings`);
        const json = await res.json();
        if (json.success && json.listings.length > 0) {
          const valid = json.listings.filter((l: any) => l.lat && l.lng);
          setTrees(valid);
        } else {
          setTrees([]);
        }
      } catch {
        setTrees([]);
      } finally {
        setLoading(false);
      }
    };

    fetchListings();
    // Poll every 30 seconds for real-time updates
    const interval = setInterval(fetchListings, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="glass-panel p-6 rounded-2xl w-full flex flex-col h-[500px] border border-white/5 relative overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 z-10">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Compass className="text-emerald-500 animate-spin-slow w-5 h-5" /> Live GIS Telemetry
          </h2>
          <p className="text-xs text-zinc-400 mt-1">Real-time map of verified on-chain carbon sequestration nodes.</p>
        </div>
        <div className="flex items-center gap-3 bg-black/40 px-4 py-2 rounded-xl border border-white/5">
          <div className="flex flex-col">
            <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Verified Nodes</span>
            <span className="text-sm font-semibold font-mono text-emerald-400">
              {loading ? '...' : `${trees.length} Active`}
            </span>
          </div>
          {!loading && trees.length > 0 && (
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
          )}
        </div>
      </div>

      <div className="flex-1 rounded-xl overflow-hidden border border-white/5 relative z-0">
        {loading ? (
          <div className="w-full h-full flex items-center justify-center bg-zinc-950">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
          </div>
        ) : trees.length === 0 ? (
          <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-950 gap-3">
            <TreePine className="w-10 h-10 text-zinc-700" />
            <p className="text-zinc-400 font-semibold text-sm">No verified trees on map yet</p>
            <p className="text-zinc-600 text-xs">Upload a geotagged tree photo above to appear on the live map.</p>
          </div>
        ) : (
          <MapContainer
            center={[22.5937, 78.9629]}
            zoom={5}
            style={{ height: '100%', width: '100%', background: '#09090b' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />
            {trees.map((tree) => (
              <Marker key={tree.id} position={[tree.lat, tree.lng]} icon={defaultIcon}>
                <Popup>
                  <div className="w-60 bg-zinc-950 text-white rounded-xl overflow-hidden shadow-2xl border border-white/10 flex flex-col font-sans">
                    {tree.image_url && (
                      <div className="h-28 w-full overflow-hidden relative bg-zinc-900">
                        <img
                          src={tree.image_url.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/')}
                          alt={tree.species}
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                        <div className="absolute top-2 right-2 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-lg">
                          <ShieldCheck className="w-3 h-3" /> Verified
                        </div>
                      </div>
                    )}
                    <div className="p-3 flex flex-col gap-1.5 bg-zinc-950">
                      <h3 className="font-bold text-sm text-zinc-100 truncate">{tree.species}</h3>
                      <p className="text-[10px] text-zinc-400 font-mono truncate">
                        {tree.seller_address.slice(0, 10)}...{tree.seller_address.slice(-4)}
                      </p>
                      <div className="flex justify-between items-center bg-white/5 rounded-lg p-2 mt-1">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider">CO₂ Offset</span>
                        <span className="text-sm font-bold font-mono text-emerald-400">{tree.credits} kg</span>
                      </div>
                      <p className="text-[9px] text-zinc-600">{new Date(tree.created_at).toLocaleDateString('en-IN')}</p>
                      {tree.tx_hash && (
                        <a
                          href={`https://sepolia.etherscan.io/tx/${tree.tx_hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 mt-1"
                        >
                          View on Etherscan <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        )}
      </div>
    </div>
  );
}
