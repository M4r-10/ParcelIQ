/**
 * Hero parcel preview: map-style background with a property area being scanned.
 * Resembles a dark 3D map (buildings, roads) and a cyan parcel bounding box on the map.
 */
import React from 'react';

export default function HeroParcelMapPreview() {
    return (
        <div className="absolute inset-0 overflow-hidden rounded-lg bg-[#0d1117]">
            {/* Base: dark map-like gradient (Mapbox-style) */}
            <div
                className="absolute inset-0 opacity-95"
                style={{
                    background: 'radial-gradient(ellipse 85% 85% at 50% 45%, rgba(30,41,59,0.4), transparent 55%), linear-gradient(180deg, #1e293b 0%, #0f172a 45%, #020617 100%)',
                }}
            />
            {/* Road network: thin grey lines */}
            <svg className="absolute inset-0 h-full w-full opacity-50" viewBox="0 0 160 160" fill="none" stroke="rgba(148,163,184,0.4)" strokeWidth="0.35">
                <line x1="0" y1="40" x2="160" y2="40" />
                <line x1="0" y1="80" x2="160" y2="80" />
                <line x1="0" y1="120" x2="160" y2="120" />
                <line x1="40" y1="0" x2="40" y2="160" />
                <line x1="80" y1="0" x2="80" y2="160" />
                <line x1="120" y1="0" x2="120" y2="160" />
                <line x1="0" y1="25" x2="95" y2="25" />
                <line x1="105" y1="25" x2="160" y2="25" />
                <line x1="0" y1="55" x2="75" y2="55" />
                <line x1="85" y1="55" x2="160" y2="55" />
                <line x1="25" y1="0" x2="25" y2="75" />
                <line x1="25" y1="85" x2="25" y2="160" />
                <line x1="55" y1="0" x2="55" y2="65" />
                <line x1="55" y1="95" x2="55" y2="160" />
                <line x1="105" y1="0" x2="105" y2="70" />
                <line x1="105" y1="90" x2="105" y2="160" />
                <line x1="135" y1="0" x2="135" y2="75" />
                <line x1="135" y1="85" x2="135" y2="160" />
            </svg>
            {/* Building blocks: 3D-style grey blocks */}
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 160 160" fill="none">
                <rect x="6" y="42" width="24" height="30" fill="#334155" opacity="0.9" />
                <rect x="34" y="50" width="20" height="24" fill="#475569" opacity="0.85" />
                <rect x="58" y="45" width="22" height="28" fill="#334155" opacity="0.9" />
                <rect x="84" y="52" width="26" height="22" fill="#475569" opacity="0.85" />
                <rect x="112" y="40" width="22" height="34" fill="#334155" opacity="0.9" />
                <rect x="132" y="48" width="20" height="26" fill="#475569" opacity="0.85" />
                <rect x="10" y="86" width="28" height="26" fill="#475569" opacity="0.85" />
                <rect x="42" y="90" width="24" height="24" fill="#334155" opacity="0.9" />
                <rect x="70" y="82" width="22" height="30" fill="#475569" opacity="0.85" />
                <rect x="94" y="86" width="26" height="28" fill="#334155" opacity="0.9" />
                <rect x="120" y="88" width="24" height="26" fill="#475569" opacity="0.85" />
                <rect x="6" y="116" width="30" height="30" fill="#334155" opacity="0.85" />
                <rect x="40" y="118" width="26" height="26" fill="#475569" opacity="0.9" />
                <rect x="70" y="116" width="28" height="28" fill="#334155" opacity="0.85" />
                <rect x="100" y="116" width="24" height="28" fill="#475569" opacity="0.9" />
                <rect x="126" y="118" width="28" height="26" fill="#334155" opacity="0.85" />
            </svg>
            {/* Parcel area on the map — the region being scanned (cyan bounding box) */}
            <div
                className="absolute rounded border-2 border-cyan-400 bg-cyan-400/20 shadow-[0_0_20px_rgba(34,211,238,0.35)]"
                style={{
                    left: '50%',
                    top: '50%',
                    width: '44%',
                    height: '40%',
                    transform: 'translate(-50%, -50%)',
                }}
            />
        </div>
    );
}
