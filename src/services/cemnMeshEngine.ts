import { WARD_ZONES } from '../data/civicDirectory';
import {
  RESTRICTED_RESCUE_STAGES,
  isPlainObject,
  isValidCoordinatePair,
} from '../lib/securityValidation';
import type {
  CemnEventType,
  CemnIdentityTier,
  CemnNode,
  CemnPacket,
  MeshOperatingMode,
  RescueOperationStage,
  SeverityLevel,
} from '../types/civic';

const CEMN_QUEUE_KEY = 'cityfix_cemn_packets_v1';
const CEMN_SEEN_KEY = 'cityfix_cemn_seen_ids_v1';
const CEMN_RATE_KEY = 'cityfix_cemn_rate_v1';
const BROADCAST_CHANNEL_NAME = 'cityfix_cemn_mesh_v1';

export const INITIAL_MESH_NODES: CemnNode[] = [
  {
    nodeId: 'AND-BLE-104',
    label: 'Citizen Relay Phone (BLE + Wi-Fi Direct)',
    radioType: 'BLE',
    wardId: 'ward-01',
    lat: 12.9721,
    lng: 77.5952,
    batteryPct: 78,
    rssiDbm: -58,
    hopDistance: 1,
    verifiedResponderNode: false,
    status: 'ACTIVE',
    lastSeenIso: new Date().toISOString(),
  },
  {
    nodeId: 'WIFI-DIR-209',
    label: 'Volunteer Transit Van Peer (Wi-Fi Direct)',
    radioType: 'WIFI_DIRECT',
    wardId: 'ward-02',
    lat: 12.9896,
    lng: 77.5988,
    batteryPct: 86,
    rssiDbm: -64,
    hopDistance: 1,
    verifiedResponderNode: true,
    status: 'ACTIVE',
    lastSeenIso: new Date().toISOString(),
  },
  {
    nodeId: 'LORA-GW-01',
    label: 'Ward 01 Solar LoRa Repeater (868 MHz)',
    radioType: 'LORA_GATEWAY',
    wardId: 'ward-01',
    lat: 12.9742,
    lng: 77.5999,
    batteryPct: 94,
    rssiDbm: -79,
    hopDistance: 2,
    verifiedResponderNode: true,
    status: 'ACTIVE',
    lastSeenIso: new Date().toISOString(),
  },
  {
    nodeId: 'MESH-AP-04',
    label: 'Ward Relief Shelter Wi-Fi Mesh Node',
    radioType: 'WIFI_MESH_NODE',
    wardId: 'ward-04',
    lat: 12.9502,
    lng: 77.6104,
    batteryPct: 62,
    rssiDbm: -71,
    hopDistance: 2,
    verifiedResponderNode: true,
    status: 'INTERMITTENT',
    lastSeenIso: new Date().toISOString(),
  },
  {
    nodeId: 'SAT-GW-HQ',
    label: 'District EOC Satellite Backhaul Gateway',
    radioType: 'SATELLITE_BACKHAUL',
    wardId: 'ward-03',
    lat: 12.9748,
    lng: 77.6242,
    batteryPct: 100,
    rssiDbm: -88,
    hopDistance: 3,
    verifiedResponderNode: true,
    status: 'ACTIVE',
    lastSeenIso: new Date().toISOString(),
  },
];

