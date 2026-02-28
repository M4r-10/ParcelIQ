/**
 * TitleGuard AI — API Client
 *
 * Axios-based client for communicating with the Flask backend.
 */

import axios from 'axios';

// TODO: Set base URL from environment variable
const API_BASE = import.meta.env.VITE_API_BASE || '/api';

const apiClient = axios.create({
    baseURL: API_BASE,
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 30000, // 30 second timeout
});

// ---------------------------------------------------------------------------
// API Methods
// ---------------------------------------------------------------------------

/**
 * Run full property risk analysis for a given address.
 * @param {string} address - The property address to analyze.
 * @param {string} [parcelId] - Optional specific parcel ID.
 * @returns {Promise<object>} Full analysis response.
 */
export async function analyzeProperty(address, parcelId = null) {
    // TODO: Add request validation
    // TODO: Add retry logic for transient failures
    const response = await apiClient.post('/analyze', {
        address,
        parcel_id: parcelId,
    });
    return response.data;
}

/**
 * Fetch parcel GeoJSON data by ID.
 * @param {string} parcelId - The parcel identifier.
 * @returns {Promise<object>} GeoJSON feature.
 */
export async function getParcel(parcelId) {
    // TODO: Add caching for repeated parcel requests
    const response = await apiClient.get(`/parcel/${parcelId}`);
    return response.data;
}

/**
 * Compute risk score from property data.
 * @param {object} propertyData - Property risk factors.
 * @returns {Promise<object>} Risk score and breakdown.
 */
export async function getRiskScore(propertyData) {
    const response = await apiClient.post('/risk-score', propertyData);
    return response.data;
}

/**
 * Generate AI risk summary from risk data.
 * @param {object} riskData - Computed risk score data.
 * @returns {Promise<object>} AI-generated summary.
 */
export async function getAISummary(riskData) {
    // TODO: Implement streaming for real-time text generation
    const response = await apiClient.post('/ai-summary', riskData);
    return response.data;
}

/**
 * Estimate lot coverage via computer vision.
 * @param {object} parcelGeojson - Parcel GeoJSON geometry.
 * @param {string} [imagePath] - Path to satellite image.
 * @returns {Promise<object>} Coverage estimation result.
 */
export async function getCVCoverage(parcelGeojson, imagePath = null) {
    const response = await apiClient.post('/cv-coverage', {
        parcel_geojson: parcelGeojson,
        image_path: imagePath,
    });
    return response.data;
}

/**
 * Health check endpoint.
 * @returns {Promise<object>} Service status.
 */
export async function healthCheck() {
    const response = await apiClient.get('/health');
    return response.data;
}

export default apiClient;
