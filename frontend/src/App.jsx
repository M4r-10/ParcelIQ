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
import AddressAutocomplete from './components/AddressAutocomplete';
import HeroParcelMapPreview from './components/HeroParcelMapPreview';
import { analyzeProperty } from './services/api';
import { Linkedin } from 'lucide-react';

const sectionIds = {
    hero: 'hero',
    product: 'product',
    spatialRisk: 'spatial-risk',
    aiEngine: 'ai-engine',
    process: 'process',
    about: 'about',
    security: 'security',
    outcomes: 'outcomes',
    insights: 'insights',
    metrics: 'metrics',
    team: 'team',
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
    const [expandedBios, setExpandedBios] = useState({});
    const [mode, setMode] = useState('landing'); // 'landing' | 'experience'
    const [analysisResult, setAnalysisResult] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [currentAddress, setCurrentAddress] = useState('');
    const [addressInput, setAddressInput] = useState('');
    const [pendingLocation, setPendingLocation] = useState(null);
    const [insightFlippedIndex, setInsightFlippedIndex] = useState(null);
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

    const handleHomeClick = useCallback(() => {
        if (mode === 'experience') {
            setMode('landing');
            setAnalysisResult(null);
            setError(null);
            setIsLoading(false);
            setCurrentAddress('');
            setAddressInput('');
        } else {
            handleScrollToSection('hero');
        }
    }, [mode, handleScrollToSection]);

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
                        'Unable to reach the analysis server. Make sure the backend is running.',
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
        setPendingLocation(null);
    }, []);

    return (
        <div
            ref={pageRef}
            className="relative min-h-screen bg-background text-text-primary antialiased"
        >
            <motion.div
                style={{ width: progressWidth }}
                className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 bg-gradient-to-r from-primary via-primary-flood to-primary"
            />

            <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.35),_transparent_60%),radial-gradient(circle_at_bottom,_rgba(15,23,42,0.85),_rgba(15,23,42,1))]" />

            <Header onLogoClick={handleLogoClick} onScrollToSection={handleScrollToSection} onHomeClick={handleHomeClick} />

            {mode === 'experience' ? (
                <main className="pt-24">
                    <PropertyDashboard
                        analysisResult={analysisResult}
                        isLoading={isLoading}
                        address={currentAddress}
                        initialLocation={pendingLocation}
                        onBack={handleBackToLanding}
                    />
                </main>
            ) : (
                <main className="mx-auto mt-24 flex w-full max-w-full flex-col gap-24 px-6 pb-24 pt-4 lg:px-8 lg:pt-6">
                {/* Hero */}
                <section id={sectionIds.hero} className="grid min-h-[calc(100vh-8rem)] gap-10 lg:grid-cols-2 lg:items-center">
                    <motion.div
                        {...fadeUp}
                        className="space-y-8"
                    >
                        <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-primary">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-glow" />
                            Spatial Property Risk Intelligence Engine
                        </div>
                        <div className="space-y-4">
                            <h1 className="bg-gradient-to-b from-blue-900 via-blue-600 to-cyan-300 bg-clip-text text-4xl font-semibold tracking-tight text-transparent sm:text-5xl lg:text-[3.1rem]">
                                See Every
                                    <br />
                                    Parcel Clearly
                            </h1>
                            <p className="max-w-xl text-slate-400 font-light leading-relaxed text-sm">
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
                                className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-black/40 p-2 shadow-[0_20px_50px_rgba(8,_112,_184,_0.1)] transition hover:border-primary/50 hover:shadow-glow sm:flex-row sm:items-center"
                            >
                                <AddressAutocomplete
                                    value={addressInput}
                                    onChange={setAddressInput}
                                    onSelect={(suggestion) => {
                                        if (suggestion.lat != null && suggestion.lng != null) {
                                            setPendingLocation({ lat: suggestion.lat, lng: suggestion.lng });
                                            handleAnalyze(suggestion.shortName);
                                        } else {
                                            setPendingLocation(null);
                                            // Sample address: input already set by onChange; user clicks Analyze Property to run
                                        }
                                    }}
                                    disabled={isLoading}
                                    placeholder="Enter a property address..."
                                    sampleAddresses={[
                                        '123 Main St, Irvine, CA 92618',
                                        '456 Oak Ave, Irvine, CA 92620',
                                    ]}
                                />
                                <motion.button
                                    whileHover={{ scale: 1.03 }}
                                    whileTap={{ scale: 0.97 }}
                                    type="submit"
                                    disabled={isLoading || !addressInput.trim()}
                                    className="inline-flex h-10 items-center justify-center rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {isLoading ? 'Analyzing…' : 'Analyze Property'}
                                </motion.button>
                            </form>
                            {error && (
                                <div className="text-xs font-medium text-red-400">
                                    {error}
                                </div>
                            )}
                            </div>
                        <div className="flex flex-wrap gap-6 text-xs text-slate-400 font-light leading-relaxed">
                            <div>
                                <div className="font-normal text-white">Instant Preliminary Search</div>
                                Automated spatial checks across flood, easements, and coverage.
                            </div>
                            <div>
                                <div className="font-normal text-white">Clear Titles, Faster Closings</div>
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
                                <div className="flex items-center justify-between font-mono text-[10px] text-text-secondary">
                                    <span className="inline-flex items-center gap-2 rounded-full bg-black/40 px-3 py-1 font-bold uppercase tracking-[0.14em] text-cyan-400">
                                        Spatial Parcel Preview
                                    </span>
                                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 font-light text-emerald-300">
                                        Buildable: 68%
                                    </span>
                                </div>

                                <div className="flex flex-1 min-h-0 w-full items-center justify-center px-2 py-2">
                                    {/* Map + bounding box — slightly smaller so it doesn't overlap other elements */}
                                    <div className="relative h-full max-h-[200px] min-h-[180px] w-full max-w-[280px]">
                                        {/* Thin cyan bounding box around the parcel preview */}
                                        <div className="absolute inset-0 rounded-lg border border-cyan-400/80 shadow-[0_0_20px_rgba(34,211,238,0.25)]" />
                                        {/* Horizontal scanning line (moves slowly up and down) */}
                                        <div className="parcel-scan-line absolute left-0 right-0 top-0 h-px bg-cyan-400/70 shadow-[0_0_8px_rgba(34,211,238,0.6)]" />
                                        {/* Map background with parcel area being scanned */}
                                        <HeroParcelMapPreview />
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-3 font-mono text-[10px] text-text-secondary">
                                    <div className="rounded-lg bg-black/40 p-2">
                                        <div className="font-bold uppercase tracking-[0.14em] text-cyan-400">
                                            Flood
                                        </div>
                                        <div className="mt-1 font-light text-text-primary">
                                            Partial Zone AE
                                        </div>
                                    </div>
                                    <div className="rounded-lg bg-black/40 p-2">
                                        <div className="font-bold uppercase tracking-[0.14em] text-cyan-400">
                                            Lot Coverage
                                        </div>
                                        <div className="mt-1 font-light text-text-primary">
                                            <CountUp end={68} duration={2.4} />%
                                        </div>
                                    </div>
                                    <div className="rounded-lg bg-black/40 p-2">
                                        <div className="font-bold uppercase tracking-[0.14em] text-cyan-400">
                                            Easements
                                        </div>
                                        <div className="mt-1 font-light text-text-primary">
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
                            <div className="w-8 h-px bg-cyan-500/50 mb-3" aria-hidden />
                            <h2 className="text-base font-black uppercase tracking-[0.3em] text-cyan-400/90 mb-4">
                                The Engine
                            </h2>
                            <p className="text-base font-light tracking-tight leading-tight text-white mb-8">
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
                        <h2 className="text-xs font-extrabold uppercase tracking-[0.2em] text-cyan-400/90 mb-4">
                            How It Works
                        </h2>
                        <p className="text-base font-light tracking-tight leading-tight text-white mb-8">
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
                                <div className="mt-2 text-sm font-normal text-white">
                                    {card.title}
                                </div>
                                <p className="text-xs text-slate-400 font-light leading-relaxed">{card.body}</p>
                            </motion.div>
                        ))}
                    </motion.div>
                </section>

                {/* About */}
                <section id={sectionIds.about} className="space-y-6">
                    <motion.div {...fadeUp}>
                        <div className="w-8 h-px bg-cyan-500/50 mb-3" aria-hidden />
                        <h2 className="text-base font-black uppercase tracking-[0.3em] text-cyan-400/90 mb-4">
                            About
                        </h2>
                        <p className="text-base font-light tracking-tight leading-tight text-white mb-8">
                            Built for the next generation of title &amp; underwriting.
                        </p>
                    </motion.div>
                    <div className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)]">
                        <motion.div
                            {...fadeUp}
                            className="space-y-4 text-slate-400 font-light leading-relaxed text-sm"
                        >
                            <p>
                                ParcelIQ transforms static title reports into spatial intelligence. We help title
                                insurers, lenders, and real estate professionals surface risk before closing — when it
                                is still cheap to fix.
                            </p>
                            <div className="grid gap-4 sm:grid-cols-3">
                                <div>
                                    <div className="text-xs font-normal uppercase tracking-[0.18em] text-cyan-400/90">
                                        Mission
                                    </div>
                                    <p className="mt-1 text-xs text-slate-400 font-light leading-relaxed">
                                        Deliver spatially-aware risk tools that slot cleanly into title workflows.
                                    </p>
                                </div>
                                <div>
                                    <div className="text-xs font-normal uppercase tracking-[0.18em] text-cyan-400/90">
                                        Vision
                                    </div>
                                    <p className="mt-1 text-xs text-slate-400 font-light leading-relaxed">
                                        Every closing decision sees beyond the document stack into the parcel itself.
                                    </p>
                                </div>
                                <div>
                                    <div className="text-xs font-normal uppercase tracking-[0.18em] text-cyan-400/90">
                                        Why Now
                                    </div>
                                    <p className="mt-1 text-xs text-slate-400 font-light leading-relaxed">
                                        Climate risk, zoning pressure, and capital intensity demand better tools.
                                    </p>
                                </div>
                            </div>
                        </motion.div>

                        <motion.div
                            {...fadeUp}
                            className="glass-panel space-y-3 border-white/10 bg-card/80 p-5 text-slate-400 font-light leading-relaxed text-xs"
                        >
                            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-400/90 mb-2">
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
                        <h2 className="text-xs font-extrabold uppercase tracking-[0.2em] text-cyan-400/90 mb-4">
                            Security &amp; Compliance
                        </h2>
                        <p className="text-base font-light tracking-tight leading-tight text-white mb-8">
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
                                className="glass-panel flex flex-col gap-2 border-white/5 bg-card/80 p-4"
                            >
                                <div className="flex items-center gap-2 text-xs font-normal text-white">
                                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/10 text-[11px] text-emerald-300">
                                        ✓
                                    </span>
                                    {item.title}
                                </div>
                                <p className="text-xs text-slate-400 font-light leading-relaxed">{item.body}</p>
                            </motion.div>
                        ))}
                    </motion.div>
                </section>

                {/* Insights (combined) */}
                <section id={sectionIds.insights} className="space-y-6">
                    <motion.div {...fadeUp}>
                        <h2 className="text-xs font-extrabold uppercase tracking-[0.2em] text-cyan-400/90 mb-4">
                            Insights
                        </h2>
                        <p className="text-base font-light tracking-tight leading-tight text-white mb-8">
                            Data-driven intelligence for every decision.
                        </p>
                    </motion.div>
                    <motion.div {...fadeUp} className="text-sm text-slate-400 font-light leading-relaxed">
                        <p>Surface risk signals, trends, and recommendations powered by spatial and document analysis.</p>
                    </motion.div>

                    <div className="grid gap-4 md:grid-cols-3" style={{ perspective: '1000px' }}>
                        {[
                            {
                                title: 'The Future of Spatial Title Intelligence',
                                body: 'How parcels, imagery, and LLMs reshape title search and examination.',
                                bullets: [
                                    'Parcel-aligned data replaces static documents for faster triage.',
                                    'Map layers and imagery feed into explainable risk scoring.',
                                    'LLMs summarize findings in underwriter-friendly language.',
                                ],
                            },
                            {
                                title: 'Why Lot Coverage Matters',
                                body: 'Understanding buildable area, encumbrances, and climate-aware density.',
                                bullets: [
                                    'Buildable area vs. zoning caps drives permit and valuation risk.',
                                    'Encumbrances and setbacks reduce effective lot coverage.',
                                    'Climate and drainage rules increasingly tie to impervious limits.',
                                ],
                            },
                            {
                                title: 'Climate Risk and Underwriting',
                                body: 'Moving from map screenshots to quantified spatial risk in your binder.',
                                bullets: [
                                    'Flood, wildfire, and quake exposure quantified at the parcel.',
                                    'Spatial risk scores slot into existing underwriting workflows.',
                                    'Clear documentation supports rep and warranty decisions.',
                                ],
                            },
                        ].map((post, index) => (
                            <motion.article
                                key={post.title}
                                {...fadeUp}
                                className="group relative h-[172px] w-full transition-transform duration-300 hover:-translate-y-2"
                                style={{ transformStyle: 'preserve-3d' }}
                            >
                                <div
                                    className="relative h-full w-full transition-transform duration-500"
                                    style={{
                                        transformStyle: 'preserve-3d',
                                        transform: insightFlippedIndex === index ? 'rotateY(180deg)' : 'rotateY(0deg)',
                                    }}
                                >
                                    {/* Front face */}
                                    <div
                                        className="absolute inset-0 flex flex-col justify-between rounded-xl border border-white/10 bg-card/80 p-3 transition hover:border-primary/50 hover:shadow-glow"
                                        style={{ backfaceVisibility: 'hidden' }}
                                    >
                                        <div>
                                            <div className="text-xs font-semibold text-text-primary">{post.title}</div>
                                            <p className="mt-1 text-xs leading-snug text-text-secondary">{post.body}</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setInsightFlippedIndex(index)}
                                            className="mt-2 w-fit rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-[11px] font-semibold text-primary transition hover:bg-primary/20"
                                        >
                                            Read Overview
                                        </button>
                                    </div>
                                    {/* Back face */}
                                    <div
                                        className="absolute inset-0 flex flex-col overflow-hidden rounded-xl border border-white/10 bg-slate-800 p-3"
                                        style={{
                                            backfaceVisibility: 'hidden',
                                            transform: 'rotateY(180deg)',
                                        }}
                                    >
                                        <div className="shrink-0 text-xs font-semibold text-text-primary">{post.title}</div>
                                        <ul className="mt-1.5 flex min-h-0 flex-1 flex-col justify-center gap-1 text-[11px] leading-snug text-slate-300">
                                            {post.bullets.map((bullet, i) => (
                                                <li key={i} className="flex items-start gap-2">
                                                    <span className="mt-0.5 shrink-0 text-primary">•</span>
                                                    <span>{bullet}</span>
                                                </li>
                                            ))}
                                        </ul>
                                        <button
                                            type="button"
                                            onClick={() => setInsightFlippedIndex(null)}
                                            className="mt-1.5 shrink-0 w-fit rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-text-secondary transition hover:bg-white/10 hover:text-text-primary"
                                        >
                                            Back
                                        </button>
                                    </div>
                                </div>
                            </motion.article>
                        ))}
                    </div>
                </section>

                {/* Metrics */}
                <section id={sectionIds.metrics} className="space-y-6">
                    <motion.div {...fadeUp}>
                        <h2 className="text-xs font-extrabold uppercase tracking-[0.2em] text-cyan-400/90 mb-4">
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
                        className="glass-panel grid grid-cols-2 gap-6 border border-white/10 bg-card/70 px-6 py-8 text-xs text-text-secondary md:grid-cols-4 md:gap-8 rounded-xl shadow-card-soft"
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
                        ].map((m, index) => (
                            <motion.div
                                key={m.label}
                                variants={{
                                    hidden: { opacity: 0, y: 10 },
                                    visible: { opacity: 1, y: 0 },
                                }}
                                className="relative flex flex-col items-center gap-3 text-center"
                            >
                                <div className="text-5xl font-bold tabular-nums md:text-6xl" style={{ color: '#00FFCC' }}>
                                    {m.prefix && <span className="mr-0.5">{m.prefix}</span>}
                                    <CountUp end={m.end} duration={2.2} />
                                    {m.suffix && <span className="ml-0.5">{m.suffix}</span>}
                                </div>
                                <div className="text-xs text-text-secondary max-w-[12rem]">{m.label}</div>
                                {/* Vertical separator: gradient line on the right, hidden on last item and end-of-row on 2-col */}
                                {index < 3 && (
                                    <div
                                        className={`absolute right-0 top-1/2 h-20 w-px -translate-y-1/2 bg-gradient-to-b from-transparent via-slate-700 to-transparent ${index === 1 ? 'hidden md:block' : ''}`}
                                        aria-hidden
                                    />
                                )}
                            </motion.div>
                        ))}
                    </motion.div>
                </section>

                {/* Meet the Team */}
                <section id={sectionIds.team} className="space-y-6 scroll-mt-24">
                    <div>
                        <div className="w-8 h-px bg-cyan-500/50 mb-3" aria-hidden />
                        <h2 className="text-base font-black uppercase tracking-[0.3em] text-cyan-400/90 mb-4">
                            Meet the Team
                        </h2>
                        <p className="text-base font-light tracking-tight leading-tight text-white mb-8">
                            Building the future of spatial risk intelligence.
                        </p>
                    </div>
                    <div className="grid min-h-[400px] grid-cols-1 gap-10 md:grid-cols-3 md:gap-12">
                        {[
                            { name: 'Mario Olivas', role: 'Co-Founder & Product', bio: 'Turning spatial data and product thinking into systems CS students can build on—from capstone ideas to full-stack risk tools.', coordinates: '33.68°N, 117.83°W', linkedin: 'https://www.linkedin.com/in/marioo5/', image: '' },
                            { name: 'Harmeet Singh', role: 'Co-Founder & Engineering', bio: 'Building AI and geospatial pipelines that make explainable risk scoring accessible for students learning ML and data engineering.', coordinates: '33.68°N, 117.83°W', linkedin: 'https://www.linkedin.com/in/harmeet-singh-uppal/', image: '' },
                            { name: 'Allyson Lay', role: 'Co-Founder & Operations', bio: 'Connecting CS talent with real-world impact—operations and partnerships that turn coursework into production-ready intelligence.', coordinates: '33.68°N, 117.83°W', linkedin: 'https://www.linkedin.com/in/allysonlay/', image: '' },
                        ].map((member) => (
                            <div
                                key={member.name}
                                className="group relative flex w-full justify-center"
                            >
                                {/* Card: fixed height; text overlay revealed on hover */}
                                <div className="relative h-[400px] w-full max-w-[280px] overflow-hidden rounded-xl border border-slate-700 bg-slate-900/50 shadow-lg">
                                    <div className="relative h-full w-full overflow-hidden">
                                        {member.image ? (
                                            <img
                                                src={member.image}
                                                alt={member.name}
                                                className="h-full w-full object-cover grayscale contrast-125 transition-transform duration-300 ease-out group-hover:scale-105"
                                            />
                                        ) : (
                                            <div
                                                className="h-full w-full bg-slate-800 grayscale contrast-125 transition-transform duration-300 ease-out group-hover:scale-105"
                                                style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(51, 65, 85, 0.9), rgba(30, 41, 59, 1))' }}
                                                aria-hidden
                                            />
                                        )}
                                        {/* Text overlay: revealed on hover, scrollable when bio expanded */}
                                        <div className="absolute inset-0 flex flex-col justify-end overflow-y-auto bg-gradient-to-t from-slate-900 via-slate-900/85 to-transparent p-6 pb-12 pr-12 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                                            <h3 className="text-xl font-bold tracking-tight text-white">
                                                {member.name}
                                            </h3>
                                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-400/90">
                                                {member.name === 'Mario Olivas' ? (
                                                    <>
                                                        Co-Founder &<br />Product
                                                    </>
                                                ) : (
                                                    member.role
                                                )}
                                            </p>
                                            <div className="mt-1.5 flex flex-col">
                                                <p className={`text-slate-400 font-light leading-relaxed text-xs ${expandedBios[member.name] ? '' : 'line-clamp-2'}`}>
                                                    {member.bio}
                                                </p>
                                                <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); setExpandedBios((prev) => ({ ...prev, [member.name]: !prev[member.name] })); }}
                                                    className="mt-0.5 self-start text-xs font-light text-slate-400 hover:underline"
                                                >
                                                    {expandedBios[member.name] ? 'show less' : '...more'}
                                                </button>
                                            </div>
                                            <a
                                                href={member.linkedin}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="absolute bottom-4 right-4 rounded p-1.5 text-slate-400 transition hover:text-cyan-400"
                                                aria-label={`${member.name} on LinkedIn`}
                                            >
                                                <Linkedin className="h-4 w-4" />
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* No demo form — the experience starts directly with an address. */}
                <section
                    id={sectionIds.demo}
                    className="space-y-5 rounded-2xl border border-dashed border-white/10 bg-black/30 px-6 py-8 text-slate-400 font-light leading-relaxed text-xs"
                >
                    <div className="text-xs font-extrabold uppercase tracking-[0.2em] text-cyan-400/90 mb-4">
                        Open Access
                    </div>
                    <p className="w-full text-slate-400 font-light leading-relaxed">
                        ParcelIQ is available to try directly from the hero search — no sales form or gated demo.
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
