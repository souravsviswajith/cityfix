import { relations } from 'drizzle-orm';
import {
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name').notNull().default('Verified Citizen'),
  role: text('role').notNull().default('citizen'), // 'citizen' | 'responder' | 'coordinator'
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const civicReports = pgTable('civic_reports', {
  id: text('id').primaryKey(), // e.g., CF-2026-0421
  userUid: text('user_uid'),
  title: text('title').notNull(),
  category: text('category').notNull(),
  severity: text('severity').notNull(),
  description: text('description').notNull(),
  address: text('address').notNull(),
  latitude: doublePrecision('latitude').notNull(),
  longitude: doublePrecision('longitude').notNull(),
  wardId: text('ward_id').notNull(),
  wardName: text('ward_name').notNull(),
  district: text('district').notNull(),
  mediaType: text('media_type').notNull().default('none'),
  mediaUrl: text('media_url'),
  seedImageKey: text('seed_image_key'),
  evidenceHash: text('evidence_hash'),
  complaintFormat: text('complaint_format').notNull().default('FORMAL_LETTER'),
  citizenName: text('citizen_name').notNull(),
  citizenContact: text('citizen_contact').notNull(),
  authChannel: text('auth_channel').notNull().default('Google Sign-In'),
  assignedOfficialIds: jsonb('assigned_official_ids').$type<string[]>().notNull(),
  draftSubject: text('draft_subject').notNull(),
  draftBody: text('draft_body').notNull(),
  status: text('status').notNull().default('Submitted'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const cemnEvents = pgTable('cemn_events', {
  id: serial('id').primaryKey(),
  messageId: text('message_id').notNull().unique(),
  eventType: text('event_type').notNull(), // 'SOS' | 'MISSING_PERSON' | 'RESOURCE' | 'INCIDENT_UPDATE'
  title: text('title').notNull(),
  summary: text('summary').notNull(),
  wardId: text('ward_id').notNull(),
  latitude: doublePrecision('latitude').notNull(),
  longitude: doublePrecision('longitude').notNull(),
  coordSource: text('coord_source').notNull().default('GPS'),
  coordAccuracyM: doublePrecision('coord_accuracy_m').notNull().default(12),
  severity: text('severity').notNull().default('Urgent'),
  identityTier: text('identity_tier').notNull().default('UNVERIFIED_CITIZEN'),
  authorUid: text('author_uid'),
  authorLabel: text('author_label').notNull(),
  signature: text('signature').notNull(),
  deliveryStatus: text('delivery_status').notNull().default('ACKNOWLEDGED'), // 'QUEUED' | 'RELAYED' | 'RECEIVED' | 'ACKNOWLEDGED'
  rescueStage: text('rescue_stage').notNull().default('CITIZEN_REPORTED'),
  hopCount: integer('hop_count').notNull().default(1),
  transportMode: text('transport_mode').notNull().default('BLE_WIFI_HYBRID'),
  payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
  ttlExpiresAt: timestamp('ttl_expires_at').notNull(),
  syncedAt: timestamp('synced_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const cemnAuditLog = pgTable('cemn_audit_log', {
  id: serial('id').primaryKey(),
  eventMessageId: text('event_message_id').notNull(),
  actorUid: text('actor_uid').notNull(),
  actorTier: text('actor_tier').notNull(),
  action: text('action').notNull(),
  previousStage: text('previous_stage'),
  nextStage: text('next_stage'),
  note: text('note').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  reports: many(civicReports),
}));

export const civicReportsRelations = relations(civicReports, ({ one }) => ({
  author: one(users, {
    fields: [civicReports.userUid],
    references: [users.uid],
  }),
}));
