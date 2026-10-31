'use client';

import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { api, downloadFile } from '../../lib/api';
import { SYNC_EVENT } from '../../lib/sync';
import { todayDhaka, fmtDate, fmtTime, fmtHM, dayName } from '../../lib/format';
import { EmployeeInfo } from './EmployeeSearch';

const badge = {
  Present: 'bg-green-100 text-green-700 ring-green-200',
  Absent: 'bg-red-100 text-red-700 ring-red-200',
  'Missing Out': 'bg-amber-100 text-amber-700 ring-amber-200',
  Holiday: 'bg-purple-100 text-purple-700 ring-purple-200',
  CL: 'bg-sky-100 text-sky-700 ring-sky-200',
  SL: 'bg-sky-100 text-sky-700 ring-sky-200',
  EL: 'bg-sky-100 text-sky-700 ring-sky-200',
  Weekend: 'bg-slate-100 text-slate-500 ring-slate-200',
  'Not Joined': 'bg-slate-100 text-slate-400 ring-slate-200',
};

const rowTone = {
  Absent: 'bg-red-50/50',
  'Missing Out': 'bg-amber-50/50',
  Holiday: 'bg-purple-50/60',
  Weekend: 'bg-slate-50',
  'Not Joined': 'bg-slate-50/60 text-slate-400',
};

const th = 'border-b border-slate-200 px-2 py-3 font-semibold sm:px-4';
const td = 'px-2 py-3 sm:px-4';

// Ekjon employee-er mashik hajira + PDF download. Employee detail ar Report page, duto-te e use hoy.
export default function MonthlyView({ id }) {
  const [month, setMonth] = useState(todayDhaka().slice(0, 7));
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
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

  useEffect(() => {
    const h = () => setTick((t) => t + 1);
    window.addEventListener(SYNC_EVENT, h);
    return () => window.removeEventListener(SYNC_EVENT, h);
  }, []);

  const emp = data?.employee;
  const s = data?.summary;

  const pdf = async () => {
    if (!emp) return;
    setPdfBusy(true);
    setErr(null);
    try {
      await downloadFile(`/api/employees/${id}/monthly-pdf?month=${month}`, `Attendance_${emp.employeeId}_${month}.pdf`);
    } catch (e) {
      setErr(e.message);
    } finally {
      setPdfBusy(false);
    }
  };

  const stats = s
    ? [
        ['Present', s.presentDays, 'text-green-700 bg-green-50 border-green-200'],
        ['Absent', s.absent, 'text-red-700 bg-red-50 border-red-200'],
        ['Missing Out', s.missingOut, 'text-amber-700 bg-amber-50 border-amber-200'],
        ['Holiday', s.holidayTotal, 'text-purple-700 bg-purple-50 border-purple-200'],
        ['CL', s.cl, 'text-sky-700 bg-sky-50 border-sky-200'],
        ['SL', s.sl, 'text-sky-700 bg-sky-50 border-sky-200'],
        ['EL', s.el, 'text-sky-700 bg-sky-50 border-sky-200'],
        ['OT Hours', s.otHours, 'text-slate-700 bg-slate-50 border-slate-200'],
        ['Holiday OT', s.holidayOtHours, 'text-slate-700 bg-slate-50 border-slate-200'],
        ['Total Hours', s.totalHours, 'text-slate-700 bg-slate-50 border-slate-200'],
      ]
    : [];

  return (
    <>
      {err && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{err}</div>
      )}

      {emp && (
        <div className="mb-3">
          <div className="mb-2 text-sm font-semibold text-slate-800">{emp.name}</div>
          <EmployeeInfo emp={emp} />
        </div>
      )}

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

        <button
          onClick={pdf}
          disabled={!emp || pdfBusy}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
        >
          <Download className="h-4 w-4" />
          {pdfBusy ? 'Preparing PDF...' : 'Download PDF'}
        </button>

        {loading && <span className="text-xs text-slate-500">Loading...</span>}
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
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

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="max-h-[calc(100vh-300px)] min-h-[420px] overflow-y-auto overflow-x-auto">
          <table className="w-full min-w-[640px] table-fixed text-left text-xs sm:text-sm">
            <colgroup>
              <col className="w-[13%]" />
              <col className="w-[7%]" />
              <col className="w-[12%]" />
              <col className="w-[12%]" />
              <col className="w-[9%]" />
              <col className="w-[13%]" />
              <col className="w-[8%]" />
              <col className="w-[26%]" />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500 sm:text-xs">
              <tr>
                {['Date', 'Day', 'In Time', 'Out Time', 'Hours', 'OT Hours', 'Punches', 'Status'].map((h) => (
                  <th key={h} className={th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data?.days.map((d) => {
                const hw = d.holidayWork;
                const otFinal = hw ? hw.otFinalMinutes : d.otFinalMinutes;
                const otActual = hw ? hw.otActualMinutes : d.otActualMinutes;
                return (
                  <tr key={d.date} className={`transition hover:bg-blue-50 ${rowTone[d.status] || (d.isWeekend ? 'bg-slate-50' : '')}`}>
                    <td className={`${td} font-medium text-slate-800`}>{fmtDate(d.date)}</td>
                    <td className={`${td} ${d.isWeekend ? 'font-semibold text-slate-500' : 'text-slate-600'}`}>{dayName(d.date)}</td>
                    <td className={td}>{fmtTime(d.inTime)}</td>
                    <td className={td}>{fmtTime(d.outTime)}</td>
                    <td className={td}>{d.hours ?? '—'}</td>
                    <td className={td}>
                      {d.status === 'Present' || hw ? (
                        <>
                          <div className="font-medium">
                            {fmtHM(otFinal)}
                            {hw && <span className="ml-1 text-[10px] text-purple-600">(H)</span>}
                          </div>
                          {otActual > 0 && otActual !== otFinal && (
                            <div className="text-[10px] text-slate-400">actual {fmtHM(otActual)}</div>
                          )}
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className={td}>{d.punches || '—'}</td>
                    <td className={td}>
                      {d.status ? (
                        <>
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset sm:px-2.5 sm:text-xs ${badge[d.status]}`}
                          >
                            {d.status === 'Missing Out' ? 'Missing out' : d.status}
                          </span>
                          {d.status === 'Holiday' && (
                            <div className="mt-0.5 truncate text-[10px] text-slate-500">
                              {d.holidayName}
                              {d.inTime ? ' • worked' : ''}
                            </div>
                          )}
                        </>
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
    </>
  );
}