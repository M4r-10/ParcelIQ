/**
 * Hero parcel preview: map image with a property area being scanned.
 * Shows the provided 3D map with a cyan parcel bounding box overlay.
 */
import React from 'react';

export default function HeroParcelMapPreview() {
    return (
        <div className="absolute inset-0 overflow-hidden rounded-lg bg-[#0d1117]">
            {/* Map image being analyzed */}
            <img
                src="/parcel-preview-map.png"
                alt="Spatial parcel map being analyzed"
                className="absolute inset-0 h-full w-full object-cover object-center"
            />
            {/* Parcel area on the map — the region being scanned (cyan bounding box), large to fill space */}
            <div
                className="absolute rounded border-2 border-cyan-400 bg-cyan-400/20 shadow-[0_0_20px_rgba(34,211,238,0.35)]"
                style={{
                    left: '50%',
                    top: '50%',
                    width: '72%',
                    height: '68%',
                    transform: 'translate(-50%, -50%)',
                }}
            />
        </div>
    );
}
