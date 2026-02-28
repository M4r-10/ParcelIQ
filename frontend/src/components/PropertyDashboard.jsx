/**
 * TitleGuard AI — Property Dashboard Container
 * Manages the dashboard layout: map area + sidebar.
 * Rewritten with Tailwind CSS to match the landing page design.
 */
import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import SpatialVisualizer from './SpatialVisualizer';
import LayerTogglePanel from './LayerTogglePanel';
import RiskScoreCard from './RiskScoreCard';
import AISummaryBox from './AISummaryBox';

function PropertyDashboard({ analysisResult, isLoading, address, onBack }) {
    const [activeLayers, setActiveLayers] = useState({
        floodZone: false,
        easement: false,
        buildableArea: false,
        encumberedArea: false,
        buildingFootprint: false,
    });

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
                {/* Map Area */}
                <div className="relative flex-1 bg-background-subtle">
                    <SpatialVisualizer
                        analysisResult={analysisResult}
                        activeLayers={activeLayers}
                    />
                    <LayerTogglePanel
                        activeLayers={activeLayers}
                        onToggle={handleToggle}
                    />
                </div>

                {/* Sidebar */}
                <motion.div
                    initial={{ x: 40, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ duration: 0.4, delay: 0.15, ease: 'easeOut' }}
                    className="w-[400px] overflow-y-auto overflow-x-hidden border-l border-white/5 bg-background max-lg:w-[340px] max-md:max-h-[50vh] max-md:w-full max-md:border-l-0 max-md:border-t max-md:border-white/5"
                >
                    <RiskScoreCard
                        riskData={analysisResult?.risk}
                        coverageData={analysisResult?.coverage}
                        isLoading={isLoading}
                    />
                    <AISummaryBox
                        summaryData={analysisResult?.ai_summary}
                        isLoading={isLoading}
                    />
                </motion.div>
            </div>
        </div>
    );
}

export default PropertyDashboard;