export const SEED_CEMN_PACKETS: CemnPacket[] = [
  {
    messageId: 'CEMN-SOS-9014A',
    eventType: 'SOS',
    title: 'Basement Transformer Flash Flood Trapping 6 Residents',
    summary:
      'Knee-deep rainwater entering ground utility room near Old Mill Crossing. Power isolated; seniors need boat or high-clearance evacuation.',
    wardId: 'ward-04',
    latitude: 12.9484,
    longitude: 77.6112,
    coordSource: 'GPS',
    coordAccuracyM: 8.5,
    severity: 'Critical',
    identityTier: 'VERIFIED_CITIZEN',
    authorUid: null,
    authorLabel: 'Meera Krishnan (Local Node)',
    publicKeyFingerprint: 'SHA256:9f2c88b1a4d0',
    signature: 'sig-ecdsa-9f2c88b1a4d077e3',
    deliveryStatus: 'ACKNOWLEDGED',
    rescueStage: 'RESPONDER_ACKNOWLEDGED',
    hopCount: 2,
    relayPath: ['AND-BLE-104', 'MESH-AP-04', 'LORA-GW-01'],
    transportMode: 'BLE -> Wi-Fi Mesh -> LoRa Gateway',
    payload: { peopleAffected: 6, needsBoat: true, utilityHazard: 'Electrical isolation done' },
    ttlExpiresAt: new Date(Date.now() + 6 * 3600 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 42 * 60 * 1000).toISOString(),
    syncedToCloud: true,
    syncedAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
  },
  {
    messageId: 'CEMN-RES-4402B',
    eventType: 'RESOURCE',
    title: '2 Inflatable Rescue Boats & First-Aid Kits Staged at Oakridge Hall',
    summary:
      'Community Civil Defense volunteers ready with 2 rescue dinghies, 12 life vests, solar floodlights, and trauma kits.',
    wardId: 'ward-04',
    latitude: 12.9501,
    longitude: 77.6095,
    coordSource: 'GPS',
    coordAccuracyM: 6,
    severity: 'Moderate',
    identityTier: 'COMMUNITY_VOLUNTEER',
    authorUid: null,
    authorLabel: 'Southridge Volunteer Corps',
    publicKeyFingerprint: 'SHA256:4c18a30e9d12',
    signature: 'sig-ecdsa-4c18a30e9d125b0a',
    deliveryStatus: 'RECEIVED',
    rescueStage: 'VOLUNTEER_RESPONSE',
    hopCount: 1,
    relayPath: ['WIFI-DIR-209', 'MESH-AP-04'],
    transportMode: 'Wi-Fi Direct -> Shelter Mesh Node',
    payload: { boats: 2, medicalKits: 6, volunteers: 8, contactChannel: 'VHF Ch-4 / BLE' },
    ttlExpiresAt: new Date(Date.now() + 12 * 3600 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 28 * 60 * 1000).toISOString(),
    syncedToCloud: false,
    syncedAt: null,
  },
];

async function signPayloadDigest(rawPayload: string): Promise<{
  signature: string;
  fingerprint: string;
}> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const enc = new TextEncoder().encode(rawPayload);
    const digest = await crypto.subtle.digest('SHA-256', enc);
    const hex = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return {
      signature: `sha256-sig-${hex.slice(0, 32)}`,
      fingerprint: `SHA256:${hex.slice(0, 12)}`,
    };
  }
  return {
    signature: `fallback-sig-${Date.now()}`,
    fingerprint: 'LOCAL-DEVICE',
  };
}

export function loadLocalCemnPackets(): CemnPacket[] {
  try {
    const raw = localStorage.getItem(CEMN_QUEUE_KEY);
    if (!raw) {
      localStorage.setItem(CEMN_QUEUE_KEY, JSON.stringify(SEED_CEMN_PACKETS));
      return SEED_CEMN_PACKETS;
    }
    return JSON.parse(raw) as CemnPacket[];
  } catch {
    return SEED_CEMN_PACKETS;
  }
}

export function saveLocalCemnPackets(packets: CemnPacket[]): void {
  try {
    localStorage.setItem(CEMN_QUEUE_KEY, JSON.stringify(packets));
  } catch {
    // Ignore storage quota errors
  }
}

export function getSeenMessageIds(): Set<string> {
  try {
    const raw = localStorage.getItem(CEMN_SEEN_KEY);
    const arr = raw ? (JSON.parse(raw) as string[]) : SEED_CEMN_PACKETS.map((p) => p.messageId);
    return new Set(arr);
  } catch {
    return new Set();
  }
}

export function recordSeenMessageId(messageId: string): boolean {
  const seen = getSeenMessageIds();
  if (seen.has(messageId)) {
    return false; // Duplicate suppressed
  }
  seen.add(messageId);
  try {
    localStorage.setItem(CEMN_SEEN_KEY, JSON.stringify(Array.from(seen).slice(-300)));
  } catch {
    // Ignore storage error
  }
  return true;
}

