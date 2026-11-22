import React, { useMemo, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { CivicReport, ReportStatus } from '../types/civic';

interface StatusAnalyticsProps {
  reports: CivicReport[];
  activeStatus?: 'all' | ReportStatus;
  onSelectStatus?: (status: 'all' | ReportStatus) => void;
}

interface StatusBucket {
  key: string;
  label: string;
  count: number;
  pct: number;
  color: string;
  bgClass: string;
  filterValue?: ReportStatus;
}

const DETAILED_STATUS_CONFIG: {
  status: ReportStatus;
  label: string;
  color: string;
  bgClass: string;
}[] = [
  { status: 'Submitted', label: 'Submitted (Pending)', color: '#d97706', bgClass: 'bg-amber-600' },
  { status: 'Acknowledged', label: 'Acknowledged', color: '#0284c7', bgClass: 'bg-sky-600' },
  { status: 'Dispatched', label: 'Crew Dispatched', color: '#4f46e5', bgClass: 'bg-indigo-600' },
  { status: 'Resolved', label: 'Resolved', color: '#047857', bgClass: 'bg-emerald-700' },
];

export const StatusAnalytics: React.FC<StatusAnalyticsProps> = ({
  reports,
  activeStatus = 'all',
  onSelectStatus,
}) => {
  const [grouping, setGrouping] = useState<'detailed' | 'summary'>('detailed');

  const { chartData, resolutionRate } = useMemo(() => {
    const total = reports.length;
    const counts: Record<ReportStatus, number> = {
      Submitted: 0,
      Acknowledged: 0,
      Dispatched: 0,
      Resolved: 0,
    };

    for (const r of reports) {
      if (r.status in counts) {
        counts[r.status] += 1;
      }
    }

    const resRate = total > 0 ? Math.round((counts.Resolved / total) * 100) : 0;

    if (grouping === 'summary') {
      const pending = counts.Submitted;
      const inProgress = counts.Acknowledged + counts.Dispatched;
      const resolved = counts.Resolved;
      const buckets: StatusBucket[] = [
        {
          key: 'Pending',
          label: 'Pending',
          count: pending,
          pct: total > 0 ? Math.round((pending / total) * 100) : 0,
          color: '#d97706',
          bgClass: 'bg-amber-600',
          filterValue: 'Submitted',
        },
        {
          key: 'In Progress',
          label: 'In Progress',
          count: inProgress,
          pct: total > 0 ? Math.round((inProgress / total) * 100) : 0,
          color: '#0f4c81',
          bgClass: 'bg-[#0f4c81]',
          filterValue: 'Dispatched',
        },
        {
          key: 'Resolved',
          label: 'Resolved',
          count: resolved,
          pct: total > 0 ? Math.round((resolved / total) * 100) : 0,
          color: '#047857',
          bgClass: 'bg-emerald-700',
          filterValue: 'Resolved',
        },
      ];
      return { chartData: buckets, resolutionRate: resRate };
    }

    const buckets: StatusBucket[] = DETAILED_STATUS_CONFIG.map((cfg) => ({
      key: cfg.status,
      label: cfg.label,
      count: counts[cfg.status],
      pct: total > 0 ? Math.round((counts[cfg.status] / total) * 100) : 0,
      color: cfg.color,
      bgClass: cfg.bgClass,
      filterValue: cfg.status,
    }));

    return { chartData: buckets, resolutionRate: resRate };
  }, [reports, grouping]);

  if (reports.length === 0) {
    return null;
  }

  return (
    <section
      aria-label="Report Status Distribution Analytics"
      className="rounded-lg border border-slate-200 bg-white p-4 space-y-4"
    >
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-[#0f4c81] shrink-0" />
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Status Distribution Analytics
            </h2>
            <p className="text-xs text-slate-500">
              {reports.length} logged report(s) ·{' '}
              <span className="font-mono font-medium text-emerald-700">
                {resolutionRate}% resolved
              </span>
            </p>
          </div>
        </div>

        <div className="inline-flex items-center gap-1 rounded-md bg-slate-100 p-1 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setGrouping('detailed')}
            className={`rounded px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
              grouping === 'detailed'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Workflow Statuses
          </button>
          <button
            type="button"
            onClick={() => setGrouping('summary')}
            className={`rounded px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
              grouping === 'summary'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Pending / In Progress / Resolved
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 items-center">
        {/* Donut Share Chart */}
        <div className="lg:col-span-4 h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="count"
                nameKey="label"
                cx="50%"
                cy="50%"
                innerRadius={44}
                outerRadius={74}
                paddingAngle={3}
                onClick={(_data, index: number) => {
                  const target = chartData[index]?.filterValue;
                  if (onSelectStatus && target) {
                    onSelectStatus(activeStatus === target ? 'all' : target);
                  }
                }}
              >
                {chartData.map((item) => (
                  <Cell
                    key={item.key}
                    fill={item.color}
                    stroke="#ffffff"
                    strokeWidth={2}
                    className={onSelectStatus ? 'cursor-pointer' : undefined}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: unknown, _name: unknown, item: { payload?: StatusBucket }) => [
                  `${Number(value ?? 0)} report(s) (${item?.payload?.pct ?? 0}%)`,
                  item?.payload?.label ?? 'Status',
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Bar Distribution Chart */}
        <div className="lg:col-span-5 h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 8, right: 12, left: -16, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis
                dataKey="key"
                tick={{ fontSize: 11, fill: '#475569' }}
                axisLine={{ stroke: '#cbd5e1' }}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: '#475569' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(value: unknown) => [`${Number(value ?? 0)} report(s)`, 'Count']}
              />
              <Bar
                dataKey="count"
                radius={[4, 4, 0, 0]}
                maxBarSize={44}
                onClick={(_data, index: number) => {
                  const target = chartData[index]?.filterValue;
                  if (onSelectStatus && target) {
                    onSelectStatus(activeStatus === target ? 'all' : target);
                  }
                }}
              >
                {chartData.map((item) => (
                  <Cell
                    key={item.key}
                    fill={item.color}
                    className={onSelectStatus ? 'cursor-pointer' : undefined}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Interactive Legend & Breakdown */}
        <div className="lg:col-span-3 space-y-2">
          {chartData.map((bucket) => {
            const isSelected =
              bucket.filterValue !== undefined && activeStatus === bucket.filterValue;
            return (
              <button
                key={bucket.key}
                type="button"
                onClick={() => {
                  if (onSelectStatus && bucket.filterValue) {
                    onSelectStatus(isSelected ? 'all' : bucket.filterValue);
                  }
                }}
                className={`w-full rounded-md border px-3 py-2 text-left transition-colors flex items-center justify-between gap-2 ${
                  isSelected
                    ? 'border-[#0f4c81] bg-sky-50/70'
                    : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100/70'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`h-2.5 w-2.5 rounded-xs shrink-0 ${bucket.bgClass}`}
                  />
                  <span className="text-xs font-medium text-slate-800 truncate">
                    {bucket.label}
                  </span>
                </div>
                <span className="font-mono text-xs text-slate-700 tabular-nums shrink-0">
                  {bucket.count}{' '}
                  <span className="text-slate-400">({bucket.pct}%)</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default StatusAnalytics;
