// frontend/app/reports/page.js

'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Search, Download, Menu, LogOut, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import SideNavBar from '../components/SideNavBar';
import DeviceStatus from '../components/DeviceStatus';

const API = process.env.NEXT_PUBLIC_API || 'http://localhost:5000';

const authHeader = () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const unauthorized = () => {
  localStorage.removeItem('token');
  window.location.href = '/login';
  throw new Error('Unauthorized');
};

async function api(path, options = {}) {
  const res = await fetch(API + path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...authHeader() },
  });
  if (res.status === 401 && path !== '/api/login') unauthorized();
  if (!res.headers.get('content-type')?.includes('application/json')) {
    throw new Error(`API returned a non-JSON response (HTTP ${res.status}). Check the API URL and backend route.`);
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// File (PDF) download: token header-shoho fetch kore browser-e save kore
async function downloadFile(path, filename) {
  const res = await fetch(API + path, { headers: authHeader() });
  if (res.status === 401) unauthorized();
  if (!res.ok) {
    let msg = 'Download failed';
    try {
      msg = (await res.json()).error || msg;
    } catch {}
    throw new Error(msg);
  }
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const LAST_SYNC_KEY = 'lastSync';
const SYNC_EVENT = 'attendance:synced';

async function runSync() {
  const result = await api('/api/sync', { method: 'POST' });
  const at = new Date().toISOString();
  try {
    localStorage.setItem(LAST_SYNC_KEY, at);
  } catch {}
  window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: { at, result } }));
  return result;
}

const fmtSyncTime = (iso) =>
  iso ? new Date(iso).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) : null;

// Shob date/time Bangladesh time (Asia/Dhaka) onujayi dekhano hoy.
const TZ = 'Asia/Dhaka';
const pad = (n) => String(n).padStart(2, '0');

const todayDhaka = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ }); // yyyy-mm-dd
const fmtDate = (d) => (d ? String(d).slice(0, 10).split('-').reverse().join('-') : '-'); // dd-mm-yyyy
const fmtTime = (d) =>
  d ? new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: TZ }) : '—';
