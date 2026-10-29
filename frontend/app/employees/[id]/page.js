// frontend/app/employees/[id]/page.js

// frontend/app/employees/[id]/page.js

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppShell from '../../components/AppShell';
import { api } from '../../../lib/api';

const thisMonth = () => new Date().toLocaleDateString('en-CA').slice(0, 7); // yyyy-mm
const fmtDate = (d) => (d ? d.slice(0, 10).split('-').reverse().join('-') : '-'); // dd-mm-yyyy
const fmtTime = (d) => (d ? new Date(d).toLocaleTimeString('en-GB') : '—');
const dayName = (d) => new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short' });

const info = [
  ['Employee ID', 'employeeId'],
  ['Name', 'name'],
  ['Join Date', 'joinDate'],
  ['Grade', 'grade'],
  ['Line', 'line'],
  ['Designation', 'designation'],
  ['Department', 'department'],
  ['Section', 'section'],
  ['Sub Section', 'subSection'],
  ['Card No', 'cardNo'],
  ['Proximity Id (Device ID)', 'proximityId'],
];

const badge = {
  Present: 'bg-green-100 text-green-700',
  Absent: 'bg-red-100 text-red-700',
  'Missing Out': 'bg-amber-100 text-amber-700',
};

export default function EmployeeDetail() {
  const { id } = useParams();
  const router = useRouter();
  const [month, setMonth] = useState(thisMonth());
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);

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
  }, [id, month]);

  const emp = data?.employee;
  const s = data?.summary;

  return (
    <AppShell title="Employee Attendance">
      <button onClick={() => router.push('/employees')} className="mb-3 text-sm text-blue-600 hover:underline">
        ← Back to Employee List
      </button>

      {err && <p className="mb-3 text-sm text-red-600">{err}</p>}

      {/* Employee info */}
      {emp && (
        <div className="mb-4 rounded border border-slate-200 bg-white shadow-sm">
          <div className="border-b bg-slate-50 px-4 py-2 text-sm font-semibold">Employee Information</div>
          <div className="grid gap-x-6 gap-y-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
            {info.map(([label, key]) => (
              <div key={key}>
                <div className="text-[11px] font-medium uppercase text-slate-500">{label}</div>
                <div className={`text-sm ${key === 'proximityId' ? 'font-semibold text-blue-700' : ''}`}>
                  {key === 'joinDate' ? fmtDate(emp.joinDate) : emp[key] || '-'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Month picker + summary */}
      <div className="mb-3 flex flex-wrap items-center gap-4">
        <label className="text-sm font-medium">
          Month{' '}
          <input
            type="month"
            value={month}
            onChange={(e) => e.target.value && setMonth(e.target.value)}
            className="ml-1 rounded border border-slate-300 px-2 py-1 text-sm outline-none focus:border-blue-500"
          />
        </label>
        {s && (
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded bg-green-100 px-3 py-1 font-medium text-green-700">Present: {s.present}</span>
            <span className="rounded bg-red-100 px-3 py-1 font-medium text-red-700">Absent: {s.absent}</span>
            <span className="rounded bg-amber-100 px-3 py-1 font-medium text-amber-700">Missing Out: {s.missingOut}</span>
            <span className="rounded bg-slate-100 px-3 py-1 font-medium text-slate-700">Total Hours: {s.totalHours}</span>
          </div>
        )}
        {loading && <span className="text-xs text-slate-500">Loading...</span>}
      </div>

      {/* Month-wise table */}
      <div className="rounded border border-slate-200 bg-white shadow-sm">
        <div className="max-h-[calc(100vh-380px)] min-h-[300px] overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-100 text-xs uppercase text-slate-600">
              <tr>
                {['Date', 'Day', 'In Time', 'Out Time', 'Hours', 'Punches', 'Status'].map((h) => (
                  <th key={h} className="whitespace-nowrap border-b px-3 py-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data?.days.map((d) => (
                <tr key={d.date} className="border-b hover:bg-slate-50">
                  <td className="whitespace-nowrap px-3 py-2.5">{fmtDate(d.date)}</td>
                  <td className="px-3 py-2.5">{dayName(d.date)}</td>
                  <td className="px-3 py-2.5">{fmtTime(d.inTime)}</td>
                  <td className="px-3 py-2.5">{fmtTime(d.outTime)}</td>
                  <td className="px-3 py-2.5">{d.hours ?? '—'}</td>
                  <td className="px-3 py-2.5">{d.punches || '—'}</td>
                  <td className="px-3 py-2.5">
                    {d.status ? (
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${badge[d.status]}`}>
                        {d.status === 'Missing Out' ? 'Missing check-out' : d.status}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
              {data && !data.days.length && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-slate-400">
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