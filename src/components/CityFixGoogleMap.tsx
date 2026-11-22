import React, { useEffect, useState } from 'react';
import {
  APIProvider,
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMapView,
  Pin,
} from '@vis.gl/react-google-maps';

export interface MapMarkerPoint {
  id: string;
  lat: number;
  lng: number;
  title: string;
  subtitle?: string;
  accentColor?: string;
  badgeText?: string;
}

interface CityFixGoogleMapProps {
  center: { lat: number; lng: number };
  zoom?: number;
  heightClass?: string;
  markers?: MapMarkerPoint[];
  selectedMarkerId?: string | null;
  onMapClick?: (lat: number, lng: number) => void;
  onMarkerClick?: (id: string) => void;
  fallbackNotice?: string;
}

let cachedPublicMapsKey: string | null = null;

export const CityFixGoogleMap: React.FC<CityFixGoogleMapProps> = ({
  center,
  zoom = 13,
  heightClass = 'h-72',
  markers = [],
  onMapClick,
  onMarkerClick,
  fallbackNotice,
}) => {
  const envKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
  const [apiKey, setApiKey] = useState<string>(envKey || cachedPublicMapsKey || '');
  const [activeInfoId, setActiveInfoId] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    if (apiKey) return;
    let active = true;
    fetch('/api/public-config')
      .then((res) => res.json())
      .then((data) => {
        if (active && typeof data.mapsApiKey === 'string' && data.mapsApiKey) {
          cachedPublicMapsKey = data.mapsApiKey;
          setApiKey(data.mapsApiKey);
        }
      })
      .catch(() => {
        // Offline or unavailable
      });
    return () => {
      active = false;
    };
  }, [apiKey]);

  const activeMarker = markers.find((m) => m.id === activeInfoId) ?? null;

  if (!isOnline || !apiKey) {
    return (
      <div
        className={`${heightClass} w-full rounded-md border border-slate-200 bg-slate-100 flex flex-col items-center justify-center px-4 text-center`}
      >
        <p className="text-xs font-semibold text-slate-800">
          {!isOnline
            ? 'Offline Cached Map Mode Active'
            : 'Interactive Google Map Ready When API Key Configured'}
        </p>
        <p className="mt-1 text-[11px] text-slate-600 max-w-md">
          {fallbackNotice ||
            'Using local vector ward coordinates and store-and-forward offline geocoding.'}
        </p>
      </div>
    );
  }

  return (
    <div className={`${heightClass} w-full overflow-hidden rounded-md border border-slate-200`}>
      <APIProvider apiKey={apiKey} libraries={['marker']}>
        <GoogleMapView
          mapId="DEMO_MAP_ID"
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          defaultCenter={center}
          defaultZoom={zoom}
          gestureHandling="greedy"
          disableDefaultUI={false}
          style={{ width: '100%', height: '100%' }}
          onClick={(e) => {
            if (onMapClick && e.detail.latLng) {
              onMapClick(
                Number(e.detail.latLng.lat.toFixed(5)),
                Number(e.detail.latLng.lng.toFixed(5))
              );
            }
          }}
        >
          {markers.map((marker) => (
            <AdvancedMarker
              key={marker.id}
              position={{ lat: marker.lat, lng: marker.lng }}
              title={marker.title}
              onClick={() => {
                setActiveInfoId(marker.id);
                onMarkerClick?.(marker.id);
              }}
            >
              <Pin
                background={marker.accentColor || '#0f4c81'}
                borderColor="#0f172a"
                glyphColor="#ffffff"
                glyphText={marker.badgeText || ''}
              />
            </AdvancedMarker>
          ))}

          {activeMarker && (
            <InfoWindow
              position={{ lat: activeMarker.lat, lng: activeMarker.lng }}
              onCloseClick={() => setActiveInfoId(null)}
            >
              <div className="max-w-xs text-xs text-slate-900 space-y-1">
                <p className="font-semibold">{activeMarker.title}</p>
                {activeMarker.subtitle && (
                  <p className="text-slate-600">{activeMarker.subtitle}</p>
                )}
                <p className="font-mono text-[11px] text-slate-500">
                  {activeMarker.lat.toFixed(5)}, {activeMarker.lng.toFixed(5)}
                </p>
              </div>
            </InfoWindow>
          )}
        </GoogleMapView>
      </APIProvider>
    </div>
  );
};