const dayName = (dateStr) =>
  new Date(`${dateStr}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' });
const fmtHM = (min) => `${pad(Math.floor((min || 0) / 60))}:${pad((min || 0) % 60)}`;

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

const th = 'border-b border-slate-200 px-2 py-2 font-semibold sm:px-4';
const td = 'px-2 py-1 sm:px-4';

const empFields = [
  ['Emp ID', 'employeeId'],
  ['Name', 'name'],
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

function EmployeeInfo({ emp }) {
  if (!emp) return null;
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:grid-cols-3 md:grid-cols-6">
      {empFields.map(([label, key]) => (
        <div key={key} className="min-w-0">
          <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
          <div
            className={`truncate text-xs ${key === 'proximityId' ? 'font-semibold text-blue-700' : 'text-slate-700'}`}
          >
            {key === 'joinDate' ? fmtDate(emp.joinDate) : emp[key] || '-'}
          </div>
        </div>
      ))}
    </div>
  );
}

// Employee ID / Proximity ID (ba naam) diye search
function EmployeeSearch({ onSelect, placeholder = 'Search by Employee ID or Proximity ID...' }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setResults([]);
      setBusy(false);
      return;
    }
    const my = ++seq.current;
    setBusy(true);
    const t = setTimeout(async () => {
      try {
        const r = await api(`/api/employee-search?q=${encodeURIComponent(term)}`);
        if (my === seq.current) {
          setResults(r);
          setOpen(true);
        }
      } catch {
        if (my === seq.current) setResults([]);
      } finally {
        if (my === seq.current) setBusy(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const pick = (emp) => {
    onSelect(emp);
    setQ('');
    setResults([]);
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const term = q.trim().toLowerCase();
    const exact = results.find((r) => r.employeeId.toLowerCase() === term || r.proximityId.toLowerCase() === term);
    if (exact) pick(exact);
    else if (results.length === 1) pick(results[0]);
  };

  return (
    <div className="relative w-full sm:w-96">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
      {open && q.trim() && (
        <div className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {busy && <div className="px-3 py-2 text-xs text-slate-500">Searching...</div>}
          {!busy && !results.length && <div className="px-3 py-2 text-xs text-slate-500">No employee found.</div>}
          {results.map((e) => (
            <button
              key={e._id}
              type="button"
              onClick={() => pick(e)}
              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-blue-50"
            >
              <span className="min-w-0 truncate">
                <span className="font-medium text-slate-800">{e.employeeId}</span>
                <span className="ml-2 text-slate-600">{e.name}</span>
              </span>
              <span className="shrink-0 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                {e.proximityId}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Ekjon employee-er mashik hajira + PDF download.
function MonthlyView({ id }) {
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

      <div className="mb-2 flex flex-wrap gap-1.5">
        {stats.map(([label, val, tone]) => (
          <span
            key={label}
            className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium ${tone}`}
          >
            {label}
            <span className="rounded bg-white/70 px-1.5 text-sm font-semibold">{val}</span>
          </span>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
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
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500 sm:text-xs">
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
                  <tr
                    key={d.date}
                    className={`transition hover:bg-blue-50 ${rowTone[d.status] || (d.isWeekend ? 'bg-slate-50' : '')}`}
                  >
                    <td className={`${td} font-medium text-slate-800`}>{fmtDate(d.date)}</td>
                    <td className={`${td} ${d.isWeekend ? 'font-semibold text-slate-500' : 'text-slate-600'}`}>
                      {dayName(d.date)}
                    </td>
                    <td className={td}>{fmtTime(d.inTime)}</td>
                    <td className={td}>{fmtTime(d.outTime)}</td>
                    <td className={td}>{d.hours ?? '—'}</td>
                    <td className={td}>
                      {d.status === 'Present' || hw ? (
                        <span className="whitespace-nowrap font-medium">
                          {fmtHM(otFinal)}
                          {hw && <span className="ml-1 text-[10px] text-purple-600">(H)</span>}
                          {otActual > 0 && otActual !== otFinal && (
                            <span className="ml-1 text-[10px] font-normal text-slate-400">({fmtHM(otActual)})</span>
                          )}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className={td}>{d.punches || '—'}</td>
                    <td className={td}>
                      {d.status ? (
                        <span className="flex items-center gap-1.5">
                          <span
                            className={`inline-block shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset sm:text-xs ${badge[d.status]}`}
                          >
                            {d.status === 'Missing Out' ? 'Missing out' : d.status}
                          </span>
                          {d.status === 'Holiday' && (
                            <span className="truncate text-[10px] text-slate-500">
                              {d.holidayName}
                              {d.inTime ? ' • worked' : ''}
                            </span>
                          )}
                        </span>
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

export default function ReportsPage() {
  const router = useRouter();
  const path = usePathname();

  const [emp, setEmp] = useState(null);

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [toast, setToast] = useState(null); // { err, text }

  useEffect(() => {
    if (!localStorage.getItem('token')) router.replace('/login');
    else {
      setReady(true);
      setLastSync(localStorage.getItem(LAST_SYNC_KEY));
    }
  }, [router]);

  useEffect(() => {
    setMobileOpen(false);
  }, [path]);

  useEffect(() => {
    const h = (e) => setLastSync(e.detail?.at || localStorage.getItem(LAST_SYNC_KEY));
    window.addEventListener(SYNC_EVENT, h);
    return () => window.removeEventListener(SYNC_EVENT, h);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const sync = async (silent = false) => {
    if (syncing) return;
    setSyncing(true);
    try {
      const r = await runSync();
      if (!silent) setToast({ text: `Synced: ${r.written} new punches (${r.logs} logs on device).` });
    } catch (e) {
      setToast({ err: true, text: `Sync failed: ${e.message}` });
    } finally {
      setSyncing(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    router.replace('/login');
  };

  if (!ready) return null;

  return (
    <div className="flex h-screen bg-slate-100 text-slate-800">
      <SideNavBar
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        onLogout={logout}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 shadow-sm md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 md:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <button
              onClick={() => setCollapsed((c) => !c)}
              className="hidden rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 md:block"
              title="Toggle sidebar"
              aria-label="Toggle sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="truncate text-base font-semibold text-slate-800">Attendance Report</h1>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <DeviceStatus />
            <div className="hidden text-right leading-tight sm:block">
              <div className="text-[10px] uppercase tracking-wide text-slate-400">Last synced</div>
              <div className="text-xs font-medium text-slate-600">{fmtSyncTime(lastSync) || 'Not yet'}</div>
            </div>

            <button
              onClick={() => sync(false)}
              disabled={syncing}
              title="Sync from Device"
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{syncing ? 'Syncing...' : 'Sync'}</span>
            </button>

            <button
              onClick={logout}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-500 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Employee Attendance Report</h2>
              <p className="text-xs text-slate-500">
                Search an employee, pick a month, view the report or download the PDF.
              </p>
            </div>
            <EmployeeSearch onSelect={setEmp} />
          </div>

          {emp ? (
            <MonthlyView key={emp._id} id={emp._id} />
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-16 text-center text-sm text-slate-400">
              Search by Employee ID or Proximity ID to view a report.
            </div>
          )}
        </main>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-4 right-4 z-50 flex max-w-sm items-start gap-2 rounded-lg border px-4 py-3 text-sm shadow-lg ${
            toast.err ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700'
          }`}
        >
          {toast.err ? (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span>{toast.text}</span>
        </div>
      )}
    </div>
  );
}