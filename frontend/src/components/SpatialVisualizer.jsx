/**
 * TitleGuard AI — Spatial Risk Visualizer
 *
 * Mapbox GL JS 3D map with extruded parcel, colored overlays, and rotation.
 * Shows a styled placeholder when Mapbox token isn't configured.
 * Rewritten with Tailwind CSS.
 */
import React, { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';

function SpatialVisualizer({ analysisResult, activeLayers, initialLocation, address }) {
    const mapContainerRef = useRef(null);
    const mapRef = useRef(null);
    const markerRef = useRef(null);
    const flyingRef = useRef(false);
    const interactingRef = useRef(false);
    const [mapReady, setMapReady] = useState(false);
    const [noToken, setNoToken] = useState(false);

    const token = import.meta.env.VITE_MAPBOX_TOKEN || '';

    const [webglError, setWebglError] = useState(false);

    // ── Initialize map ──
    useEffect(() => {
        if (!token) {
            setNoToken(true);
            return;
        }

        // Check WebGL support before trying to create the map
        if (!mapboxgl.supported()) {
            setWebglError(true);
            return;
        }

        mapboxgl.accessToken = token;

        let map;
        try {
            map = new mapboxgl.Map({
                container: mapContainerRef.current,
                style: 'mapbox://styles/mapbox/dark-v11',
                center: [-117.8265, 33.6846],
                zoom: 12,
                pitch: 45,
                bearing: -15,
                antialias: true,
                failIfMajorPerformanceCaveat: false,
            });
        } catch (e) {
            console.warn('Mapbox GL failed to initialize:', e.message);
            setWebglError(true);
            return;
        }

        map.addControl(new mapboxgl.NavigationControl({ showCompass: true }), 'bottom-right');

        map.on('load', () => {
            mapRef.current = map;
            setMapReady(true);
            addSources(map);
            addLayers(map);
        });

        // Track user interaction to pause rotation
        let interactTimeout = null;
        const startInteraction = () => {
            interactingRef.current = true;
            if (interactTimeout) clearTimeout(interactTimeout);
        };
        const resumeRotation = () => {
             if (interactTimeout) clearTimeout(interactTimeout);
             interactTimeout = setTimeout(() => { interactingRef.current = false; }, 2500);
        };

        map.on('mousedown', startInteraction);
        map.on('dragstart', startInteraction);
        map.on('touchstart', startInteraction);
        map.on('wheel', startInteraction);

        map.on('mouseup', resumeRotation);
        map.on('dragend', resumeRotation);
        map.on('touchend', resumeRotation);

        // Slow auto-rotate (paused during flyTo or user interaction)
        let frame;
        const rotate = () => {
            if (mapRef.current && !flyingRef.current && !interactingRef.current) {
                mapRef.current.rotateTo((mapRef.current.getBearing() + 0.05) % 360, { duration: 0 });
            }
            frame = requestAnimationFrame(rotate);
        };

        map.on('load', () => { rotate(); });

        return () => {
            map.remove();
            mapRef.current = null;
            setMapReady(false);
        };
    }, [token]);

    // ── Pre-flight to initial location (quick pan while backend loads) ──
    useEffect(() => {
        if (!mapRef.current || !mapReady || !initialLocation) return;

        flyingRef.current = true;
        mapRef.current.flyTo({
            center: [initialLocation.lng, initialLocation.lat],
            zoom: 17, pitch: 55, bearing: -25, duration: 2000,
        });
        mapRef.current.once('moveend', () => {
            flyingRef.current = false;
        });
    }, [initialLocation, mapReady]);

    // ── Update data on new analysis (uses backend's authoritative geocode) ──
    useEffect(() => {
        if (!mapRef.current || !mapReady || !analysisResult) return;
        const map = mapRef.current;
        const { location, parcel, building, layers, address: resultAddress } = analysisResult;

        // 4) Dynamic AI Flood Zone
        if (analysisResult.ai_flood_zone && map.getSource('ai-flood-zone')) {
            map.getSource('ai-flood-zone').setData(analysisResult.ai_flood_zone);
        } else if (map.getSource('ai-flood-zone')) {
             map.getSource('ai-flood-zone').setData({ type: 'FeatureCollection', features: [] });
        }

        // 5) Historical Wildfire Zones
        if (analysisResult.wildfire_zones && map.getSource('wildfire-zone')) {
            map.getSource('wildfire-zone').setData(analysisResult.wildfire_zones);
        } else if (map.getSource('wildfire-zone')) {
             map.getSource('wildfire-zone').setData({ type: 'FeatureCollection', features: [] });
        }

        // 6) Historical Earthquake Zones (Points)
        if (analysisResult.earthquake_zones && map.getSource('earthquake-zone')) {
            map.getSource('earthquake-zone').setData(analysisResult.earthquake_zones);
        } else if (map.getSource('earthquake-zone')) {
             map.getSource('earthquake-zone').setData({ type: 'FeatureCollection', features: [] });
        }

        const displayAddress = address || resultAddress || 'Target Property';

        // Remove old marker
        if (markerRef.current) {
            markerRef.current.remove();
            markerRef.current = null;
        }

        if (location) {
            const coords = [location.lng, location.lat];

            // Pause auto-rotate and fly to the property
            flyingRef.current = true;
            map.flyTo({
                center: coords,
                zoom: 18, pitch: 55, bearing: -25, duration: 2500,
            });
            // Resume auto-rotation after flyTo completes
            map.once('moveend', () => {
                flyingRef.current = false;
            });

            // Create custom marker element (beautiful gradient pin)
            const el = document.createElement('div');
            el.className = 'target-marker';
            el.innerHTML = `
                <div style="
                    background: linear-gradient(135deg, #2563eb, #7c3aed);
                    color: white;
                    padding: 6px 12px;
                    border-radius: 8px;
                    font-size: 12px;
                    font-weight: 600;
                    white-space: nowrap;
                    box-shadow: 0 4px 20px rgba(37,99,235,0.5);
                    border: 1px solid rgba(255,255,255,0.2);
                    pointer-events: none;
                ">
                    <div style="display:flex;align-items:center;gap:6px;">
                        <span style="font-size:14px;">📍</span>
                        <span>${displayAddress}</span>
                    </div>
                </div>
                <div style="
                    width: 2px; height: 30px;
                    background: linear-gradient(to bottom, #2563eb, transparent);
                    margin: 0 auto;
                "></div>
                <div style="
                    width: 8px; height: 8px;
                    background: #2563eb;
                    border-radius: 50%;
                    margin: 0 auto;
                    box-shadow: 0 0 12px 4px rgba(37,99,235,0.6);
                    animation: pulse-ring 2s ease-out infinite;
                "></div>
                <style>
                    @keyframes pulse-ring {
                        0% { transform:scale(0.8); box-shadow: 0 0 0 0 rgba(37,99,235,0.6); }
                        70% { transform:scale(1.2); box-shadow: 0 0 0 8px rgba(37,99,235,0); }
                        100% { transform:scale(0.8); box-shadow: 0 0 0 0 rgba(37,99,235,0); }
                    }
                </style>
            `;

            markerRef.current = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
                .setLngLat(coords)
                .addTo(map);

            // Highlight the building at this location after the flyTo completes
            setTimeout(() => {
                if (!mapRef.current) return;
                highlightBuildingAt(map, coords);
            }, 2600);
        }

        // Update building footprint source if we have it
        if (building?.geometry) {
            const src = map.getSource('footprint');
            if (src) src.setData({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: building.geometry, properties: {} }] });
            // Auto-show the building footprint layer
            if (map.getLayer('footprint-fill')) {
                map.setLayoutProperty('footprint-fill', 'visibility', 'visible');
            }
        }

        if (parcel) {
            const src = map.getSource('parcel');
            if (src) src.setData({ type: 'FeatureCollection', features: [parcel] });
        }

        if (layers?.easements?.geometry) {
            const src = map.getSource('easement');
            if (src) src.setData({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: layers.easements.geometry, properties: {} }] });
        }
    }, [analysisResult, mapReady, address]);

    // ── Toggle layer visibility ──
    useEffect(() => {
        if (!mapRef.current || !mapReady || !activeLayers) return;
        const map = mapRef.current;

        // ── Manage Toggles ──
        const layerMap = {
            floodZone: ['ai-flood-fill', 'ai-flood-outline'],
            wildfireZone: ['wildfire-fill', 'wildfire-outline'],
            earthquakeZone: ['earthquake-points'],
            easement: ['easement-fill'],
            buildableArea: ['buildable-fill'],
            encumberedArea: ['encumbered-fill'],
            buildingFootprint: ['footprint-fill'],
        };

        for (const [key, layerIds] of Object.entries(layerMap)) {
            const vis = activeLayers[key] ? 'visible' : 'none';
            for (const layerId of layerIds) {
                if (map.getLayer(layerId)) {
                    map.setLayoutProperty(layerId, 'visibility', vis);
                }
            }
        }
    }, [activeLayers, mapReady]);

    // ── Placeholder when no token ──
    if (noToken) {
        return (
            <div ref={mapContainerRef} className="flex h-full w-full flex-col items-center justify-center gap-4 bg-[radial-gradient(ellipse_at_center,_rgba(255,255,255,0.02),_transparent_70%)] bg-background-subtle">
                <div className="text-5xl opacity-30">🌍</div>
                <p className="max-w-[280px] text-center text-sm text-text-secondary">
                    3D Spatial Risk Viewer
                </p>
                <span className="rounded-md bg-white/[0.03] px-3 py-1 font-mono text-[10px] text-text-secondary">
                    Set VITE_MAPBOX_TOKEN in .env
                </span>
            </div>
        );
    }

    // ── Fallback when WebGL is unavailable ──
    if (webglError) {
        return (
            <div ref={mapContainerRef} className="flex h-full w-full flex-col items-center justify-center gap-4 bg-[radial-gradient(ellipse_at_center,_rgba(255,255,255,0.02),_transparent_70%)] bg-background-subtle">
                <div className="text-5xl opacity-30">🗺️</div>
                <p className="max-w-[280px] text-center text-sm text-text-secondary">
                    3D Spatial Viewer requires WebGL
                </p>
                <span className="rounded-md bg-white/[0.03] px-3 py-1 font-mono text-[10px] text-text-secondary">
                    Enable hardware acceleration in your browser settings
                </span>
            </div>
        );
    }

    return (
        <div
            ref={mapContainerRef}
            id="spatial-viewer"
            className="h-full w-full"
        />
    );
}

