/**
 * TitleGuard AI — Address Input Form
 * Hero-style input with sample addresses and loading state.
 */
import React, { useState } from 'react';

const SAMPLE_ADDRESSES = [
    '123 Main St, Irvine, CA 92618',
    '456 Oak Ave, Irvine, CA 92620',
];

function AddressInputForm({ onSubmit, isLoading, error }) {
    const [address, setAddress] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (address.trim() && !isLoading) {
            onSubmit(address.trim());
        }
    };

    const handleSample = (sample) => {
        setAddress(sample);
    };

    return (
        <div className="home__content animate-in">
            <div className="home__eyebrow animate-in--delay-1">
                <span className="home__eyebrow-dot" />
                Spatial Risk Intelligence Engine
            </div>

            <h1 className="home__heading animate-in--delay-2">
                Uncover hidden property risks before they delay your closing
            </h1>

            <p className="home__subheading animate-in--delay-3">
                Enter a property address to generate an AI-powered risk score,
                spatial analysis, and actionable underwriting insights.
            </p>

            <form className="address-form animate-in--delay-4" onSubmit={handleSubmit}>
                <div className="address-form__wrapper">
                    <span className="address-form__icon">📍</span>
                    <input
                        id="address-input"
                        type="text"
                        className="address-form__input"
                        placeholder="Enter property address..."
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        disabled={isLoading}
                        autoComplete="off"
                        autoFocus
                    />
                    <button
                        id="search-button"
                        type="submit"
                        className="address-form__btn"
                        disabled={isLoading || !address.trim()}
                    >
                        {isLoading ? (
                            <>
                                <span className="spinner" />
                                Analyzing
                            </>
                        ) : (
                            'Analyze Risk →'
                        )}
                    </button>
                </div>

                {error && <div className="address-form__error">{error}</div>}

                <div className="address-form__hint">
                    Try a sample address:
                </div>
                <div className="address-form__samples">
                    {SAMPLE_ADDRESSES.map((sample) => (
                        <button
                            type="button"
                            key={sample}
                            className="address-form__sample-btn"
                            onClick={() => handleSample(sample)}
                            disabled={isLoading}
                        >
                            {sample}
                        </button>
                    ))}
                </div>
            </form>
        </div>
    );
}

export default AddressInputForm;
