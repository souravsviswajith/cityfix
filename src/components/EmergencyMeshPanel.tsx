import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BatteryCharging,
  CheckCircle2,
  CloudUpload,
  Lock,
  Radio,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useMeshQueue } from '../context/MeshQueueContext';
import { WARD_ZONES } from '../data/civicDirectory';
import {
  INITIAL_MESH_NODES,
  aggregateCemnIncidents,
  broadcastCemnPacketOverTabMesh,
  checkBroadcastRateLimit,
  createSignedCemnPacket,
  saveLocalCemnPackets,
  subscribeTabMeshRelays,
} from '../services/cemnMeshEngine';
import type {
  CemnAuditEntry,
  CemnEventType,
  CemnNode,
  CemnPacket,
  MeshOperatingMode,
  RescueOperationStage,
  SeverityLevel,
} from '../types/civic';
import { CityFixGoogleMap } from './CityFixGoogleMap';
import { MeshMessageQueue } from './MeshMessageQueue';

const STAGE_LABELS: Record<RescueOperationStage, string> = {
  CITIZEN_REPORTED: '1. Citizen-Reported Emergency',
  VOLUNTEER_RESPONSE: '2. Community Volunteer Response',
  RESPONDER_ACKNOWLEDGED: '3. Verified Responder Acknowledged',
  OFFICIAL_AGENCY_ASSIGNED: '4. Official Agency Assigned',
  RESCUE_IN_PROGRESS: '5. Rescue Operation in Progress',
  RESOLVED_WITH_EVIDENCE: '6. Resolved with Evidence',
};

const DELIVERY_STYLES: Record<CemnPacket['deliveryStatus'], string> = {
  QUEUED: 'text-amber-700 bg-amber-50 border-amber-200',
  RELAYED: 'text-sky-700 bg-sky-50 border-sky-200',
  RECEIVED: 'text-indigo-700 bg-indigo-50 border-indigo-200',
  ACKNOWLEDGED: 'text-emerald-700 bg-emerald-50 border-emerald-200',
};

