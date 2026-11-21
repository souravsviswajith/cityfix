import React, { useMemo, useState } from 'react';
import { Mail, MapPin, MessageSquare, Phone, Search } from 'lucide-react';
import {
  ISSUE_CATEGORIES,
  PUBLIC_OFFICIALS,
  WARD_ZONES,
} from '../data/civicDirectory';
import type { IssueCategory } from '../types/civic';

export const OfficialsDirectory: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [wardFilter, setWardFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  const filteredOfficials = useMemo(() => {
    return PUBLIC_OFFICIALS.filter((official) => {
      if (wardFilter !== 'all' && !official.wardIds.includes(wardFilter)) {
        return false;
      }
      if (
        categoryFilter !== 'all' &&
        !official.categories.includes(categoryFilter as IssueCategory)
      ) {
        return false;
      }
      if (roleFilter !== 'all' && official.roleType !== roleFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const haystack =
          `${official.name} ${official.designation} ${official.department} ${official.email}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [searchQuery, wardFilter, categoryFilter, roleFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            Public Officials & Representatives Directory
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Direct municipal contact details for elected ward councillors, civil servants, and
            department heads across all 6 city jurisdictions.
          </p>
        </div>
        <div className="font-mono text-xs text-slate-500 tabular-nums whitespace-nowrap">
          {filteredOfficials.length} of {PUBLIC_OFFICIALS.length} officials shown
        </div>
      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-12 rounded-lg border border-slate-200 bg-white p-4">
        <div className="relative md:col-span-5">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by official name, department, or email..."
            className="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0f4c81] focus:outline-none"
          />
        </div>

        <div className="md:col-span-3">
          <select
            aria-label="Filter by municipal ward"
            value={wardFilter}
            onChange={(e) => setWardFilter(e.target.value)}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-[#0f4c81] focus:outline-none"
          >
            <option value="all">All Municipal Wards</option>
            {WARD_ZONES.map((w) => (
              <option key={w.id} value={w.id}>
                {w.code} · {w.name}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <select
            aria-label="Filter by issue category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-[#0f4c81] focus:outline-none"
          >
            <option value="all">All Departments</option>
            {ISSUE_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.department}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <select
            aria-label="Filter by role type"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-[#0f4c81] focus:outline-none"
          >
            <option value="all">All Roles</option>
            <option value="Elected Representative">Elected Representative</option>
            <option value="Department Head">Department Head</option>
            <option value="Civil Servant">Civil Servant</option>
          </select>
        </div>
      </div>

      {/* Officials Table / Grid */}
      {filteredOfficials.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-10 text-center">
          <p className="text-sm font-medium text-slate-900">
            No officials match the selected filters.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Clear your search or select all wards to view the full municipal roster.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setWardFilter('all');
              setCategoryFilter('all');
              setRoleFilter('all');
            }}
            className="mt-4 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Reset Directory Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filteredOfficials.map((official) => {
            const wardCodes =
              official.wardIds.length === WARD_ZONES.length
                ? 'Citywide (All 6 Wards)'
                : official.wardIds
                    .map((id) => WARD_ZONES.find((w) => w.id === id)?.code ?? id)
                    .join(', ');

            return (
              <article
                key={official.id}
                className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-5 transition-colors hover:border-slate-300"
              >
                <div>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-base font-semibold text-slate-900">
                        {official.name}
                      </h2>
                      <p className="mt-0.5 text-sm font-medium text-[#0f4c81]">
                        {official.designation}
                      </p>
                    </div>
                    <span className="font-mono text-xs text-slate-500 tabular-nums whitespace-nowrap">
                      SLA {official.responseTargetHours}h
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                    <span>{official.roleType}</span>
                    <span aria-hidden="true">·</span>
                    <span>{official.department}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono">{wardCodes}</span>
                  </div>

                  <div className="mt-4 space-y-1.5 border-t border-slate-100 pt-3 text-xs text-slate-600">
                    <div className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <a
                        href={`mailto:${official.email}`}
                        className="font-mono text-slate-800 hover:text-[#0f4c81] hover:underline truncate"
                      >
                        {official.email}
                      </a>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <a
                        href={`tel:${official.phone.replace(/[^+\d]/g, '')}`}
                        className="font-mono text-slate-800 tabular-nums hover:text-[#0f4c81] hover:underline"
                      >
                        {official.phone}
                      </a>
                      {official.whatsapp && (
                        <>
                          <span aria-hidden="true" className="text-slate-300">
                            ·
                          </span>
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                            <MessageSquare className="h-3 w-3" />
                            WhatsApp Desk
                          </span>
                        </>
                      )}
                    </div>
                    <div className="flex items-start gap-2">
                      <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <span>{official.officeAddress}</span>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
