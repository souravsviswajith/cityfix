import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  CloudOff,
  CloudUpload,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useMeshQueue } from '../context/MeshQueueContext';
import { WARD_ZONES } from '../data/civicDirectory';
import {
  INITIAL_MESH_NODES,
  broadcastCemnPacketOverTabMesh,
  createSignedCemnPacket,
  saveLocalCemnPackets,
} from '../services/cemnMeshEngine';
import type {
  CemnEventType,
  CemnNode,
  CemnPacket,
  MeshOperatingMode,
  SeverityLevel,
} from '../types/civic';

const RETRY_META_STORAGE_KEY = 'cityfix_cemn_retry_meta_v1';
const MAX_RETRIES = 5;
const BASE_BACKOFF_MS = 2000;
const MAX_BACKOFF_MS = 32000;

export type QueueSyncState =
  | 'PENDING'
  | 'RETRY_SCHEDULED'
  | 'SYNCING'
  | 'SYNCED'
  | 'EXHAUSTED';

export interface QueueRetryMeta {
  messageId: string;
  state: QueueSyncState;
  retryCount: number;
  maxRetries: number;
  nextRetryAt: number | null;
  lastAttemptAt: string | null;
  lastError: string | null;
}

interface MeshMessageQueueProps {
  packets?: CemnPacket[];
  onPacketsChange?: (nextPackets: CemnPacket[]) => void;
  operatingMode?: MeshOperatingMode;
  nodes?: CemnNode[];
  onSyncCompleted?: (info: {
    syncedCount: number;
    duplicateSkippedCount: number;
  }) => void;
}

function loadRetryMetaMap(): Record<string, QueueRetryMeta> {
  try {
    const raw = localStorage.getItem(RETRY_META_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, QueueRetryMeta>) : {};
  } catch {
    return {};
  }
}

function saveRetryMetaMap(map: Record<string, QueueRetryMeta>): void {
  try {
    localStorage.setItem(RETRY_META_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Ignore localStorage quota errors
  }
}

function computeBackoffMs(retryCount: number): number {
  const exp = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * Math.pow(2, Math.max(0, retryCount - 1)));
  const jitter = Math.floor(Math.random() * 350);
  return exp + jitter;
}

