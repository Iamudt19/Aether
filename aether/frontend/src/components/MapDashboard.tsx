'use client';

import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ExternalLink, Compass, ShieldCheck } from 'lucide-react';

// Custom tree pin icon using custom SVG to match Aether's brand colors
const createCustomIcon = (color: string) => {
  return new L.Icon({
    iconUrl: `data:image/svg+xml;utf8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" width="32" height="32">
        <path d="M12 2C7.58 2 4 5.58 4 10c0 4.5 8 12 8 12s8-7.5 8-12c0-4.42-3.58-8-8-8zm0 11c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z"/>
      </svg>
    `)}`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
};

const defaultIcon = createCustomIcon('#10b981'); // Emerald color

// Mock data of high-fidelity verified trees to showcase global GIS telemetry
const mockTrees = [
  {
    id: 1,
    species: 'Azadirachta indica (Neem)',
    lat: 12.9716,
    lng: 77.5946,
    credits: 82,
    location: 'Bengaluru, India',
    txHash: '0x3efc...a891',
    imageUrl: 'https://images.unsplash.com/photo-1594904351111-a072f80b1a71?auto=format&fit=crop&q=80&w=400',
  },
  {
    id: 2,
    species: 'Ficus religiosa (Sacred Fig)',
    lat: 30.0668,
    lng: 79.0193,
    credits: 145,
    location: 'Dehradun, India',
    txHash: '0x9d3a...f721',
    imageUrl: 'https://images.unsplash.com/photo-1502082553048-f009c37129b9?auto=format&fit=crop&q=80&w=400',
  },
  {
    id: 3,
    species: 'Mangifera indica (Mango Tree)',
    lat: 19.0760,
    lng: 72.8777,
    credits: 95,
    location: 'Mumbai, India',
    txHash: '0x6e24...439a',
    imageUrl: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&q=80&w=400',
  },
  {
    id: 4,
    species: 'Cedrus deodara (Deodar Cedar)',
    lat: 32.2190,
    lng: 76.3234,
    credits: 210,
    location: 'Dharamshala, India',
    txHash: '0x88f1...b902',
    imageUrl: 'https://images.unsplash.com/photo-1473448912268-2022ce9509d8?auto=format&fit=crop&q=80&w=400',
  }
];

export default function MapDashboard() {
  return (
    <div className="glass-panel p-6 rounded-2xl w-full flex flex-col h-[500px] border border-white/5 relative overflow-hidden">
      {/* Header telemetry info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 z-10">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Compass className="text-emerald-500 animate-spin-slow w-5 h-5" /> Global GIS Telemetry
          </h2>
          <p className="text-xs text-zinc-400 mt-1">Real-time geospatial mapping of verified active carbon sequestration offsets.</p>
        </div>
        <div className="flex items-center gap-4 bg-black/40 px-4 py-2 rounded-xl border border-white/5">
          <div className="flex flex-col">
            <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Verified Nodes</span>
            <span className="text-sm font-semibold font-mono text-emerald-400">4 Active</span>
          </div>
        </div>
      </div>

      {/* Leaflet Map container */}
      <div className="flex-1 rounded-xl overflow-hidden border border-white/5 relative z-0">
        <MapContainer
          center={[22.5937, 78.9629]} // Geographically centered on India
          zoom={5}
          style={{ height: '100%', width: '100%', background: '#09090b' }}
          className="dark-map"
        >
          {/* Custom dark-mode Mapbox-style CartoDB tiles */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          {mockTrees.map((tree) => (
            <Marker key={tree.id} position={[tree.lat, tree.lng]} icon={defaultIcon}>
              <Popup className="custom-leaflet-popup">
                <div className="w-64 bg-zinc-950 text-white rounded-xl overflow-hidden shadow-2xl border border-white/10 flex flex-col gap-2 font-sans">
                  <div className="h-28 w-full overflow-hidden relative">
                    <img src={tree.imageUrl} alt={tree.species} className="w-full h-full object-cover" />
                    <div className="absolute top-2 right-2 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-lg">
                      <ShieldCheck className="w-3 h-3" /> Verified
                    </div>
                  </div>
                  <div className="p-3 flex flex-col gap-1.5 bg-zinc-950">
                    <h3 className="font-bold text-sm text-zinc-100 truncate">{tree.species}</h3>
                    <p className="text-xs text-zinc-400">{tree.location}</p>
                    <div className="flex justify-between items-center bg-white/5 rounded-lg p-2 mt-1">
                      <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Offset Value</span>
                      <span className="text-sm font-bold font-mono text-emerald-400">{tree.credits} kg CO₂</span>
                    </div>
                    <a
                      href="https://sepolia.etherscan.io"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-emerald-400 hover:text-emerald-300 font-medium underline flex items-center justify-center gap-1 mt-1 hover:no-underline"
                    >
                      View Sepolia Transaction <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
