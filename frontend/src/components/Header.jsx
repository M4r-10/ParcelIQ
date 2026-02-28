/**
 * TitleGuard AI — Header Component
 */
import React from 'react';
import { motion } from 'framer-motion';

const navItems = [
    { id: 'product', label: 'Product' },
    { id: 'spatial-risk', label: 'Spatial Risk' },
    { id: 'ai-engine', label: 'AI Engine' },
    { id: 'about', label: 'About' },
    { id: 'security', label: 'Security' },
    { id: 'blog', label: 'Blog' },
];

function Header({ onLogoClick, onScrollToSection }) {
    return (
        <motion.header
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="fixed inset-x-0 top-0 z-40 border-b border-white/5 bg-background/40 backdrop-blur-2xl"
        >
            <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 lg:px-8">
                <button
                    onClick={onLogoClick}
                    className="group flex items-center gap-3 rounded-full border border-white/5 bg-white/5 px-3 py-1.5 text-left shadow-sm transition hover:border-primary/60 hover:bg-white/10"
                >
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-flood text-sm font-bold text-slate-900 shadow-glow">
                        TG
                    </div>
                    <div>
                        <div className="text-sm font-semibold tracking-tight text-text-primary">
                            ParcelIQ
                        </div>
                        <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-text-secondary">
                            Spatial Risk Intelligence
                        </div>
                    </div>
                </button>

                <nav className="hidden items-center gap-6 text-sm text-text-secondary md:flex">
                    {navItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => onScrollToSection?.(item.id)}
                            className="relative overflow-hidden px-1 py-1 transition hover:text-text-primary"
                        >
                            <span className="relative z-10">{item.label}</span>
                            <span className="absolute inset-x-0 bottom-0 h-px translate-x-[-110%] bg-gradient-to-r from-primary via-primary-flood to-primary transition-transform duration-300 group-hover:translate-x-0" />
                        </button>
                    ))}

                    <motion.button
                        whileHover={{ scale: 1.05, boxShadow: '0 0 40px rgba(59, 130, 246, 0.55)' }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => onScrollToSection?.('demo')}
                        className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-slate-950 shadow-glow transition hover:bg-primary-flood"
                    >
                        Request Demo
                    </motion.button>
                </nav>
            </div>
        </motion.header>
    );
}

export default Header;