export function checkBroadcastRateLimit(): { allowed: boolean; waitSeconds: number } {
  try {
    const raw = localStorage.getItem(CEMN_RATE_KEY);
    const timestamps = raw ? (JSON.parse(raw) as number[]) : [];
    const oneMinuteAgo = Date.now() - 60_000;
    const recent = timestamps.filter((t) => t > oneMinuteAgo);
    if (recent.length >= 6) {
      const oldest = recent[0];
      return {
        allowed: false,
        waitSeconds: Math.max(1, Math.ceil((oldest + 60_000 - Date.now()) / 1000)),
      };
    }
    recent.push(Date.now());
    localStorage.setItem(CEMN_RATE_KEY, JSON.stringify(recent));
    return { allowed: true, waitSeconds: 0 };
  } catch {
    return { allowed: true, waitSeconds: 0 };
  }
}

export async function createSignedCemnPacket(params: {
  eventType: CemnEventType;
  title: string;
  summary: string;
  wardId: string;
  latitude: number;
  longitude: number;
  coordSource: 'GPS' | 'CELL_WIFI' | 'MANUAL_PIN';
  coordAccuracyM: number;
  severity: SeverityLevel;
  identityTier: CemnIdentityTier;
  authorUid?: string | null;
  authorLabel: string;
  operatingMode: MeshOperatingMode;
  nodes: CemnNode[];
  payload?: Record<string, unknown>;
}): Promise<CemnPacket> {
  const messageId = `CEMN-${params.eventType.slice(0, 3)}-${Math.random()
    .toString(36)
    .slice(2, 7)
    .toUpperCase()}`;
  const createdAt = new Date().toISOString();
  const ttlExpiresAt = new Date(Date.now() + 6 * 3600 * 1000).toISOString();

  const { signature, fingerprint } = await signPayloadDigest(
    `${messageId}|${params.eventType}|${params.latitude.toFixed(5)}|${params.longitude.toFixed(
      5
    )}|${createdAt}|${params.title}`
  );

  const activeNodes = params.nodes.filter((n) => n.status !== 'OFFLINE');
  const hopPath = activeNodes.slice(0, 3).map((n) => n.nodeId);

  let deliveryStatus: CemnPacket['deliveryStatus'] = 'QUEUED';
  if (params.operatingMode === 'CONNECTED') {
    deliveryStatus = 'RECEIVED';
  } else if (activeNodes.length >= 2) {
    deliveryStatus = 'RELAYED';
  } else if (activeNodes.length === 1) {
    deliveryStatus = 'QUEUED';
  }

  const transportMode =
    activeNodes.length > 0
      ? activeNodes
          .slice(0, 2)
          .map((n) => n.radioType.replace('_', ' '))
          .join(' -> ')
      : 'Local Store-and-Forward Queue (No peers in range)';

  const rescueStage: RescueOperationStage =
    params.identityTier === 'COMMUNITY_VOLUNTEER'
      ? 'VOLUNTEER_RESPONSE'
      : 'CITIZEN_REPORTED';

  const packet: CemnPacket = {
    messageId,
    eventType: params.eventType,
    title: params.title.trim(),
    summary: params.summary.trim(),
    wardId: params.wardId,
    latitude: params.latitude,
    longitude: params.longitude,
    coordSource: params.coordSource,
    coordAccuracyM: params.coordAccuracyM,
    severity: params.severity,
    identityTier: params.identityTier,
    authorUid: params.authorUid ?? null,
    authorLabel: params.authorLabel,
    publicKeyFingerprint: fingerprint,
    signature,
    deliveryStatus,
    rescueStage,
    hopCount: Math.max(1, hopPath.length),
    relayPath: hopPath,
    transportMode,
    payload: params.payload ?? {},
    ttlExpiresAt,
    createdAt,
    syncedToCloud: false,
    syncedAt: null,
  };

  recordSeenMessageId(messageId);
  return packet;
}

export function broadcastCemnPacketOverTabMesh(packet: CemnPacket): void {
  if (typeof BroadcastChannel === 'undefined') return;
  try {
    const ch = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    ch.postMessage({ type: 'CEMN_PACKET_RELAY', packet });
    ch.close();
  } catch {
    // Ignore channel errors
  }
}

