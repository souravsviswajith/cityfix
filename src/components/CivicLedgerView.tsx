import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  Clock,
  FileWarning,
  Mail,
  Map as MapIcon,
  MapPin,
  Plus,
  Search,
  Trash2,
  Wrench,
} from 'lucide-react';
import {
  ISSUE_CATEGORIES,
  PUBLIC_OFFICIALS,
  WARD_ZONES,
} from '../data/civicDirectory';
import { resolveReportMediaUrl } from '../data/civicMedia';
import { useAuth } from '../context/AuthContext';
import type { CivicReport, LocalDraftReport, ReportStatus } from '../types/civic';
import { CityFixGoogleMap, type MapMarkerPoint } from './CityFixGoogleMap';
import { StatusAnalytics } from './StatusAnalytics';

interface CivicLedgerViewProps {
  reports: CivicReport[];
  localDrafts?: LocalDraftReport[];
  loading: boolean;
  error: string | null;
  onlyMine?: boolean;
  citizenContact?: string;
  onCreateNew: () => void;
  onOpenDisaster?: () => void;
  onRequireAuth?: () => void;
  onResumeDraft?: (draft: LocalDraftReport) => void;
  onDeleteDraft?: (localId: string) => void;
  onStatusChange: (reportId: string, status: ReportStatus) => Promise<void>;
}

const STATUS_META: Record<
  ReportStatus,
  { label: string; colorClass: string; Icon: React.FC<{ className?: string }> }
> = {
  Submitted: {
    label: 'Submitted',
    colorClass: 'text-amber-700',
    Icon: Clock,
  },
  Acknowledged: {
    label: 'Acknowledged',
    colorClass: 'text-sky-700',
    Icon: FileWarning,
  },
  Dispatched: {
    label: 'Crew Dispatched',
    colorClass: 'text-indigo-700',
    Icon: Wrench,
  },
  Resolved: {
    label: 'Resolved',
    colorClass: 'text-emerald-700',
    Icon: CheckCircle2,
  },
};