export const EmergencyMeshPanel: React.FC = () => {
  const { session, refreshToken } = useAuth();
  const { operatingMode, setOperatingMode, packets, setPackets } = useMeshQueue();
  const [subView, setSubView] = useState<
    'broadcast' | 'queue' | 'incidents' | 'topology' | 'sync'
  >('broadcast');
  const [nodes, setNodes] = useState<CemnNode[]>(INITIAL_MESH_NODES);
  const [auditLog, setAuditLog] = useState<CemnAuditEntry[]>([]);
  const [suppressedDupes, setSuppressedDupes] = useState(0);

  // Composer state
  const [eventType, setEventType] = useState<CemnEventType>('SOS');
  const [wardId, setWardId] = useState('ward-04');
  const [severity, setSeverity] = useState<SeverityLevel>('Critical');
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [coordAccuracyM, setCoordAccuracyM] = useState(9);
  const [broadcastFeedback, setBroadcastFeedback] = useState<{
    type: 'ok' | 'error';
    text: string;
  } | null>(null);
  const [syncing, setSyncing] = useState(false);

  const selectedWard = useMemo(
    () => WARD_ZONES.find((w) => w.id === wardId) ?? WARD_ZONES[0],
    [wardId]
  );

  // Real cross-tab P2P mesh relay listener via BroadcastChannel
  useEffect(() => {
    const unsub = subscribeTabMeshRelays((relayedPacket) => {
      setPackets((prev) => {
        if (prev.some((p) => p.messageId === relayedPacket.messageId)) {
          setSuppressedDupes((n) => n + 1);
          return prev;
        }
        const next = [relayedPacket, ...prev];
        saveLocalCemnPackets(next);
        return next;
      });
    });
    return unsub;
  }, []);

  const isCoordinator = Boolean(
    session?.authenticated &&
      (session.role === 'coordinator' || session.role === 'responder')
  );

  // Load synced Cloud SQL CEMN recovery records when connected as verified responder/coordinator
  const fetchRecoveryLog = async () => {
    if (operatingMode === 'DISCONNECTED' || !isCoordinator || !session?.authenticated) {
      return;
    }
    try {
      const tok = await refreshToken();
      if (!tok) return;
      const res = await fetch('/api/cemn/events', {
        headers: {
          Authorization: `Bearer ${tok}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.auditLog)) {
          setAuditLog(data.auditLog);
        }
      }
    } catch {
      // Ignore offline fetch failure
    }
  };

  useEffect(() => {
    if (operatingMode === 'CONNECTED' && isCoordinator) {
      fetchRecoveryLog();
    }
  }, [operatingMode, isCoordinator, session?.authenticated]);

  const clusters = useMemo(() => aggregateCemnIncidents(packets), [packets]);
  const unsyncedPackets = useMemo(
    () => packets.filter((p) => !p.syncedToCloud),
    [packets]
  );

  const handleBroadcastPacket = async (e: React.FormEvent) => {
    e.preventDefault();
    setBroadcastFeedback(null);

    if (eventType === 'EVACUATION_ORDER' && !isCoordinator) {
      setBroadcastFeedback({
        type: 'error',
        text: 'Security Guard: Unverified devices and standard citizen accounts cannot issue authoritative evacuation orders.',
      });
      return;
    }

    const rate = checkBroadcastRateLimit();
    if (!rate.allowed) {
      setBroadcastFeedback({
        type: 'error',
        text: `Abuse prevention rate-limit active. Wait ${rate.waitSeconds}s before transmitting another mesh packet.`,
      });
      return;
    }

    if (!title.trim() || !summary.trim()) {
      setBroadcastFeedback({
        type: 'error',
        text: 'Provide a concise headline and field details for structured mesh propagation.',
      });
      return;
    }

    const packet = await createSignedCemnPacket({
      eventType,
      title,
      summary,
      wardId: selectedWard.id,
      latitude: selectedWard.centerLat,
      longitude: selectedWard.centerLng,
      coordSource: 'GPS',
      coordAccuracyM,
      severity,
      identityTier: isCoordinator
        ? 'OFFICIAL_AGENCY'
        : session?.authenticated
        ? 'VERIFIED_CITIZEN'
        : 'UNVERIFIED_CITIZEN',
      authorUid: session?.uid ?? null,
      authorLabel: session?.name ?? 'Local Citizen Device',
      operatingMode,
      nodes,
      payload: {
        operatingModeAtOrigin: operatingMode,
        androidP2pPrimary: true,
        loraGatewaySupported: nodes.some(
          (n) => n.radioType === 'LORA_GATEWAY' && n.status === 'ACTIVE'
        ),
      },
    });

    const next = [packet, ...packets];
    setPackets(next);
    saveLocalCemnPackets(next);
    broadcastCemnPacketOverTabMesh(packet);

    setTitle('');
    setSummary('');
    setBroadcastFeedback({
      type: 'ok',
      text: `Packet ${packet.messageId} signed (${packet.publicKeyFingerprint}) -> Status: ${packet.deliveryStatus} across ${packet.hopCount} mesh hop(s).`,
    });
  };

  const handleAdvanceStage = async (
    packet: CemnPacket,
    nextStage: RescueOperationStage
  ) => {
    setBroadcastFeedback(null);
    const restricted: RescueOperationStage[] = [
      'RESPONDER_ACKNOWLEDGED',
      'OFFICIAL_AGENCY_ASSIGNED',
      'RESCUE_IN_PROGRESS',
      'RESOLVED_WITH_EVIDENCE',
    ];

    if (restricted.includes(nextStage) && !isCoordinator) {
      setBroadcastFeedback({
        type: 'error',
        text: 'Role Guard: An unverified citizen device cannot claim responder authority, assign official agencies, or close an emergency incident.',
      });
      return;
    }

    const previousPackets = packets;
    const updated = packets.map((p) =>
      p.messageId === packet.messageId
        ? {
            ...p,
            rescueStage: nextStage,
            deliveryStatus: 'ACKNOWLEDGED' as const,
          }
        : p
    );
    setPackets(updated);
    saveLocalCemnPackets(updated);

    if (operatingMode === 'CONNECTED' && session?.authenticated) {
      try {
        const tok = await refreshToken();
        if (tok) {
          const res = await fetch('/api/cemn/advance-stage', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${tok}`,
            },
            body: JSON.stringify({
              messageId: packet.messageId,
              nextStage,
              note: `Updated via CEMN Rescue Coordination Console (${operatingMode})`,
            }),
          });
          if (!res.ok) {
            setPackets(previousPackets);
            saveLocalCemnPackets(previousPackets);
            const data = await res.json().catch(() => ({}));
            setBroadcastFeedback({
              type: 'error',
              text: data.error || 'Server rejected unauthorized stage transition.',
            });
            return;
          }
          fetchRecoveryLog();
        }
      } catch {
        setPackets(previousPackets);
        saveLocalCemnPackets(previousPackets);
        setBroadcastFeedback({
          type: 'error',
          text: 'Network error while verifying stage transition with backend.',
        });
      }
    }
  };

  const handleRecoverySync = async () => {
    setBroadcastFeedback(null);
    if (operatingMode === 'DISCONNECTED') {
      setBroadcastFeedback({
        type: 'error',
        text: 'Cannot synchronize with Cloud SQL while in Disconnected Mode. Switch to Connected Mode when internet returns.',
      });
      return;
    }
    if (!session?.authenticated) {
      setBroadcastFeedback({
        type: 'error',
        text: 'Sign in with Google to authenticate recovery reconciliation with Cloud SQL.',
      });
      return;
    }
    if (unsyncedPackets.length === 0) {
      setBroadcastFeedback({
        type: 'ok',
        text: 'All local CEMN packets are already reconciled with PostgreSQL.',
      });
      return;
    }

    setSyncing(true);
    try {
      const tok = await refreshToken();
      const res = await fetch('/api/cemn/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tok}`,
        },
        body: JSON.stringify({ packets: unsyncedPackets }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBroadcastFeedback({
          type: 'error',
          text: data.error || 'Recovery synchronization failed.',
        });
      } else {
        const now = new Date().toISOString();
        const acceptedIds = new Set<string>(
          Array.isArray(data.acceptedMessageIds) ? data.acceptedMessageIds : []
        );
        const marked = packets.map((p) =>
          acceptedIds.has(p.messageId)
            ? {
                ...p,
                syncedToCloud: true,
                deliveryStatus: isCoordinator
                  ? ('ACKNOWLEDGED' as const)
                  : ('RECEIVED' as const),
                syncedAt: p.syncedAt ?? now,
              }
            : p
        );
        setPackets(marked);
        saveLocalCemnPackets(marked);
        setSuppressedDupes((d) => d + (data.duplicateSkippedCount ?? 0));
        await fetchRecoveryLog();
        const rejectedCount =
          Number(data.rejectedUnauthorized ?? 0) + Number(data.rejectedInvalid ?? 0);
        setBroadcastFeedback({
          type: rejectedCount > 0 ? 'error' : 'ok',
          text: `Recovery sync complete: ${data.syncedCount} queued packet(s) persisted to Cloud SQL (${data.duplicateSkippedCount ?? 0} duplicates suppressed${rejectedCount > 0 ? `, ${rejectedCount} unauthorized/invalid packet(s) rejected` : ''}).`,
        });
      }
    } catch {
      setBroadcastFeedback({
        type: 'error',
        text: 'Network error during Cloud SQL recovery synchronization.',
      });
    } finally {
      setSyncing(false);
    }
  };

  const toggleNodeOffline = (nodeId: string) => {
    setNodes((prev) =>
      prev.map((n) =>
        n.nodeId === nodeId
          ? { ...n, status: n.status === 'ACTIVE' ? 'OFFLINE' : 'ACTIVE' }
          : n
      )
    );
  };

  const activeNodeCount = nodes.filter((n) => n.status !== 'OFFLINE').length;

  return (
    <section className="rounded-lg border border-slate-300 bg-white overflow-hidden">
      {/* Header & Operating Mode Bar */}
      <div className="border-b border-slate-200 bg-slate-900 px-5 py-4 text-white flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-sky-400" />
            <h2 className="text-base font-semibold tracking-tight">
              CityFix Emergency Mesh Network (CEMN)
            </h2>
          </div>
          <p className="mt-0.5 text-xs text-slate-300">
            Offline-first hybrid BLE / Wi-Fi Direct / LoRa gateway store-and-forward rescue coordination.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-mono text-slate-400 mr-1">MODE:</span>
          {(['CONNECTED', 'DEGRADED', 'DISCONNECTED'] as MeshOperatingMode[]).map(
            (mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setOperatingMode(mode)}
                className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                  operatingMode === mode
                    ? mode === 'DISCONNECTED'
                      ? 'bg-red-600 text-white'
                      : mode === 'DEGRADED'
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-emerald-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {mode === 'DISCONNECTED' ? (
                  <WifiOff className="h-3 w-3" />
                ) : (
                  <Wifi className="h-3 w-3" />
                )}
                {mode}
              </button>
            )
          )}
        </div>
      </div>

      {/* Network Health Telemetry Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-slate-200 border-b border-slate-200">
        <div className="bg-slate-50 px-4 py-3">
          <p className="text-[11px] font-medium text-slate-500">Active Mesh Nodes</p>
          <p className="mt-0.5 font-mono text-lg font-semibold text-slate-900 tabular-nums">
            {activeNodeCount} / {nodes.length}
          </p>
        </div>
        <div className="bg-slate-50 px-4 py-3">
          <p className="text-[11px] font-medium text-slate-500">Store-and-Forward Queue</p>
          <p className="mt-0.5 font-mono text-lg font-semibold text-amber-700 tabular-nums">
            {unsyncedPackets.length} pending
          </p>
        </div>
        <div className="bg-slate-50 px-4 py-3">
          <p className="text-[11px] font-medium text-slate-500">Total Relayed Packets</p>
          <p className="mt-0.5 font-mono text-lg font-semibold text-slate-900 tabular-nums">
            {packets.length}
          </p>
        </div>
        <div className="bg-slate-50 px-4 py-3">
          <p className="text-[11px] font-medium text-slate-500">Duplicates Suppressed</p>
          <p className="mt-0.5 font-mono text-lg font-semibold text-emerald-700 tabular-nums">
            {suppressedDupes}
          </p>
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1">
          {(
            [
              { id: 'broadcast', label: 'SOS & Event Broadcast' },
              { id: 'queue', label: `Message Queue & Retry (${unsyncedPackets.length})` },
              { id: 'incidents', label: `Rescue Coordination (${clusters.length})` },
              { id: 'topology', label: 'Hybrid Mesh & Offline Map' },
              { id: 'sync', label: 'Recovery Sync & Audit Log' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSubView(t.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                subView === t.id
                  ? 'bg-[#0f4c81] text-white'
                  : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={handleRecoverySync}
          disabled={syncing || operatingMode === 'DISCONNECTED'}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-100 disabled:opacity-50"
        >
          <CloudUpload className="h-3.5 w-3.5 text-[#0f4c81]" />
          {syncing ? 'Reconciling...' : `Sync Queued (${unsyncedPackets.length})`}
        </button>
      </div>

      <div className="p-5 space-y-5">
        {operatingMode !== 'CONNECTED' && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-950 flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <strong>{operatingMode} Mode Active:</strong> Mesh communication is operating
              locally via store-and-forward queue and peer relay. Messages cannot guarantee
              external agency reach if zero participating nodes are within radio range.
            </div>
          </div>
        )}

        {broadcastFeedback && (
          <div
            className={`rounded-md border px-4 py-3 text-xs flex items-start gap-2 ${
              broadcastFeedback.type === 'error'
                ? 'border-red-200 bg-red-50 text-red-900'
                : 'border-emerald-200 bg-emerald-50 text-emerald-900'
            }`}
          >
            {broadcastFeedback.type === 'error' ? (
              <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
            )}
            <span>{broadcastFeedback.text}</span>
          </div>
        )}

        {subView === 'broadcast' && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <form onSubmit={handleBroadcastPacket} className="lg:col-span-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">
                  Compose Signed Mesh Packet
                </h3>
                <span className="font-mono text-[11px] text-slate-500">
                  {isCoordinator
                    ? 'Verified Coordinator'
                    : session?.authenticated
                    ? 'Verified Citizen'
                    : 'Unverified Device'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Structured Event Type
                  </label>
                  <select
                    value={eventType}
                    onChange={(e) => setEventType(e.target.value as CemnEventType)}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-[#0f4c81] focus:outline-none"
                  >
                    <option value="SOS">Emergency SOS Broadcast</option>
                    <option value="MISSING_PERSON">Missing-Person Report</option>
                    <option value="RESOURCE">Resource Offer (Boat/Shelter/Med)</option>
                    <option value="EVACUATION_ORDER">
                      Authoritative Evacuation Order (Coordinator Only)
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Ward Jurisdiction
                  </label>
                  <select
                    value={wardId}
                    onChange={(e) => setWardId(e.target.value)}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-[#0f4c81] focus:outline-none"
                  >
                    {WARD_ZONES.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.code} · {w.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Severity
                  </label>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as SeverityLevel)}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                  >
                    <option value="Critical">Critical</option>
                    <option value="Urgent">Urgent</option>
                    <option value="Moderate">Moderate</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    GPS Accuracy (meters)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={coordAccuracyM}
                    onChange={(e) => setCoordAccuracyM(Number(e.target.value) || 10)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Event Headline
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Trapped elderly residents on rooftop at Canal Street 14"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Structured Details (People / Medical / Resources / Landmarks)
                </label>
                <textarea
                  rows={3}
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="State exact count, hazards, medical needs, or available rescue equipment..."
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
                />
              </div>

              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-red-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-red-800 transition-colors"
              >
                <Send className="h-3.5 w-3.5" />
                Sign & Broadcast Over CEMN Mesh
              </button>
            </form>

            {/* Live Store-and-Forward Packet Feed */}
            <div className="lg:col-span-6 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">
                  Local Mesh Packet Queue ({packets.length})
                </h3>
                <span className="text-[11px] text-slate-500">
                  Signed · Duplicate-filtered · Cross-tab P2P active
                </span>
              </div>

              <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                {packets.map((pkt) => (
                  <div
                    key={pkt.messageId}
                    className="rounded-md border border-slate-200 bg-slate-50/70 p-3.5 space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-slate-900">
                        {pkt.messageId} · {pkt.eventType}
                      </span>
                      <span
                        className={`rounded border px-2 py-0.5 font-mono text-[10px] font-semibold ${DELIVERY_STYLES[pkt.deliveryStatus]}`}
                      >
                        {pkt.deliveryStatus}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-slate-900">{pkt.title}</p>
                    <p className="text-xs text-slate-600 leading-relaxed">{pkt.summary}</p>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-500 pt-1 border-t border-slate-200/80">
                      <span>
                        {pkt.hopCount} hop(s) · {pkt.transportMode}
                      </span>
                      <span>
                        {pkt.syncedToCloud ? 'Cloud SQL Synced' : 'Local Queue Only'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className={subView === 'queue' ? 'block' : 'hidden'}>
          <MeshMessageQueue
            packets={packets}
            onPacketsChange={setPackets}
            operatingMode={operatingMode}
            nodes={nodes}
            onSyncCompleted={({ duplicateSkippedCount }) => {
              if (duplicateSkippedCount > 0) {
                setSuppressedDupes((d) => d + duplicateSkippedCount);
              }
              fetchRecoveryLog();
            }}
          />
        </div>

        {subView === 'incidents' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-700">
              <span>
                <strong>6-Stage Rescue Lifecycle:</strong> Distinguishes citizen & volunteer
                reports from verified responder acknowledgements and official agency dispatch.
              </span>
              {!isCoordinator && (
                <span className="inline-flex items-center gap-1 font-medium text-amber-800">
                  <Lock className="h-3.5 w-3.5" />
                  Responder stages locked for citizen devices
                </span>
              )}
            </div>

            <div className="space-y-4">
              {clusters.map((cluster) => {
                const primary = cluster.packets[0];
                return (
                  <div
                    key={cluster.clusterId}
                    className="rounded-lg border border-slate-200 bg-white p-4 space-y-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-mono text-xs text-[#0f4c81]">
                          Cluster {cluster.wardName} · {cluster.eventType} ·{' '}
                          {cluster.packets.length} aggregated source(s)
                        </p>
                        <h4 className="mt-0.5 text-sm font-semibold text-slate-900">
                          {cluster.primaryTitle}
                        </h4>
                      </div>
                      <span className="font-mono text-xs font-semibold text-slate-700">
                        {STAGE_LABELS[cluster.highestStage]}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5">
                      {(Object.keys(STAGE_LABELS) as RescueOperationStage[]).map(
                        (stage) => {
                          const isCurrent = primary.rescueStage === stage;
                          const isLocked =
                            !isCoordinator &&
                            stage !== 'CITIZEN_REPORTED' &&
                            stage !== 'VOLUNTEER_RESPONSE';
                          return (
                            <button
                              key={stage}
                              type="button"
                              onClick={() => handleAdvanceStage(primary, stage)}
                              className={`rounded border px-2 py-1.5 text-[11px] font-medium text-left transition-colors ${
                                isCurrent
                                  ? 'border-[#0f4c81] bg-[#0f4c81] text-white'
                                  : isLocked
                                  ? 'border-slate-200 bg-slate-100 text-slate-400'
                                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              {STAGE_LABELS[stage]}
                            </button>
                          );
                        }
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {subView === 'topology' && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="lg:col-span-6 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">
                  Live Hybrid Mesh Nodes (Android P2P + LoRa Gateways)
                </h3>
                <span className="text-[11px] text-slate-500">
                  Click node to simulate outage
                </span>
              </div>
              <div className="space-y-2">
                {nodes.map((node) => (
                  <button
                    key={node.nodeId}
                    type="button"
                    onClick={() => toggleNodeOffline(node.nodeId)}
                    className={`w-full text-left rounded-md border p-3 transition-colors flex items-center justify-between gap-3 ${
                      node.status === 'ACTIVE'
                        ? 'border-slate-200 bg-white hover:bg-slate-50'
                        : 'border-red-200 bg-red-50/50 text-slate-500'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900 truncate">
                        {node.nodeId} — {node.label}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-slate-500">
                        {node.radioType} · RSSI {node.rssiDbm} dBm · {node.hopDistance} hop
                        {node.verifiedResponderNode ? ' · Verified Responder' : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 font-mono text-xs">
                      <span className="inline-flex items-center gap-1 text-slate-600">
                        <BatteryCharging className="h-3.5 w-3.5" />
                        {node.batteryPct}%
                      </span>
                      <span
                        className={`font-semibold ${
                          node.status === 'ACTIVE' ? 'text-emerald-700' : 'text-red-700'
                        }`}
                      >
                        {node.status}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="lg:col-span-6 space-y-2">
              <h3 className="text-sm font-semibold text-slate-900">
                Mesh Node & SOS Marker Map
              </h3>
              <CityFixGoogleMap
                center={{ lat: selectedWard.centerLat, lng: selectedWard.centerLng }}
                zoom={13}
                heightClass="h-80"
                fallbackNotice="Disconnected mode: Google Maps tiles suspended; local store-and-forward coordinates and offline ward bounds remain active."
                markers={[
                  ...nodes.map((n) => ({
                    id: n.nodeId,
                    lat: n.lat,
                    lng: n.lng,
                    title: `${n.nodeId} (${n.radioType})`,
                    subtitle: `${n.label} · ${n.status} · ${n.batteryPct}% battery`,
                    accentColor: n.status === 'ACTIVE' ? '#0f4c81' : '#94a3b8',
                    badgeText: 'N',
                  })),
                  ...packets.map((p) => ({
                    id: p.messageId,
                    lat: p.latitude,
                    lng: p.longitude,
                    title: `${p.eventType}: ${p.title}`,
                    subtitle: `${STAGE_LABELS[p.rescueStage]} · ${p.deliveryStatus}`,
                    accentColor: p.eventType === 'RESOURCE' ? '#059669' : '#dc2626',
                    badgeText: '!',
                  })),
                ]}
              />
            </div>
          </div>
        )}

        {subView === 'sync' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Append-Only CEMN Recovery & Authority Audit Log (Cloud SQL)
                </h3>
                <p className="text-xs text-slate-500">
                  Every offline reconciliation and responder stage change is immutably logged in PostgreSQL.
                </p>
              </div>
              <button
                type="button"
                onClick={fetchRecoveryLog}
                className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh Log
              </button>
            </div>

            {auditLog.length === 0 ? (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-600">
                No Cloud SQL audit entries yet. Click <strong>Sync Queued</strong> while
                signed in to reconcile offline CEMN events.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 rounded-md border border-slate-200 bg-white">
                {auditLog.map((entry) => (
                  <div
                    key={entry.id}
                    className="px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs"
                  >
                    <div>
                      <p className="font-mono font-semibold text-slate-900">
                        {entry.eventMessageId} · {entry.action}
                      </p>
                      <p className="text-slate-600 mt-0.5">{entry.note}</p>
                    </div>
                    <div className="text-right font-mono text-[11px] text-slate-500">
                      <p>{entry.actorTier}</p>
                      <p>{new Date(entry.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
