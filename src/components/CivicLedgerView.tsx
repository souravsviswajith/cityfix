import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  FileWarning,
  Mail,
  MapPin,
  Plus,
  Search,
  Wrench,
} from 'lucide-react';
import {
  ISSUE_CATEGORIES,
  PUBLIC_OFFICIALS,
  WARD_ZONES,
} from '../data/civicDirectory';
import { resolveReportMediaUrl } from '../data/civicMedia';
import type { CivicReport, ReportStatus } from '../types/civic';

interface CivicLedgerViewProps {
  reports: CivicReport[];
  loading: boolean;
  error: string | null;
  onlyMine?: boolean;
  citizenContact?: string;
  onCreateNew: () => void;
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
  loading,
  error,
  onlyMine = false,
  citizenContact,
  onCreateNew,
  onStatusChange,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [wardFilter, setWardFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ReportStatus>('all');
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const baseReports = useMemo(() => {
    if (!onlyMine) return reports;
    if (!citizenContact) return [];
    return reports.filter((r) => r.citizenContact === citizenContact);
  }, [reports, onlyMine, citizenContact]);

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
            {onlyMine ? 'My Submitted Civic Complaints' : 'Municipal Civic Accountability Ledger'}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {onlyMine
              ? 'Track official acknowledgments, assigned municipal officers, and field dispatch progress for your reports.'
              : 'Public register of geotagged urban infrastructure issues, assigned public officials, and formal complaint briefs.'}
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
        </div>
      </div>

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
            {onlyMine && !citizenContact
              ? 'Verify your Mobile or WhatsApp number to view personal submissions'
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
                  <h3 className="mt-1.5 text-base font-semibold text-slate-900">
                    {activeReport.title}
                  </h3>
                  <p className="mt-1 text-xs text-slate-600">
                    {activeReport.address} · {activeReport.wardName} ({activeReport.district})
                  </p>
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
                          <a
                            href={`mailto:${off.email}?subject=${encodeURIComponent(
                              activeReport.draftSubject
                            )}&body=${encodeURIComponent(activeReport.draftBody)}`}
                            className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
                          >
                            <Mail className="h-3 w-3" />
                            Email
                          </a>
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
