/**
 * TitleGuard AI — Header Component
 */
import React from 'react';
import { motion } from 'framer-motion';

const navItems = [
    { id: 'hero', label: 'Home' },
    { id: 'product', label: 'Product' },
    { id: 'about', label: 'About' },
];

function Header({ onLogoClick, onHomeClick, onScrollToSection }) {
    return (
        <motion.header
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="fixed inset-x-0 top-0 z-40 border-b border-white/5 bg-background/40 backdrop-blur-2xl"
        >
            <div className="mx-auto flex w-full max-w-full items-center justify-between px-6 py-4 lg:px-8">
                <button
                    onClick={onLogoClick}
                    className="group flex items-center gap-3 rounded-full border border-white/5 bg-white/5 px-3 py-1.5 text-left shadow-sm transition hover:border-primary/60 hover:bg-white/10"
                >
                    <div className="mt-0.5 h-12 w-12 shrink-0 overflow-hidden rounded-full">
                        <img
                            src="/logo.png"
                            alt="ParcelIQ"
                            className="h-full w-full scale-[1.35] object-cover"
                            style={{ objectPosition: '50% 50%' }}
                        />
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
                            onClick={() => (item.id === 'hero' && onHomeClick ? onHomeClick() : onScrollToSection?.(item.id))}
                            className="relative overflow-hidden px-1 py-1 transition hover:text-text-primary"
                        >
                            <span className="relative z-10">{item.label}</span>
                            <span className="absolute inset-x-0 bottom-0 h-px translate-x-[-110%] bg-gradient-to-r from-primary via-primary-flood to-primary transition-transform duration-300 group-hover:translate-x-0" />
                        </button>
                    ))}

                </nav>
            </div>
        </motion.header>
    );
}

export default Header;