export function subscribeTabMeshRelays(
  onPacket: (packet: CemnPacket) => void
): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => {};
  const ch = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
  ch.onmessage = (ev) => {
    if (!isPlainObject(ev.data) || ev.data.type !== 'CEMN_PACKET_RELAY') return;
    const raw = ev.data.packet;
    if (!isPlainObject(raw)) return;

    const messageId = typeof raw.messageId === 'string' ? raw.messageId.trim() : '';
    if (!/^[A-Za-z0-9_-]{4,64}$/.test(messageId)) return;

    const eventType = raw.eventType as CemnEventType;
    if (
      eventType !== 'SOS' &&
      eventType !== 'MISSING_PERSON' &&
      eventType !== 'RESOURCE'
    ) {
      // Authoritative EVACUATION_ORDER packets are only accepted from authenticated server sync
      return;
    }

    if (
      typeof raw.title !== 'string' ||
      !raw.title.trim() ||
      typeof raw.summary !== 'string' ||
      !raw.summary.trim() ||
      typeof raw.wardId !== 'string' ||
      !raw.wardId.trim()
    ) {
      return;
    }

    if (!isValidCoordinatePair(raw.latitude, raw.longitude)) return;

    const ttlMs = new Date(String(raw.ttlExpiresAt ?? '')).getTime();
    if (Number.isNaN(ttlMs) || ttlMs < Date.now()) {
      return; // Invalid or expired TTL dropped
    }

    const incoming = raw as unknown as CemnPacket;
    const safeStage: RescueOperationStage = RESTRICTED_RESCUE_STAGES.includes(
      incoming.rescueStage
    )
      ? 'CITIZEN_REPORTED'
      : incoming.rescueStage === 'VOLUNTEER_RESPONSE'
      ? 'VOLUNTEER_RESPONSE'
      : 'CITIZEN_REPORTED';
    const safeTier: CemnIdentityTier =
      incoming.identityTier === 'COMMUNITY_VOLUNTEER'
        ? 'COMMUNITY_VOLUNTEER'
        : 'UNVERIFIED_CITIZEN';
    const hopCount =
      typeof incoming.hopCount === 'number' &&
      Number.isInteger(incoming.hopCount) &&
      incoming.hopCount >= 0 &&
      incoming.hopCount < 64
        ? incoming.hopCount + 1
        : 1;

    if (recordSeenMessageId(messageId)) {
      onPacket({
        ...incoming,
        messageId,
        title: raw.title.trim().slice(0, 180),
        summary: raw.summary.trim().slice(0, 1000),
        wardId: raw.wardId.trim().slice(0, 64),
        rescueStage: safeStage,
        identityTier: safeTier,
        hopCount,
        deliveryStatus: 'RECEIVED',
      });
    }
  };
  return () => ch.close();
}

export interface AggregatedIncidentCluster {
  clusterId: string;
  wardId: string;
  wardName: string;
  eventType: CemnEventType;
  primaryTitle: string;
  highestSeverity: SeverityLevel;
  highestStage: RescueOperationStage;
  packets: CemnPacket[];
}

const SEVERITY_RANK: Record<SeverityLevel, number> = {
  Low: 1,
  Moderate: 2,
  Urgent: 3,
  Critical: 4,
};

const STAGE_ORDER: RescueOperationStage[] = [
  'CITIZEN_REPORTED',
  'VOLUNTEER_RESPONSE',
  'RESPONDER_ACKNOWLEDGED',
  'OFFICIAL_AGENCY_ASSIGNED',
  'RESCUE_IN_PROGRESS',
  'RESOLVED_WITH_EVIDENCE',
];

export function aggregateCemnIncidents(
  packets: CemnPacket[]
): AggregatedIncidentCluster[] {
  const clusters: Record<string, AggregatedIncidentCluster> = {};
  for (const p of packets) {
    const key = `${p.wardId}::${p.eventType}`;
    const ward = WARD_ZONES.find((w) => w.id === p.wardId);
    if (!clusters[key]) {
      clusters[key] = {
        clusterId: key,
        wardId: p.wardId,
        wardName: ward?.name ?? p.wardId,
        eventType: p.eventType,
        primaryTitle: p.title,
        highestSeverity: p.severity,
        highestStage: p.rescueStage,
        packets: [p],
      };
    } else {
      clusters[key].packets.push(p);
      if (SEVERITY_RANK[p.severity] > SEVERITY_RANK[clusters[key].highestSeverity]) {
        clusters[key].highestSeverity = p.severity;
      }
      if (
        STAGE_ORDER.indexOf(p.rescueStage) >
        STAGE_ORDER.indexOf(clusters[key].highestStage)
      ) {
        clusters[key].highestStage = p.rescueStage;
      }
    }
  }
  return Object.values(clusters);
}
