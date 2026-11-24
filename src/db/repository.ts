import { and, desc, eq } from 'drizzle-orm';
import { db } from './index.ts';
import { cemnAuditLog, cemnEvents, civicReports, users } from './schema.ts';
import { SEED_REPORTS } from '../data/civicDirectory.ts';
import type {
  AuthChannel,
  CemnAuditEntry,
  CemnPacket,
  CivicReport,
  ComplaintFormat,
  IssueCategory,
  ReportStatus,
  RescueOperationStage,
  SeverityLevel,
} from '../types/civic.ts';

function toCivicReport(row: typeof civicReports.$inferSelect): CivicReport {
  return {
    id: row.id,
    userUid: row.userUid,
    title: row.title,
    category: row.category as IssueCategory,
    severity: row.severity as SeverityLevel,
    description: row.description,
    address: row.address,
    latitude: row.latitude,
    longitude: row.longitude,
    wardId: row.wardId,
    wardName: row.wardName,
    district: row.district,
    mediaType: row.mediaType as 'image' | 'video' | 'none',
    mediaUrl: row.mediaUrl ?? undefined,
    seedImageKey:
      row.seedImageKey === 'pothole' ||
      row.seedImageKey === 'streetlight' ||
      row.seedImageKey === 'waste'
        ? row.seedImageKey
        : undefined,
    evidenceHash: row.evidenceHash ?? undefined,
    complaintFormat: row.complaintFormat as ComplaintFormat,
    citizenName: row.citizenName,
    citizenContact: row.citizenContact,
    authChannel: row.authChannel as AuthChannel,
    assignedOfficialIds: Array.isArray(row.assignedOfficialIds)
      ? row.assignedOfficialIds
      : [],
    draftSubject: row.draftSubject,
    draftBody: row.draftBody,
    status: row.status as ReportStatus,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getOrCreateUser(
  uid: string,
  email: string,
  displayName?: string
) {
  try {
    const safeName = displayName?.trim() || email.split('@')[0] || 'Verified Citizen';
    const result = await db
      .insert(users)
      .values({
        uid,
        email,
        displayName: safeName,
        role: 'citizen',
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          displayName: safeName,
        },
      })
      .returning();
    return result[0];
  } catch (error) {
    console.error('Database user upsert failed:', error);
    throw new Error('Failed to synchronize user account with database.', {
      cause: error,
    });
  }
}

export async function getUserByUid(uid: string) {
  try {
    const rows = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    return rows[0] ?? null;
  } catch (error) {
    console.error('Database user lookup failed:', error);
    throw new Error('Database query failed. Please try again later.', {
      cause: error,
    });
  }
}

export async function seedInitialReportsIfEmpty(): Promise<void> {
  try {
    const existing = await db.select({ id: civicReports.id }).from(civicReports).limit(1);
    if (existing.length > 0) return;

    for (const r of SEED_REPORTS) {
      await db
        .insert(civicReports)
        .values({
          id: r.id,
          userUid: null,
          title: r.title,
          category: r.category,
          severity: r.severity,
          description: r.description,
          address: r.address,
          latitude: r.latitude,
          longitude: r.longitude,
          wardId: r.wardId,
          wardName: r.wardName,
          district: r.district,
          mediaType: r.mediaType,
          mediaUrl: r.mediaUrl ?? null,
          seedImageKey: r.seedImageKey ?? null,
          evidenceHash: r.evidenceHash ?? null,
          complaintFormat: r.complaintFormat ?? 'FORMAL_LETTER',
          citizenName: r.citizenName,
          citizenContact: r.citizenContact,
          authChannel: r.authChannel,
          assignedOfficialIds: r.assignedOfficialIds,
          draftSubject: r.draftSubject,
          draftBody: r.draftBody,
          status: r.status,
          createdAt: new Date(r.createdAt),
          updatedAt: new Date(r.updatedAt),
        })
        .onConflictDoNothing();
    }
  } catch (error) {
    console.error('Failed to seed initial reports:', error);
  }
}

export async function listCivicReports(filters?: {
  wardId?: string;
  category?: string;
  status?: string;
  userUid?: string;
}): Promise<CivicReport[]> {
  try {
    await seedInitialReportsIfEmpty();
    const conditions = [];
    if (filters?.userUid) conditions.push(eq(civicReports.userUid, filters.userUid));
    if (filters?.wardId && filters.wardId !== 'all') {
      conditions.push(eq(civicReports.wardId, filters.wardId));
    }
    if (filters?.category && filters.category !== 'all') {
      conditions.push(eq(civicReports.category, filters.category));
    }
    if (filters?.status && filters.status !== 'all') {
      conditions.push(eq(civicReports.status, filters.status));
    }

    const rows = await db
      .select()
      .from(civicReports)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(civicReports.createdAt));

    return rows.map(toCivicReport);
  } catch (error) {
    console.error('Database listCivicReports failed:', error);
    throw new Error('Unable to load civic reports from database.', { cause: error });
  }
}

