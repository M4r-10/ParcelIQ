/**
 * TitleGuard AI — Address Autocomplete Component
 * 
 * Provides a dropdown with real address suggestions powered by
 * the Nominatim (OpenStreetMap) geocoding API. Uses debounced
 * search to avoid excessive API calls.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/** Small map pin icon for address UI. */
function MapPinIcon({ className = '' }) {
    return (
        <svg
            className={className}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
        >
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
        </svg>
    );
}

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const DEBOUNCE_MS = 350;

function AddressAutocomplete({ value, onChange, onSelect, onSubmit, disabled, placeholder, sampleAddresses = [] }) {
    const [suggestions, setSuggestions] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [highlightIndex, setHighlightIndex] = useState(-1);
    const wrapperRef = useRef(null);
    const debounceRef = useRef(null);
    const abortRef = useRef(null);

    // Default options when no API results: synthetic suggestions from sampleAddresses
    const defaultOptions = (sampleAddresses || []).map((shortName) => ({ shortName, lat: null, lng: null }));
    const displayList = suggestions.length > 0 ? suggestions : defaultOptions;
    const showDropdown = isOpen && displayList.length > 0;

    const fetchSuggestions = useCallback(async (query) => {
        if (query.length < 3) {
            setSuggestions([]);
            setIsOpen((sampleAddresses?.length ?? 0) > 0);
            return;
        }

        // Cancel previous in-flight request
        if (abortRef.current) {
            abortRef.current.abort();
        }
        const controller = new AbortController();
        abortRef.current = controller;

        setIsSearching(true);
        try {
            const params = new URLSearchParams({
                q: query,
                format: 'json',
                addressdetails: '1',
                limit: '6',
                countrycodes: 'us',
            });

            const response = await fetch(`${NOMINATIM_URL}?${params}`, {
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json',
                },
            });

            if (!response.ok) throw new Error('Nominatim request failed');

            const data = await response.json();
            const formatted = data.map((item) => ({
                displayName: item.display_name,
                shortName: _formatShortAddress(item),
                lat: parseFloat(item.lat),
                lng: parseFloat(item.lon),
                type: item.type,
                addressDetails: item.address,
            }));

            setSuggestions(formatted);
            setIsOpen(formatted.length > 0 || (sampleAddresses?.length ?? 0) > 0);
            setHighlightIndex(-1);
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error('Address suggestion error:', err);
                setSuggestions([]);
                setIsOpen(false);
            }
        } finally {
            setIsSearching(false);
        }
    }, [sampleAddresses]);

    // Debounced input handler
    const handleInputChange = useCallback((e) => {
        const val = e.target.value;
        onChange(val);

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            fetchSuggestions(val);
        }, DEBOUNCE_MS);
    }, [onChange, fetchSuggestions]);

    // Select a suggestion
    const handleSelect = useCallback((suggestion) => {
        onChange(suggestion.shortName);
        setSuggestions([]);
        setIsOpen(false);
        setHighlightIndex(-1);
        if (onSelect) onSelect(suggestion);
    }, [onChange, onSelect]);

    // Keyboard navigation
    const handleKeyDown = useCallback((e) => {
        if (!isOpen || displayList.length === 0) {
            if (e.key === 'Enter') return; // let form submit
            return;
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setHighlightIndex((prev) =>
                    prev < displayList.length - 1 ? prev + 1 : 0
                );
                break;
            case 'ArrowUp':
                e.preventDefault();
                setHighlightIndex((prev) =>
                    prev > 0 ? prev - 1 : displayList.length - 1
                );
                break;
            case 'Enter':
                if (highlightIndex >= 0 && highlightIndex < displayList.length) {
                    e.preventDefault();
                    handleSelect(displayList[highlightIndex]);
                }
                break;
            case 'Escape':
                setIsOpen(false);
                setHighlightIndex(-1);
                break;
        }
    }, [isOpen, displayList, highlightIndex, handleSelect]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            if (abortRef.current) abortRef.current.abort();
        };
    }, []);

    return (
        <div ref={wrapperRef} className="relative flex-1">
            <div
                className="flex h-10 items-center gap-3 rounded-xl border border-white/10 bg-slate-900/80 px-4 py-2 backdrop-blur-md transition-all duration-300 focus-within:border-cyan-400/60 focus-within:shadow-[0_0_15px_rgba(0,255,204,0.3)]"
            >
                <MapPinIcon className="h-4 w-4 shrink-0 text-cyan-400/80" />
                <input
                    type="text"
                    value={value}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    onFocus={() => {
                        if (suggestions.length > 0) {
                            setIsOpen(true);
                        } else if (value.trim().length >= 3) {
                            fetchSuggestions(value.trim());
                        } else if ((sampleAddresses?.length ?? 0) > 0) {
                            setIsOpen(true);
                        }
                    }}
                    placeholder={placeholder || 'Enter a property address...'}
                    className="h-full w-full bg-transparent text-sm text-text-primary placeholder:text-text-secondary/60 outline-none"
                    disabled={disabled}
                    autoComplete="off"
                    role="combobox"
                    aria-expanded={isOpen}
                    aria-haspopup="listbox"
                    aria-autocomplete="list"
                />
                {isSearching && (
                    <div className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-cyan-400/30 border-t-cyan-400" />
                )}
            </div>

            <AnimatePresence>
                {showDropdown && (
                    <motion.ul
                        initial={{ opacity: 0, y: -4, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -4, scale: 0.98 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        role="listbox"
                        className="absolute left-0 right-0 top-full z-50 mt-2 max-h-72 overflow-y-auto rounded-xl border border-white/10 border-cyan-400/10 bg-slate-900/95 shadow-2xl shadow-black/40 backdrop-blur-xl"
                    >
                        {displayList.map((suggestion, index) => {
                                const county = suggestion.addressDetails?.county || '';
                                const state = suggestion.addressDetails?.state || '';
                                const countyState = [county, state].filter(Boolean).join(', ');
                                const isSample = suggestion.lat == null && suggestion.lng == null;
                                return (
                                    <li
                                        key={isSample ? `sample-${index}-${suggestion.shortName}` : `${suggestion.lat}-${suggestion.lng}-${index}`}
                                        role="option"
                                        aria-selected={index === highlightIndex}
                                        onClick={() => handleSelect(suggestion)}
                                        onMouseEnter={() => setHighlightIndex(index)}
                                        className={`cursor-pointer border-b border-white/5 px-4 py-3 text-sm transition-colors last:border-b-0 ${
                                            index === highlightIndex
                                                ? 'bg-cyan-500/10 text-text-primary'
                                                : 'text-text-secondary hover:bg-white/5 hover:text-text-primary'
                                        }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <MapPinIcon className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400/70" />
                                            <div className="min-w-0 flex-1">
                                                <div className="truncate font-semibold text-text-primary text-[13px]">
                                                    {suggestion.shortName}
                                                </div>
                                                {countyState && (
                                                    <div className="mt-0.5 truncate text-[11px] text-text-secondary/80">
                                                        {countyState}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </li>
                                );
                            })}
                    </motion.ul>
                )}
            </AnimatePresence>
        </div>
    );
}

/** Format a Nominatim result into a short, clean address. */
function _formatShortAddress(item) {
    const addr = item.address || {};
    const parts = [];

    // House number + road
    if (addr.house_number && addr.road) {
        parts.push(`${addr.house_number} ${addr.road}`);
    } else if (addr.road) {
        parts.push(addr.road);
    } else if (item.display_name) {
        // Use first segment of display_name
        const first = item.display_name.split(',')[0].trim();
        parts.push(first);
    }

    // City
    const city = addr.city || addr.town || addr.village || addr.hamlet || '';
    if (city) parts.push(city);

    // State
    if (addr.state) parts.push(addr.state);

    // Zip
    if (addr.postcode) parts.push(addr.postcode);

    return parts.join(', ') || item.display_name;
}

export default AddressAutocomplete;
