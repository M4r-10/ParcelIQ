/**
 * TitleGuard AI — Footer Component
 */
import React from 'react';

function Footer() {
    return (
        <footer className="border-t border-white/10 bg-black/40">
            <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8 text-xs text-text-secondary lg:flex-row lg:items-start lg:justify-between lg:px-8">
                <div className="space-y-2">
                    <div className="text-sm font-semibold text-text-primary">ParcelIQ</div>
                    <p className="max-w-sm">
                        Spatial intelligence for title, underwriting, and real estate professionals. Reduce closing
                        friction by surfacing risk before it becomes expensive.
                    </p>
                    <div className="text-[11px] text-text-secondary/80">
                        © {new Date().getFullYear()} ParcelIQ. All rights reserved.
                    </div>
                </div>

                <div className="grid flex-1 grid-cols-2 gap-6 sm:grid-cols-4 lg:justify-items-end">
                    <div className="space-y-2">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-secondary">
                            Product
                        </div>
                        <ul className="space-y-1">
                            <li>Spatial Risk</li>
                            <li>AI Risk Engine</li>
                            <li>Platform Overview</li>
                        </ul>
                    </div>
                    <div className="space-y-2">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-secondary">
                            Company
                        </div>
                        <ul className="space-y-1">
                            <li>About</li>
                            <li>Blog</li>
                        </ul>
                    </div>
                    <div className="space-y-2">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-secondary">
                            Security
                        </div>
                        <ul className="space-y-1">
                            <li>Security Overview</li>
                            <li>Compliance</li>
                        </ul>
                    </div>
                    <div className="space-y-2">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-secondary">
                            Legal
                        </div>
                        <ul className="space-y-1">
                            <li>Privacy Policy</li>
                            <li>Terms</li>
                            <li className="mt-2">
                                <span className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-1 text-[11px]">
                                    <span className="h-3 w-3 rounded-full bg-sky-500" />
                                    LinkedIn
                                </span>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </footer>
    );
}

export default Footer;