export async function createCivicReportRecord(report: CivicReport): Promise<CivicReport> {
  try {
    const [inserted] = await db
      .insert(civicReports)
      .values({
        id: report.id,
        userUid: report.userUid ?? null,
        title: report.title,
        category: report.category,
        severity: report.severity,
        description: report.description,
        address: report.address,
        latitude: report.latitude,
        longitude: report.longitude,
        wardId: report.wardId,
        wardName: report.wardName,
        district: report.district,
        mediaType: report.mediaType,
        mediaUrl: report.mediaUrl ?? null,
        seedImageKey: report.seedImageKey ?? null,
        evidenceHash: report.evidenceHash ?? null,
        complaintFormat: report.complaintFormat ?? 'FORMAL_LETTER',
        citizenName: report.citizenName,
        citizenContact: report.citizenContact,
        authChannel: report.authChannel,
        assignedOfficialIds: report.assignedOfficialIds,
        draftSubject: report.draftSubject,
        draftBody: report.draftBody,
        status: report.status,
        createdAt: new Date(report.createdAt),
        updatedAt: new Date(report.updatedAt),
      })
      .returning();
    return toCivicReport(inserted);
  } catch (error) {
    console.error('Database createCivicReportRecord failed:', error);
    throw new Error('Failed to save civic report to PostgreSQL database.', {
      cause: error,
    });
  }
}

export async function updateCivicReportStatusRecord(
  id: string,
  status: ReportStatus
): Promise<CivicReport | null> {
  try {
    const [updated] = await db
      .update(civicReports)
      .set({ status, updatedAt: new Date() })
      .where(eq(civicReports.id, id))
      .returning();
    return updated ? toCivicReport(updated) : null;
  } catch (error) {
    console.error('Database updateCivicReportStatusRecord failed:', error);
    throw new Error('Failed to update report status.', { cause: error });
  }
}

export async function listCemnSyncedEvents(): Promise<{
  events: CemnPacket[];
  auditLog: CemnAuditEntry[];
}> {
  try {
    const rows = await db
      .select()
      .from(cemnEvents)
      .orderBy(desc(cemnEvents.createdAt))
      .limit(100);
    const logs = await db
      .select()
      .from(cemnAuditLog)
      .orderBy(desc(cemnAuditLog.createdAt))
      .limit(100);

    const events: CemnPacket[] = rows.map((row) => ({
      messageId: row.messageId,
      eventType: row.eventType as CemnPacket['eventType'],
      title: row.title,
      summary: row.summary,
      wardId: row.wardId,
      latitude: row.latitude,
      longitude: row.longitude,
      coordSource: row.coordSource as CemnPacket['coordSource'],
      coordAccuracyM: row.coordAccuracyM,
      severity: row.severity as SeverityLevel,
      identityTier: row.identityTier as CemnPacket['identityTier'],
      authorUid: row.authorUid,
      authorLabel: row.authorLabel,
      publicKeyFingerprint:
        typeof row.payload?.publicKeyFingerprint === 'string'
          ? row.payload.publicKeyFingerprint
          : 'mesh-node',
      signature: row.signature,
      deliveryStatus: row.deliveryStatus as CemnPacket['deliveryStatus'],
      rescueStage: row.rescueStage as RescueOperationStage,
      hopCount: row.hopCount,
      relayPath: Array.isArray(row.payload?.relayPath)
        ? (row.payload.relayPath as string[])
        : [],
      transportMode: row.transportMode,
      payload: row.payload,
      ttlExpiresAt: row.ttlExpiresAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
      syncedToCloud: true,
      syncedAt: row.syncedAt.toISOString(),
    }));

    const auditLog: CemnAuditEntry[] = logs.map((l) => ({
      id: l.id,
      eventMessageId: l.eventMessageId,
      actorUid: l.actorUid,
      actorTier: l.actorTier,
      action: l.action,
      previousStage: l.previousStage,
      nextStage: l.nextStage,
      note: l.note,
      createdAt: l.createdAt.toISOString(),
    }));

    return { events, auditLog };
  } catch (error) {
    console.error('Database listCemnSyncedEvents failed:', error);
    throw new Error('Failed to load CEMN recovery ledger.', { cause: error });
  }
}

