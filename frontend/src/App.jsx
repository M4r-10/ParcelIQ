/**
 * TitleGuard AI — Root Application
 *
 * Two views:
 *   1. Home — hero address input
 *   2. Dashboard — spatial viewer + risk analysis
 */
import React, { useCallback, useRef, useState } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import CountUp from 'react-countup';
import Header from './components/Header';
import Footer from './components/Footer';
import RiskScoreCard from './components/RiskScoreCard';
import SpatialVisualizer from './components/SpatialVisualizer';
import PropertyDashboard from './components/PropertyDashboard';
import { analyzeProperty } from './services/api';

const sectionIds = {
    hero: 'hero',
    product: 'product',
    spatialRisk: 'spatial-risk',
    aiEngine: 'ai-engine',
    process: 'process',
    about: 'about',
    security: 'security',
    metrics: 'metrics',
    blog: 'blog',
    demo: 'demo',
};

const fadeUp = {
    initial: { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.2 },
    transition: { duration: 0.6, ease: 'easeOut' },
};

function App() {
    const [activeProductTab, setActiveProductTab] = useState('spatial');
    const [expandedExplain, setExpandedExplain] = useState(false);
    const [mode, setMode] = useState('landing'); // 'landing' | 'experience'
    const [analysisResult, setAnalysisResult] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [currentAddress, setCurrentAddress] = useState('');
    const [addressInput, setAddressInput] = useState('');
    const pageRef = useRef(null);
    const { scrollYProgress } = useScroll({ target: pageRef, offset: ['start 0', 'end 1'] });
    const progressWidth = useTransform(scrollYProgress, [0, 1], ['0%', '100%']);

    const handleScrollToSection = useCallback((id) => {
        const targetId = sectionIds[id] || id;
        const el = document.getElementById(targetId);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, []);

    const handleLogoClick = useCallback(() => {
        if (mode === 'experience') {
            setMode('landing');
            setAnalysisResult(null);
            setError(null);
            setIsLoading(false);
            setCurrentAddress('');
            setAddressInput('');
        } else {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, [mode]);

    const handleAnalyze = useCallback(
        async (address) => {
            if (!address.trim()) return;
            setError(null);
            setIsLoading(true);
            setCurrentAddress(address.trim());
            setMode('experience');
            try {
                const result = await analyzeProperty(address.trim());
                setAnalysisResult(result);
            } catch (err) {
                console.error('Analysis failed:', err);
                setError(
                    err.response?.data?.error ||
                        'Unable to reach the analysis server. Make sure the backend is running on port 5000.',
                );
            } finally {
                setIsLoading(false);
            }
        },
        [],
    );

    const handleBackToLanding = useCallback(() => {
        setMode('landing');
        setAnalysisResult(null);
        setError(null);
        setIsLoading(false);
    }, []);

    return (
        <div
            ref={pageRef}
            className="relative min-h-screen bg-background text-text-primary"
        >
            <motion.div
                style={{ width: progressWidth }}
                className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 bg-gradient-to-r from-primary via-primary-flood to-primary"
            />

            <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.35),_transparent_60%),radial-gradient(circle_at_bottom,_rgba(15,23,42,0.85),_rgba(15,23,42,1))]" />

            <Header onLogoClick={handleLogoClick} onScrollToSection={handleScrollToSection} />

            {mode === 'experience' ? (
                <main className="pt-20">
                    <PropertyDashboard
                        analysisResult={analysisResult}
                        isLoading={isLoading}
                        address={currentAddress}
                        onBack={handleBackToLanding}
                    />
                </main>
            ) : (
                <main className="mx-auto mt-24 flex max-w-6xl flex-col gap-24 px-6 pb-24 pt-10 lg:px-8 lg:pt-16">
                {/* Hero */}
                <section id={sectionIds.hero} className="grid gap-10 lg:grid-cols-2 lg:items-center">
                    <motion.div
                        {...fadeUp}
                        className="space-y-8"
                    >
                        <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-primary">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-glow" />
                            Spatial Intelligence for Title
                        </div>
                        <div className="space-y-4">
                            <h1 className="text-4xl font-semibold tracking-tight text-text-primary sm:text-5xl lg:text-[3.1rem]">
                                Make Property Risk Spatial.
                                <br />
                                <span className="bg-gradient-to-r from-primary via-primary-flood to-sky-300 bg-clip-text text-transparent">
                                    Underwrite With Intelligence.
                                </span>
                            </h1>
                            <p className="max-w-xl text-sm leading-relaxed text-text-secondary">
                                Enter an address to generate an AI-powered spatial risk view — open for underwriters,
                                examiners, and real estate teams without a sales gate.
                            </p>
                        </div>
                        <div className="space-y-3">
                            <form
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    handleAnalyze(addressInput);
                                }}
                                className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-black/40 p-2 shadow-card-soft transition hover:border-primary/50 hover:shadow-glow sm:flex-row sm:items-center"
                            >
                                <div className="flex flex-1 items-center gap-2 px-2">
                                    <span className="text-lg">📍</span>
                                    <input
                                        type="text"
                                        value={addressInput}
                                        onChange={(e) => setAddressInput(e.target.value)}
                                        placeholder="Enter a property address..."
                                        className="h-10 w-full bg-transparent text-sm text-text-primary placeholder:text-text-secondary/60 outline-none"
                                        disabled={isLoading}
                                    />
                                </div>
                                <motion.button
                                    whileHover={{ scale: 1.03 }}
                                    whileTap={{ scale: 0.97 }}
                                    type="submit"
                                    disabled={isLoading || !addressInput.trim()}
                                    className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-slate-950 shadow-glow transition hover:bg-primary-flood disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {isLoading ? 'Analyzing…' : 'Analyze Property'}
                                </motion.button>
                            </form>
                            {error && (
                                <div className="text-xs font-medium text-red-400">
                                    {error}
                                </div>
                            )}
                            <div className="space-y-1 text-[11px] text-text-secondary">
                                <div>Or try a sample:</div>
                                <div className="flex flex-wrap gap-2">
                                    {[
                                        '123 Main St, Irvine, CA 92618',
                                        '456 Oak Ave, Irvine, CA 92620',
                                    ].map((sample) => (
                                        <button
                                            key={sample}
                                            type="button"
                                            onClick={() => {
                                                setAddressInput(sample);
                                                handleAnalyze(sample);
                                            }}
                                            disabled={isLoading}
                                            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-text-secondary transition hover:border-primary/50 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            {sample}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-6 text-xs text-text-secondary">
                            <div>
                                <div className="font-semibold text-text-primary">Minutes, not weeks</div>
                                Automated spatial checks across flood, easements, and coverage.
                            </div>
                            <div>
                                <div className="font-semibold text-text-primary">Built for title</div>
                                Designed with underwriters, examiners, and closers in mind.
                            </div>
                        </div>
                    </motion.div>

                    {/* Parcel visual */}
                    <motion.div
                        initial={{ opacity: 0, y: 32 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, amount: 0.3 }}
                        transition={{ duration: 0.7, ease: 'easeOut' }}
                        className="relative"
                    >
                        <div className="pointer-events-none absolute -inset-10 rounded-3xl bg-radial-faded-strong opacity-70 blur-3xl" />
                        <motion.div
                            animate={{ rotateY: [10, 18, 10] }}
                            transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
                            className="glass-panel relative aspect-[4/3] overflow-hidden transition hover:border-primary/50 hover:shadow-glow"
                        >
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.4),_transparent_60%),linear-gradient(145deg,#020617,#020617_20%,#0f172a_60%,#1d4ed8_100%)]" />
                            <div className="relative flex h-full flex-col justify-between p-5">
                                <div className="flex items-center justify-between text-xs text-text-secondary">
                                    <span className="inline-flex items-center gap-2 rounded-full bg-black/40 px-3 py-1 text-[10px] uppercase tracking-[0.14em]">
                                        Spatial Parcel Preview
                                    </span>
                                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                                        Buildable: 68%
                                    </span>
                                </div>

                                <div className="flex flex-1 items-center justify-center">
                                    <div className="relative h-40 w-40">
                                        <div className="absolute inset-2 rounded-3xl border border-cyan-400/40 bg-sky-500/10 shadow-[0_0_35px_rgba(56,189,248,0.7)]" />
                                        <motion.div
                                            animate={{ opacity: [0.15, 0.35, 0.15] }}
                                            transition={{ duration: 6, repeat: Infinity }}
                                            className="absolute inset-0 rounded-[2rem] border border-primary-flood/60"
                                        />
                                        <motion.div
                                            animate={{ opacity: [0.25, 0.6, 0.25] }}
                                            transition={{ duration: 8, repeat: Infinity }}
                                            className="absolute inset-6 rounded-[2.2rem] border border-primary/40"
                                        />
                                        <motion.div
                                            animate={{ opacity: [0.15, 0.35, 0.15] }}
                                            transition={{ duration: 5, repeat: Infinity }}
                                            className="absolute inset-10 rounded-[2.4rem] border border-sky-300/40"
                                        />
                                        <motion.div
                                            animate={{ opacity: [0.4, 0.8, 0.4] }}
                                            transition={{ duration: 4, repeat: Infinity }}
                                            className="absolute inset-[22px] rounded-[1.9rem] border-2 border-emerald-400/80 shadow-[0_0_40px_rgba(74,222,128,0.8)]"
                                        />
                                        <motion.div
                                            animate={{ opacity: [0.2, 0.85, 0.2] }}
                                            transition={{ duration: 3.5, repeat: Infinity }}
                                            className="absolute inset-[32px] rounded-[1.6rem] border-2 border-primary-flood/90 shadow-[0_0_40px_rgba(59,130,246,0.9)]"
                                        />
                                        <motion.div
                                            animate={{ opacity: [0.2, 0.7, 0.2] }}
                                            transition={{ duration: 4.5, repeat: Infinity }}
                                            className="absolute inset-[42px] rounded-[1.3rem] border-2 border-sky-200/80 shadow-[0_0_40px_rgba(186,230,253,0.8)]"
                                        />
                                        <motion.div
                                            animate={{ opacity: [0.5, 0.2, 0.5] }}
                                            transition={{ duration: 5.5, repeat: Infinity }}
                                            className="absolute inset-[52px] rounded-[1rem] border-2 border-red-400/80 shadow-[0_0_30px_rgba(248,113,113,0.9)]"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-3 text-[10px] text-text-secondary">
                                    <div className="rounded-lg bg-black/40 p-2">
                                        <div className="text-[10px] uppercase tracking-[0.14em] text-sky-300">
                                            Flood
                                        </div>
                                        <div className="mt-1 text-xs font-semibold text-text-primary">
                                            Partial Zone AE
                                        </div>
                                    </div>
                                    <div className="rounded-lg bg-black/40 p-2">
                                        <div className="text-[10px] uppercase tracking-[0.14em] text-emerald-300">
                                            Lot Coverage
                                        </div>
                                        <div className="mt-1 text-xs font-semibold text-text-primary">
                                            <CountUp end={68} duration={2.4} />%
                                        </div>
                                    </div>
                                    <div className="rounded-lg bg-black/40 p-2">
                                        <div className="text-[10px] uppercase tracking-[0.14em] text-rose-300">
                                            Easements
                                        </div>
                                        <div className="mt-1 text-xs font-semibold text-text-primary">
                                            Utility &amp; Drainage
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                </section>

                {/* Product Tabs */}
                <section id={sectionIds.product} className="space-y-8">
                    <motion.div
                        {...fadeUp}
                        className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"
                    >
                        <div>
                            <h2 className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                                Platform
                            </h2>
                            <p className="mt-2 text-xl font-semibold text-text-primary">
                                Two engines. One spatially-aware underwriting stack.
                            </p>
                        </div>
                    </motion.div>

                    <div className="overflow-hidden rounded-2xl border border-white/10 bg-card/60 shadow-card-soft">
                        <div className="flex space-x-1 border-b border-white/10 bg-black/30 p-2 text-xs font-medium text-text-secondary">
                            <button
                                onClick={() => setActiveProductTab('spatial')}
                                className={`relative flex-1 rounded-xl px-4 py-2 transition ${
                                    activeProductTab === 'spatial'
                                        ? 'bg-background/80 text-text-primary shadow-inner shadow-primary/30'
                                        : 'hover:bg-white/5'
                                }`}
                            >
                                Spatial Risk Intelligence
                            </button>
                            <button
                                onClick={() => setActiveProductTab('ai')}
                                className={`relative flex-1 rounded-xl px-4 py-2 transition ${
                                    activeProductTab === 'ai'
                                        ? 'bg-background/80 text-text-primary shadow-inner shadow-primary/30'
                                        : 'hover:bg-white/5'
                                }`}
                            >
                                AI Risk Engine
                            </button>
                        </div>

                        <div className="grid gap-8 p-6 lg:grid-cols-2 lg:p-8">
                            {activeProductTab === 'spatial' ? (
                                <>
                                    <motion.div
                                        key="spatial-left"
                                        initial={{ x: -20, opacity: 0 }}
                                        animate={{ x: 0, opacity: 1 }}
                                        transition={{ duration: 0.4, ease: 'easeOut' }}
                                        className="glass-panel relative h-72 overflow-hidden bg-gradient-to-br from-sky-900/40 via-slate-900/90 to-background transition hover:border-primary/50 hover:shadow-glow"
                                        id={sectionIds.spatialRisk}
                                    >
                                        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.28),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(15,23,42,1),_rgba(15,23,42,1))]" />
                                        <div className="relative flex h-full flex-col justify-between p-4">
                                            <div className="flex items-center justify-between text-[11px] text-text-secondary">
                                                <span className="rounded-full bg-black/40 px-3 py-1 uppercase tracking-[0.16em]">
                                                    Interactive 3D Map
                                                </span>
                                                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                                                    Preview Mode
                                                </span>
                                            </div>
                                            <div className="flex flex-1 items-center justify-center">
                                                <div className="h-44 w-full max-w-xs">
                                                    <SpatialVisualizer />
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between text-[11px] text-text-secondary">
                                                <span>Flood • Easements • Buildable Envelope</span>
                                                <span className="text-xs font-semibold text-sky-300">
                                                    Lot Coverage: <CountUp end={68} duration={2.2} />%
                                                </span>
                                            </div>
                                        </div>
                                    </motion.div>

                                    <motion.div
                                        key="spatial-right"
                                        initial={{ x: 20, opacity: 0 }}
                                        animate={{ x: 0, opacity: 1 }}
                                        transition={{ duration: 0.4, ease: 'easeOut' }}
                                        className="space-y-4"
                                    >
                                        <h3 className="text-sm font-semibold text-text-primary">
                                            Spatial Risk Intelligence
                                        </h3>
                                        <ul className="space-y-3 text-sm text-text-secondary">
                                            <li>Flood Zone Visualization with parcel-aligned flood overlays.</li>
                                            <li>Easement Detection across recorded plats and right-of-way data.</li>
                                            <li>CV-Based Lot Coverage tied to computer vision building footprints.</li>
                                            <li>Buildable vs Encumbered area split per zoning &amp; restrictions.</li>
                                            <li>Zoning Threshold Analysis against coverage and height limits.</li>
                                        </ul>

                                        <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                                            <div className="rounded-xl border border-white/5 bg-black/30 p-3 transition hover:border-primary/50 hover:shadow-glow">
                                                <div className="text-[11px] uppercase tracking-[0.18em] text-text-secondary">
                                                    Lot Coverage
                                                </div>
                                                <div className="mt-1 text-2xl font-semibold text-text-primary">
                                                    <CountUp end={68} duration={2.2} />%
                                                </div>
                                                <div className="mt-1 text-[11px] text-text-secondary">
                                                    Within current zoning envelope.
                                                </div>
                                            </div>
                                            <div className="rounded-xl border border-white/5 bg-black/30 p-3 transition hover:border-primary/50 hover:shadow-glow">
                                                <div className="text-[11px] uppercase tracking-[0.18em] text-text-secondary">
                                                    Flood Exposure
                                                </div>
                                                <div className="mt-1 text-2xl font-semibold text-sky-300">
                                                    Partial
                                                </div>
                                                <div className="mt-1 text-[11px] text-text-secondary">
                                                    Edge-intersect with Zone AE.
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                </>
                            ) : (
                                <>
                                    <motion.div
                                        key="ai-left"
                                        initial={{ x: -20, opacity: 0 }}
                                        animate={{ x: 0, opacity: 1 }}
                                        transition={{ duration: 0.4, ease: 'easeOut' }}
                                        className="space-y-4"
                                        id={sectionIds.aiEngine}
                                    >
                                        <h3 className="text-sm font-semibold text-text-primary">
                                            AI Risk Engine
                                        </h3>
                                        <p className="text-sm text-text-secondary">
                                            Weighted spatial and legal risk modeling tuned for title workflows.
                                            Every score is explainable down to the parcel, instrument, and party.
                                        </p>
                                        <ul className="space-y-3 text-sm text-text-secondary">
                                            <li>Weighted risk modeling across climate, encumbrances, and parties.</li>
                                            <li>Ownership anomaly detection from chains, transfers, and entities.</li>
                                            <li>Explainable scoring logic with factor-level contributions.</li>
                                            <li>GPT-powered underwriting summaries tailored to your guidelines.</li>
                                            <li>Closing delay prediction based on historic defect resolution time.</li>
                                        </ul>
                                        <button
                                            type="button"
                                            onClick={() => setExpandedExplain((v) => !v)}
                                            className="mt-2 inline-flex items-center gap-2 text-xs text-text-secondary hover:text-text-primary"
                                        >
                                            <span>{expandedExplain ? 'Hide' : 'Show'} explanation schema</span>
                                        </button>
                                        {expandedExplain && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                className="mt-2 overflow-hidden rounded-xl border border-white/10 bg-black/40 p-3 text-[11px] text-text-secondary"
                                            >
                                                Scores are decomposed into spatial, legal, and behavioral factors, each
                                                with weights and confidence bands so underwriting teams can calibrate
                                                tolerance and overrides.
                                            </motion.div>
                                        )}
                                    </motion.div>

                                    <motion.div
                                        key="ai-right"
                                        initial={{ x: 20, opacity: 0 }}
                                        animate={{ x: 0, opacity: 1 }}
                                        transition={{ duration: 0.4, ease: 'easeOut' }}
                                        className="glass-panel flex h-72 flex-col items-center justify-center gap-6 bg-gradient-to-br from-slate-900/80 via-background to-slate-950 transition hover:border-primary/50 hover:shadow-glow"
                                    >
                                        <div className="text-center text-xs uppercase tracking-[0.22em] text-text-secondary">
                                            Composite Risk Score
                                        </div>
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="rounded-full border border-white/10 bg-black/60 px-6 py-3 text-center shadow-inner shadow-primary/40">
                                                <div className="text-[11px] uppercase tracking-[0.18em] text-text-secondary">
                                                    Score
                                                </div>
                                                <div className="mt-1 text-4xl font-semibold text-text-primary">
                                                    <CountUp end={72} duration={3} />
                                                </div>
                                                <div className="mt-1 text-[11px] text-amber-300">
                                                    Moderated — underwriter review recommended
                                                </div>
                                            </div>
                                            <RiskScoreCard score={72} />
                                        </div>
                                    </motion.div>
                                </>
                            )}
                        </div>
                    </div>
                </section>

                {/* How it works */}
                <section id={sectionIds.process} className="space-y-6">
                    <motion.div {...fadeUp}>
                        <h2 className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                            How It Works
                        </h2>
                        <p className="mt-2 text-xl font-semibold text-text-primary">
                            From address to explainable spatial risk — in four steps.
                        </p>
                    </motion.div>

                    <motion.div
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true, amount: 0.3 }}
                        variants={{
                            hidden: {},
                            visible: { transition: { staggerChildren: 0.12 } },
                        }}
                        className="grid gap-4 md:grid-cols-4"
                    >
                        {[
                            {
                                title: 'Enter Address',
                                body: 'Drop in a property address, legal description, or parcel ID.',
                            },
                            {
                                title: 'Spatial Data Retrieval',
                                body: 'We hydrate the parcel with flood, lidar, zoning, and imagery.',
                            },
                            {
                                title: 'CV Lot Analysis',
                                body: 'Computer vision segments structures and impervious surfaces.',
                            },
                            {
                                title: 'AI Risk Scoring',
                                body: 'We generate explainable risk scores and underwriting summaries.',
                            },
                        ].map((card, i) => (
                            <motion.div
                                key={card.title}
                                variants={{
                                    hidden: { opacity: 0, y: 20 },
                                    visible: { opacity: 1, y: 0 },
                                }}
                                transition={{ duration: 0.5, ease: 'easeOut' }}
                                className="glass-panel group flex flex-col gap-2 border-white/5 bg-card/70 p-4 transition hover:border-primary/50 hover:shadow-glow"
                            >
                                <div className="flex items-center justify-between text-xs text-text-secondary">
                                    <span className="rounded-full bg-black/40 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em]">
                                        Step {i + 1}
                                    </span>
                                </div>
                                <div className="mt-2 text-sm font-semibold text-text-primary">
                                    {card.title}
                                </div>
                                <p className="text-xs text-text-secondary">{card.body}</p>
                            </motion.div>
                        ))}
                    </motion.div>
                </section>

                {/* About */}
                <section id={sectionIds.about} className="space-y-6">
                    <motion.div {...fadeUp}>
                        <h2 className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                            About
                        </h2>
                        <p className="mt-2 text-xl font-semibold text-text-primary">
                            Built for the next generation of title &amp; underwriting.
                        </p>
                    </motion.div>
                    <div className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)]">
                        <motion.div
                            {...fadeUp}
                            className="space-y-4 text-sm text-text-secondary"
                        >
                            <p>
                                TitleGuard AI transforms static title reports into spatial intelligence. We help title
                                insurers, lenders, and real estate professionals surface risk before closing — when it
                                is still cheap to fix.
                            </p>
                            <div className="grid gap-4 sm:grid-cols-3">
                                <div>
                                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">
                                        Mission
                                    </div>
                                    <p className="mt-1 text-xs text-text-secondary">
                                        Deliver spatially-aware risk tools that slot cleanly into title workflows.
                                    </p>
                                </div>
                                <div>
                                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">
                                        Vision
                                    </div>
                                    <p className="mt-1 text-xs text-text-secondary">
                                        Every closing decision sees beyond the document stack into the parcel itself.
                                    </p>
                                </div>
                                <div>
                                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">
                                        Why Now
                                    </div>
                                    <p className="mt-1 text-xs text-text-secondary">
                                        Climate risk, zoning pressure, and capital intensity demand better tools.
                                    </p>
                                </div>
                            </div>
                        </motion.div>

                        <motion.div
                            {...fadeUp}
                            className="glass-panel space-y-3 border-white/10 bg-card/80 p-5 text-xs text-text-secondary transition hover:border-primary/50 hover:shadow-glow"
                        >
                            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                                Credibility
                            </div>
                            <p>
                                Built by engineers focused on AI, spatial computing, and risk modeling — pairing map
                                infrastructure with modern LLMs and explainable scoring frameworks.
                            </p>
                            <p>
                                We&apos;re opinionated about what actually moves the needle for title: fast triage, clear
                                explanations, and tools that respect existing underwriting guidelines.
                            </p>
                        </motion.div>
                    </div>
                </section>

                {/* Security */}
                <section id={sectionIds.security} className="space-y-6">
                    <motion.div {...fadeUp}>
                        <h2 className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                            Security &amp; Compliance
                        </h2>
                        <p className="mt-2 text-xl font-semibold text-text-primary">
                            Enterprise-grade controls from day zero.
                        </p>
                    </motion.div>

                    <motion.div
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true, amount: 0.3 }}
                        variants={{
                            hidden: {},
                            visible: { transition: { staggerChildren: 0.12 } },
                        }}
                        className="grid gap-4 md:grid-cols-4"
                    >
                        {[
                            {
                                title: 'Data Encryption',
                                body: 'Encryption in transit and at rest for all customer data.',
                            },
                            {
                                title: 'SOC2-Ready Architecture',
                                body: 'Control surfaces and logging built for formal audits.',
                            },
                            {
                                title: 'Secure API Integrations',
                                body: 'Scoped API keys, rotating secrets, and IP allowlisting.',
                            },
                            {
                                title: 'Role-Based Access',
                                body: 'Granular permissions for underwriting, operations, and dev teams.',
                            },
                        ].map((item) => (
                            <motion.div
                                key={item.title}
                                variants={{
                                    hidden: { opacity: 0, y: 20 },
                                    visible: { opacity: 1, y: 0 },
                                }}
                                transition={{ duration: 0.5, ease: 'easeOut' }}
                                className="glass-panel flex flex-col gap-2 border-white/5 bg-card/80 p-4 transition hover:border-primary/50 hover:shadow-glow"
                            >
                                <div className="flex items-center gap-2 text-xs font-semibold text-text-primary">
                                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/10 text-[11px] text-emerald-300">
                                        ✓
                                    </span>
                                    {item.title}
                                </div>
                                <p className="text-xs text-text-secondary">{item.body}</p>
                            </motion.div>
                        ))}
                    </motion.div>
                </section>

                {/* Metrics */}
                <section id={sectionIds.metrics} className="space-y-4">
                    <motion.div {...fadeUp}>
                        <h2 className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                            Outcomes
                        </h2>
                    </motion.div>
                    <motion.div
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true, amount: 0.3 }}
                        variants={{
                            hidden: {},
                            visible: { transition: { staggerChildren: 0.1 } },
                        }}
                        className="glass-panel grid gap-4 border-white/5 bg-card/70 px-4 py-3 text-xs text-text-secondary sm:grid-cols-4 transition hover:border-primary/50 hover:shadow-glow"
                    >
                        {[
                            {
                                label: 'Faster underwriting decisions',
                                end: 45,
                                suffix: '%',
                            },
                            {
                                label: 'Reduced closing delays',
                                end: 30,
                                suffix: '%',
                            },
                            {
                                label: 'Improved risk visibility',
                                end: 3,
                                prefix: 'x',
                            },
                            {
                                label: 'Climate-adjusted risk modeling',
                                end: 100,
                                suffix: '%',
                            },
                        ].map((m) => (
                            <motion.div
                                key={m.label}
                                variants={{
                                    hidden: { opacity: 0, y: 10 },
                                    visible: { opacity: 1, y: 0 },
                                }}
                                className="flex flex-col gap-1"
                            >
                                <div className="text-sm font-semibold text-text-primary">
                                    {m.prefix && <span className="mr-0.5">{m.prefix}</span>}
                                    <CountUp end={m.end} duration={2.2} />
                                    {m.suffix && <span className="ml-0.5">{m.suffix}</span>}
                                </div>
                                <div className="text-[11px] text-text-secondary">{m.label}</div>
                            </motion.div>
                        ))}
                    </motion.div>
                </section>

                {/* Blog */}
                <section id={sectionIds.blog} className="space-y-6">
                    <motion.div {...fadeUp}>
                        <h2 className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                            Insights
                        </h2>
                        <p className="mt-2 text-xl font-semibold text-text-primary">
                            Spatial intelligence for modern title operations.
                        </p>
                    </motion.div>

                    <div className="grid gap-4 md:grid-cols-3">
                        {[
                            {
                                title: 'The Future of Spatial Title Intelligence',
                                body: 'How parcels, imagery, and LLMs reshape title search and examination.',
                            },
                            {
                                title: 'Why Lot Coverage Matters',
                                body: 'Understanding buildable area, encumbrances, and climate-aware density.',
                            },
                            {
                                title: 'Climate Risk and Underwriting',
                                body: 'Moving from map screenshots to quantified spatial risk in your binder.',
                            },
                        ].map((post) => (
                            <motion.article
                                key={post.title}
                                {...fadeUp}
                                className="glass-panel flex flex-col gap-2 border-white/5 bg-card/80 p-4 transition hover:border-primary/50 hover:shadow-glow"
                            >
                                <div className="text-xs font-semibold text-text-primary">{post.title}</div>
                                <p className="text-xs text-text-secondary">{post.body}</p>
                                <span className="mt-1 text-[11px] text-primary">Read overview →</span>
                            </motion.article>
                        ))}
                    </div>
                </section>

                {/* No demo form — the experience starts directly with an address. */}
                <section
                    id={sectionIds.demo}
                    className="space-y-4 rounded-2xl border border-dashed border-white/10 bg-black/30 p-5 text-xs text-text-secondary transition hover:border-primary/50 hover:shadow-glow"
                >
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                        Open Access
                    </div>
                    <p className="max-w-xl">
                        TitleGuard AI is available to try directly from the hero search — no sales form or gated demo.
                        Enter a live address above and you&apos;ll be taken into the spatial risk and AI engine
                        experience.
                    </p>
                </section>
            </main>
            )}

            <Footer />
        </div>
    );
}

export default App;
