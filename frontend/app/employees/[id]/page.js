// frontend/app/employees/[id]/page.js

'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Download, Printer, Loader2, Menu, RefreshCw } from 'lucide-react';
import { IBM_Plex_Sans } from 'next/font/google';
import SideNavBar from '../../components/SideNavBar';
import DeviceStatus from '../../components/DeviceStatus';

const plex = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], display: 'swap' });

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

// PDF blob fetch (token header shoho)
async function fetchPdfBlob(path) {
  const res = await fetch(API + path, { headers: authHeader() });
  if (res.status === 401) unauthorized();
  if (!res.ok) {
    let msg = 'PDF request failed';
    try {
      msg = (await res.json()).error || msg;
    } catch { }
    throw new Error(msg);
  }
  return res.blob();
}

// PDF download: browser-e save kore
async function downloadFile(path, filename) {
  const url = URL.createObjectURL(await fetchPdfBlob(path));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Print: ekoi server PDF hidden iframe-e khule print dialog dekhay, tai PDF ar print hubohu ek
async function printFile(path) {
  const url = URL.createObjectURL(await fetchPdfBlob(path));
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  iframe.src = url;
  iframe.onload = () => {
    setTimeout(() => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch {
        // iframe print block hole notun tab-e khule dey
        window.open(url, '_blank');
      }
    }, 400);
  };
  document.body.appendChild(iframe);
  setTimeout(() => {
    iframe.remove();
    URL.revokeObjectURL(url);
  }, 120000);
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
  d ? new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: TZ }) : '-';
