import React, { useEffect, useState } from 'react';
import {
  ClipboardList,
  FilePlus2,
  Menu,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { CitizenAuthModal } from './components/CitizenAuthModal';
import { CivicLedgerView } from './components/CivicLedgerView';
import { OfficialsDirectory } from './components/OfficialsDirectory';
import { ReportComposer } from './components/ReportComposer';
import type { CitizenSession, CivicReport, ReportStatus } from './types/civic';

type ActiveTab = 'ledger' | 'report' | 'officials' | 'submissions';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('ledger');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [session, setSession] = useState<CitizenSession | null>(null);

  const [reports, setReports] = useState<CivicReport[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [reportsError, setReportsError] = useState<string | null>(null);

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
    setActiveTab('ledger');
  };

  const handleStatusChange = async (reportId: string, status: ReportStatus) => {
    const res = await fetch(`/api/reports/${reportId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
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
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-sky-50 text-[#0f4c81]'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-[#0f4c81]' : 'text-slate-400'}`} />
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
                {session.contact} · {session.channel}
              </p>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setAuthModalOpen(true)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap"
            >
              Citizen Sign In (SMS / WhatsApp)
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
            <button
              type="button"
              onClick={() => setAuthModalOpen(true)}
              className="hidden sm:inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              {session?.authenticated ? session.name : 'Verify Citizen Phone'}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('report')}
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
              loading={reportsLoading}
              error={reportsError}
              onCreateNew={() => setActiveTab('report')}
              onStatusChange={handleStatusChange}
            />
          )}

          {activeTab === 'report' && (
            <ReportComposer
              session={session}
              onRequireAuth={() => setAuthModalOpen(true)}
              onReportSubmitted={handleReportSubmitted}
            />
          )}

          {activeTab === 'officials' && <OfficialsDirectory />}

          {activeTab === 'submissions' && (
            <CivicLedgerView
              reports={reports}
              loading={reportsLoading}
              error={reportsError}
              onlyMine
              citizenContact={session?.contact}
              onCreateNew={() => setActiveTab('report')}
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
        onAuthenticated={(s) => setSession(s)}
        currentSession={session}
        onSignOut={() => setSession(null)}
      />
    </div>
  );
};

export default App;
