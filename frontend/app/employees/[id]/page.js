// frontend/app/employees/[id]/page.js

'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { Download, Printer, Loader2, Menu, LogOut, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import SideNavBar from '../../components/SideNavBar';
import DeviceStatus from '../../components/DeviceStatus';

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
    } catch { }
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
  } catch { }
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

const th = 'border-b border-slate-200 px-2 py-3 font-semibold sm:px-4 print:px-1.5 print:py-1.5';
const td = 'px-2 py-3 sm:px-4 print:px-1.5 print:py-1';

const fields = [
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
    <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:grid-cols-3 md:grid-cols-6 print:grid-cols-6 print:shadow-none">
      {fields.map(([label, key]) => (
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

// Ekjon employee-er mashik hajira + summary table + PDF download + print.
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

  // Direct browser print dialog open kore
  const printPage = () => {
    if (!emp) return;
    const prev = document.title;
    document.title = `Attendance_${emp.employeeId}_${month}`;
    const restore = () => {
      document.title = prev;
      window.removeEventListener('afterprint', restore);
    };
    window.addEventListener('afterprint', restore);
    window.print();
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
      ['Total Hours', s.totalHours, 'text-slate-700 bg-slate-50 border-slate-200'],
    ]
    : [];

  return (
    <>
      {/* Print-er shomoy page setup */}
      <style>{`
        @media print {
          @page { size: A4; margin: 10mm; }
          html, body { background: #fff !important; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      {err && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 print:hidden">
          {err}
        </div>
      )}

      {/* Sudhu print-e dekhabe */}
      {emp && (
        <div className="mb-2 hidden print:block">
          <div className="text-base font-bold text-slate-900">Monthly Attendance Report</div>
          <div className="text-xs text-slate-600">
            {emp.name} ({emp.employeeId}) — {month}
          </div>
        </div>
      )}

      {emp && (
        <div className="mb-3">
          <div className="mb-2 text-sm font-semibold text-slate-800 print:hidden">{emp.name}</div>
          <EmployeeInfo emp={emp} />
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-3 print:hidden">
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
          title="Download PDF"
          aria-label="Download PDF"
          className="icon-btn"
        >
          {pdfBusy ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
        </button>

        <button
          onClick={printPage}
          disabled={!emp}
          title="Print"
          aria-label="Print"
          className="icon-btn"
        >
          <Printer size={18} />
        </button>

        {loading && <span className="text-xs text-slate-500">Loading...</span>}
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start print:flex-row print:items-start">
        {/* Main attendance table */}
        <div className="min-w-0 flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm print:shadow-none">
          <div className="max-h-[calc(100vh-300px)] min-h-[420px] overflow-y-auto overflow-x-auto print:max-h-none print:min-h-0 print:overflow-visible">
            <table className="w-full min-w-[640px] table-fixed text-left text-xs sm:text-sm print:min-w-0 print:text-[10px]">
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
              <thead className="sticky top-0 z-10 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500 sm:text-xs print:static">
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
                  const otFinal = d.otFinalMinutes;
                  const otActual = d.otActualMinutes;
                  return (
                    <tr
                      key={d.date}
                      className={`transition hover:bg-blue-50 print:break-inside-avoid ${rowTone[d.status] || (d.isWeekend ? 'bg-slate-50' : '')}`}
                    >
                      <td className={`${td} font-medium text-slate-800`}>{fmtDate(d.date)}</td>
                      <td className={`${td} ${d.isWeekend ? 'font-semibold text-slate-500' : 'text-slate-600'}`}>{dayName(d.date)}</td>
                      <td className={td}>{fmtTime(d.inTime)}</td>
                      <td className={td}>{fmtTime(d.outTime)}</td>
                      <td className={td}>{d.hours ?? '—'}</td>
                      <td className={td}>
                        {d.status === 'Present' ? (
                          <>
                            <div className="font-medium">{fmtHM(otFinal)}</div>
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
                            {d.holidayName && (
                              <div className="mt-0.5 truncate text-[10px] text-slate-500">
                                {d.holidayName}
                                {d.status !== 'Holiday' ? ' • duty' : ''}
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

        {/* Side summary table */}
        {s && (
          <aside className="w-full shrink-0 lg:sticky lg:top-0 lg:w-56 print:static print:w-44">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm print:shadow-none">
              <table className="w-full text-left text-xs sm:text-sm print:text-[10px]">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500 sm:text-xs">
                  <tr>
                    <th colSpan={2} className={th}>
                      Summary
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stats.map(([label, val, tone]) => (
                    <tr key={label}>
                      <td className={`${td} py-2 text-slate-600`}>{label}</td>
                      <td className={`${td} py-2 text-right font-semibold ${tone.split(' ')[0]}`}>{val ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </aside>
        )}
      </div>
    </>
  );
}

export default function EmployeeDetail() {
  const { id } = useParams();
  const router = useRouter();
  const path = usePathname();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [toast, setToast] = useState(null); // { err, text }
  const autoDone = useRef(false);

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

  // onno jaygay (jemon dashboard-er button) sync hole last-synced time update
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

  // Auto sync (ekbar): page khulle device theke sync
  useEffect(() => {
    if (ready && !autoDone.current) {
      autoDone.current = true;
      sync(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const logout = () => {
    localStorage.removeItem('token');
    router.replace('/login');
  };

  if (!ready) return null;

  return (
    <div className="flex h-screen bg-slate-100 text-slate-800 print:block print:h-auto print:bg-white">
      {/* `contents` thakle layout bhange na; print-e puro sidebar hide hoy */}
      <div className="contents print:hidden">
        <SideNavBar
          collapsed={collapsed}
          onToggle={() => setCollapsed((c) => !c)}
          mobileOpen={mobileOpen}
          onClose={() => setMobileOpen(false)}
          onLogout={logout}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col print:block">
        <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 shadow-sm md:px-6 print:hidden">
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
            <h1 className="truncate text-base font-semibold text-slate-800">Employee Attendance</h1>
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

        <main className="flex-1 overflow-auto p-4 md:p-6 print:overflow-visible print:p-0">
          <button
            onClick={() => router.push('/employees')}
            className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-800 print:hidden"
          >
            <span>←</span> Back to Employee List
          </button>
          <MonthlyView id={id} />
        </main>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-4 right-4 z-50 flex max-w-sm items-start gap-2 rounded-lg border px-4 py-3 text-sm shadow-lg print:hidden ${toast.err ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700'
            }`}
        >
          {toast.err ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
          <span>{toast.text}</span>
        </div>
      )}
    </div>
  );
}