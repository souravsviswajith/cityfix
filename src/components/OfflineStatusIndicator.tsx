import React from 'react';
import { AlertTriangle, Wifi } from 'lucide-react';
import { useMeshQueue } from '../context/MeshQueueContext';

interface OfflineStatusIndicatorProps {
  onClick?: () => void;
}

export const OfflineStatusIndicator: React.FC<OfflineStatusIndicatorProps> = ({
  onClick,
}) => {
  const { isBrowserOnline, queuedCount } = useMeshQueue();

  if (!isBrowserOnline) {
    return (
      <button
        type="button"
        onClick={onClick}
        role="status"
        aria-live="polite"
        title="Browser offline: emergency alerts are stored locally in the Mesh Message Queue until connectivity returns."
        className="inline-flex items-center gap-1.5 rounded-md border border-red-700 bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-700 whitespace-nowrap shrink-0"
      >
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>Offline</span>
        {queuedCount > 0 && (
          <span className="font-mono text-[11px] opacity-90 tabular-nums">
            · {queuedCount} queued
          </span>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      role="status"
      aria-live="polite"
      title="Browser connectivity online"
      className="hidden sm:inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-800 transition-colors hover:bg-emerald-100 whitespace-nowrap shrink-0"
    >
      <Wifi className="h-3.5 w-3.5 text-emerald-700 shrink-0" aria-hidden="true" />
      <span>Online</span>
      {queuedCount > 0 && (
        <span className="font-mono text-[11px] text-amber-800 tabular-nums">
          · {queuedCount} pending sync
        </span>
      )}
    </button>
  );
};

export default OfflineStatusIndicator;
