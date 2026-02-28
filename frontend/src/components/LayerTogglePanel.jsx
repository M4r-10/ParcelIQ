/**
 * TitleGuard AI — Layer Toggle Panel
 * Sleek toggle switches with color indicators over the map.
 * Rewritten with Tailwind CSS.
 */
import React from 'react';
import { motion } from 'framer-motion';

const LAYERS = [
    { key: 'floodZone', label: 'Flood Zone', color: '#3B82F6' },
    { key: 'wildfireZone', label: 'Wildfire Zone', color: '#F97316' },
    { key: 'earthquakeZone', label: 'Earthquake Zone', color: '#A855F7' },
    { key: 'easement', label: 'Easement Area', color: '#EF4444' },
    { key: 'buildableArea', label: 'Buildable Area', color: '#22C55E' },
    { key: 'encumberedArea', label: 'Encumbered Area', color: '#991B1B' },
    { key: 'buildingFootprint', label: 'Building Footprint', color: '#FFFFFF' },
];

function LayerTogglePanel({ activeLayers, onToggle }) {
    return (
        <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="absolute left-4 top-4 z-10 flex min-w-[200px] flex-col gap-1"
        >
            <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
                Layers
            </div>
            {LAYERS.map((layer) => {
                const isActive = activeLayers[layer.key];
                return (
                    <div
                        key={layer.key}
                        onClick={() => onToggle(layer.key)}
                        role="switch"
                        aria-checked={isActive}
                        tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && onToggle(layer.key)}
                        className={`flex cursor-pointer select-none items-center gap-3 rounded-lg border px-4 py-2.5 backdrop-blur-xl transition ${isActive
                                ? 'border-white/15 bg-white/[0.07]'
                                : 'border-white/5 bg-black/80 hover:border-white/10 hover:bg-black/90'
                            }`}
                    >
                        {/* Toggle track */}
                        <div
                            className={`relative h-[18px] w-8 shrink-0 rounded-full transition-colors ${isActive ? 'bg-text-secondary' : 'bg-white/10'
                                }`}
                        >
                            <div
                                className={`absolute top-[2px] h-[14px] w-[14px] rounded-full transition-all ${isActive
                                        ? 'left-[16px] bg-white'
                                        : 'left-[2px] bg-white/30'
                                    }`}
                            />
                        </div>
                        {/* Color dot */}
                        <span
                            className="h-2.5 w-2.5 shrink-0 rounded-sm"
                            style={{ background: layer.color }}
                        />
                        {/* Label */}
                        <span
                            className={`text-sm font-medium transition-colors ${isActive ? 'text-text-primary' : 'text-text-secondary'
                                }`}
                        >
                            {layer.label}
                        </span>
                    </div>
                );
            })}
        </motion.div>
    );
}

export default LayerTogglePanel;