// ── Source & Layer Setup ──

function addSources(map) {
    const empty = { type: 'FeatureCollection', features: [] };
    map.addSource('parcel', { type: 'geojson', data: empty });
    
    // Dynamic AI flood highlighting zone
    map.addSource('ai-flood-zone', { type: 'geojson', data: empty });
    
    // Historical wildfire perimeters
    map.addSource('wildfire-zone', { type: 'geojson', data: empty });
    
    // Historical earthquake points
    map.addSource('earthquake-zone', { type: 'geojson', data: empty });
    
    map.addSource('easement', { type: 'geojson', data: empty });
    map.addSource('buildable', { type: 'geojson', data: empty });
    map.addSource('encumbered', { type: 'geojson', data: empty });
    map.addSource('footprint', { type: 'geojson', data: empty });
    map.addSource('highlight-building', { type: 'geojson', data: empty });
}

function addLayers(map) {
    // Standard mapbox 3D buildings
    map.addLayer(
        {
            'id': '3d-buildings',
            'source': 'composite',
            'source-layer': 'building',
            'filter': ['==', 'extrude', 'true'],
            'type': 'fill-extrusion',
            'minzoom': 14,
            'paint': {
                'fill-extrusion-color': '#2a2a35',
                'fill-extrusion-height': ['get', 'height'],
                'fill-extrusion-base': ['get', 'min_height'],
                'fill-extrusion-opacity': 0.8
            }
        },
        // Insert it below our custom layers if we want, but standard is just add at the end
    );

    map.addLayer({ id: 'parcel-extrusion', type: 'fill-extrusion', source: 'parcel', paint: { 'fill-extrusion-color': '#ffffff', 'fill-extrusion-height': 3, 'fill-extrusion-opacity': 0.15 } });
    map.addLayer({ id: 'parcel-outline', type: 'line', source: 'parcel', paint: { 'line-color': '#ffffff', 'line-width': 2, 'line-opacity': 0.6 } });
    
    // Real FEMA NFHL Flood Zone Polygons
    map.addLayer(
        {
            id: 'ai-flood-fill',
            type: 'fill',
            source: 'ai-flood-zone',
            layout: { visibility: 'none' },
            paint: {
                // Color intensity based on zone severity weight
                'fill-color': [
                    'interpolate',
                    ['linear'],
                    ['coalesce', ['get', 'severity'], 0.5],
                    0.5, 'rgba(59, 130, 246, 0.25)',   // lighter blue for lower risk
                    0.7, 'rgba(37, 99, 235, 0.35)',    // medium blue
                    0.85, 'rgba(29, 78, 216, 0.45)',   // deep blue for AE zones
                    1.0, 'rgba(30, 64, 175, 0.55)',    // darkest blue for VE zones
                ],
                'fill-opacity': 0.6,
            }
        },
        '3d-buildings'
    );

    // Outline for the flood zone polygons
    map.addLayer(
        {
            id: 'ai-flood-outline',
            type: 'line',
            source: 'ai-flood-zone',
            layout: { visibility: 'none' },
            paint: {
                'line-color': '#3B82F6',
                'line-width': 1.5,
                'line-opacity': 0.7,
            }
        },
        '3d-buildings'
    );

    // Real NIFC Historical Wildfire Polygons
    map.addLayer(
        {
            id: 'wildfire-fill',
            type: 'fill',
            source: 'wildfire-zone',
            layout: { visibility: 'none' },
            paint: {
                // Color intensity based on zone severity weight
                'fill-color': [
                    'interpolate',
                    ['linear'],
                    ['coalesce', ['get', 'severity'], 0.5],
                    0.2, 'rgba(251, 146, 60, 0.25)',   // lighter orange 
                    0.5, 'rgba(249, 115, 22, 0.35)',   // medium orange
                    0.8, 'rgba(234, 88, 12, 0.45)',    // deep orange
                    1.0, 'rgba(194, 65, 12, 0.55)',    // darkest red-orange
                ],
                'fill-opacity': 0.6,
            }
        },
        '3d-buildings'
    );

    // Outline for the wildfire polygons
    map.addLayer(
        {
            id: 'wildfire-outline',
            type: 'line',
            source: 'wildfire-zone',
            layout: { visibility: 'none' },
            paint: {
                'line-color': '#F97316',
                'line-width': 1.5,
                'line-opacity': 0.7,
            }
        },
        '3d-buildings'
    );

    // Real USGS Historical Earthquakes (Points)
    map.addLayer(
        {
            id: 'earthquake-points',
            type: 'circle',
            source: 'earthquake-zone',
            layout: { visibility: 'none' },
            paint: {
                // Size expands based on earthquake magnitude severity
                'circle-radius': [
                    'interpolate',
                    ['linear'],
                    ['coalesce', ['get', 'severity'], 0.5],
                    0.2, 8,
                    0.6, 16,
                    1.0, 32,
                ],
                'circle-color': '#A855F7', // Purple
                'circle-opacity': 0.6,
                'circle-stroke-width': 1.5,
                'circle-stroke-color': '#ffffff',
                'circle-blur': 0.3, // Adds a glowing effect
            }
        },
        '3d-buildings'
    );

    map.addLayer({ id: 'easement-fill', type: 'fill-extrusion', source: 'easement', layout: { visibility: 'none' }, paint: { 'fill-extrusion-color': '#ef4444', 'fill-extrusion-height': 6, 'fill-extrusion-opacity': 0.45 } });
    map.addLayer({ id: 'buildable-fill', type: 'fill', source: 'buildable', layout: { visibility: 'none' }, paint: { 'fill-color': '#22c55e', 'fill-opacity': 0.2 } });
    map.addLayer({ id: 'encumbered-fill', type: 'fill', source: 'encumbered', layout: { visibility: 'none' }, paint: { 'fill-color': '#991b1b', 'fill-opacity': 0.4 } });
    map.addLayer({ id: 'footprint-fill', type: 'fill-extrusion', source: 'footprint', layout: { visibility: 'none' }, paint: { 'fill-extrusion-color': '#ffffff', 'fill-extrusion-height': 8, 'fill-extrusion-opacity': 0.5 } });

    // Highlighted target building layer (bright cyan glow)
    map.addLayer({
        id: 'highlight-building-fill',
        type: 'fill-extrusion',
        source: 'highlight-building',
        paint: {
            'fill-extrusion-color': '#38bdf8',
            'fill-extrusion-height': ['coalesce', ['get', 'height'], 12],
            'fill-extrusion-base': ['coalesce', ['get', 'min_height'], 0],
            'fill-extrusion-opacity': 0.85,
        },
    });
}

/**
 * Query the 3D building layer at the given coordinates and
 * copy the matched building geometry into the highlight source.
 */
function highlightBuildingAt(map, lngLat) {
    try {
        const point = map.project(lngLat);
        // Query in a small box around the point to catch the building
        const bbox = [
            [point.x - 5, point.y - 5],
            [point.x + 5, point.y + 5],
        ];
        const features = map.queryRenderedFeatures(bbox, { layers: ['3d-buildings'] });

        const src = map.getSource('highlight-building');
        if (features.length > 0 && src) {
            // Take the first (closest) building feature
            const building = features[0];
            src.setData({
                type: 'FeatureCollection',
                features: [{
                    type: 'Feature',
                    geometry: building.geometry,
                    properties: building.properties || {},
                }],
            });
        } else if (src) {
            // No building found — clear the highlight
            src.setData({ type: 'FeatureCollection', features: [] });
        }
    } catch (err) {
        console.warn('Could not highlight building:', err);
    }
}

export default SpatialVisualizer;
