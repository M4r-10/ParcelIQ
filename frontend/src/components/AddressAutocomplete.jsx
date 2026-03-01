/**
 * TitleGuard AI — Address Autocomplete Component
 * 
 * Provides a dropdown with real address suggestions powered by
 * the Nominatim (OpenStreetMap) geocoding API. Uses debounced
 * search to avoid excessive API calls.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const DEBOUNCE_MS = 350;

function AddressAutocomplete({ value, onChange, onSelect, onSubmit, disabled, placeholder }) {
    const [suggestions, setSuggestions] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [highlightIndex, setHighlightIndex] = useState(-1);
    const wrapperRef = useRef(null);
    const debounceRef = useRef(null);
    const abortRef = useRef(null);

    // Fetch suggestions from Nominatim
    const fetchSuggestions = useCallback(async (query) => {
        if (query.length < 3) {
            setSuggestions([]);
            setIsOpen(false);
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
            setIsOpen(formatted.length > 0);
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
    }, []);

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
        if (!isOpen || suggestions.length === 0) {
            if (e.key === 'Enter') return; // let form submit
            return;
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setHighlightIndex((prev) =>
                    prev < suggestions.length - 1 ? prev + 1 : 0
                );
                break;
            case 'ArrowUp':
                e.preventDefault();
                setHighlightIndex((prev) =>
                    prev > 0 ? prev - 1 : suggestions.length - 1
                );
                break;
            case 'Enter':
                if (highlightIndex >= 0 && highlightIndex < suggestions.length) {
                    e.preventDefault();
                    handleSelect(suggestions[highlightIndex]);
                }
                break;
            case 'Escape':
                setIsOpen(false);
                setHighlightIndex(-1);
                break;
        }
    }, [isOpen, suggestions, highlightIndex, handleSelect]);

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
            <div className="flex items-center gap-2 px-2">
                <span className="text-lg">📍</span>
                <input
                    type="text"
                    value={value}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    onFocus={() => {
                        if (suggestions.length > 0) setIsOpen(true);
                    }}
                    placeholder={placeholder || 'Enter a property address...'}
                    className="h-10 w-full bg-transparent text-sm text-text-primary placeholder:text-text-secondary/60 outline-none"
                    disabled={disabled}
                    autoComplete="off"
                    role="combobox"
                    aria-expanded={isOpen}
                    aria-haspopup="listbox"
                    aria-autocomplete="list"
                />
                {isSearching && (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                )}
            </div>

            <AnimatePresence>
                {isOpen && suggestions.length > 0 && (
                    <motion.ul
                        initial={{ opacity: 0, y: -4, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -4, scale: 0.98 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        role="listbox"
                        className="absolute left-0 right-0 top-full z-50 mt-2 max-h-72 overflow-y-auto rounded-xl border border-white/10 bg-slate-900/95 shadow-2xl shadow-black/40 backdrop-blur-xl"
                    >
                        {suggestions.map((suggestion, index) => (
                            <li
                                key={`${suggestion.lat}-${suggestion.lng}-${index}`}
                                role="option"
                                aria-selected={index === highlightIndex}
                                onClick={() => handleSelect(suggestion)}
                                onMouseEnter={() => setHighlightIndex(index)}
                                className={`cursor-pointer border-b border-white/5 px-4 py-3 text-sm transition-colors last:border-b-0 ${
                                    index === highlightIndex
                                        ? 'bg-primary/15 text-text-primary'
                                        : 'text-text-secondary hover:bg-white/5 hover:text-text-primary'
                                }`}
                            >
                                <div className="flex items-start gap-3">
                                    <span className="mt-0.5 text-xs opacity-50">
                                        {_getTypeIcon(suggestion.type)}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <div className="truncate font-medium text-text-primary text-[13px]">
                                            {suggestion.shortName}
                                        </div>
                                        <div className="mt-0.5 truncate text-[11px] text-text-secondary/70">
                                            {suggestion.displayName}
                                        </div>
                                    </div>
                                </div>
                            </li>
                        ))}
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

/** Map Nominatim type to an icon. */
function _getTypeIcon(type) {
    const icons = {
        house: '🏠',
        building: '🏢',
        apartments: '🏢',
        residential: '🏘️',
        commercial: '🏪',
        industrial: '🏭',
        school: '🏫',
        hospital: '🏥',
        church: '⛪',
    };
    return icons[type] || '📍';
}

export default AddressAutocomplete;