export const MeshMessageQueue: React.FC<MeshMessageQueueProps> = ({
  packets: controlledPackets,
  onPacketsChange,
  operatingMode: controlledMode,
  nodes = INITIAL_MESH_NODES,
  onSyncCompleted,
}) => {
  const { session, refreshToken } = useAuth();
  const meshQueueCtx = useMeshQueue();

  const packets = controlledPackets ?? meshQueueCtx.packets;

  const updatePackets = useCallback(
    (next: CemnPacket[]) => {
      saveLocalCemnPackets(next);
      if (onPacketsChange) {
        onPacketsChange(next);
      } else {
        meshQueueCtx.setPackets(next);
      }
    },
    [onPacketsChange, meshQueueCtx]
  );

  const browserOnline = meshQueueCtx.isBrowserOnline;
  const effectiveMode = controlledMode ?? meshQueueCtx.operatingMode;
  const effectiveOnline = browserOnline && effectiveMode !== 'DISCONNECTED';

  const [retryMeta, setRetryMeta] = useState<Record<string, QueueRetryMeta>>(() =>
    loadRetryMetaMap()
  );
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [syncInFlight, setSyncInFlight] = useState(false);
  const [statusBanner, setStatusBanner] = useState<{
    tone: 'ok' | 'warn' | 'error';
    text: string;
  } | null>(null);

  // Quick offline enqueue form
  const [showComposer, setShowComposer] = useState(false);
  const [draftType, setDraftType] = useState<CemnEventType>('SOS');
  const [draftWardId, setDraftWardId] = useState('ward-04');
  const [draftSeverity, setDraftSeverity] = useState<SeverityLevel>('Urgent');
  const [draftTitle, setDraftTitle] = useState('');
  const [draftSummary, setDraftSummary] = useState('');
  const [enqueueing, setEnqueueing] = useState(false);

  const packetsRef = useRef(packets);
  packetsRef.current = packets;
  const retryMetaRef = useRef(retryMeta);
  retryMetaRef.current = retryMeta;
  const syncInFlightRef = useRef(false);
  const wasOfflineRef = useRef(!effectiveOnline);

  const persistRetryMeta = useCallback(
    (
      updater:
        | Record<string, QueueRetryMeta>
        | ((prev: Record<string, QueueRetryMeta>) => Record<string, QueueRetryMeta>)
    ) => {
      setRetryMeta((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        saveRetryMetaMap(next);
        return next;
      });
    },
    []
  );

  // Keep retry metadata initialized for all packets in localStorage
  useEffect(() => {
    persistRetryMeta((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const pkt of packets) {
        if (!next[pkt.messageId]) {
          next[pkt.messageId] = {
            messageId: pkt.messageId,
            state: pkt.syncedToCloud ? 'SYNCED' : 'PENDING',
            retryCount: 0,
            maxRetries: MAX_RETRIES,
            nextRetryAt: null,
            lastAttemptAt: pkt.syncedAt ?? null,
            lastError: null,
          };
          changed = true;
        } else if (pkt.syncedToCloud && next[pkt.messageId].state !== 'SYNCED') {
          next[pkt.messageId] = {
            ...next[pkt.messageId],
            state: 'SYNCED',
            nextRetryAt: null,
            lastError: null,
          };
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [packets, persistRetryMeta]);

  // Surface warning banner when browser goes offline
  useEffect(() => {
    if (!browserOnline) {
      setStatusBanner({
        tone: 'warn',
        text: 'Connectivity lost. Emergency messages are queued safely in localStorage and will auto-sync when connection returns.',
      });
    }
  }, [browserOnline]);

  const isCoordinator = Boolean(
    session?.authenticated &&
      (session.role === 'coordinator' || session.role === 'responder')
  );

  const syncPacketBatch = useCallback(
    async (targetIds?: string[]) => {
      if (syncInFlightRef.current) return;
      if (!effectiveOnline) {
        setStatusBanner({
          tone: 'warn',
          text: 'Offline mode active: sync deferred until internet connectivity is restored.',
        });
        return;
      }

      const currentPackets = packetsRef.current;
      const currentMeta = retryMetaRef.current;
      const now = Date.now();

      const duePackets = currentPackets.filter((pkt) => {
        if (pkt.syncedToCloud) return false;
        if (targetIds && !targetIds.includes(pkt.messageId)) return false;
        const meta = currentMeta[pkt.messageId];
        if (!meta) return true;
        if (meta.state === 'EXHAUSTED' && !targetIds) return false;
        if (
          meta.state === 'RETRY_SCHEDULED' &&
          meta.nextRetryAt &&
          meta.nextRetryAt > now &&
          !targetIds
        ) {
          return false;
        }
        return true;
      });

      if (duePackets.length === 0) return;

      const token = await refreshToken();
      if (!token) {
        setStatusBanner({
          tone: 'warn',
          text: `${duePackets.length} queued message(s) waiting in localStorage. Sign in with Google to authenticate Cloud SQL recovery sync.`,
        });
        return;
      }

      syncInFlightRef.current = true;
      setSyncInFlight(true);

      const attemptIso = new Date().toISOString();
      const dueIds = new Set(duePackets.map((p) => p.messageId));

      persistRetryMeta((prev) => {
        const next = { ...prev };
        for (const id of dueIds) {
          const existing = next[id];
          next[id] = {
            messageId: id,
            state: 'SYNCING',
            retryCount: existing?.retryCount ?? 0,
            maxRetries: MAX_RETRIES,
            nextRetryAt: null,
            lastAttemptAt: attemptIso,
            lastError: existing?.lastError ?? null,
          };
        }
        return next;
      });

      try {
        const res = await fetch('/api/cemn/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ packets: duePackets }),
        });

        const data = await res.json().catch(() => ({}));
        if (res.status === 403) {
          const rejectIso = new Date().toISOString();
          const msg =
            typeof data.error === 'string'
              ? data.error
              : 'Rejected: Account lacks authorization to sync these packets.';
          persistRetryMeta((prev) => {
            const next = { ...prev };
            for (const id of dueIds) {
              next[id] = {
                messageId: id,
                state: 'EXHAUSTED',
                retryCount: MAX_RETRIES,
                maxRetries: MAX_RETRIES,
                nextRetryAt: null,
                lastAttemptAt: rejectIso,
                lastError: msg,
              };
            }
            return next;
          });
          setStatusBanner({ tone: 'error', text: msg });
          return;
        }
        if (!res.ok) {
          throw new Error(
            typeof data.error === 'string'
              ? data.error
              : `Backend sync returned HTTP ${res.status}`
          );
        }

        const syncedIso = new Date().toISOString();
        const acceptedIds = new Set<string>(
          Array.isArray(data.acceptedMessageIds)
            ? data.acceptedMessageIds
            : duePackets
                .filter((p) => !(p.eventType === 'EVACUATION_ORDER' && !isCoordinator))
                .map((p) => p.messageId)
        );

        const nextPackets = packetsRef.current.map((p) =>
          acceptedIds.has(p.messageId)
            ? {
                ...p,
                syncedToCloud: true,
                deliveryStatus: isCoordinator
                  ? ('ACKNOWLEDGED' as const)
                  : ('RECEIVED' as const),
                syncedAt: p.syncedAt ?? syncedIso,
              }
            : p
        );
        updatePackets(nextPackets);

        persistRetryMeta((prev) => {
          const next = { ...prev };
          for (const pkt of duePackets) {
            if (acceptedIds.has(pkt.messageId)) {
              next[pkt.messageId] = {
                messageId: pkt.messageId,
                state: 'SYNCED',
                retryCount: prev[pkt.messageId]?.retryCount ?? 0,
                maxRetries: MAX_RETRIES,
                nextRetryAt: null,
                lastAttemptAt: syncedIso,
                lastError: null,
              };
            } else {
              next[pkt.messageId] = {
                messageId: pkt.messageId,
                state: 'EXHAUSTED',
                retryCount: MAX_RETRIES,
                maxRetries: MAX_RETRIES,
                nextRetryAt: null,
                lastAttemptAt: syncedIso,
                lastError:
                  'Rejected: Packet violated schema validation or requires responder/coordinator authorization.',
              };
            }
          }
          return next;
        });

        const syncedCount = Number(data.syncedCount ?? acceptedIds.size);
        const duplicateSkippedCount = Number(data.duplicateSkippedCount ?? 0);
        const rejectedTotal =
          Number(data.rejectedUnauthorized ?? 0) + Number(data.rejectedInvalid ?? 0);
        onSyncCompleted?.({ syncedCount, duplicateSkippedCount });

        setStatusBanner({
          tone: rejectedTotal > 0 ? 'warn' : 'ok',
          text: `Synced ${syncedCount} emergency packet(s) to Cloud SQL (${duplicateSkippedCount} duplicate(s) suppressed).${
            rejectedTotal > 0
              ? ` ${rejectedTotal} unauthorized/invalid packet(s) blocked.`
              : ''
          }`,
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Central backend unreachable.';
        const failNow = Date.now();
        const failIso = new Date(failNow).toISOString();

        persistRetryMeta((prev) => {
          const next = { ...prev };
          for (const id of dueIds) {
            const nextAttempt = (prev[id]?.retryCount ?? 0) + 1;
            const exhausted = nextAttempt >= MAX_RETRIES;
            const delayMs = computeBackoffMs(nextAttempt);
            next[id] = {
              messageId: id,
              state: exhausted ? 'EXHAUSTED' : 'RETRY_SCHEDULED',
              retryCount: nextAttempt,
              maxRetries: MAX_RETRIES,
              nextRetryAt: exhausted ? null : failNow + delayMs,
              lastAttemptAt: failIso,
              lastError: message,
            };
          }
          return next;
        });

        setStatusBanner({
          tone: 'error',
          text: `Sync failed (${message}). Exponential backoff retry scheduled while records remain in localStorage.`,
        });
      } finally {
        syncInFlightRef.current = false;
        setSyncInFlight(false);
      }
    },
    [
      effectiveOnline,
      isCoordinator,
      onSyncCompleted,
      persistRetryMeta,
      refreshToken,
      updatePackets,
    ]
  );

  // Automatic flush immediately when connectivity returns
  useEffect(() => {
    if (effectiveOnline && wasOfflineRef.current) {
      setStatusBanner({
        tone: 'ok',
        text: 'Connectivity restored. Flushing offline emergency message queue to central backend...',
      });
      syncPacketBatch();
    }
    wasOfflineRef.current = !effectiveOnline;
  }, [effectiveOnline, syncPacketBatch]);

  // 1-second ticker for retry countdowns and due automatic retries
  useEffect(() => {
    const hasPendingOrScheduled = packets.some((p) => {
      if (p.syncedToCloud) return false;
      const meta = retryMeta[p.messageId];
      return !meta || meta.state === 'RETRY_SCHEDULED' || meta.state === 'PENDING';
    });
    if (!hasPendingOrScheduled) return;

    const timer = window.setInterval(() => {
      const t = Date.now();
      setNowMs(t);
      if (!effectiveOnline || syncInFlightRef.current || !session?.authenticated) {
        return;
      }
      const hasDueRetry = packetsRef.current.some((p) => {
        if (p.syncedToCloud) return false;
        const m = retryMetaRef.current[p.messageId];
        return (
          m &&
          m.state === 'RETRY_SCHEDULED' &&
          m.nextRetryAt !== null &&
          m.nextRetryAt <= t
        );
      });
      if (hasDueRetry) {
        syncPacketBatch();
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [effectiveOnline, packets, retryMeta, session?.authenticated, syncPacketBatch]);

  const handleQueueOfflineMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftTitle.trim() || !draftSummary.trim()) {
      setStatusBanner({
        tone: 'error',
        text: 'Enter both a headline and message details before queueing.',
      });
      return;
    }

    setEnqueueing(true);
    try {
      const ward = WARD_ZONES.find((w) => w.id === draftWardId) ?? WARD_ZONES[0];
      const packet = await createSignedCemnPacket({
        eventType: draftType,
        title: draftTitle,
        summary: draftSummary,
        wardId: ward.id,
        latitude: ward.centerLat,
        longitude: ward.centerLng,
        coordSource: 'GPS',
        coordAccuracyM: 10,
        severity: draftSeverity,
        identityTier: isCoordinator
          ? 'OFFICIAL_AGENCY'
          : session?.authenticated
          ? 'VERIFIED_CITIZEN'
          : 'UNVERIFIED_CITIZEN',
        authorUid: session?.uid ?? null,
        authorLabel: session?.name ?? 'Offline Citizen Node',
        operatingMode: effectiveOnline ? 'CONNECTED' : 'DISCONNECTED',
        nodes,
        payload: { queuedVia: 'MeshMessageQueue', offlineAtOrigin: !effectiveOnline },
      });

      const nextPackets = [packet, ...packets];
      updatePackets(nextPackets);
      broadcastCemnPacketOverTabMesh(packet);

      persistRetryMeta((prev) => ({
        ...prev,
        [packet.messageId]: {
          messageId: packet.messageId,
          state: 'PENDING',
          retryCount: 0,
          maxRetries: MAX_RETRIES,
          nextRetryAt: null,
          lastAttemptAt: null,
          lastError: null,
        },
      }));

      setDraftTitle('');
      setDraftSummary('');
      setShowComposer(false);

      if (effectiveOnline && session?.authenticated) {
        setStatusBanner({
          tone: 'ok',
          text: `Packet ${packet.messageId} stored in localStorage and queued for immediate sync.`,
        });
        window.setTimeout(() => syncPacketBatch([packet.messageId]), 50);
      } else {
        setStatusBanner({
          tone: 'warn',
          text: `Packet ${packet.messageId} saved to localStorage queue. It will automatically sync with backoff retry once connectivity is restored.`,
        });
      }
    } finally {
      setEnqueueing(false);
    }
  };

  const handleManualRetrySingle = (messageId: string) => {
    persistRetryMeta((prev) => ({
      ...prev,
      [messageId]: {
        messageId,
        state: 'PENDING',
        retryCount: 0,
        maxRetries: MAX_RETRIES,
        nextRetryAt: null,
        lastAttemptAt: prev[messageId]?.lastAttemptAt ?? null,
        lastError: null,
      },
    }));
    window.setTimeout(() => syncPacketBatch([messageId]), 30);
  };

  const handleDiscardPacket = (messageId: string) => {
    updatePackets(packets.filter((p) => p.messageId !== messageId));
    persistRetryMeta((prev) => {
      const next = { ...prev };
      delete next[messageId];
      return next;
    });
  };

  const handleClearSynced = () => {
    const unsynced = packets.filter((p) => !p.syncedToCloud);
    updatePackets(unsynced);
    persistRetryMeta((prev) => {
      const next: Record<string, QueueRetryMeta> = {};
      for (const p of unsynced) {
        if (prev[p.messageId]) next[p.messageId] = prev[p.messageId];
      }
      return next;
    });
  };

  const stats = useMemo(() => {
    let pending = 0;
    let retrying = 0;
    let exhausted = 0;
    let synced = 0;
    for (const p of packets) {
      if (p.syncedToCloud) {
        synced++;
      } else {
        const st = retryMeta[p.messageId]?.state ?? 'PENDING';
        if (st === 'EXHAUSTED') exhausted++;
        else if (st === 'RETRY_SCHEDULED') retrying++;
        else pending++;
      }
    }
    return { pending, retrying, exhausted, synced };
  }, [packets, retryMeta]);

  return (
    <section className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      {/* Queue Header */}
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2.5">
          {effectiveOnline ? (
            <Wifi className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
          ) : (
            <WifiOff className="h-4 w-4 text-red-700 shrink-0 mt-0.5" />
          )}
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Offline Store-and-Forward Message Queue & Retry Sync
            </h3>
            <p className="text-xs text-slate-600">
              Persists signed emergency messages in{' '}
              <span className="font-mono">localStorage</span> when offline and flushes to
              Cloud SQL with exponential backoff (<span className="font-mono">2s–32s</span>)
              upon reconnection.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowComposer((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-100 whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" />
            {showComposer ? 'Close Composer' : 'Queue Offline Message'}
          </button>

          <button
            type="button"
            onClick={() =>
              syncPacketBatch(
                packets.filter((p) => !p.syncedToCloud).map((p) => p.messageId)
              )
            }
            disabled={syncInFlight || !effectiveOnline || stats.pending + stats.retrying + stats.exhausted === 0}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#0f4c81] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#0c3d68] disabled:opacity-50 whitespace-nowrap"
          >
            {syncInFlight ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CloudUpload className="h-3.5 w-3.5" />
            )}
            {syncInFlight
              ? 'Syncing...'
              : `Flush Queue (${stats.pending + stats.retrying + stats.exhausted})`}
          </button>
        </div>
      </div>

      {/* Queue Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 border-b border-slate-200 bg-white text-xs">
        <div className="px-4 py-2.5 flex items-center justify-between">
          <span className="text-slate-600">Offline / Pending</span>
          <span className="font-mono font-semibold text-amber-700 tabular-nums">
            {stats.pending}
          </span>
        </div>
        <div className="px-4 py-2.5 flex items-center justify-between">
          <span className="text-slate-600">Backoff Scheduled</span>
          <span className="font-mono font-semibold text-[#0f4c81] tabular-nums">
            {stats.retrying}
          </span>
        </div>
        <div className="px-4 py-2.5 flex items-center justify-between">
          <span className="text-slate-600">Retry Exhausted</span>
          <span className="font-mono font-semibold text-red-700 tabular-nums">
            {stats.exhausted}
          </span>
        </div>
        <div className="px-4 py-2.5 flex items-center justify-between">
          <span className="text-slate-600">Backend Synced</span>
          <span className="font-mono font-semibold text-emerald-700 tabular-nums">
            {stats.synced}
          </span>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {statusBanner && (
          <div
            className={`rounded-md border px-3.5 py-2.5 text-xs flex items-start gap-2 ${
              statusBanner.tone === 'error'
                ? 'border-red-200 bg-red-50 text-red-900'
                : statusBanner.tone === 'warn'
                ? 'border-amber-200 bg-amber-50 text-amber-950'
                : 'border-emerald-200 bg-emerald-50 text-emerald-900'
            }`}
          >
            {statusBanner.tone === 'ok' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            )}
            <span>{statusBanner.text}</span>
          </div>
        )}

        {/* Quick Offline Queue Form */}
        {showComposer && (
          <form
            onSubmit={handleQueueOfflineMessage}
            className="rounded-md border border-slate-200 bg-slate-50/70 p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-900">
                Store Emergency Message in Offline Queue
              </p>
              <span className="font-mono text-[11px] text-slate-500">
                {effectiveOnline ? 'Online · Will auto-sync' : 'Offline · Saved to localStorage'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <select
                aria-label="Emergency message type"
                value={draftType}
                onChange={(e) => setDraftType(e.target.value as CemnEventType)}
                className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
              >
                <option value="SOS">SOS Alert</option>
                <option value="MISSING_PERSON">Missing Person</option>
                <option value="RESOURCE">Resource Offer</option>
              </select>

              <select
                aria-label="Ward location"
                value={draftWardId}
                onChange={(e) => setDraftWardId(e.target.value)}
                className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
              >
                {WARD_ZONES.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.code} · {w.name}
                  </option>
                ))}
              </select>

              <select
                aria-label="Urgency severity"
                value={draftSeverity}
                onChange={(e) => setDraftSeverity(e.target.value as SeverityLevel)}
                className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
              >
                <option value="Critical">Critical</option>
                <option value="Urgent">Urgent</option>
                <option value="Moderate">Moderate</option>
                <option value="Low">Low</option>
              </select>
            </div>

            <input
              type="text"
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              placeholder="Emergency headline (e.g. Medical oxygen depleted at Shelter 3)"
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900"
            />

            <textarea
              rows={2}
              value={draftSummary}
              onChange={(e) => setDraftSummary(e.target.value)}
              placeholder="Exact location landmarks, headcount, and emergency needs..."
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900"
            />

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowComposer(false)}
                className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={enqueueing}
                className="rounded bg-red-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-800 disabled:opacity-60"
              >
                {enqueueing ? 'Signing & Storing...' : 'Save to Offline Queue'}
              </button>
            </div>
          </form>
        )}

        {/* Queue Items List */}
        {packets.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-300 p-6 text-center text-xs text-slate-500">
            The offline store-and-forward queue is empty.
          </div>
        ) : (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>
                Showing {packets.length} stored message(s) in{' '}
                <span className="font-mono">localStorage</span>
              </span>
              {stats.synced > 0 && (
                <button
                  type="button"
                  onClick={handleClearSynced}
                  className="text-[11px] font-medium text-slate-600 hover:text-slate-900 underline"
                >
                  Clear Synced ({stats.synced})
                </button>
              )}
            </div>

            <div className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white max-h-[360px] overflow-y-auto">
              {packets.map((pkt) => {
                const meta = retryMeta[pkt.messageId];
                const state: QueueSyncState = pkt.syncedToCloud
                  ? 'SYNCED'
                  : meta?.state ?? 'PENDING';
                const secondsLeft =
                  state === 'RETRY_SCHEDULED' && meta?.nextRetryAt
                    ? Math.max(0, Math.ceil((meta.nextRetryAt - nowMs) / 1000))
                    : 0;

                return (
                  <div
                    key={pkt.messageId}
                    className="p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-slate-900">
                          {pkt.messageId}
                        </span>
                        <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-700">
                          {pkt.eventType} · {pkt.severity}
                        </span>

                        {state === 'SYNCED' && (
                          <span className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-700">
                            <CheckCircle2 className="h-3 w-3" />
                            SYNCED
                          </span>
                        )}
                        {state === 'PENDING' && (
                          <span className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-2 py-0.5 font-mono text-[10px] font-semibold text-amber-800">
                            <CloudOff className="h-3 w-3" />
                            QUEUED OFFLINE
                          </span>
                        )}
                        {state === 'SYNCING' && (
                          <span className="inline-flex items-center gap-1 rounded border border-sky-200 bg-sky-50 px-2 py-0.5 font-mono text-[10px] font-semibold text-[#0f4c81]">
                            <RefreshCw className="h-3 w-3 animate-spin" />
                            SYNCING
                          </span>
                        )}
                        {state === 'RETRY_SCHEDULED' && (
                          <span className="inline-flex items-center gap-1 rounded border border-sky-200 bg-sky-50 px-2 py-0.5 font-mono text-[10px] font-semibold text-[#0f4c81]">
                            <Clock className="h-3 w-3" />
                            RETRY IN {secondsLeft}s ({meta?.retryCount ?? 0}/{MAX_RETRIES})
                          </span>
                        )}
                        {state === 'EXHAUSTED' && (
                          <span className="inline-flex items-center gap-1 rounded border border-red-200 bg-red-50 px-2 py-0.5 font-mono text-[10px] font-semibold text-red-700">
                            <AlertTriangle className="h-3 w-3" />
                            RETRY EXHAUSTED ({meta?.retryCount ?? MAX_RETRIES}/{MAX_RETRIES})
                          </span>
                        )}
                      </div>

                      <p className="text-xs font-medium text-slate-900 truncate">
                        {pkt.title}
                      </p>
                      <p className="text-[11px] text-slate-600 line-clamp-1">
                        {pkt.summary}
                      </p>

                      {meta?.lastError && state !== 'SYNCED' && (
                        <p className="font-mono text-[11px] text-red-700">
                          Last error: {meta.lastError}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {state !== 'SYNCED' && (
                        <button
                          type="button"
                          onClick={() => handleManualRetrySingle(pkt.messageId)}
                          disabled={!effectiveOnline || syncInFlight}
                          className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          <RotateCcw className="h-3 w-3" />
                          Retry
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDiscardPacket(pkt.messageId)}
                        aria-label={`Remove queued packet ${pkt.messageId}`}
                        className="rounded border border-slate-200 p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default MeshMessageQueue;
