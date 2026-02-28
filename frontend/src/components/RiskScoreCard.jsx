/**
 * TitleGuard AI — Risk Score Card
 * Animated circular gauge, tier badge, and per-factor breakdown bars.
 * Rewritten with Tailwind CSS.
 */
import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';

const GAUGE_RADIUS = 62;
const GAUGE_CIRCUMFERENCE = 2 * Math.PI * GAUGE_RADIUS;

function RiskScoreCard({ riskData, coverageData, isLoading, score }) {
    const [displayScore, setDisplayScore] = useState(0);
    const animFrameRef = useRef(null);

    /* ── If used as a standalone preview in landing page (score prop) ── */
    if (score != null && !riskData) {
        return null; // no standalone preview in dashboard mode
    }

    // Animate score counter from 0 → actual
    useEffect(() => {
        if (!riskData) { setDisplayScore(0); return; }

        const target = riskData.overall_score;
        const duration = 1500;
        const start = performance.now();

        const tick = (now) => {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setDisplayScore(Math.round(target * eased));

            if (progress < 1) {
                animFrameRef.current = requestAnimationFrame(tick);
            }
        };

        animFrameRef.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(animFrameRef.current);
    }, [riskData]);

    /* ── Loading ── */
    if (isLoading) {
        return (
            <div className="border-b border-white/5 p-6">
                <div className="mb-5 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
                    Risk Assessment
                </div>
                <div className="flex flex-col items-center gap-3 py-10 text-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-white/10 border-t-white" />
                    <p className="text-xs text-text-secondary">Computing risk score…</p>
                </div>
            </div>
        );
    }

    /* ── Empty state ── */
    if (!riskData) {
        return (
            <div className="border-b border-white/5 p-6">
                <div className="mb-5 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
                    Risk Assessment
                </div>
                <div className="flex flex-col items-center gap-3 py-10 text-center">
                    <div className="text-2xl opacity-30">📊</div>
                    <p className="max-w-[200px] text-xs text-text-secondary">
                        Enter an address to begin analysis
                    </p>
                </div>
            </div>
        );
    }

    const { overall_score, risk_tier, factors } = riskData;
    const tierLower = risk_tier?.toLowerCase() || 'moderate';
    const gaugeOffset = GAUGE_CIRCUMFERENCE * (1 - overall_score / 100);
    const scoreColor = getScoreColor(overall_score);
    const tierColors = getTierColors(tierLower);

    return (
        <>
            {/* Score Gauge */}
            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="border-b border-white/5 p-6"
            >
                <div className="mb-5 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
                    Risk Assessment
                </div>
                <div className="flex flex-col items-center gap-5">
                    {/* Gauge */}
                    <div className="relative h-40 w-40">
                        <svg className="h-full w-full -rotate-90" viewBox="0 0 140 140">
                            <circle
                                cx="70" cy="70" r={GAUGE_RADIUS}
                                fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6"
                            />
                            <circle
                                cx="70" cy="70" r={GAUGE_RADIUS}
                                fill="none" stroke={scoreColor} strokeWidth="6"
                                strokeLinecap="round"
                                strokeDasharray={GAUGE_CIRCUMFERENCE}
                                strokeDashoffset={gaugeOffset}
                                className="transition-all duration-[1.5s] ease-out"
                            />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span
                                className="text-4xl font-extrabold tracking-tight tabular-nums"
                                style={{ color: scoreColor }}
                            >
                                {displayScore}
                            </span>
                            <span className="mt-1 text-[10px] text-text-secondary">/ 100</span>
                        </div>
                    </div>

                    {/* Tier badge */}
                    <span
                        className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em]"
                        style={{ background: tierColors.bg, color: tierColors.fg }}
                    >
                        ● {risk_tier}
                    </span>
                </div>
            </motion.div>

            {/* Factor Breakdown */}
            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="border-b border-white/5 p-6"
            >
                <div className="mb-5 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
                    Risk Factors
                </div>
                <div className="flex flex-col gap-4">
                    {factors && Object.entries(factors).map(([key, factor]) => (
                        <div key={key} className="flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-text-secondary">{factor.label}</span>
                                <span className="font-mono text-xs font-semibold text-text-primary tabular-nums">
                                    {factor.score}
                                </span>
                            </div>
                            <div className="h-1 w-full overflow-hidden rounded-full bg-white/5">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${factor.score}%` }}
                                    transition={{ duration: 1, delay: 0.2, ease: 'easeOut' }}
                                    className="h-full rounded-full"
                                    style={{ background: getScoreColor(factor.score) }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </motion.div>

            {/* Lot Coverage */}
            {coverageData && (
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="border-b border-white/5 p-6"
                >
                    <div className="mb-5 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
                        Lot Coverage — CV Estimate
                    </div>
                    <CoverageVisual data={coverageData} />
                </motion.div>
            )}
        </>
    );
}

function CoverageVisual({ data }) {
    const pct = data.lot_coverage_pct ?? 0;
    const displayPct = Math.round(pct * 100);
    const radius = 24;
    const circ = 2 * Math.PI * radius;
    const offset = circ * (1 - pct);
    const hasZoning = data.zoning_max_coverage != null;
    const isHigh = hasZoning && pct >= data.zoning_max_coverage * 0.9;
    const color = isHigh ? '#EF4444' : '#22C55E';

    return (
        <div className="flex items-center gap-5">
            {/* Mini gauge */}
            <div className="relative h-16 w-16 shrink-0">
                <svg className="h-full w-full -rotate-90" viewBox="0 0 56 56">
                    <circle cx="28" cy="28" r={radius}
                        fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5"
                    />
                    <circle cx="28" cy="28" r={radius}
                        fill="none" stroke={color} strokeWidth="5"
                        strokeLinecap="round"
                        strokeDasharray={circ}
                        strokeDashoffset={offset}
                        className="transition-all duration-1000 ease-out"
                    />
                </svg>
                <div
                    className="absolute inset-0 flex items-center justify-center font-mono text-xs font-bold"
                    style={{ color }}
                >
                    {displayPct}%
                </div>
            </div>
            {/* Details */}
            <div className="flex-1 space-y-1">
                <div className="text-xs text-text-secondary">
                    Building: <strong className="text-text-primary">{data.building_area_sqft?.toLocaleString()} sq ft</strong>
                </div>
                <div className="text-xs text-text-secondary">
                    Parcel: <strong className="text-text-primary">{data.parcel_area_sqft?.toLocaleString()} sq ft</strong>
                </div>
                {hasZoning && (
                    <div className="text-xs text-text-secondary">
                        Zoning Max: <strong className="text-text-primary">{Math.round(data.zoning_max_coverage * 100)}%</strong>
                    </div>
                )}
                {data.expansion_risk && (
                    <div
                        className="mt-2 inline-flex rounded-md px-2 py-1 text-[10px] font-semibold"
                        style={{
                            background: isHigh ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
                            color,
                        }}
                    >
                        Expansion Risk: {data.expansion_risk}
                    </div>
                )}
            </div>
        </div>
    );
}

function getScoreColor(score) {
    if (score >= 80) return '#EF4444';
    if (score >= 60) return '#F97316';
    if (score >= 40) return '#EAB308';
    if (score >= 20) return '#4ADE80';
    return '#22C55E';
}

function getTierColors(tier) {
    switch (tier) {
        case 'critical': return { bg: 'rgba(239,68,68,0.1)', fg: '#EF4444' };
        case 'high': return { bg: 'rgba(249,115,22,0.1)', fg: '#F97316' };
        case 'moderate': return { bg: 'rgba(234,179,8,0.1)', fg: '#EAB308' };
        case 'low': return { bg: 'rgba(74,222,128,0.1)', fg: '#4ADE80' };
        default: return { bg: 'rgba(34,197,94,0.1)', fg: '#22C55E' };
    }
}

export default RiskScoreCard;
