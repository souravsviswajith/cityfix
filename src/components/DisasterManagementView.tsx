import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  PhoneCall,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import {
  DISASTER_CATEGORIES,
  VERIFIED_EMERGENCY_HELPLINES,
} from '../data/disasterGuidance';
import type { DisasterScale } from '../types/civic';
import { EmergencyMeshPanel } from './EmergencyMeshPanel';

export const DisasterManagementView: React.FC = () => {
  const [scaleFilter, setScaleFilter] = useState<'ALL' | DisasterScale>('ALL');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('flooding_waterlogging');

  const visibleCategories = useMemo(() => {
    if (scaleFilter === 'ALL') return DISASTER_CATEGORIES;
    return DISASTER_CATEGORIES.filter((c) => c.scale === scaleFilter);
  }, [scaleFilter]);

  const activeGuide = useMemo(() => {
    return (
      visibleCategories.find((c) => c.id === selectedCategoryId) ??
      visibleCategories[0] ??
      DISASTER_CATEGORIES[0]
    );
  }, [visibleCategories, selectedCategoryId]);

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <div className="flex items-center gap-2.5">
          <ShieldAlert className="h-5 w-5 text-red-700 shrink-0" />
          <h1 className="text-xl font-semibold text-slate-900">
            Disaster Management & Emergency Mesh Network
          </h1>
        </div>
        <p className="mt-1 text-sm text-slate-600">
          Offline-first CEMN rescue coordination, verified official emergency helplines, and
          authoritative NDMA / Red Cross safety protocols.
        </p>
      </div>

      {/* Mandatory Transparency Notice */}
      <div className="rounded-lg border border-red-200 bg-red-50/70 p-4 text-sm text-red-950">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-700 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">
              Communication vs. Official Emergency Dispatch Notice
            </p>
            <p className="text-xs leading-relaxed text-red-900">
              CityFix provides local mesh communication infrastructure, verified emergency
              contacts, and authoritative safety guidance. CityFix does <strong>not</strong>{' '}
              independently dispatch government ambulances, fire engines, or rescue forces. In
              any life-threatening emergency, dial <strong>112</strong> immediately when
              cellular or radio service is reachable.
            </p>
          </div>
        </div>
      </div>

      {/* CityFix Emergency Mesh Network (CEMN) Subsystem */}
      <EmergencyMeshPanel />

      {/* Verified National Helplines */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">
            Verified Official Emergency Helplines
          </h2>
          <span className="font-mono text-xs text-slate-500">
            Official ERSS / NDMA Directory
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {VERIFIED_EMERGENCY_HELPLINES.map((helpline) => {
            const dialTarget = helpline.phoneNumber.split('/')[0].trim();
            return (
              <div
                key={helpline.serviceName}
                className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-4"
              >
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    {helpline.serviceName}
                  </h3>
                  <p className="mt-1 text-xs text-slate-600">{helpline.scope}</p>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                  <a
                    href={helpline.sourceCitation}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-500 hover:text-[#0f4c81] hover:underline"
                  >
                    {helpline.sourceCitation.replace('https://', '')}
                    <ExternalLink className="h-3 w-3" />
                  </a>

                  <a
                    href={`tel:${dialTarget}`}
                    className="inline-flex items-center gap-1.5 rounded-md bg-red-700 px-3 py-1.5 font-mono text-xs font-semibold text-white transition-colors hover:bg-red-800 tabular-nums whitespace-nowrap"
                  >
                    <PhoneCall className="h-3.5 w-3.5" />
                    Call {helpline.phoneNumber}
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Authoritative Safety Protocols */}
      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-semibold text-slate-900">
            Authoritative Safety Protocols ({visibleCategories.length} scenarios)
          </h2>

          <div className="inline-flex items-center gap-1 rounded-md bg-slate-100 p-1">
            {(
              [
                { id: 'ALL', label: 'All Scenarios' },
                { id: 'LOCAL_EMERGENCY', label: 'Local Emergencies' },
                { id: 'LARGE_SCALE_DISASTER', label: 'Large-Scale Disasters' },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setScaleFilter(item.id)}
                className={`rounded px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  scaleFilter === item.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-5 rounded-lg border border-slate-200 bg-white divide-y divide-slate-100 max-h-[480px] overflow-y-auto">
            {visibleCategories.map((cat) => {
              const isSelected = activeGuide.id === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={`w-full text-left px-4 py-3 transition-colors flex items-center justify-between gap-2 ${
                    isSelected
                      ? 'bg-sky-50 text-[#0f4c81]'
                      : 'text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  <div>
                    <p className="text-sm font-medium">{cat.title}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {cat.scale === 'LOCAL_EMERGENCY'
                        ? 'Local Emergency'
                        : 'Large-Scale Disaster'}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="lg:col-span-7">
            <article className="rounded-lg border border-slate-200 bg-white p-6 space-y-5">
              <div className="border-b border-slate-100 pb-4">
                <p className="text-xs font-medium text-slate-500">
                  {activeGuide.scale === 'LOCAL_EMERGENCY'
                    ? 'Local Emergency Protocol'
                    : 'Large-Scale Disaster Protocol'}
                </p>
                <h3 className="mt-1 text-lg font-semibold text-slate-900">
                  {activeGuide.title}
                </h3>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
                  Immediate Verified Actions
                </h4>
                <ul className="space-y-2.5">
                  {activeGuide.immediateActions.map((step) => (
                    <li
                      key={step}
                      className="flex items-start gap-2.5 text-sm text-slate-800 leading-relaxed"
                    >
                      <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-3 border-t border-slate-100 pt-4">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-red-800">
                  Critical Precautions (Do Not)
                </h4>
                <ul className="space-y-2.5">
                  {activeGuide.strictDoNots.map((dont) => (
                    <li
                      key={dont}
                      className="flex items-start gap-2.5 text-sm text-slate-800 leading-relaxed"
                    >
                      <XCircle className="h-4 w-4 text-red-700 shrink-0 mt-0.5" />
                      <span>{dont}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="border-t border-slate-100 pt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <span>Source: {activeGuide.sourceAgency}</span>
                <a
                  href={activeGuide.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-[#0f4c81] hover:underline"
                >
                  {activeGuide.sourceUrl}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </article>
          </div>
        </div>
      </section>
    </div>
  );
};
