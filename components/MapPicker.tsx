'use client';
import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

interface Props {
  lat: number | null;
  lng: number | null;
  onPick?: (lat: number, lng: number) => void;
  height?: number;
}

export default function MapPicker({ lat, lng, onPick, height = 280 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.CircleMarker | null>(null);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = L.map(ref.current, { scrollWheelZoom: false, attributionControl: true }).setView([lat ?? 10.16, lng ?? 76.27], lat != null ? 15 : 7);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors',
    }).addTo(map);
    map.on('click', (e: L.LeafletMouseEvent) => {
      pickRef.current?.(round(e.latlng.lat), round(e.latlng.lng));
    });
    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 120);
    return () => { map.remove(); mapRef.current = null; markerRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (lat == null || lng == null) {
      if (markerRef.current) { markerRef.current.remove(); markerRef.current = null; }
      return;
    }
    if (!markerRef.current) {
      markerRef.current = L.circleMarker([lat, lng], {
        radius: 13, color: '#fff', weight: 3, fillColor: '#d9480f', fillOpacity: 1,
      }).addTo(map);
    } else {
      markerRef.current.setLatLng([lat, lng]);
    }
  }, [lat, lng]);

  return <div ref={ref} style={{ height }} className="w-full overflow-hidden rounded-2xl border border-line" aria-label="Map — tap to set report location" role="application" />;
}

const round = (n: number) => Math.round(n * 1e6) / 1e6;
