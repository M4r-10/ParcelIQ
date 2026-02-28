/**
 * TitleGuard AI — Spatial Risk Visualizer
 *
 * Mapbox GL JS 3D map with extruded parcel, colored overlays, and rotation.
 * Shows a styled placeholder when Mapbox token isn't configured.
 * Rewritten with Tailwind CSS.
 */
import React, { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';

function SpatialVisualizer({ analysisResult, activeLayers }) {
    const mapContainerRef = useRef(null);
    const mapRef = useRef(null);
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
                zoom: 17,
                pitch: 55,
                bearing: -25,
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

        // Slow auto-rotate
        let frame;
        const rotate = () => {
            if (mapRef.current) {
                mapRef.current.rotateTo((mapRef.current.getBearing() + 0.05) % 360, { duration: 0 });
            }
            frame = requestAnimationFrame(rotate);
        };

        map.on('load', () => { rotate(); });

        return () => {
            cancelAnimationFrame(frame);
            map.remove();
            mapRef.current = null;
            setMapReady(false);
        };
    }, [token]);

    // ── Update data on new analysis ──
    useEffect(() => {
        if (!mapRef.current || !mapReady || !analysisResult) return;
        const map = mapRef.current;
        const { location, parcel, layers } = analysisResult;

        if (location) {
            map.flyTo({
                center: [location.lng, location.lat],
                zoom: 17, pitch: 55, bearing: -25, duration: 2000,
            });
        }

        if (parcel) {
            const src = map.getSource('parcel');
            if (src) src.setData({ type: 'FeatureCollection', features: [parcel] });
        }

        if (layers?.flood_zone?.geometry) {
            const src = map.getSource('flood-zone');
            if (src) src.setData({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: layers.flood_zone.geometry, properties: {} }] });
        }

        if (layers?.easements?.geometry) {
            const src = map.getSource('easement');
            if (src) src.setData({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: layers.easements.geometry, properties: {} }] });
        }
    }, [analysisResult, mapReady]);

    // ── Toggle layer visibility ──
    useEffect(() => {
        if (!mapRef.current || !mapReady || !activeLayers) return;
        const map = mapRef.current;

        const layerMap = {
            floodZone: 'flood-zone-fill',
            easement: 'easement-fill',
            buildableArea: 'buildable-fill',
            encumberedArea: 'encumbered-fill',
            buildingFootprint: 'footprint-fill',
        };

        for (const [key, layerId] of Object.entries(layerMap)) {
            if (map.getLayer(layerId)) {
                map.setLayoutProperty(layerId, 'visibility', activeLayers[key] ? 'visible' : 'none');
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
    map.addSource('flood-zone', { type: 'geojson', data: empty });
    map.addSource('easement', { type: 'geojson', data: empty });
    map.addSource('buildable', { type: 'geojson', data: empty });
    map.addSource('encumbered', { type: 'geojson', data: empty });
    map.addSource('footprint', { type: 'geojson', data: empty });
}

function addLayers(map) {
    map.addLayer({ id: 'parcel-extrusion', type: 'fill-extrusion', source: 'parcel', paint: { 'fill-extrusion-color': '#ffffff', 'fill-extrusion-height': 3, 'fill-extrusion-opacity': 0.15 } });
    map.addLayer({ id: 'parcel-outline', type: 'line', source: 'parcel', paint: { 'line-color': '#ffffff', 'line-width': 2, 'line-opacity': 0.6 } });
    map.addLayer({ id: 'flood-zone-fill', type: 'fill-extrusion', source: 'flood-zone', layout: { visibility: 'none' }, paint: { 'fill-extrusion-color': '#3b82f6', 'fill-extrusion-height': 5, 'fill-extrusion-opacity': 0.35 } });
    map.addLayer({ id: 'easement-fill', type: 'fill-extrusion', source: 'easement', layout: { visibility: 'none' }, paint: { 'fill-extrusion-color': '#ef4444', 'fill-extrusion-height': 6, 'fill-extrusion-opacity': 0.45 } });
    map.addLayer({ id: 'buildable-fill', type: 'fill', source: 'buildable', layout: { visibility: 'none' }, paint: { 'fill-color': '#22c55e', 'fill-opacity': 0.2 } });
    map.addLayer({ id: 'encumbered-fill', type: 'fill', source: 'encumbered', layout: { visibility: 'none' }, paint: { 'fill-color': '#991b1b', 'fill-opacity': 0.4 } });
    map.addLayer({ id: 'footprint-fill', type: 'fill-extrusion', source: 'footprint', layout: { visibility: 'none' }, paint: { 'fill-extrusion-color': '#ffffff', 'fill-extrusion-height': 8, 'fill-extrusion-opacity': 0.5 } });
}

export default SpatialVisualizer;
