/**
 * TitleGuard AI — Property Dashboard Container
 * Manages the dashboard layout: map area + sidebar.
 * Rewritten with Tailwind CSS to match the landing page design.
 */
import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Download } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import SpatialVisualizer from './SpatialVisualizer';
import LayerTogglePanel from './LayerTogglePanel';
import RiskScoreCard from './RiskScoreCard';
import AISummaryBox from './AISummaryBox';
import DataDashboard from './DataDashboard';
import PropertyAssistant from './PropertyAssistant';
import PDFReportTemplate from './PDFReportTemplate';

function PropertyDashboard({ analysisResult, isLoading, address, onBack, initialLocation }) {
    const [viewMode, setViewMode] = useState('map'); // 'map' or 'dashboard'
    const [isAgentMode, setIsAgentMode] = useState(false);
    const [activeLayers, setActiveLayers] = useState({
        floodZone: false,
        wildfireZone: false,
        earthquakeZone: false,
    });

    const handleToggle = useCallback((layerKey) => {
        setActiveLayers((prev) => ({ ...prev, [layerKey]: !prev[layerKey] }));
    }, []);

    const handleExportReport = useCallback(async () => {
        if (!analysisResult) return;
        
        try {
            await new Promise(r => setTimeout(r, 100)); // wait for layout

            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            
            for (let i = 1; i <= 7; i++) {
                const pageEl = document.getElementById(`pdf-page-${i}`);
                if (!pageEl) break;
                
                const canvas = await html2canvas(pageEl, { 
                    scale: 2, 
                    useCORS: true, 
                    backgroundColor: i === 2 ? '#f8fafc' : '#ffffff',
                    logging: false
                });
                const imgData = canvas.toDataURL('image/jpeg', 0.95);
                
                if (i > 1) pdf.addPage();
                pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
            }
            
            pdf.save(`ParcelIQ_Risk_Report_${address.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`);
            
        } catch (error) {
            console.error("Failed to generate PDF Export", error);
            alert("Sorry, we encountered an error exporting the PDF.");
        }
    }, [analysisResult, address]);

    return (
        <div className="flex min-h-[calc(100vh-5rem)] flex-col">
            {/* Toolbar */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="flex items-center justify-between border-b border-white/5 bg-background-subtle px-6 py-3"
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
                <div className="flex items-center gap-3">
                    {analysisResult && !isLoading && (
                        <div className="mr-2 flex rounded-md border border-white/10 bg-black/20 p-1">
                            <button
                                onClick={() => setViewMode('map')}
                                className={`rounded px-3 py-1 text-xs font-semibold transition ${
                                    viewMode === 'map' ? 'bg-primary text-black shadow-glow' : 'text-text-secondary hover:text-white'
                                }`}
                            >
                                Spatial Map
                            </button>
                            <button
                                onClick={() => setViewMode('dashboard')}
                                className={`rounded px-3 py-1 text-xs font-semibold transition ${
                                    viewMode === 'dashboard' ? 'bg-primary text-black shadow-glow' : 'text-text-secondary hover:text-white'
                                }`}
                            >
                                Data Dashboard
                            </button>
                        </div>
                    )}
                    {analysisResult && !isLoading && (
                        <button
                            onClick={handleExportReport}
                            className="flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs text-primary transition hover:border-primary/40 hover:bg-primary/20"
                            title="Export Visual PDF Report"
                        >
                            <Download size={14} />
                            <span>Export Report</span>
                        </button>
                    )}
                    <button
                        onClick={onBack}
                        className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-text-secondary transition hover:border-white/20 hover:text-text-primary"
                    >
                        ← New Search
                    </button>
                </div>
            </motion.div>

            {/* Main */}
            {viewMode === 'dashboard' && analysisResult ? (
                <div className="flex-1 overflow-y-auto" id="pdf-export-content" style={{ backgroundColor: '#0f172a' }}>
                    <DataDashboard analysisResult={analysisResult} address={address} isAgentMode={isAgentMode} setIsAgentMode={setIsAgentMode} />
                </div>
            ) : (
                <div className="flex flex-1 overflow-hidden max-md:flex-col">
                {/* Left Column Area */}
                <div className="flex flex-1 flex-col overflow-hidden bg-background-subtle">
                    {/* Map Area */}
                    <div className="relative flex-1 bg-background-subtle min-h-[50%]">
                        <SpatialVisualizer
                            analysisResult={analysisResult}
                            activeLayers={activeLayers}
                            initialLocation={initialLocation}
                            address={address}
                        />
                        <LayerTogglePanel
                            activeLayers={activeLayers}
                            onToggle={handleToggle}
                        />
                    </div>
                    {/* AI Summary Box under Map */}
                    <div className="max-h-[50%] overflow-y-auto border-t border-white/5 bg-background">
                        <AISummaryBox
                            summaryData={analysisResult?.ai_summary}
                            isLoading={isLoading}
                        />
                    </div>
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
                </motion.div>
            </div>
            )}
            
            {/* Virtual Assistant Floating Widget */}
            {analysisResult && <PropertyAssistant analysisResult={analysisResult} address={address} isAgentMode={isAgentMode} />}
            
            {/* Hidden PDF Export Template */}
            <PDFReportTemplate analysisResult={analysisResult} address={address} />
        </div>
    );
}

export default PropertyDashboard;