export async function syncCemnPacketsToDb(
  packets: CemnPacket[],
  actorUid: string,
  actorTier: string
): Promise<{ syncedCount: number; duplicateSkippedCount: number }> {
  try {
    let syncedCount = 0;
    let duplicateSkippedCount = 0;

    for (const pkt of packets) {
      // Idempotent messageId insert (duplicate suppression)
      const inserted = await db
        .insert(cemnEvents)
        .values({
          messageId: pkt.messageId,
          eventType: pkt.eventType,
          title: pkt.title.slice(0, 180),
          summary: pkt.summary.slice(0, 1000),
          wardId: pkt.wardId,
          latitude: pkt.latitude,
          longitude: pkt.longitude,
          coordSource: pkt.coordSource,
          coordAccuracyM: pkt.coordAccuracyM,
          severity: pkt.severity,
          identityTier: pkt.identityTier,
          authorUid: pkt.authorUid ?? actorUid,
          authorLabel: pkt.authorLabel.slice(0, 120),
          signature: pkt.signature,
          deliveryStatus: pkt.deliveryStatus,
          rescueStage: pkt.rescueStage,
          hopCount: pkt.hopCount,
          transportMode: pkt.transportMode,
          payload: {
            ...pkt.payload,
            relayPath: pkt.relayPath,
            publicKeyFingerprint: pkt.publicKeyFingerprint,
          },
          ttlExpiresAt: new Date(pkt.ttlExpiresAt),
          syncedAt: new Date(),
          createdAt: new Date(pkt.createdAt),
        })
        .onConflictDoNothing({ target: cemnEvents.messageId })
        .returning({ messageId: cemnEvents.messageId });

      if (inserted.length > 0) {
        syncedCount += 1;
        await db.insert(cemnAuditLog).values({
          eventMessageId: pkt.messageId,
          actorUid,
          actorTier,
          action: 'RECOVERY_SYNC',
          previousStage: null,
          nextStage: pkt.rescueStage,
          note: `Synchronized offline ${pkt.eventType} packet (${pkt.hopCount} mesh hops) to Cloud SQL.`,
        });
      } else {
        duplicateSkippedCount += 1;
      }
    }

    return { syncedCount, duplicateSkippedCount };
  } catch (error) {
    console.error('Database syncCemnPacketsToDb failed:', error);
    throw new Error('Failed to synchronize CEMN packets to PostgreSQL.', {
      cause: error,
    });
  }
}

export async function updateCemnRescueStageInDb(params: {
  messageId: string;
  nextStage: RescueOperationStage;
  actorUid: string;
  actorTier: string;
  note: string;
}): Promise<boolean> {
  try {
    const existingRows = await db
      .select()
      .from(cemnEvents)
      .where(eq(cemnEvents.messageId, params.messageId))
      .limit(1);

    const previousStage = existingRows[0]?.rescueStage ?? null;
    if (existingRows.length > 0) {
      await db
        .update(cemnEvents)
        .set({
          rescueStage: params.nextStage,
          deliveryStatus: 'ACKNOWLEDGED',
        })
        .where(eq(cemnEvents.messageId, params.messageId));
    }

    await db.insert(cemnAuditLog).values({
      eventMessageId: params.messageId,
      actorUid: params.actorUid,
      actorTier: params.actorTier,
      action: 'STAGE_TRANSITION',
      previousStage,
      nextStage: params.nextStage,
      note: params.note,
    });

    return true;
  } catch (error) {
    console.error('Database updateCemnRescueStageInDb failed:', error);
    throw new Error('Failed to record CEMN rescue stage transition.', {
      cause: error,
    });
  }
}

