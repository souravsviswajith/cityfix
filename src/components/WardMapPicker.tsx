import React, { useState } from 'react';
import { Crosshair, Globe, Grid, MapPin } from 'lucide-react';
import { WARD_ZONES } from '../data/civicDirectory';
import type { WardZone } from '../types/civic';
import { CityFixGoogleMap } from './CityFixGoogleMap';

interface WardMapPickerProps {
  latitude: number;
  longitude: number;
  selectedWard: WardZone;
  onLocationChange: (lat: number, lng: number, explicitWardId?: string) => void;
}

export const WardMapPicker: React.FC<WardMapPickerProps> = ({
  latitude,
  longitude,
  selectedWard,
  onLocationChange,
}) => {
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoNotice, setGeoNotice] = useState<string | null>(null);
  const [mapMode, setMapMode] = useState<'google' | 'offline_grid'>('google');

  const handleDetectGps = () => {
    setGeoNotice(null);
    if (!navigator.geolocation) {
      setGeoNotice('Browser geolocation is unavailable. Click a point on the map or grid.');
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeoLoading(false);
        const lat = Number(position.coords.latitude.toFixed(5));
        const lng = Number(position.coords.longitude.toFixed(5));
        onLocationChange(lat, lng);
        setGeoNotice(
          `GPS lock acquired (${lat.toFixed(4)}, ${lng.toFixed(4)}) ±${Math.round(
            position.coords.accuracy
          )}m and mapped to nearest municipal ward.`
        );
      },
      (err) => {
        setGeoLoading(false);
        setGeoNotice(
          `Location access unavailable (${err.message}). Click the Google Map or ward grid to geotag.`
        );
      },
      { enableHighAccuracy: true, timeout: 6000 }
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-slate-700">
            Interactive Geotagging & Jurisdiction Map
          </p>
          <p className="text-xs text-slate-500">
            Click anywhere on Google Maps or switch to the Offline Ward Grid to assign ward jurisdiction.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md bg-slate-100 p-0.5">
            <button
              type="button"
              onClick={() => setMapMode('google')}
              className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                mapMode === 'google'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Globe className="h-3 w-3" />
              Google Map
            </button>
            <button
              type="button"
              onClick={() => setMapMode('offline_grid')}
              className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                mapMode === 'offline_grid'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Grid className="h-3 w-3" />
              Offline Ward Grid
            </button>
          </div>
          <button
            type="button"
            onClick={handleDetectGps}
            disabled={geoLoading}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60 whitespace-nowrap shrink-0"
          >
            <Crosshair className="h-3.5 w-3.5 text-[#0f4c81]" />
            {geoLoading ? 'Acquiring GPS...' : 'Detect GPS'}
          </button>
        </div>
      </div>

      {mapMode === 'google' ? (
        <CityFixGoogleMap
          center={{ lat: latitude, lng: longitude }}
          zoom={14}
          heightClass="h-56"
          onMapClick={(lat, lng) => onLocationChange(lat, lng)}
          markers={[
            {
              id: 'selected-issue-pin',
              lat: latitude,
              lng: longitude,
              title: `Pinned Incident (${selectedWard.code})`,
              subtitle: `${selectedWard.name} · ${selectedWard.localBodyName}`,
              accentColor: '#0f4c81',
              badgeText: '●',
            },
            ...WARD_ZONES.map((w) => ({
              id: w.id,
              lat: w.centerLat,
              lng: w.centerLng,
              title: `${w.code} · ${w.name}`,
              subtitle: w.district,
              accentColor: w.id === selectedWard.id ? '#0369a1' : '#64748b',
              badgeText: w.code.replace('W-', ''),
            })),
          ]}
          onMarkerClick={(id) => {
            const matched = WARD_ZONES.find((w) => w.id === id);
            if (matched) {
              onLocationChange(matched.centerLat, matched.centerLng, matched.id);
            }
          }}
        />
      ) : (
        <div className="overflow-hidden rounded-md border border-slate-200 bg-slate-50">
          <svg
            viewBox="0 0 400 250"
            className="w-full h-56 select-none"
            role="img"
            aria-label="Interactive offline municipal ward jurisdiction map"
          >
            <defs>
              <pattern id="ward-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path
                  d="M 20 0 L 0 0 0 20"
                  fill="none"
                  stroke="#e2e8f0"
                  strokeWidth="0.75"
                />
              </pattern>
            </defs>
            <rect width="400" height="250" fill="url(#ward-grid)" />
            <path
              d="M 0 114 Q 140 108 265 156 T 400 162"
              fill="none"
              stroke="#cbd5e1"
              strokeWidth="4"
              strokeDasharray="6 4"
            />
            {WARD_ZONES.map((ward) => {
              const isSelected = ward.id === selectedWard.id;
              return (
                <g
                  key={ward.id}
                  onClick={() =>
                    onLocationChange(ward.centerLat, ward.centerLng, ward.id)
                  }
                  className="cursor-pointer"
                >
                  <rect
                    x={ward.svgX}
                    y={ward.svgY}
                    width={ward.svgW}
                    height={ward.svgH}
                    rx={4}
                    fill={isSelected ? '#e0f2fe' : '#ffffff'}
                    stroke={isSelected ? '#0f4c81' : '#cbd5e1'}
                    strokeWidth={isSelected ? 2 : 1}
                  />
                  <text
                    x={ward.svgX + 10}
                    y={ward.svgY + 20}
                    fontSize="10"
                    fontWeight="600"
                    fontFamily="IBM Plex Mono, monospace"
                    fill={isSelected ? '#0f4c81' : '#64748b'}
                  >
                    {ward.code}
                  </text>
                  <text
                    x={ward.svgX + 10}
                    y={ward.svgY + 36}
                    fontSize="10.5"
                    fontWeight="600"
                    fontFamily="Public Sans, sans-serif"
                    fill="#0f172a"
                  >
                    {ward.name.split('&')[0].trim()}
                  </text>
                  {isSelected && (
                    <g
                      transform={`translate(${ward.svgX + ward.svgW - 24}, ${
                        ward.svgY + ward.svgH - 22
                      })`}
                    >
                      <circle cx="8" cy="8" r="7" fill="#0f4c81" />
                      <circle cx="8" cy="8" r="2.5" fill="#ffffff" />
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Identified Ward
          </label>
          <div className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-900">
            <MapPin className="h-3.5 w-3.5 text-[#0f4c81] shrink-0" />
            <span className="truncate">
              {selectedWard.code} · {selectedWard.name}
            </span>
          </div>
        </div>
        <div>
          <label htmlFor="lat-input" className="block text-xs font-medium text-slate-600 mb-1">
            Latitude
          </label>
          <input
            id="lat-input"
            type="number"
            step="0.0001"
            value={latitude}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              if (!Number.isNaN(val)) onLocationChange(val, longitude);
            }}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 tabular-nums focus:border-[#0f4c81] focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="lng-input" className="block text-xs font-medium text-slate-600 mb-1">
            Longitude
          </label>
          <input
            id="lng-input"
            type="number"
            step="0.0001"
            value={longitude}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              if (!Number.isNaN(val)) onLocationChange(latitude, val);
            }}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 tabular-nums focus:border-[#0f4c81] focus:outline-none"
          />
        </div>
      </div>

      {geoNotice && <p className="text-xs text-slate-600">{geoNotice}</p>}
    </div>
  );
};
