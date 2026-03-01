/**
 * TitleGuard AI — Property Dashboard Container
 * Manages the dashboard layout: map area + sidebar.
 * Rewritten with Tailwind CSS to match the landing page design.
 */
import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Maximize2, X } from 'lucide-react';
import SpatialVisualizer from './SpatialVisualizer';
import LayerTogglePanel from './LayerTogglePanel';
import RiskScoreCard from './RiskScoreCard';
import AISummaryBox from './AISummaryBox';

function PropertyDashboard({ analysisResult, isLoading, address, onBack, initialLocation }) {
    const [activeLayers, setActiveLayers] = useState({
        floodZone: false,
        wildfireZone: false,
        earthquakeZone: false,
        easement: false,
        buildableArea: false,
        encumberedArea: false,
        buildingFootprint: false,
    });
    const [isMapExpanded, setIsMapExpanded] = useState(false);

    const handleToggle = useCallback((layerKey) => {
        setActiveLayers((prev) => ({ ...prev, [layerKey]: !prev[layerKey] }));
    }, []);

    return (
        <div className="flex min-h-[calc(100vh-6rem)] flex-col">
            {/* Toolbar — section right below header */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="flex shrink-0 items-center justify-between gap-4 border-b border-white/5 bg-background-subtle px-6 py-4"
            >
                <div className="flex items-center gap-3">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-secondary">
                        Property
                    </span>
                    <span className="text-sm font-medium text-text-primary">{address}</span>

                    {isLoading && (
                        <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-[10px] font-medium text-primary">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                            Analyzing…
                        </span>
                    )}

                    {analysisResult && !isLoading && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-risk-green/10 px-2 py-0.5 text-[10px] font-medium text-risk-green">
                            ✓ Complete
                        </span>
                    )}
                </div>
                <button
                    onClick={onBack}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-text-secondary transition hover:border-white/20 hover:text-text-primary"
                >
                    ← New Search
                </button>
            </motion.div>

            {/* Main: map + sidebar */}
            <div className="flex min-h-0 flex-1 overflow-hidden max-md:flex-col">
                {/* Map Area — can expand to fullscreen */}
                <AnimatePresence mode="wait">
                    {isMapExpanded ? (
                        <motion.div
                            key="expanded"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            className="fixed inset-0 z-50 flex flex-col bg-background-subtle"
                        >
                            <div className="relative flex-1 min-h-0">
                                <SpatialVisualizer
                                    analysisResult={analysisResult}
                                    activeLayers={activeLayers}
                                    resizeTrigger={isMapExpanded}
                                />
                                <button
                                    type="button"
                                    onClick={() => setIsMapExpanded(false)}
                                    className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-900/60 text-slate-300 backdrop-blur-md transition hover:bg-slate-800/80 hover:text-white"
                                    aria-label="Exit fullscreen"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="inline"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            className="relative flex-1 bg-background-subtle"
                        >
                            <SpatialVisualizer
                                analysisResult={analysisResult}
                                activeLayers={activeLayers}
                                resizeTrigger={isMapExpanded}
                            />
                            <LayerTogglePanel
                                activeLayers={activeLayers}
                                onToggle={handleToggle}
                            />
                            <button
                                type="button"
                                onClick={() => setIsMapExpanded(true)}
                                className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-900/60 text-slate-300 backdrop-blur-md transition hover:bg-slate-800/80 hover:text-white"
                                aria-label="Expand map"
                            >
                                <Maximize2 className="h-4 w-4" />
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Sidebar — fills full height, 50/50 split for Risk + AI */}
                <motion.div
                    initial={{ x: 40, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ duration: 0.4, delay: 0.15, ease: 'easeOut' }}
                    className="flex h-full min-h-0 w-[400px] shrink-0 flex-col overflow-hidden border-l border-white/5 bg-background-subtle max-lg:w-[340px] max-md:max-h-[50vh] max-md:w-full max-md:border-l-0 max-md:border-t max-md:border-white/5"
                >
                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-b border-slate-800">
                        <RiskScoreCard
                            riskData={analysisResult?.risk}
                            coverageData={analysisResult?.coverage}
                            isLoading={isLoading}
                        />
                    </div>
                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                        <AISummaryBox
                            summaryData={analysisResult?.ai_summary}
                            isLoading={isLoading}
                        />
                    </div>
                </motion.div>
            </div>
        </div>
    );
}

export default PropertyDashboard;