export const CivicLedgerView: React.FC<CivicLedgerViewProps> = ({
  reports,
  localDrafts = [],
  loading,
  error,
  onlyMine = false,
  citizenContact,
  onCreateNew,
  onOpenDisaster,
  onRequireAuth,
  onResumeDraft,
  onDeleteDraft,
  onStatusChange,
}) => {
  const { session, bookmarks, saveBookmark, removeBookmark } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [wardFilter, setWardFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ReportStatus>('all');
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(true);
  const [bookmarkBusy, setBookmarkBusy] = useState(false);

  const baseReports = useMemo(() => {
    if (!onlyMine) return reports;
    if (!session?.authenticated && !citizenContact) return [];
    return reports.filter(
      (r) =>
        (session?.uid && r.userUid === session.uid) ||
        (citizenContact && r.citizenContact === citizenContact)
    );
  }, [reports, onlyMine, citizenContact, session?.authenticated, session?.uid]);

  const filteredReports = useMemo(() => {
    return baseReports.filter((r) => {
      if (wardFilter !== 'all' && r.wardId !== wardFilter) return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const hay = `${r.id} ${r.title} ${r.address} ${r.wardName} ${r.description}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [baseReports, wardFilter, statusFilter, searchQuery]);

  const activeReport = useMemo(() => {
    if (!filteredReports.length) return null;
    return (
      filteredReports.find((r) => r.id === selectedReportId) ?? filteredReports[0]
    );
  }, [filteredReports, selectedReportId]);

  const mapMarkers: MapMarkerPoint[] = useMemo(
    () =>
      filteredReports.map((r) => ({
        id: r.id,
        lat: r.latitude,
        lng: r.longitude,
        title: `${r.id} · ${r.title}`,
        subtitle: `${r.wardName} · ${r.status} (${r.severity})`,
        accentColor:
          r.status === 'Resolved'
            ? '#047857'
            : r.severity === 'Critical' || r.severity === 'Urgent'
            ? '#b91c1c'
            : '#0f4c81',
        badgeText: r.severity.slice(0, 1),
      })),
    [filteredReports]
  );

  const activeBookmark = useMemo(() => {
    if (!activeReport) return null;
    return bookmarks.find((b) => b.reportId === activeReport.id) ?? null;
  }, [bookmarks, activeReport]);

  const handleToggleBookmark = async () => {
    if (!activeReport) return;
    if (!session?.authenticated) {
      onRequireAuth?.();
      return;
    }
    setBookmarkBusy(true);
    try {
      if (activeBookmark) {
        await removeBookmark(activeBookmark.id);
      } else {
        await saveBookmark(
          activeReport.id,
          activeReport.wardId,
          `${activeReport.title} (${activeReport.status})`
        );
      }
    } finally {
      setBookmarkBusy(false);
    }
  };

  const metrics = useMemo(() => {
    const total = baseReports.length;
    const active = baseReports.filter((r) => r.status !== 'Resolved').length;
    const resolved = baseReports.filter((r) => r.status === 'Resolved').length;
    const coveredWards = new Set(baseReports.map((r) => r.wardId)).size;
    return { total, active, resolved, coveredWards };
  }, [baseReports]);

  const handleAdvanceStatus = async (report: CivicReport, nextStatus: ReportStatus) => {
    setUpdatingId(report.id);
    try {
      await onStatusChange(report.id, nextStatus);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            {onlyMine ? 'My Submitted Civic Complaints & Offline Drafts' : 'Municipal Civic Accountability Ledger'}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {onlyMine
              ? 'Review saved offline drafts, SHA-256 evidence digests, and official complaint progress.'
              : 'Public register of geotagged urban infrastructure issues, verified public officials, and formal complaint briefs.'}
          </p>
        </div>

        <button
          type="button"
          onClick={onCreateNew}
          className="inline-flex items-center gap-1.5 rounded-md bg-[#0f4c81] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0c3d68] whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" />
          Report Civic Issue
        </button>
      </div>

      {/* Prominent Emergency & Disaster Pathway on Overview */}
      {!onlyMine && onOpenDisaster && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-red-200 bg-red-50/70 px-4 py-3.5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-700 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-950">
                Emergency & Disaster Response
              </p>
              <p className="text-xs text-red-900">
                Access verified 112 / 101 / 108 emergency helplines and authoritative NDMA / Red
                Cross safety protocols.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenDisaster}
            className="rounded-md bg-red-700 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-red-800 whitespace-nowrap shrink-0"
          >
            Open Disaster Module
          </button>
        </div>
      )}

      {/* Offline Saved Drafts Section */}
      {localDrafts.length > 0 && (
        <section className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-700">
              Locally Archived Offline Drafts ({localDrafts.length})
            </h2>
            <span className="text-xs text-slate-500">Stored in browser cache</span>
          </div>
          <div className="divide-y divide-slate-100">
            {localDrafts.map((draft) => (
              <div
                key={draft.localId}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-2.5 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {draft.title}
                  </p>
                  <p className="font-mono text-[11px] text-slate-500 tabular-nums">
                    Saved {new Date(draft.savedAt).toLocaleString()} · {draft.complaintFormat}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {onResumeDraft && (
                    <button
                      type="button"
                      onClick={() => onResumeDraft(draft)}
                      className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Resume Draft
                    </button>
                  )}
                  {onDeleteDraft && (
                    <button
                      type="button"
                      onClick={() => onDeleteDraft(draft.localId)}
                      aria-label="Delete saved draft"
                      className="rounded border border-slate-200 p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 4-Column Metric Strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3.5">
          <p className="text-xs text-slate-500">Total Logged Reports</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {metrics.total}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3.5">
          <p className="text-xs text-slate-500">Open Action Items</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {metrics.active}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3.5">
          <p className="text-xs text-slate-500">Resolved Cases</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-emerald-700 tabular-nums">
            {metrics.resolved}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3.5">
          <p className="text-xs text-slate-500">Active Municipal Wards</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {metrics.coveredWards} / {WARD_ZONES.length}
          </p>
        </div>
      </div>

      {/* Recharts Status Distribution Analytics */}
      <StatusAnalytics
        reports={baseReports}
        activeStatus={statusFilter}
        onSelectStatus={setStatusFilter}
      />

      {/* Filter Bar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between rounded-lg border border-slate-200 bg-white p-3.5">
        <div className="flex flex-wrap items-center gap-1 rounded-md bg-slate-100 p-1">
          {(['all', 'Submitted', 'Acknowledged', 'Dispatched', 'Resolved'] as const).map(
            (st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`rounded px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  statusFilter === st
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st === 'all' ? 'All Statuses' : st}
              </button>
            )
          )}
        </div>

        <div className="flex flex-1 flex-col sm:flex-row gap-2.5 lg:max-w-lg">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search report ID, street, or issue..."
              className="w-full rounded-md border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#0f4c81] focus:outline-none"
            />
          </div>
          <select
            aria-label="Filter reports by ward"
            value={wardFilter}
            onChange={(e) => setWardFilter(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-[#0f4c81] focus:outline-none"
          >
            <option value="all">All Wards</option>
            {WARD_ZONES.map((w) => (
              <option key={w.id} value={w.id}>
                {w.code} · {w.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setShowMap((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium whitespace-nowrap ${
              showMap
                ? 'border-[#0f4c81] bg-sky-50 text-[#0f4c81]'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <MapIcon className="h-3.5 w-3.5" />
            {showMap ? 'Hide Map' : 'Show Map'}
          </button>
        </div>
      </div>

      {showMap && filteredReports.length > 0 && (
        <section className="rounded-lg border border-slate-200 bg-white p-3.5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span className="font-semibold text-slate-800">
              Municipal Issue Spatial Map ({filteredReports.length} plotted)
            </span>
            <span>Select any pin to inspect complaint and assigned officials</span>
          </div>
          <CityFixGoogleMap
            center={{
              lat: activeReport?.latitude ?? 12.9716,
              lng: activeReport?.longitude ?? 77.5946,
            }}
            zoom={13}
            heightClass="h-64"
            markers={mapMarkers}
            selectedMarkerId={activeReport?.id}
            onMarkerClick={(id) => setSelectedReportId(id)}
          />
        </section>
      )}

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="h-28 animate-pulse rounded-lg border border-slate-200 bg-white"
            />
          ))}
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-12 text-center">
          <p className="text-base font-semibold text-slate-900">
            {onlyMine && !session?.authenticated
              ? 'Sign in with Google to view your personal submissions and Firestore bookmarks'
              : 'No civic reports match the current filters'}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Document an infrastructure issue with geotagged evidence to create a formal complaint.
          </p>
          <button
            type="button"
            onClick={onCreateNew}
            className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-[#0f4c81] px-4 py-2 text-sm font-medium text-white hover:bg-[#0c3d68]"
          >
            <Plus className="h-4 w-4" />
            Log First Report
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          {/* Report List */}
          <div className="space-y-3 xl:col-span-7">
            {filteredReports.map((report) => {
              const cat = ISSUE_CATEGORIES.find((c) => c.id === report.category);
              const mediaSrc = resolveReportMediaUrl(report);
              const statusInfo = STATUS_META[report.status];
              const StatusIcon = statusInfo.Icon;
              const isSelected = activeReport?.id === report.id;

              return (
                <button
                  key={report.id}
                  type="button"
                  onClick={() => setSelectedReportId(report.id)}
                  className={`w-full text-left rounded-lg border bg-white p-4 transition-colors ${
                    isSelected
                      ? 'border-[#0f4c81] ring-1 ring-[#0f4c81]/20'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row gap-4">
                    {mediaSrc && (
                      <div className="h-24 w-full sm:w-32 shrink-0 overflow-hidden rounded border border-slate-200 bg-slate-100">
                        <img
                          src={mediaSrc}
                          alt={report.title}
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover"
                        />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span className="font-mono font-medium text-slate-700 tabular-nums">
                            {report.id}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{cat?.label ?? report.category}</span>
                          <span aria-hidden="true">·</span>
                          <span>{report.severity}</span>
                        </div>
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-medium ${statusInfo.colorClass}`}
                        >
                          <StatusIcon className="h-3.5 w-3.5" />
                          {statusInfo.label}
                        </span>
                      </div>

                      <h2 className="mt-1.5 text-sm font-semibold text-slate-900 line-clamp-1">
                        {report.title}
                      </h2>
                      <p className="mt-1 text-xs text-slate-600 line-clamp-2 leading-relaxed">
                        {report.description}
                      </p>

                      <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-slate-400" />
                          {report.wardName}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          {report.latitude.toFixed(4)}, {report.longitude.toFixed(4)}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>Reported by {report.citizenName}</span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Detail Inspector */}
          {activeReport && (
            <aside className="xl:col-span-5">
              <div className="sticky top-6 rounded-lg border border-slate-200 bg-white p-5 space-y-5">
                <div className="border-b border-slate-100 pb-4">
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                    <span className="font-mono font-semibold text-[#0f4c81] tabular-nums">
                      {activeReport.id}
                    </span>
                    <span className="font-mono tabular-nums">
                      {new Date(activeReport.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-start justify-between gap-2">
                    <h3 className="text-base font-semibold text-slate-900">
                      {activeReport.title}
                    </h3>
                    <button
                      type="button"
                      onClick={handleToggleBookmark}
                      disabled={bookmarkBusy}
                      className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-[11px] font-medium whitespace-nowrap shrink-0 ${
                        activeBookmark
                          ? 'border-sky-300 bg-sky-50 text-[#0f4c81]'
                          : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {activeBookmark ? (
                        <>
                          <BookmarkCheck className="h-3.5 w-3.5" />
                          Bookmarked
                        </>
                      ) : (
                        <>
                          <Bookmark className="h-3.5 w-3.5" />
                          Bookmark
                        </>
                      )}
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    {activeReport.address} · {activeReport.wardName} ({activeReport.district})
                  </p>
                  {activeReport.evidenceHash && (
                    <p className="mt-1.5 font-mono text-[11px] text-slate-500 break-all">
                      SHA-256: {activeReport.evidenceHash}
                    </p>
                  )}
                </div>

                {resolveReportMediaUrl(activeReport) && (
                  <div className="overflow-hidden rounded-md border border-slate-200 bg-slate-100">
                    <img
                      src={resolveReportMediaUrl(activeReport)}
                      alt={activeReport.title}
                      referrerPolicy="no-referrer"
                      className="w-full max-h-52 object-cover"
                    />
                  </div>
                )}

                <div>
                  <h4 className="text-xs font-semibold text-slate-700 mb-2">
                    Complaint Status Progression
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {(['Submitted', 'Acknowledged', 'Dispatched', 'Resolved'] as const).map(
                      (st) => (
                        <button
                          key={st}
                          type="button"
                          disabled={updatingId === activeReport.id}
                          onClick={() => handleAdvanceStatus(activeReport, st)}
                          className={`rounded border px-2 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                            activeReport.status === st
                              ? 'border-[#0f4c81] bg-[#0f4c81] text-white'
                              : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {st}
                        </button>
                      )
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-slate-700 mb-2">
                    Assigned Responsible Authorities
                  </h4>
                  <div className="space-y-2">
                    {activeReport.assignedOfficialIds.map((id) => {
                      const off = PUBLIC_OFFICIALS.find((o) => o.id === id);
                      if (!off) return null;
                      return (
                        <div
                          key={off.id}
                          className="flex items-center justify-between gap-2 rounded border border-slate-100 bg-slate-50/70 px-3 py-2 text-xs"
                        >
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 truncate">{off.name}</p>
                            <p className="text-slate-500 truncate">{off.designation}</p>
                          </div>
                          {off.email && (
                            <a
                              href={`mailto:${off.email}?subject=${encodeURIComponent(
                                activeReport.draftSubject
                              )}&body=${encodeURIComponent(activeReport.draftBody)}`}
                              className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
                            >
                              <Mail className="h-3 w-3" />
                              Email
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-slate-700 mb-1.5">
                    Formal Complaint Brief
                  </h4>
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 space-y-2">
                    <p className="font-semibold text-slate-900">{activeReport.draftSubject}</p>
                    <p className="whitespace-pre-line leading-relaxed">{activeReport.draftBody}</p>
                  </div>
                </div>
              </div>
            </aside>
          )}
        </div>
      )}
    </div>
  );
};
