// frontend/app/employees/[id]/page.js

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppShell from '../../components/AppShell';
import { api } from '../../../lib/api';
import { SYNC_EVENT } from '../../../lib/sync';

const thisMonth = () => new Date().toLocaleDateString('en-CA').slice(0, 7); // yyyy-mm
const fmtDate = (d) => (d ? d.slice(0, 10).split('-').reverse().join('-') : '-'); // dd-mm-yyyy
const fmtTime = (d) =>
  d ? new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—';
const dayName = (d) => new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short' });
const initials = (n) =>
  (n || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

// Choto info strip (Name alada header-e dekhano hoy)
const info = [
  ['Emp ID', 'employeeId'],
  ['Join Date', 'joinDate'],
  ['Grade', 'grade'],
  ['Line', 'line'],
  ['Designation', 'designation'],
  ['Department', 'department'],
  ['Section', 'section'],
  ['Sub Section', 'subSection'],
  ['Card No', 'cardNo'],
  ['Device ID', 'proximityId'],
];

const badge = {
  Present: 'bg-green-100 text-green-700 ring-green-200',
  Absent: 'bg-red-100 text-red-700 ring-red-200',
  'Missing Out': 'bg-amber-100 text-amber-700 ring-amber-200',
  Weekend: 'bg-slate-100 text-slate-500 ring-slate-200',
  'Not Joined': 'bg-slate-100 text-slate-400 ring-slate-200',
};

const rowTone = {
  Absent: 'bg-red-50/50',
  'Missing Out': 'bg-amber-50/50',
  Weekend: 'bg-slate-50',
  'Not Joined': 'bg-slate-50/60 text-slate-400',
};

const th = 'border-b border-slate-200 px-2 py-3 font-semibold sm:px-4';
const td = 'px-2 py-3 sm:px-4';

export default function EmployeeDetail() {
  const { id } = useParams();
  const router = useRouter();
  const [month, setMonth] = useState(thisMonth());
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0); // sync hole data reload korar jonno

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const r = await api(`/api/employees/${id}/monthly?month=${month}`);
        if (!cancelled) setData(r);
      } catch (e) {
        if (!cancelled) setErr(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, month, tick]);

  // Sync (header ba onno page theke) hole auto reload
  useEffect(() => {
    const h = () => setTick((t) => t + 1);
    window.addEventListener(SYNC_EVENT, h);
    return () => window.removeEventListener(SYNC_EVENT, h);
  }, []);

  const emp = data?.employee;
  const s = data?.summary;

  const stats = s
    ? [
        ['Present', s.present, 'text-green-700 bg-green-50 border-green-200'],
        ['Absent', s.absent, 'text-red-700 bg-red-50 border-red-200'],
        ['Missing Out', s.missingOut, 'text-amber-700 bg-amber-50 border-amber-200'],
        ['Total Hours', s.totalHours, 'text-slate-700 bg-slate-50 border-slate-200'],
      ]
    : [];

  return (
    <AppShell title="Employee Attendance" autoSync>
      <button
        onClick={() => router.push('/employees')}
        className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-800"
      >
        <span>←</span> Back to Employee List
      </button>

      {err && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{err}</div>
      )}

      {/* Compact employee info */}
      {emp && (
        <div className="mb-3 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-white px-4 py-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
              {initials(emp.name)}
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-800">{emp.name}</div>
              <div className="truncate text-xs text-slate-500">
                {[emp.designation, emp.department].filter(Boolean).join(' • ') || 'Employee'}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 px-4 py-2.5 sm:grid-cols-3 md:grid-cols-5">
            {info.map(([label, key]) => (
              <div key={key} className="min-w-0">
                <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
                <div
                  className={`truncate text-xs ${
                    key === 'proximityId' ? 'font-semibold text-blue-700' : 'text-slate-700'
                  }`}
                  title={key === 'joinDate' ? fmtDate(emp.joinDate) : emp[key] || '-'}
                >
                  {key === 'joinDate' ? fmtDate(emp.joinDate) : emp[key] || '-'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Month picker + summary */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          Month
          <input
            type="month"
            value={month}
            onChange={(e) => e.target.value && setMonth(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </label>

        <div className="flex flex-wrap gap-2">
          {stats.map(([label, val, tone]) => (
            <span
              key={label}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium ${tone}`}
            >
              {label}
              <span className="rounded bg-white/70 px-1.5 text-sm font-semibold">{val}</span>
            </span>
          ))}
        </div>

        {loading && <span className="text-xs text-slate-500">Loading...</span>}
      </div>

      {/* Big month-wise table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="max-h-[calc(100vh-270px)] min-h-[420px] overflow-y-auto overflow-x-hidden">
          <table className="w-full table-fixed text-left text-xs sm:text-sm">
            <colgroup>
              <col className="w-[14%]" />
              <col className="w-[8%]" />
              <col className="w-[13%]" />
              <col className="w-[13%]" />
              <col className="w-[13%]" />
              <col className="w-[9%]" />
              <col className="w-[9%]" />
              <col className="w-[21%]" />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500 sm:text-xs">
              <tr>
                {['Date', 'Day', 'Device ID', 'In Time', 'Out Time', 'Hours', 'Punches', 'Status'].map((h) => (
                  <th key={h} className={th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data?.days.map((d) => {
                const day = dayName(d.date);
                const weekend = d.isWeekend ?? day === 'Fri';
                return (
                  <tr
                    key={d.date}
                    className={`transition hover:bg-blue-50 ${
                      rowTone[d.status] || (weekend ? 'bg-slate-50' : '')
                    }`}
                  >
                    <td className={`${td} font-medium text-slate-800`}>{fmtDate(d.date)}</td>
                    <td className={`${td} ${weekend ? 'font-semibold text-slate-500' : 'text-slate-600'}`}>{day}</td>
                    <td className={td}>
                      {emp?.proximityId ? (
                        <span className="inline-block rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 sm:px-2 sm:text-xs">
                          {emp.proximityId}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className={td}>{fmtTime(d.inTime)}</td>
                    <td className={td}>{fmtTime(d.outTime)}</td>
                    <td className={td}>{d.hours ?? '—'}</td>
                    <td className={td}>{d.punches || '—'}</td>
                    <td className={td}>
                      {d.status ? (
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset sm:px-2.5 sm:text-xs ${badge[d.status]}`}
                        >
                          {d.status === 'Missing Out' ? 'Missing out' : d.status}
                        </span>
                      ) : weekend ? (
                        <span className="text-xs text-slate-400">Weekend</span>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                );
              })}
              {data && !data.days.length && (
                <tr>
                  <td colSpan={8} className="px-3 py-16 text-center text-sm text-slate-400">
                    No data.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}