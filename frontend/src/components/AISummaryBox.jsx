/**
 * TitleGuard AI — AI Summary Box
 * Expand/collapse, copy-to-clipboard, key term highlighting.
 * Rewritten with Tailwind CSS.
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

function AISummaryBox({ summaryData, isLoading }) {
    const [expanded, setExpanded] = useState(true);
    const [copied, setCopied] = useState(false);

    /* ── Loading ── */
    if (isLoading) {
        return (
            <div className="border-b border-white/5 p-6">
                <div className="mb-5 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
                    AI Risk Analysis
                </div>
                <div className="flex flex-col items-center gap-3 py-10 text-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-white/10 border-t-white" />
                    <p className="text-xs text-text-secondary">Generating AI insights…</p>
                </div>
            </div>
        );
    }

    /* ── Empty ── */
    if (!summaryData) {
        return (
            <div className="border-b border-white/5 p-6">
                <div className="mb-5 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
                    AI Risk Analysis
                </div>
                <div className="flex flex-col items-center gap-3 py-10 text-center">
                    <div className="text-2xl opacity-30">🤖</div>
                    <p className="max-w-[220px] text-xs text-text-secondary">
                        AI-powered analysis will appear after property lookup
                    </p>
                </div>
            </div>
        );
    }

    const {
        explanation,
        recommendations,
        closing_delay_likelihood,
        delay_reason,
        generated_by,
    } = summaryData;

    const handleCopy = async () => {
        const text = [
            explanation,
            '',
            'Recommendations:',
            ...(recommendations || []).map((r, i) => `${i + 1}. ${r}`),
            '',
            `Closing Delay Likelihood: ${closing_delay_likelihood}`,
            delay_reason && `Reason: ${delay_reason}`,
            ...(summaryData.financial_impacts?.length > 0 ? [
                '',
                'Estimated Financial Impacts:',
                ...summaryData.financial_impacts.map(f => `- ${f.category}: ${f.estimate}`)
            ] : []),
        ].filter(Boolean).join('\n');

        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            /* noop */
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="border-b border-white/5 p-6"
        >
            {/* Header */}
            <div className="mb-5 flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
                    AI Risk Analysis
                </span>
                <button
                    onClick={handleCopy}
                    className="rounded-md border border-white/10 bg-transparent px-2.5 py-1 text-[10px] text-text-secondary transition hover:bg-white/5 hover:text-text-primary"
                >
                    {copied ? '✓ Copied' : '⎘ Copy'}
                </button>
            </div>

            {/* Explanation */}
            <p className="mb-5 text-sm leading-relaxed text-text-secondary">
                {highlightTerms(explanation)}
            </p>

            {/* Collapsible content */}
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                    >
                        {/* Recommendations */}
                        {recommendations && recommendations.length > 0 && (
                            <div className="mb-4">
                                <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-text-secondary">
                                    Recommended Actions
                                </div>
                                <ul className="flex flex-col gap-3">
                                    {recommendations.map((rec, i) => (
                                        <li key={i} className="flex items-start gap-3 text-sm leading-relaxed text-text-secondary">
                                            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/5 text-[10px] font-semibold text-text-secondary">
                                                {i + 1}
                                            </span>
                                            <span>{rec}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Closing Delay */}
                        {closing_delay_likelihood && (
                            <div className="mt-4 flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.03] px-4 py-3 text-xs text-text-secondary">
                                <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-secondary">
                                    Closing Delay
                                </span>
                                <strong style={{ color: getDelayColor(closing_delay_likelihood) }}>
                                    {closing_delay_likelihood}
                                </strong>
                                {delay_reason && <span>— {delay_reason}</span>}
                            </div>
                        )}

                        {/* Financial Impacts */}
                        {summaryData.financial_impacts && summaryData.financial_impacts.length > 0 && (
                            <div className="mt-4">
                                <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-text-secondary">
                                    Estimated Financial Impacts
                                </div>
                                <div className="flex flex-col gap-2 rounded-lg border border-white/5 bg-white/[0.03] p-3">
                                    {summaryData.financial_impacts.map((impact, i) => (
                                        <div key={i} className="flex items-center justify-between text-xs">
                                            <span className="text-text-secondary">{impact.category}</span>
                                            <span className="font-semibold text-text-primary">{impact.estimate}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Toggle */}
            <button
                onClick={() => setExpanded(!expanded)}
                className="mt-3 flex w-full items-center gap-2 border-none bg-transparent py-1.5 text-[10px] text-text-secondary transition hover:text-text-primary"
            >
                {expanded ? '▲ Show Less' : '▼ Show More'}
            </button>

            {/* Mock badge */}
            {generated_by === 'mock' && (
                <div className="mt-4 inline-flex items-center gap-1 rounded-full bg-white/[0.03] px-3 py-1 text-[10px] text-text-secondary">
                    ⚡ Demo — set OPENAI_API_KEY for live analysis
                </div>
            )}
        </motion.div>
    );
}

/** Highlight key risk terms. */
function highlightTerms(text) {
    if (!text) return '';
    const terms = ['high', 'moderate', 'critical', 'low', 'flood zone', 'easement', 'lot coverage'];
    let remaining = text;

    for (const term of terms) {
        const regex = new RegExp(`(${term})`, 'gi');
        remaining = remaining.replace(regex, `**$1**`);
    }

    const segments = remaining.split(/\*\*(.*?)\*\*/g);
    return segments.map((seg, i) =>
        i % 2 === 1 ? (
            <strong key={i} className="text-text-primary">{seg}</strong>
        ) : (
            <React.Fragment key={i}>{seg}</React.Fragment>
        )
    );
}

function getDelayColor(likelihood) {
    switch (likelihood?.toLowerCase()) {
        case 'high': return '#F97316';
        case 'medium': return '#EAB308';
        case 'low': return '#22C55E';
        default: return '#F9FAFB';
    }
}

export default AISummaryBox;
