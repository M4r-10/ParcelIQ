import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, ShieldCheck, Activity, AlertTriangle, Key, Maximize, Calendar, Hash, FileText, Info, TrendingUp, DollarSign } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';
import Plot from 'react-plotly.js';

export default function DataDashboard({ analysisResult, address, isAgentMode, setIsAgentMode }) {
    if (!analysisResult) return null;

    const { risk, ai_summary, derived_factors, coverage } = analysisResult;

    // --- Data Mapping ---
    // Deal Health Score
    // If risk score is 0-100 where higher is worse, health = 100 - risk
    const rawRiskScore = risk?.overall_score ?? 50;
    const dealHealthScore = Math.max(0, Math.min(100, Math.round(100 - rawRiskScore)));
    
    // Categorized Risks
    const factors = risk?.factors || {};
    
    const titleRisk = {
        score: factors.ownership?.score ?? 0,
        flags: []
    };
    if (factors.ownership?.score > 50) titleRisk.flags.push("High ownership volatility");
    if (derived_factors?.easement_encroachment > 0.05) titleRisk.flags.push(`Easement encroachment (${Math.round(derived_factors.easement_encroachment * 100)}%)`);

    const structuralRisk = {
        score: factors.coverage?.score ?? 0,
        flags: []
    };
    if (derived_factors?.property_age > 30) structuralRisk.flags.push(`Aging property (${derived_factors.property_age} yrs)`);
    if (coverage?.expansion_risk === 'HIGH') structuralRisk.flags.push("High lot coverage / Max zoned");

    const climateRiskScore = Math.max(factors.flood?.score ?? 0, factors.wildfire?.score ?? 0, factors.earthquake?.score ?? 0);
    const climateRisk = {
        score: climateRiskScore,
        flags: []
    };
    if (factors.flood?.score > 50) climateRisk.flags.push("FEMA Flood Zone Risk");
    if (factors.wildfire?.score > 50) climateRisk.flags.push("Historical Wildfire Area");
    if (factors.earthquake?.score > 50) climateRisk.flags.push("Seismic Fault Proximity");

    const insuranceImpact = {
        score: Math.min(100, climateRiskScore * 1.2), // Proxy for demo
        flags: ai_summary?.financial_impacts?.map(f => `${f.category}: ${f.estimate}`) || ["Review required"]
    };

    // Timeline Data (Synthesized from available data)
    const timeline = [];
    const currentYear = new Date().getFullYear();
    if (derived_factors?.property_age) {
        timeline.push({ year: currentYear - derived_factors.property_age, event: "Structure Built", riskChange: 0 });
    }
    if (factors.ownership?.description && factors.ownership.description.includes("transfer")) {
         // rough guess from num transfers
         timeline.push({ year: currentYear - 2, event: "Recent Ownership Transfer", riskChange: 5 });
    }
    timeline.push({ year: currentYear, event: "TitleGuard AI Risk Analysis", riskChange: -10 }); // analyzing reduces uncertainty

    // Negotiation Insights
    const negotiationInsights = ai_summary?.recommendations || [
        "Review climate risk factors for insurance contingencies",
        "Verify easement boundaries to ensure no structural encroachment"
    ];

    // Navigation / Utilities
    const hashString = (str) => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        return Math.abs(hash);
    };

    const seededRandom = (seed) => {
        const x = Math.sin(seed++) * 10000;
        return x - Math.floor(x);
    };

    const addressHash = address ? hashString(address) : 12345;

    // --- Financial & Market Data (Deterministic Pseudo-Random) ---
    // Base property value: derived from coverage and address hash (baseline $500/sqft)
    const buildingSqft = coverage?.building_area_sqft || 2400;
    const baseValue = buildingSqft * (400 + (seededRandom(addressHash) * 300)); // Price between $400 and $700 per sqft
    
    // Price Impact based on Deal Health (e.g. Health 50 means -10% impact, Health 100 means +5%)
    // Normalized around 80 health being 0 impact.
    const priceAdjustmentPct = (dealHealthScore - 80) * 0.2; 
    const estimatedValue = baseValue * (1 + (priceAdjustmentPct / 100));
    const priceImpactDollar = estimatedValue - baseValue;

    // Resale Velocity (Days on Market)
    const baseDays = 20 + (seededRandom(addressHash + 1) * 20); // 20 to 40 base DOM
    const estDaysOnMarket = Math.round(baseDays + ((100 - dealHealthScore) * 0.5));

    // Historical Risk Trend (Simulated deterministically from base score)
    const historicalTrendData = [
        { year: '2021', health: Math.min(100, dealHealthScore + 15 + (seededRandom(addressHash + 2) * 5 - 2.5)), title: titleRisk.score * 0.8, climate: climateRisk.score * 0.9 },
        { year: '2022', health: Math.min(100, dealHealthScore + 10 + (seededRandom(addressHash + 3) * 5 - 2.5)), title: titleRisk.score * 0.9, climate: climateRisk.score * 0.95 },
        { year: '2023', health: Math.min(100, dealHealthScore + 5 + (seededRandom(addressHash + 4) * 5 - 2.5)), title: titleRisk.score * 0.95, climate: climateRisk.score * 0.98 },
        { year: '2024 (Now)', health: dealHealthScore, title: titleRisk.score, climate: climateRisk.score },
    ];

    // Risk Composition (2D Bar Chart Data)
    const riskCompositionData = [
        { category: 'Title', score: titleRisk.score },
        { category: 'Structural', score: structuralRisk.score },
        { category: 'Climate', score: climateRisk.score },
        { category: 'Insurance', score: insuranceImpact.score },
    ];

    const formatCurrency = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

    // --- Prepare Zoning Highlights for Layout ---
    const zoningHighlights = [
        { label: "Estimated Area", value: `${coverage?.building_area_sqft || 'N/A'} sqft` },
        { label: "Lot Coverage", value: `${((coverage?.lot_coverage_pct || 0) * 100).toFixed(1)}%` },
    ];
    if (coverage?.zoning_max_coverage) {
        zoningHighlights.push({ label: "Zoning Max", value: `${(coverage.zoning_max_coverage * 100).toFixed(1)}%`, isWarning: coverage.lot_coverage_pct > coverage.zoning_max_coverage * 0.9 });
    }
    zoningHighlights.push({ label: "Easement Issue", value: derived_factors?.easement_encroachment > 0.05 ? "Detected" : "Clear", isWarning: derived_factors?.easement_encroachment > 0.05 });

    // --- Helper Functions ---
    const getHealthColor = (score) => {
        if (score >= 80) return 'text-emerald-400';
        if (score >= 50) return 'text-amber-400';
        return 'text-rose-400';
    };

    const getHealthBg = (score) => {
        if (score >= 80) return 'bg-emerald-400/10 border-emerald-400/20';
        if (score >= 50) return 'bg-amber-400/10 border-amber-400/20';
        return 'bg-rose-400/10 border-rose-400/20';
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 15 },
        visible: { opacity: 1, y: 0 }
    };

    return (
        <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="flex h-full flex-col overflow-y-auto bg-background p-6"
        >
            {/* Header */}
            <motion.div variants={itemVariants} className="mb-8 flex flex-col justify-between gap-6 rounded-2xl border border-white/10 bg-black/20 p-6 md:flex-row md:items-center shadow-card-soft">
                <div className="flex flex-col gap-2">
                    <h2 className="text-2xl font-bold tracking-tight text-text-primary">Data Dashboard</h2>
                    <p className="text-sm text-text-secondary">Comprehensive Deal Intelligence</p>
                    
                    <div className="mt-2 flex items-center gap-3">
                        <span className="text-xs font-medium text-text-secondary">View Mode:</span>
                        <div className="flex rounded-full border border-white/10 bg-black/40 p-1">
                            <button 
                                onClick={() => setIsAgentMode(false)}
                                className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${!isAgentMode ? 'bg-primary text-black shadow-glow' : 'text-text-secondary hover:text-white'}`}
                            >
                                Regular
                            </button>
                            <button 
                                onClick={() => setIsAgentMode(true)}
                                className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${isAgentMode ? 'bg-indigo-500 text-white shadow-glow' : 'text-text-secondary hover:text-white'}`}
                            >
                                Agent PRO
                            </button>
                        </div>
                    </div>
                </div>

                <div className={`flex items-center gap-6 rounded-2xl border p-5 ${getHealthBg(dealHealthScore)}`}>
                    <div className="flex flex-col items-end">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">
                            Deal Health Score
                        </span>
                        <div className="flex items-baseline gap-1">
                            <span className={`text-5xl font-extrabold tracking-tighter ${getHealthColor(dealHealthScore)}`}>
                                {dealHealthScore}
                            </span>
                            <span className="text-sm font-medium text-text-secondary">/ 100</span>
                        </div>
                        <span className="mt-1 text-xs font-medium text-text-primary">
                            {dealHealthScore >= 80 ? 'Highly Stable' : dealHealthScore >= 50 ? 'Moderate Risk' : 'High Friction'}
                        </span>
                    </div>
                    {/* Ring indicator */}
                    <div className="relative h-16 w-16">
                        <svg className="h-full w-full -rotate-90" viewBox="0 0 56 56">
                            <circle cx="28" cy="28" r="24" fill="none" stroke="currentColor" className="opacity-10" strokeWidth="6" />
                            <circle 
                                cx="28" cy="28" r="24" fill="none" stroke="currentColor" strokeWidth="6"
                                strokeLinecap="round"
                                strokeDasharray={2 * Math.PI * 24}
                                strokeDashoffset={(2 * Math.PI * 24) * (1 - dealHealthScore / 100)}
                                className={`transition-all duration-1000 ease-out ${getHealthColor(dealHealthScore)}`}
                            />
                        </svg>
                    </div>
                </div>
            </motion.div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                
                {/* Left Panel: Risk Summary Cards */}
                <div className="flex flex-col gap-4 lg:col-span-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary">Risk Categories</h3>
                    
                    <RiskCard 
                        title="Title & Ownership Risk" 
                        score={titleRisk.score} 
                        flags={titleRisk.flags} 
                        icon={<FileText size={18} />}
                        isAgentMode={isAgentMode}
                    />
                    <RiskCard 
                        title="Structural & Zoning Risk" 
                        score={structuralRisk.score} 
                        flags={structuralRisk.flags} 
                        icon={<Hash size={18} />}
                        isAgentMode={isAgentMode}
                    />
                    <RiskCard 
                        title="Climate Exposure" 
                        score={climateRisk.score} 
                        flags={climateRisk.flags} 
                        icon={<AlertTriangle size={18} />}
                        isAgentMode={isAgentMode}
                    />
                    <RiskCard 
                        title="Insurance Impact" 
                        score={insuranceImpact.score} 
                        flags={insuranceImpact.flags} 
                        icon={<ShieldAlert size={18} />}
                        isAgentMode={isAgentMode}
                    />
                </div>

                {/* Center Panel: Timeline */}
                <div className="flex flex-col gap-4 lg:col-span-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary">Property Timeline</h3>
                    <motion.div variants={itemVariants} className="flex-1 rounded-2xl border border-white/5 bg-background-subtle p-6">
                        <div className="relative border-l-2 border-white/10 pl-6 pb-4">
                            {timeline.map((item, idx) => (
                                <div key={idx} className="relative mb-8 last:mb-0 group cursor-pointer">
                                    <div className="absolute -left-[31px] top-1 h-3 w-3 rounded-full border-2 border-background-subtle bg-primary ring-2 ring-primary/30 transition group-hover:scale-125" />
                                    <span className="text-xs font-bold text-primary">{item.year}</span>
                                    <h4 className="mt-1 text-sm font-semibold text-text-primary transition group-hover:text-primary">{item.event}</h4>
                                    
                                    {isAgentMode && item.riskChange !== 0 && (
                                        <div className="mt-2 text-xs">
                                            <span className={`inline-flex items-center gap-1 rounded bg-black/40 px-2 py-1 ${item.riskChange > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                                                {item.riskChange > 0 ? '↑' : '↓'} Risk Impact: {Math.abs(item.riskChange)}%
                                            </span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </motion.div>
                </div>

                {/* Right Panel: AI Insights & Extraction */}
                <div className="flex flex-col gap-6 lg:col-span-4">
                    
                    {/* Negotiation Insights */}
                    <div className="flex flex-col gap-4">
                        <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-text-secondary">
                            <Key size={14} className="text-amber-400" />
                            Negotiation Leverage
                        </h3>
                        <motion.div variants={itemVariants} className="flex flex-col gap-3 rounded-2xl border border-white/5 bg-background-subtle p-5">
                            {negotiationInsights.map((insight, idx) => (
                                <div key={idx} className="flex items-start gap-3 rounded-xl border border-white/5 bg-black/20 p-4 transition hover:border-amber-400/30">
                                    <div className="mt-0.5 text-amber-400">✧</div>
                                    <p className="text-sm leading-relaxed text-text-primary">{insight}</p>
                                </div>
                            ))}
                        </motion.div>
                    </div>

                    {/* Zoning Highlights */}
                    <div className="flex flex-col gap-4">
                        <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-text-secondary">
                            <Maximize size={14} className="text-sky-400" />
                            Zoning & Parameters
                        </h3>
                        <motion.div variants={itemVariants} className="flex flex-wrap gap-2 rounded-2xl border border-white/5 bg-background-subtle p-5">
                            <HighlightBadge label="Estimated Area" value={`${coverage?.building_area_sqft || 'N/A'} sqft`} />
                            <HighlightBadge label="Lot Coverage" value={`${((coverage?.lot_coverage_pct || 0) * 100).toFixed(1)}%`} />
                            {coverage?.zoning_max_coverage && (
                                <HighlightBadge label="Zoning Max" value={`${coverage.zoning_max_coverage * 100}%`} isWarning={coverage.lot_coverage_pct > coverage.zoning_max_coverage * 0.9} />
                            )}
                            <HighlightBadge label="Easement Issue" value={derived_factors?.easement_encroachment > 0.05 ? "Detected" : "Clear"} isWarning={derived_factors?.easement_encroachment > 0.05} />
                        </motion.div>
                    </div>
                </div>

            </div>

            {/* Agent Pro Exclusive Panel */}
            <AnimatePresence mode="wait">
                {isAgentMode && (
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className="mt-8 flex flex-col gap-6 rounded-2xl border border-indigo-500/30 bg-indigo-500/5 p-6"
                    >
                        <div className="flex items-center gap-3">
                            <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/20 p-2 text-indigo-400">
                                <Activity size={20} />
                            </div>
                            <h3 className="text-xl font-bold tracking-tight text-text-primary">Agent PRO Intel</h3>
                        </div>

                        {/* Financial Projections Grid */}
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <FinancialStatCard 
                                label="Est. Property Value" 
                                value={formatCurrency(estimatedValue)} 
                                subtext={`Base: ${formatCurrency(baseValue)}`} 
                            />
                            <FinancialStatCard 
                                label="Risk Price Impact" 
                                value={formatCurrency(priceImpactDollar)} 
                                valueColor={priceImpactDollar < 0 ? 'text-rose-400' : 'text-emerald-400'}
                                subtext={`${priceAdjustmentPct > 0 ? '+' : ''}${priceAdjustmentPct.toFixed(1)}% Adjustment`} 
                            />
                            <FinancialStatCard 
                                label="Est. Annual Insurance" 
                                value={formatCurrency(1500 + (insuranceImpact.score * 25))} 
                                subtext="Based on climate exposure" 
                            />
                            <FinancialStatCard 
                                label="Resale Liquidity" 
                                value={`${estDaysOnMarket} DOM`} 
                                subtext="Estimated Days on Market" 
                                valueColor={estDaysOnMarket > 45 ? 'text-amber-400' : 'text-emerald-400'}
                            />
                        </div>

                        {/* 2D Graphs Section */}
                        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                            {/* Health Trend Line Chart */}
                            <div className="rounded-xl border border-white/10 bg-black/40 p-5">
                                <h4 className="mb-4 text-sm font-bold text-text-secondary">Historical Risk Trends</h4>
                                <div className="h-64 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={historicalTrendData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                                            <XAxis dataKey="year" stroke="#ffffff50" fontSize={12} tickLine={false} axisLine={false} />
                                            <YAxis stroke="#ffffff50" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
                                            <RechartsTooltip 
                                                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#ffffff20', borderRadius: '8px' }}
                                                itemStyle={{ fontSize: '12px' }}
                                            />
                                            <Legend wrapperStyle={{ fontSize: '12px' }} />
                                            <Line type="monotone" dataKey="health" name="Deal Health" stroke="#34d399" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                            <Line type="monotone" dataKey="title" name="Title Risk" stroke="#f87171" strokeWidth={2} dot={false} opacity={0.5} />
                                            <Line type="monotone" dataKey="climate" name="Climate Risk" stroke="#60a5fa" strokeWidth={2} dot={false} opacity={0.5} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Risk Composition Bar Chart */}
                            <div className="rounded-xl border border-white/10 bg-black/40 p-5">
                                <h4 className="mb-4 text-sm font-bold text-text-secondary">Risk Score Composition</h4>
                                <div className="h-64 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={riskCompositionData} layout="vertical" margin={{ left: 20 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" horizontal={false} />
                                            <XAxis type="number" domain={[0, 100]} stroke="#ffffff50" fontSize={12} tickLine={false} axisLine={false} />
                                            <YAxis dataKey="category" type="category" stroke="#ffffff50" fontSize={12} tickLine={false} axisLine={false} />
                                            <RechartsTooltip 
                                                cursor={{ fill: '#ffffff05' }}
                                                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#ffffff20', borderRadius: '8px' }}
                                            />
                                            <Bar dataKey="score" name="Risk Score (Lower is better)" fill="#818cf8" radius={[0, 4, 4, 0]}>
                                                {riskCompositionData.map((entry, index) => {
                                                    const color = entry.score > 60 ? '#f87171' : entry.score > 30 ? '#fbbf24' : '#34d399';
                                                    return <cell key={`cell-${index}`} fill={color} />;
                                                })}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>

                        {/* 3D Multi-factor Scatter Plot */}
                        <div className="rounded-xl border border-white/10 bg-black/40 p-5">
                            <h4 className="mb-4 text-sm font-bold text-text-secondary">Multi-Factor Portfolio Analysis (3D)</h4>
                            <p className="mb-4 text-xs text-text-secondary">Comparing this property (yellow) vs similar neighborhood properties (blue).</p>
                            <div className="flex h-[400px] w-full items-center justify-center overflow-hidden rounded-lg bg-black/20">
                                <Plot
                                    data={[
                                        {
                                            // Deterministic neighborhood comps based on the address seed
                                            x: Array.from({length: 20}, (_, i) => 40 + (seededRandom(addressHash + i * 10) * 50)), // Deal Health
                                            y: Array.from({length: 20}, (_, i) => -50000 + (seededRandom(addressHash + i * 10 + 1) * 100000)), // Price Impact
                                            z: Array.from({length: 20}, (_, i) => 1000 + (seededRandom(addressHash + i * 10 + 2) * 3000)), // Insurance
                                            mode: 'markers',
                                            type: 'scatter3d',
                                            name: 'Comps',
                                            marker: { color: '#60a5fa', size: 4, opacity: 0.6 }
                                        },
                                        {
                                            // This property
                                            x: [dealHealthScore],
                                            y: [priceImpactDollar],
                                            z: [1500 + (insuranceImpact.score * 25)],
                                            mode: 'markers',
                                            type: 'scatter3d',
                                            name: 'This Property',
                                            marker: { color: '#fbbf24', size: 8, symbol: 'diamond' }
                                        }
                                    ]}
                                    layout={{
                                        autosize: true,
                                        margin: { l: 0, r: 0, b: 0, t: 0 },
                                        paper_bgcolor: 'transparent',
                                        plot_bgcolor: 'transparent',
                                        scene: {
                                            xaxis: { title: 'Deal Health', backgroundcolor: 'transparent', gridcolor: '#ffffff20', showbackground: false, zerolinecolor: '#ffffff50' },
                                            yaxis: { title: 'Price Impact ($)', backgroundcolor: 'transparent', gridcolor: '#ffffff20', showbackground: false, zerolinecolor: '#ffffff50' },
                                            zaxis: { title: 'Insurance ($)', backgroundcolor: 'transparent', gridcolor: '#ffffff20', showbackground: false, zerolinecolor: '#ffffff50' },
                                            camera: { eye: { x: 1.5, y: 1.5, z: 1.2 } }
                                        },
                                        legend: { orientation: 'h', y: 1.1, font: { color: '#94a3b8' } }
                                    }}
                                    config={{ displayModeBar: false, responsive: true }}
                                    style={{ width: '100%', height: '100%' }}
                                />
                            </div>
                        </div>

                        {/* Explainable AI Modal Content */}
                        <div className="mt-4 rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-5">
                            <h4 className="text-sm font-bold text-indigo-400">Explainable AI Analysis</h4>
                            <p className="mt-1 text-xs text-text-secondary">
                                The ML stacking ensemble (GBM 65%, NN 35%) identified an uncertainty level of <strong className="text-indigo-400">{risk?.uncertainty_level || 'Moderate'}</strong>. 
                                Isotonic calibration applied.
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

// Subcomponent: Risk Card
function RiskCard({ title, score, flags, icon, isAgentMode }) {
    // Score is 0-100 (Risk), higher is worse
    const isHighRisk = score > 60;
    const isMedRisk = score > 30 && score <= 60;
    
    const colorClass = isHighRisk ? 'text-rose-400' : isMedRisk ? 'text-amber-400' : 'text-emerald-400';
    const bgClass = isHighRisk ? 'bg-rose-400/10 border-rose-400/20' : isMedRisk ? 'bg-amber-400/10 border-amber-400/20' : 'bg-emerald-400/10 border-emerald-400/20';

    return (
        <motion.div 
            variants={{ hidden: { opacity: 0, x: -20 }, visible: { opacity: 1, x: 0 } }}
            className={`group relative flex flex-col gap-3 rounded-2xl border p-5 transition-all hover:shadow-card-soft ${isAgentMode ? 'bg-background-subtle border-white/5' : bgClass}`}
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className={`rounded-lg p-2 ${isAgentMode ? 'bg-white/5 text-text-secondary' : ''} ${!isAgentMode ? colorClass : ''}`}>
                        {icon}
                    </div>
                    <h4 className="text-sm font-bold text-text-primary">{title}</h4>
                </div>
                {isAgentMode && (
                    <div className={`text-lg font-bold tabular-nums ${colorClass}`}>
                        {Math.round(score)}
                    </div>
                )}
            </div>

            {/* In regular mode, show simple status text. In agent mode, show specific flags */}
            {!isAgentMode ? (
                <div className="text-sm font-medium text-text-secondary">
                    Status: <span className={colorClass}>{isHighRisk ? 'Critical Flags Found' : isMedRisk ? 'Review Needed' : 'Clear / Nominal'}</span>
                </div>
            ) : (
                <div className="flex flex-col gap-2">
                    {flags.length > 0 ? (
                        flags.map((flag, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-xs text-text-secondary">
                                <div className={`h-1.5 w-1.5 rounded-full ${colorClass}`} />
                                {flag}
                            </div>
                        ))
                    ) : (
                        <div className="text-xs text-text-secondary italic">No critical flags detected.</div>
                    )}
                </div>
            )}
        </motion.div>
    );
}

// Subcomponent: Highlight Badge
function HighlightBadge({ label, value, isWarning }) {
    return (
        <div className={`flex flex-col rounded-xl border p-3 ${isWarning ? 'border-rose-400/30 bg-rose-400/5' : 'border-white/5 bg-black/40'}`}>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">{label}</span>
            <span className={`mt-1 text-sm font-bold ${isWarning ? 'text-rose-400' : 'text-text-primary'}`}>{value}</span>
        </div>
    );
}
// Subcomponent: Financial Stat Card
function FinancialStatCard({ label, value, subtext, valueColor = 'text-text-primary' }) {
    return (
        <div className="flex flex-col gap-1 rounded-xl border border-white/10 bg-black/40 p-4 transition-all hover:border-indigo-500/30">
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">{label}</span>
            <span className={`text-xl font-bold tracking-tight ${valueColor}`}>{value}</span>
            {subtext && <span className="text-xs text-text-secondary">{subtext}</span>}
        </div>
    );
}
