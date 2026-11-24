'use client';
import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

export interface PulseReport {
  id: string; refNo: string; title: string; status: string; severity: string;
  lat: number; lng: number; jurisdictionName: string;
}

const STATUS_COLOR: Record<string, string> = {
  submitted: '#e8590c',
  acknowledged: '#0b5cad',
  in_progress: '#6d28d9',
  resolved: '#15803d',
};
const SEV_RADIUS: Record<string, number> = { low: 6, medium: 8, high: 10, emergency: 13 };

export default function PulseMap({ reports }: { reports: PulseReport[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = L.map(ref.current, { scrollWheelZoom: false }).setView([10.3, 76.3], 7);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '© OpenStreetMap contributors',
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 150);
    return () => { map.remove(); mapRef.current = null; layerRef.current = null; };
  }, []);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.clearLayers();
    for (const r of reports) {
      const m = L.circleMarker([r.lat, r.lng], {
        radius: SEV_RADIUS[r.severity] ?? 8,
        color: '#ffffff',
        weight: 2,
        fillColor: STATUS_COLOR[r.status] ?? '#e8590c',
        fillOpacity: 0.9,
      });
      m.bindPopup(
        `<div style="font-family:'Public Sans',sans-serif"><div style="font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.08em;color:#5b6b62">${r.refNo}</div>` +
        `<strong style="font-size:13px">${escapeHtml(r.title)}</strong><br/><span style="font-size:11px;color:#5b6b62">${escapeHtml(r.jurisdictionName)} · ${r.status.replace('_', ' ')}</span></div>`
      );
      m.addTo(layer);
    }
  }, [reports]);

  return <div ref={ref} style={{ height: 440 }} className="w-full overflow-hidden rounded-2xl border border-line" role="application" aria-label="Map of community civic reports" />;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}
