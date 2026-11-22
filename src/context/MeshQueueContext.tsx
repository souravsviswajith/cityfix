import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  loadLocalCemnPackets,
  saveLocalCemnPackets,
} from '../services/cemnMeshEngine';
import type { CemnPacket, MeshOperatingMode } from '../types/civic';

interface MeshQueueContextValue {
  isBrowserOnline: boolean;
  operatingMode: MeshOperatingMode;
  setOperatingMode: React.Dispatch<React.SetStateAction<MeshOperatingMode>>;
  packets: CemnPacket[];
  setPackets: React.Dispatch<React.SetStateAction<CemnPacket[]>>;
  queuedCount: number;
}

const MeshQueueContext = createContext<MeshQueueContextValue | null>(null);

export const MeshQueueProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isBrowserOnline, setIsBrowserOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [operatingMode, setOperatingMode] = useState<MeshOperatingMode>(() =>
    typeof navigator !== 'undefined' && !navigator.onLine ? 'DISCONNECTED' : 'CONNECTED'
  );
  const [packets, setPacketsState] = useState<CemnPacket[]>(() =>
    loadLocalCemnPackets()
  );

  const setPackets: React.Dispatch<React.SetStateAction<CemnPacket[]>> = useCallback(
    (updater) => {
      setPacketsState((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        saveLocalCemnPackets(next);
        return next;
      });
    },
    []
  );

  useEffect(() => {
    const handleOnline = () => {
      setIsBrowserOnline(true);
      setOperatingMode('CONNECTED');
    };
    const handleOffline = () => {
      setIsBrowserOnline(false);
      setOperatingMode('DISCONNECTED');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const queuedCount = useMemo(
    () => packets.filter((p) => !p.syncedToCloud).length,
    [packets]
  );

  const value = useMemo<MeshQueueContextValue>(
    () => ({
      isBrowserOnline,
      operatingMode,
      setOperatingMode,
      packets,
      setPackets,
      queuedCount,
    }),
    [isBrowserOnline, operatingMode, packets, setPackets, queuedCount]
  );

  return (
    <MeshQueueContext.Provider value={value}>
      {children}
    </MeshQueueContext.Provider>
  );
};

export function useMeshQueue(): MeshQueueContextValue {
  const ctx = useContext(MeshQueueContext);
  if (!ctx) {
    throw new Error('useMeshQueue must be used inside MeshQueueProvider');
  }
  return ctx;
}
