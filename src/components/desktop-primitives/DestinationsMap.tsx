import { useEffect, useRef, type CSSProperties } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { MongoliaPlace } from '../../constants/mongoliaPlaces';

interface DestinationsMapProps {
    places: MongoliaPlace[];
    /** Map container height in pixels. Default 340. */
    height?: number;
    /** Border radius applied to the map. Default 20. */
    borderRadius?: number;
}

/**
 * Renders a small OpenStreetMap (via Leaflet) showing tour destinations as
 * numbered pins connected by a dashed line — matches the brand visual the
 * stylized SVG mockup had, but with a real map underneath.
 *
 * Notes:
 * - 100% free / no API key (OpenStreetMap tile server).
 * - Tile attribution is included as required by OSM's license.
 * - Pins are styled as custom DivIcon (white circle with primary teal border
 *   and centered number, matching the original SVG mockup).
 */
export function DestinationsMap({ places, height = 340, borderRadius = 20 }: DestinationsMapProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<L.Map | null>(null);

    useEffect(() => {
        if (!containerRef.current || places.length === 0) return;

        // Initialize map once
        if (!mapRef.current) {
            const map = L.map(containerRef.current, {
                zoomControl: false,
                scrollWheelZoom: false,
                doubleClickZoom: true,
                attributionControl: true,
                dragging: true,
            });
            // OpenStreetMap tile layer — free, no API key required.
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
                maxZoom: 18,
            }).addTo(map);
            L.control.zoom({ position: 'bottomright' }).addTo(map);
            mapRef.current = map;
        }

        const map = mapRef.current;

        // Clear existing markers / polylines (Leaflet doesn't expose a built-in
        // "remove all" so we walk every layer and remove anything that isn't
        // the base tile layer).
        map.eachLayer((layer) => {
            if (!(layer instanceof L.TileLayer)) {
                map.removeLayer(layer);
            }
        });

        // Add numbered markers
        places.forEach((p, i) => {
            const icon = L.divIcon({
                className: 'milkyway-pin',
                html: `<div style="
                    width: 32px;
                    height: 32px;
                    border-radius: 999px;
                    background: #fff;
                    border: 2px solid #0f766e;
                    box-shadow: 0 2px 6px rgba(0,0,0,0.18);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 12px;
                    font-weight: 700;
                    color: #0f766e;
                    font-family: ui-monospace, Menlo, monospace;
                ">${i + 1}</div>`,
                iconSize: [32, 32],
                iconAnchor: [16, 16],
            });
            const marker = L.marker([p.lat, p.lng], { icon }).addTo(map);
            marker.bindPopup(
                `<div style="font-family: 'Pretendard', sans-serif; font-size: 13px;">
                    <div style="font-weight: 700; color: #0e1a18;">${escapeHtml(p.name)}</div>
                    ${p.short ? `<div style="font-size: 11px; color: #64748b; margin-top: 2px;">${escapeHtml(p.short)}</div>` : ''}
                </div>`
            );
        });

        // Draw dashed connecting line between stops (only if 2+ places)
        if (places.length >= 2) {
            const coords: [number, number][] = places.map((p) => [p.lat, p.lng]);
            L.polyline(coords, {
                color: '#115e59',
                weight: 2,
                opacity: 0.7,
                dashArray: '6 6',
            }).addTo(map);
        }

        // Fit map to all pins with padding
        if (places.length === 1) {
            map.setView([places[0].lat, places[0].lng], 8);
        } else {
            const bounds = L.latLngBounds(places.map((p) => [p.lat, p.lng] as [number, number]));
            map.fitBounds(bounds, { padding: [40, 40], maxZoom: 9 });
        }

        return () => {
            // Don't destroy the map on every render; only when component unmounts.
        };
    }, [places]);

    // Clean up the map instance on unmount.
    useEffect(() => {
        return () => {
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, []);

    if (places.length === 0) return null;

    return (
        <div
            ref={containerRef}
            style={{
                width: '100%',
                height,
                borderRadius,
                overflow: 'hidden',
                border: '1px solid var(--border-subtle)',
                background: '#f8fafc',
            } satisfies CSSProperties}
        />
    );
}

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
