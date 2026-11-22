import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Box,
  ClipboardList,
  FilePlus2,
  Menu,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { CitizenAuthModal } from './components/CitizenAuthModal';
import { CivicAiStudioView } from './components/CivicAiStudioView';
import { CivicLedgerView } from './components/CivicLedgerView';
import { CivicTwin3DView } from './components/CivicTwin3DView';
import { DisasterManagementView } from './components/DisasterManagementView';
import { OfflineStatusIndicator } from './components/OfflineStatusIndicator';
import { OfficialsDirectory } from './components/OfficialsDirectory';
import { ReportComposer } from './components/ReportComposer';
import { useAuth } from './context/AuthContext';
import type {
  CivicReport,
  LocalDraftReport,
  ReportStatus,
} from './types/civic';

type ActiveTab =
  | 'ledger'
  | 'report'
  | 'disaster'
  | '3d-twin'
  | 'ai-hub'
  | 'officials'
  | 'submissions';

const LOCAL_DRAFTS_KEY = 'cityfix_local_drafts_v1';

export const App: React.FC = () => {
  const { session, refreshToken } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>('ledger');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [mapsQuotaExceeded, setMapsQuotaExceeded] = useState(false);

  const [reports, setReports] = useState<CivicReport[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [resumedDraft, setResumedDraft] = useState<LocalDraftReport | null>(null);

  const [localDrafts, setLocalDrafts] = useState<LocalDraftReport[]>(() => {
    try {
      const raw = localStorage.getItem(LOCAL_DRAFTS_KEY);
      return raw ? (JSON.parse(raw) as LocalDraftReport[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const onQuotaExceeded = () => setMapsQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', onQuotaExceeded);
    return () => {
      window.removeEventListener('gmp-quota-exceeded', onQuotaExceeded);
    };
  }, []);

  const persistLocalDrafts = (next: LocalDraftReport[]) => {
    setLocalDrafts(next);
    try {
      localStorage.setItem(LOCAL_DRAFTS_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage quota errors
    }
  };

  const fetchReports = async () => {
    setReportsLoading(true);
    setReportsError(null);
    try {
      const res = await fetch('/api/reports');
      const data = await res.json();
      if (!res.ok) {
        setReportsError(data.error || 'Unable to load civic reports.');
      } else {
        setReports(data.reports ?? []);
      }
    } catch {
      setReportsError('Network error while fetching municipal reports.');
    } finally {
      setReportsLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleReportSubmitted = (newReport: CivicReport) => {
    setReports((prev) => [newReport, ...prev]);
    if (resumedDraft) {
      persistLocalDrafts(
        localDrafts.filter((d) => d.localId !== resumedDraft.localId)
      );
      setResumedDraft(null);
    }
    setActiveTab('ledger');
  };

  const handleSaveLocalDraft = (draft: LocalDraftReport) => {
    const existingIdx = localDrafts.findIndex((d) => d.localId === draft.localId);
    const updated =
      existingIdx >= 0
        ? localDrafts.map((d) => (d.localId === draft.localId ? draft : d))
        : [draft, ...localDrafts];
    persistLocalDrafts(updated);
  };

  const handleDeleteLocalDraft = (localId: string) => {
    persistLocalDrafts(localDrafts.filter((d) => d.localId !== localId));
  };

  const handleResumeDraft = (draft: LocalDraftReport) => {
    setResumedDraft(draft);
    setActiveTab('report');
  };

  const handleStatusChange = async (reportId: string, status: ReportStatus) => {
    const token = await refreshToken();
    if (!token) {
      setAuthModalOpen(true);
      return;
    }

    const res = await fetch(`/api/reports/${reportId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status }),
    });
    if (res.status === 401) {
      setAuthModalOpen(true);
      return;
    }
    const data = await res.json();
    if (res.ok && data.report) {
      setReports((prev) =>
        prev.map((r) => (r.id === reportId ? data.report : r))
      );
    }
  };

  const navItems: {
    id: ActiveTab;
    label: string;
    Icon: React.FC<{ className?: string }>;
  }[] = [
    { id: 'ledger', label: 'Civic Ledger', Icon: ClipboardList },
    { id: 'report', label: 'Report Issue', Icon: FilePlus2 },
    { id: 'disaster', label: 'Disaster & Mesh', Icon: ShieldAlert },
    { id: '3d-twin', label: '3D Ward Twin', Icon: Box },
    { id: 'ai-hub', label: 'Civic AI Hub', Icon: Sparkles },
    { id: 'officials', label: 'Officials Directory', Icon: Users },
    { id: 'submissions', label: 'My Submissions', Icon: ShieldCheck },
  ];

  const breadcrumbLabel =
    navItems.find((n) => n.id === activeTab)?.label ?? 'Civic Ledger';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r border-slate-200 bg-white">
        <div className="flex h-16 items-center px-6 border-b border-slate-200">
          <span className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap">
            CityFix
          </span>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1" aria-label="Primary Sidebar">
          {navItems.map(({ id, label, Icon }) => {
            const active = activeTab === id;
            const isDisaster = id === 'disaster';
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  if (id === 'report') setResumedDraft(null);
                  setActiveTab(id);
                }}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? isDisaster
                      ? 'bg-red-50 text-red-800'
                      : 'bg-sky-50 text-[#0f4c81]'
                    : isDisaster
                    ? 'text-red-700 hover:bg-red-50/70'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 ${
                    active
                      ? isDisaster
                        ? 'text-red-700'
                        : 'text-[#0f4c81]'
                      : isDisaster
                      ? 'text-red-600'
                      : 'text-slate-400'
                  }`}
                />
                {label}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 p-4">
          {session?.authenticated ? (
            <button
              type="button"
              onClick={() => setAuthModalOpen(true)}
              className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 text-left transition-colors hover:bg-slate-100"
            >
              <p className="text-xs font-semibold text-slate-900 truncate">{session.name}</p>
              <p className="mt-0.5 font-mono text-[11px] text-slate-500 truncate">
                {session.email || session.contact} · {session.role ?? 'citizen'}
              </p>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setAuthModalOpen(true)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap"
            >
              Sign In with Google
            </button>
          )}
        </div>
      </aside>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 flex w-64 flex-col bg-white border-r border-slate-200 shadow-xl">
            <div className="flex h-16 items-center justify-between px-6 border-b border-slate-200">
              <span className="font-display text-lg font-bold tracking-tight text-slate-900">
                CityFix
              </span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
                aria-label="Close navigation menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1">
              {navItems.map(({ id, label, Icon }) => {
                const active = activeTab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      if (id === 'report') setResumedDraft(null);
                      setActiveTab(id);
                      setMobileMenuOpen(false);
                    }}
                    className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium ${
                      active
                        ? 'bg-sky-50 text-[#0f4c81]'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {label}
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {mapsQuotaExceeded && (
          <div className="sticky top-0 z-50 border-b border-amber-300 bg-amber-50 px-4 py-2.5 text-xs text-amber-950 flex items-center justify-between gap-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
              <span>
                <strong>Temporary Demo Key Quota Exceeded:</strong> Some Google Maps features may be
                temporarily unavailable. To restore full functionality, upgrade to your own Google
                Maps Platform API key in the{' '}
                <a
                  href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold underline text-amber-900 hover:text-amber-800"
                >
                  Google Cloud Console
                </a>
                .
              </span>
            </div>
          </div>
        )}

        {/* Top Bar Contract */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-8 border-b border-slate-200 bg-white px-4 sm:px-8">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="rounded-md p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 text-sm text-slate-500 truncate">
              <span className="font-display font-semibold text-slate-900 lg:hidden">
                CityFix
              </span>
              <span className="lg:hidden" aria-hidden="true">/</span>
              <span className="font-medium text-slate-800 truncate">{breadcrumbLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <OfflineStatusIndicator onClick={() => setActiveTab('disaster')} />
            <button
              type="button"
              onClick={() => setAuthModalOpen(true)}
              className="hidden sm:inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              {session?.authenticated ? session.name : 'Sign In with Google'}
            </button>
            <button
              type="button"
              onClick={() => {
                setResumedDraft(null);
                setActiveTab('report');
              }}
              className="inline-flex items-center rounded-md bg-[#0f4c81] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[#0c3d68] whitespace-nowrap shrink-0"
            >
              Report Issue
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-8 sm:py-8 max-w-7xl w-full mx-auto">
          {activeTab === 'ledger' && (
            <CivicLedgerView
              reports={reports}
              localDrafts={localDrafts}
              loading={reportsLoading}
              error={reportsError}
              onCreateNew={() => {
                setResumedDraft(null);
                setActiveTab('report');
              }}
              onOpenDisaster={() => setActiveTab('disaster')}
              onRequireAuth={() => setAuthModalOpen(true)}
              onResumeDraft={handleResumeDraft}
              onDeleteDraft={handleDeleteLocalDraft}
              onStatusChange={handleStatusChange}
            />
          )}

          {activeTab === 'report' && (
            <ReportComposer
              key={resumedDraft?.localId ?? 'new-report'}
              session={session}
              initialDraft={resumedDraft}
              onRequireAuth={() => setAuthModalOpen(true)}
              onReportSubmitted={handleReportSubmitted}
              onSaveLocalDraft={handleSaveLocalDraft}
            />
          )}

          {activeTab === 'disaster' && <DisasterManagementView />}

          {activeTab === '3d-twin' && <CivicTwin3DView />}

          {activeTab === 'ai-hub' && <CivicAiStudioView />}

          {activeTab === 'officials' && <OfficialsDirectory />}

          {activeTab === 'submissions' && (
            <CivicLedgerView
              reports={reports}
              localDrafts={localDrafts}
              loading={reportsLoading}
              error={reportsError}
              onlyMine
              citizenContact={session?.contact}
              onCreateNew={() => {
                setResumedDraft(null);
                setActiveTab('report');
              }}
              onRequireAuth={() => setAuthModalOpen(true)}
              onResumeDraft={handleResumeDraft}
              onDeleteDraft={handleDeleteLocalDraft}
              onStatusChange={handleStatusChange}
            />
          )}
        </main>

        <footer className="border-t border-slate-200 bg-white px-4 sm:px-8 py-4 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-2">
          <span>CityFix — See the problem. Report it. Reach the responsible authority.</span>
          <span>GNU GPL v3 Open Civic Platform</span>
        </footer>
      </div>

      <CitizenAuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
      />
    </div>
  );
};

export default App;