const dayName = (dateStr) =>
  new Date(`${dateStr}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' });
const fmtHM = (min) => `${pad(Math.floor((min || 0) / 60))}:${pad((min || 0) % 60)}`;

/* ---------- shared classes ---------- */
const focus = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700/40';
const inputCls =
  'rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/25';
const btnSecondary = `rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60 ${focus}`;
const linkBtn = `rounded text-sm font-medium text-teal-800 hover:underline disabled:opacity-60 ${focus}`;
const th = 'px-4 py-2.5 font-medium whitespace-nowrap';
const td = 'px-4 py-2.5 align-top';

const fields = [
  ['Join date', 'joinDate'],
  ['Grade', 'grade'],
  ['Line', 'line'],
  ['Designation', 'designation'],
  ['Department', 'department'],
  ['Section', 'section'],
  ['Sub section', 'subSection'],
  ['Card no', 'cardNo'],
];

// Month ruler: ek din = ekta tick. Rong shudhu status bujhate.
const tickTone = (status) => {
  switch (status) {
    case 'Present':
      return 'bg-teal-800';
    case 'Missing Out':
      return 'bg-red-700/50';
    case 'Absent':
      return 'bg-red-700';
    case 'CL':
    case 'SL':
    case 'EL':
      return 'bg-zinc-500';
    case 'Holiday':
    case 'Weekend':
      return 'bg-zinc-300';
    default:
      return 'border border-zinc-200 bg-white'; // future / not joined
  }
};

const legend = [
  ['Present', 'bg-teal-800'],
  ['Missing out', 'bg-red-700/50'],
  ['Absent', 'bg-red-700'],
  ['Leave', 'bg-zinc-500'],
  ['Holiday or weekend', 'bg-zinc-300'],
];

function MonthRuler({ days, summary }) {
  const last = days.length;
  return (
    <div>
      <div
        role="img"
        aria-label={`Month overview: ${summary.presentDays} present, ${summary.absent} absent, ${summary.missingOut} missing out, ${summary.holidayTotal} holiday or weekend, ${summary.leave} on leave`}
      >
        <div className="flex gap-px" aria-hidden="true">
          {days.map((d) => (
            <div
              key={d.date}
              title={`${fmtDate(d.date)}: ${d.status ? (d.status === 'Missing Out' ? 'Missing out' : d.status) : 'No record'}`}
              className={`h-6 flex-1 ${tickTone(d.status)}`}
            />
          ))}
        </div>
        <div className="mt-1 flex gap-px text-xs text-zinc-500 tabular-nums" aria-hidden="true">
          {days.map((d, i) => {
            const n = i + 1;
            const show = n === 1 || n % 5 === 0 || n === last;
            return (
              <div key={d.date} className="flex-1 whitespace-nowrap text-center">
                {show ? n : ''}
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-500">
        {legend.map(([label, tone]) => (
          <span key={label} className="inline-flex items-center gap-1.5">
            <span className={`inline-block h-3 w-3 ${tone}`} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

// Ekjon employee-er mashik hajira + summary + PDF download + print.
function MonthlyView({ id }) {
  const [month, setMonth] = useState(todayDhaka().slice(0, 7));
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [printBusy, setPrintBusy] = useState(false);
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

  // PDF-er hubohu ek print: server-er PDF diye print dialog open hoy
  const printPage = async () => {
    if (!emp) return;
    setPrintBusy(true);
    setErr(null);
    try {
      await printFile(`/api/employees/${id}/monthly-pdf?month=${month}`);
    } catch (e) {
      setErr(e.message);
    } finally {
      setPrintBusy(false);
    }
  };

  const num = (n) => Number(Number(n || 0).toFixed(2));
  const otHours = s ? num(s.otHours) : 0;
  // General hours = regular working hours (OT bad)
  const generalHours = data ? num(data.days.reduce((a, d) => a + (d.regularMinutes || 0), 0) / 60) : 0;
  const strong = 'text-zinc-900';
  const cells = s
    ? [
        ['Present', s.presentDays, strong],
        ['Absent', s.absent, s.absent > 0 ? 'text-red-700' : strong],
        ['Missing out', s.missingOut, s.missingOut > 0 ? 'text-red-700' : strong],
        ['CL', s.cl, strong],
        ['SL', s.sl, strong],
        ['EL', s.el, strong],
        ['OT hours', otHours, 'text-teal-800'],
        ['General hours', generalHours, strong],
      ]
    : [];

  return (
    <>
      <div className="mb-5">
        <h2 className="text-2xl font-semibold text-zinc-900">{emp ? emp.name : 'Employee attendance'}</h2>
        <p className="mt-1 text-sm text-zinc-500 tabular-nums">
          {emp ? `Employee ID ${emp.employeeId}, device ID ${emp.proximityId}` : loading ? 'Loading' : ''}
        </p>
      </div>

      {err && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-l-4 border-zinc-300 border-l-red-700 bg-white px-4 py-3 text-sm text-red-700"
        >
          {err}
        </div>
      )}

      <div className="overflow-hidden rounded-md border border-zinc-300 bg-white">
        {/* Employee details (compact) */}
        {emp && (
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 px-4 py-3 sm:grid-cols-4">
            {fields.map(([label, key]) => (
              <div key={key} className="min-w-0">
                <dt className="text-xs text-zinc-500">{label}</dt>
                <dd className="truncate text-sm text-zinc-900 tabular-nums">
                  {key === 'joinDate' ? fmtDate(emp.joinDate) : emp[key] || '-'}
                </dd>
              </div>
            ))}
          </dl>
        )}

        {/* Month controls */}
        <div className="flex flex-wrap items-center gap-3 border-t border-zinc-200 px-4 py-3">
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            Month
            <input
              type="month"
              value={month}
              onChange={(e) => e.target.value && setMonth(e.target.value)}
              className={inputCls}
            />
          </label>
          <button onClick={pdf} disabled={!emp || pdfBusy} className={`${btnSecondary} flex items-center gap-2`}>
            {pdfBusy ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <Download className="h-4 w-4" />}
            {pdfBusy ? 'Preparing PDF' : 'Download PDF'}
          </button>
          <button onClick={printPage} disabled={!emp || printBusy} className={`${btnSecondary} flex items-center gap-2`}>
            {printBusy ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <Printer className="h-4 w-4" />}
            {printBusy ? 'Preparing print' : 'Print'}
          </button>
          <span className="text-sm text-zinc-500">Times are in Bangladesh time.</span>
          {loading && <span className="text-sm text-zinc-500">Loading</span>}
        </div>

        {/* Monthly summary: one ruled strip */}
        {s && (
          <div className="border-t border-zinc-200 px-4 py-3">
            <div
              role="group"
              aria-label="Monthly summary"
              className="grid grid-cols-4 gap-px border border-zinc-300 bg-zinc-200 lg:grid-cols-8"
            >
              {cells.map(([label, value, tone]) => (
                <div key={label} className="bg-white px-3 py-2">
                  <div className="text-xs text-zinc-500">{label}</div>
                  <div className={`text-xl font-semibold tabular-nums ${tone}`}>{value}</div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-sm text-zinc-500 tabular-nums">
              Present includes {s.missingOut} day{s.missingOut === 1 ? '' : 's'} with a missing check-out. Holiday and weekend: {s.holidayTotal} days.
              General hours exclude overtime. Total hours with overtime: {num(s.totalHours)}.
            </p>
          </div>
        )}

        {/* Month ruler */}
        {s && (
          <div className="border-t border-zinc-200 px-4 py-3">
            <MonthRuler days={data.days} summary={s} />
          </div>
        )}

        {/* Daily table */}
        <div className="overflow-x-auto border-t border-zinc-300">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-zinc-300 bg-zinc-50 text-zinc-500">
              <tr>
                {['Date', 'Day', 'In', 'Out', 'Hours', 'Overtime', 'Punches', 'Status'].map((h) => (
                  <th key={h} className={th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {data?.days.map((d) => {
                const quiet = d.status === 'Holiday' || d.status === 'Weekend' || d.status === 'Not Joined';
                const bad = d.status === 'Absent' || d.status === 'Missing Out';
                return (
                  <tr key={d.date} className={`tabular-nums ${quiet ? 'bg-zinc-50 text-zinc-500' : 'text-zinc-800'}`}>
                    <td className={`${td} font-medium`}>{fmtDate(d.date)}</td>
                    <td className={td}>{dayName(d.date)}</td>
                    <td className={td}>{fmtTime(d.inTime)}</td>
                    <td className={td}>{fmtTime(d.outTime)}</td>
                    <td className={td}>{d.hours ?? '-'}</td>
                    <td className={td}>
                      {d.status === 'Present' ? (
                        <>
                          <div className="font-medium">{fmtHM(d.otFinalMinutes)}</div>
                          {d.otActualMinutes > 0 && d.otActualMinutes !== d.otFinalMinutes && (
                            <div className="text-xs text-zinc-500">actual {fmtHM(d.otActualMinutes)}</div>
                          )}
                        </>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className={td}>{d.punches || '-'}</td>
                    <td className={td}>
                      {d.status ? (
                        <>
                          <span className={bad ? 'font-medium text-red-700' : 'font-medium'}>
                            {d.status === 'Missing Out' ? 'Missing out' : d.status}
                          </span>
                          {d.holidayName && (
                            <div className="truncate text-xs text-zinc-500">
                              {d.holidayName}
                              {d.status !== 'Holiday' ? ' (duty)' : ''}
                            </div>
                          )}
                        </>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                );
              })}
              {data && !data.days.length && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-zinc-500">
                    No attendance data for this month.
                  </td>
                </tr>
              )}
            </tbody>
            {s && (
              <tfoot className="border-t border-zinc-300 bg-zinc-50 text-zinc-900 tabular-nums">
                <tr>
                  <td colSpan={4} className={`${td} font-semibold`}>
                    Total
                  </td>
                  <td className={`${td} font-semibold`}>
                    {num(s.totalHours)}
                    <span className="block text-xs font-normal text-zinc-500">total hours</span>
                  </td>
                  <td className={`${td} font-semibold text-teal-800`}>
                    {fmtHM(s.otFinalMinutes)}
                    <span className="block text-xs font-normal text-zinc-500">total overtime</span>
                  </td>
                  <td colSpan={2} className={td} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
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
    <div className={`flex h-screen bg-zinc-100 text-zinc-900 ${plex.className}`}>
      <SideNavBar
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        onLogout={logout}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-zinc-300 bg-white px-4 md:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <button
              onClick={() => setMobileOpen(true)}
              className={`rounded-md p-1.5 text-zinc-600 hover:bg-zinc-100 md:hidden ${focus}`}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <button
              onClick={() => setCollapsed((c) => !c)}
              className={`hidden rounded-md p-1.5 text-zinc-600 hover:bg-zinc-100 md:block ${focus}`}
              aria-label="Toggle sidebar"
              title="Toggle sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="truncate text-sm font-semibold text-zinc-900">Attendance</h1>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <DeviceStatus />
            <span className="hidden text-sm text-zinc-500 tabular-nums sm:inline">
              Last synced {fmtSyncTime(lastSync) || 'not yet'}
            </span>
            <button onClick={() => sync(false)} disabled={syncing} className={`${btnSecondary} flex items-center gap-2 py-1.5`}>
              <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin motion-reduce:animate-none' : ''}`} />
              {syncing ? 'Syncing' : 'Sync'}
            </button>
            <button onClick={logout} className={linkBtn}>
              Log out
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-8">
          <div className="max-w-4xl">
            <Link href="/employees" className={`mb-4 inline-block ${linkBtn}`}>
              Back to employees
            </Link>
            <MonthlyView id={id} />
          </div>
        </main>
      </div>

      {/* Toast */}
      {toast && (
        <div
          role="status"
          className={`fixed bottom-4 right-4 z-50 max-w-sm rounded-md bg-zinc-900 px-4 py-2.5 text-sm text-white ${
            toast.err ? 'border-l-4 border-red-500' : ''
          }`}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}