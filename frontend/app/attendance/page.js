// frontend/app/attendance/page.js

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Search, RefreshCw, Download, Printer, Pencil, Check, X, Loader2 } from 'lucide-react';
import { IBM_Plex_Sans } from 'next/font/google';
import SideNavBar from '../components/SideNavBar';
import { formatTime, useTimeFormat } from '../timeFormat';

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

async function fetchPdfBlob(path) {
  const res = await fetch(API + path, { headers: authHeader() });
  if (res.status === 401) unauthorized();
  if (!res.ok) {
    let msg = 'PDF request failed';
    try {
      msg = (await res.json()).error || msg;
    } catch {}
    throw new Error(msg);
  }
  return res.blob();
}

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

/* ---------- formatting (Asia/Dhaka) ---------- */
const TZ = 'Asia/Dhaka';
const pad = (n) => String(n).padStart(2, '0');
const todayDhaka = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ });
const fmtDate = (d) => (d ? String(d).slice(0, 10).split('-').reverse().join('-') : '-');
const fmtTime = (d) => formatTime(d, { timeZone: TZ });
const fmtHM = (min) => `${pad(Math.floor((min || 0) / 60))}:${pad((min || 0) % 60)}`;

// ISO timestamp -> 'HH:MM' (Dhaka), khali hole khali
const toHHMM = (value) => {
  if (!value) return '';
  const t = new Date(value).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: TZ,
  });
  return /^\d{2}:\d{2}$/.test(t) ? t : '';
};

const rowKey = (r) => `${r.date}|${r.employee}`;

/* ---------- shared classes ---------- */
const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700/40';
// compact input (filters)
const inputCls =
  'rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-[13px] text-zinc-900 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/25';
const btnSecondary = `rounded-md bg-teal-800 px-3 py-2 text-[13px] font-medium text-white hover:bg-teal-900 disabled:opacity-60 ${focusRing}`;
const linkBtn = `rounded text-sm font-medium text-teal-800 hover:underline disabled:opacity-60 ${focusRing}`;
const th = 'px-1.5 py-2 font-medium whitespace-nowrap';
const td = 'px-1.5 py-1.5 align-middle whitespace-nowrap tabular-nums';
// Fixed width for the time columns so entering edit mode never changes the table width
const timeCol = 'w-[5.75rem] min-w-[5.75rem] max-w-[5.75rem]';
// Time input inside edit mode: always fills its fixed-width cell
const timeInputCls = `${inputCls} w-full min-w-0 px-1 py-1 text-xs`;

const statusTone = (status) => {
  if (status === 'Present') return 'font-medium text-teal-800';
  if (status === 'Missing Out' || status === 'Absent') return 'font-medium text-red-700';
  if (status === 'CL' || status === 'SL' || status === 'EL') return 'font-medium text-zinc-700';
  return 'text-zinc-500';
};

/* ---------- search: Employee ID / Proximity ID / Name ---------- */
function EmployeeSearch({ onSelect }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const seq = useRef(0);
  const box = useRef(null);

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

  useEffect(() => {
    const h = (e) => {
      if (box.current && !box.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const pick = (emp) => {
    setQ('');
    setResults([]);
    setOpen(false);
    onSelect(emp);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (results.length === 1) pick(results[0]);
  };

  return (
    <div ref={box} className="w-full sm:w-60">
      <label htmlFor="reg-search" className="mb-1 block text-xs font-medium text-zinc-700">
        Search employee
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
        <input
          id="reg-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Employee ID, device ID or name"
          autoComplete="off"
          className={`${inputCls} w-full pl-8`}
        />
        {open && q.trim() && (
          <div className="absolute z-20 mt-1 max-h-72 w-72 overflow-auto rounded-md border border-zinc-300 bg-white shadow-md">
            {busy && <div className="px-3 py-2 text-sm text-zinc-500">Searching</div>}
            {!busy && !results.length && <div className="px-3 py-2 text-sm text-zinc-500">No employee found.</div>}
            {results.map((e) => (
              <button
                key={e._id}
                type="button"
                onClick={() => pick(e)}
                className="flex w-full items-center justify-between gap-3 border-b border-zinc-100 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-zinc-50"
              >
                <span className="min-w-0 truncate tabular-nums">
                  <span className="font-semibold text-teal-800">{e.employeeId}</span>
                  <span className="ml-2 text-zinc-600">{e.name}</span>
                </span>
                <span className="shrink-0 text-xs text-zinc-500 tabular-nums">Device {e.proximityId}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AttendanceRegisterPage() {
  const [timeFormat] = useTimeFormat();
  const router = useRouter();
  const path = usePathname();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState(null);

  const [emp, setEmp] = useState(null);
  const [searchKey, setSearchKey] = useState(0);
  const [from, setFrom] = useState(todayDhaka);
  const [to, setTo] = useState(todayDhaka);
  const [showEmpty, setShowEmpty] = useState(false);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [err, setErr] = useState(null);

  const seq = useRef(0);
  const [editing, setEditing] = useState(null); // { key, inTime, outTime }
  const [savingKey, setSavingKey] = useState(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [printBusy, setPrintBusy] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('token')) router.replace('/login');
    else setReady(true);
  }, [router]);

  useEffect(() => {
    setMobileOpen(false);
  }, [path]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const query = useCallback(() => {
    const p = new URLSearchParams({ from, to });
    if (emp?._id) p.set('employee', emp._id);
    if (showEmpty) p.set('showEmpty', '1');
    return p.toString();
  }, [from, to, emp, showEmpty]);

  const load = useCallback(async () => {
    const my = ++seq.current;
    setLoading(true);
    setErr(null);
    try {
      const r = await api(`/api/attendance/register?${query()}`);
      if (my === seq.current) setData(r);
    } catch (e) {
      if (my === seq.current) {
        setErr(e.message);
        setData(null);
      }
    } finally {
      if (my === seq.current) setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  // Device theke sync kore tarpor register abar load kori
  const sync = async () => {
    if (syncing) return;
    setSyncing(true);
    setErr(null);
    try {
      const r = await api('/api/sync', { method: 'POST' });
      await load();
      setToast({ text: `Synced: ${r.written} new punches (${r.logs} logs on device).` });
    } catch (e) {
      setErr(e.message);
      setToast({ err: true, text: `Sync failed: ${e.message}` });
    } finally {
      setSyncing(false);
    }
  };

  // Sidebar-er Sync button theke sync hole register abar load hoy
  useEffect(() => {
    const h = () => load();
    window.addEventListener('attendance:synced', h);
    return () => window.removeEventListener('attendance:synced', h);
  }, [load]);

  // Filter badalale purono row-er editor bondho
  useEffect(() => {
    setEditing(null);
  }, [from, to, emp, showEmpty]);

  const pickEmp = (e) => {
    setEmp(e);
    setSearchKey((k) => k + 1);
  };

  const setFromDate = (v) => {
    if (!v) return;
    setFrom(v);
    if (to && v > to) setTo(v);
  };
  const setToDate = (v) => {
    if (!v) return;
    setTo(v);
    if (from && v < from) setFrom(v);
  };

  const startEdit = (row) => {
    setErr(null);
    setEditing({ key: rowKey(row), inTime: toHHMM(row.inTime), outTime: toHHMM(row.outTime) });
  };

  const saveRow = async (row) => {
    const key = rowKey(row);
    const nextIn = editing?.inTime || '';
    const nextOut = editing?.outTime || '';
    // Device time-i ache, notun override kora lagbe na
    if (!row.edited && nextIn === toHHMM(row.inTime) && nextOut === toHHMM(row.outTime)) {
      setEditing(null);
      return;
    }
    if (nextIn && nextOut && nextOut <= nextIn) {
      setErr('Check-out must be after check-in.');
      return;
    }
    setSavingKey(key);
    setErr(null);
    try {
      await api(`/api/employees/${row.employee}/attendance-edit`, {
        method: 'PUT',
        body: JSON.stringify({ date: row.date, inTime: nextIn, outTime: nextOut }),
      });
      setEditing(null);
      await load();
      setToast({ text: `Saved ${row.name} on ${fmtDate(row.date)}. Overtime recalculated.` });
    } catch (e) {
      setErr(e.message);
    } finally {
      setSavingKey(null);
    }
  };

  const pdf = async () => {
    setPdfBusy(true);
    setErr(null);
    try {
      await downloadFile(
        `/api/attendance/register-pdf?${query()}&timeFormat=${timeFormat}`,
        `Attendance_Register_${from}${from === to ? '' : `_to_${to}`}.pdf`
      );
    } catch (e) {
      setErr(e.message);
    } finally {
      setPdfBusy(false);
    }
  };

  const print = async () => {
    setPrintBusy(true);
    setErr(null);
    try {
      await printFile(`/api/attendance/register-pdf?${query()}&timeFormat=${timeFormat}`);
    } catch (e) {
      setErr(e.message);
    } finally {
      setPrintBusy(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    router.replace('/login');
  };

  if (!ready) return null;

  const rows = data?.rows || [];
  const s = data?.summary;
  const employeeChip = emp ? `${emp.name} — Employee ID ${emp.employeeId}, device ID ${emp.proximityId}` : null;

  return (
    <div className={`flex h-screen bg-zinc-100 text-zinc-900 ${plex.className}`}>
      {/* The sidebar manages its own collapsed state (saved in localStorage) */}
      <SideNavBar
        onOpen={() => setMobileOpen(true)}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        onLogout={logout}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1 overflow-auto p-3 pt-16 md:p-4">
          <div className="mx-0 w-full max-w-none">
            {/* Filters */}
            <div className="rounded-md border border-zinc-300 bg-white px-3 py-3">
              <div className="flex flex-wrap items-end gap-3">
                <EmployeeSearch key={searchKey} onSelect={pickEmp} />

                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-zinc-700">From</span>
                  <input
                    type="date"
                    value={from}
                    max={to || undefined}
                    onChange={(e) => setFromDate(e.target.value)}
                    className={`${inputCls} w-36`}
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-zinc-700">To</span>
                  <input
                    type="date"
                    value={to}
                    min={from || undefined}
                    onChange={(e) => setToDate(e.target.value)}
                    className={`${inputCls} w-36`}
                  />
                </label>

                <label className="flex shrink-0 items-center gap-2 whitespace-nowrap pb-2 text-[13px] text-zinc-700">
                  <input
                    type="checkbox"
                    checked={showEmpty}
                    onChange={(e) => setShowEmpty(e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300 text-teal-800 focus:ring-teal-700/40"
                  />
                  Include days with no punch
                </label>

                <div className="ml-auto flex shrink-0 items-center gap-2">
                  <button onClick={pdf} disabled={pdfBusy || !rows.length} className={`${btnSecondary} flex items-center gap-2`}>
                    {pdfBusy ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <Download className="h-4 w-4" />}
                    {pdfBusy ? 'Preparing PDF' : 'Download PDF'}
                  </button>
                  <button onClick={print} disabled={printBusy || !rows.length} className={`${btnSecondary} flex items-center gap-2`}>
                    {printBusy ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <Printer className="h-4 w-4" />}
                    {printBusy ? 'Preparing print' : 'Print'}
                  </button>
                </div>
              </div>

              {employeeChip && (
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-zinc-600">
                  <span className="rounded-full bg-teal-50 px-3 py-1 font-medium text-teal-800">{employeeChip}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setEmp(null);
                      setSearchKey((k) => k + 1);
                    }}
                    className={linkBtn}
                  >
                    Clear employee filter
                  </button>
                </div>
              )}
            </div>

            {err && (
              <div
                role="alert"
                className="mt-3 rounded-md border border-l-4 border-zinc-300 border-l-red-700 bg-white px-4 py-3 text-sm text-red-700"
              >
                {err}
              </div>
            )}

            {/* Rows */}
            <div className="mt-3 overflow-hidden rounded-md border border-zinc-300 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-3 py-2.5">
                <p className="text-sm font-medium text-zinc-900">
                  {fmtDate(from)}
                  {from === to ? '' : ` to ${fmtDate(to)}`}
                  <span className="ml-2 font-normal text-zinc-500">
                    {loading ? 'Loading' : `${s ? s.rows : 0} row${s && s.rows === 1 ? '' : 's'}`}
                  </span>
                </p>
              </div>

              <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <table className="w-full text-left text-[13px]">
                  <thead className="border-b border-zinc-300 bg-zinc-50 text-zinc-500">
                    <tr>
                      {['Date', 'Emp ID', 'Device', 'Name', 'Check-in', 'Check-out', 'Hours', 'Punch', 'OT', 'Status'].map((h) => (
                        <th key={h} className={`${th} ${h === 'Check-in' || h === 'Check-out' ? timeCol : ''}`}>
                          {h}
                        </th>
                      ))}
                      <th className={`${th} text-right`}>Edit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {rows.map((r) => {
                      const key = rowKey(r);
                      const isEditing = editing?.key === key;
                      const saving = savingKey === key;
                      const quiet = r.status === 'Weekend' || r.status === 'Holiday';
                      return (
                        <tr key={key} className={quiet ? 'bg-zinc-50 text-zinc-500' : 'text-zinc-800'}>
                          <td className={`${td} font-medium`}>{fmtDate(r.date)}</td>
                          <td className={td}>{r.employeeId}</td>
                          <td className={td}>{r.proximityId}</td>
                          <td className={`${td} max-w-[110px] truncate lg:max-w-[180px]`} title={r.name}>
                            {r.name}
                            {r.edited && <span className="ml-2 text-xs font-medium text-teal-800">edited</span>}
                          </td>
                          <td className={`${td} ${timeCol}`}>
                            {isEditing ? (
                              <input
                                type="time"
                                value={editing.inTime}
                                onChange={(e) => setEditing((x) => ({ ...x, inTime: e.target.value }))}
                                aria-label={`Check-in for ${r.name} on ${fmtDate(r.date)}`}
                                className={timeInputCls}
                              />
                            ) : (
                              fmtTime(r.inTime)
                            )}
                          </td>
                          <td className={`${td} ${timeCol}`}>
                            {isEditing ? (
                              <input
                                type="time"
                                value={editing.outTime}
                                onChange={(e) => setEditing((x) => ({ ...x, outTime: e.target.value }))}
                                aria-label={`Check-out for ${r.name} on ${fmtDate(r.date)}`}
                                className={timeInputCls}
                              />
                            ) : (
                              fmtTime(r.outTime)
                            )}
                          </td>
                          <td className={td}>{r.hours ?? '-'}</td>
                          <td className={td}>{r.punches || '-'}</td>
                          <td className={`${td} ${r.status === 'Present' ? 'text-teal-800' : ''}`}>
                            {r.status === 'Present' ? fmtHM(r.otFinalMinutes) : '-'}
                            {r.status === 'Present' && r.manualOt && (
                              <span className="ml-1 text-xs text-zinc-500">manual</span>
                            )}
                          </td>
                          {/* Status may wrap (long holiday names) instead of widening the table */}
                          <td className="px-1.5 py-1.5 align-middle tabular-nums">
                            <span className={statusTone(r.status)}>{r.status || '-'}</span>
                            {r.holidayName && <span className="ml-2 text-xs text-zinc-500">{r.holidayName}</span>}
                          </td>
                          <td className={`${td} text-right`}>
                            {isEditing ? (
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => saveRow(r)}
                                  disabled={saving}
                                  title="Save check-in and check-out"
                                  aria-label={`Save ${r.name} on ${fmtDate(r.date)}`}
                                  className={`rounded-md bg-teal-800 p-1.5 text-white hover:bg-teal-900 disabled:opacity-50 ${focusRing}`}
                                >
                                  {saving ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <Check className="h-4 w-4" />}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditing(null)}
                                  disabled={saving}
                                  title="Cancel"
                                  aria-label="Cancel editing"
                                  className={`rounded-md border border-zinc-300 p-1.5 text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 ${focusRing}`}
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => startEdit(r)}
                                title="Edit check-in and check-out"
                                aria-label={`Edit ${r.name} on ${fmtDate(r.date)}`}
                                className={`rounded-md bg-teal-800 p-1.5 text-white hover:bg-teal-900 ${focusRing}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}

                    {data && !rows.length && (
                      <tr>
                        <td colSpan={11} className="px-4 py-12 text-center text-sm text-zinc-500">
                          No attendance rows for these filters.
                        </td>
                      </tr>
                    )}
                  </tbody>

                  {s && rows.length > 0 && (
                    <tfoot className="border-t border-zinc-300 bg-zinc-50 text-zinc-900">
                      <tr>
                        <td className={`${td} font-semibold`} colSpan={6}>
                          Total
                        </td>
                        <td className={`${td} font-semibold`}>{s.totalHours}</td>
                        <td className={td} />
                        <td className={`${td} font-semibold text-teal-800`}>{fmtHM(s.otFinalMinutes)}</td>
                        <td className={td} colSpan={2} />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {s && rows.length > 0 && (
                <p className="border-t border-zinc-200 px-3 py-2.5 text-sm text-zinc-500">
                  Present {s.presentDays} · Missing out {s.missingOut} · Absent {s.absent} · Leave {s.leave} · Holiday{' '}
                  {s.holiday} · Weekend {s.weekend}. Total overtime {fmtHM(s.otFinalMinutes)}.
                </p>
              )}
            </div>
          </div>
        </main>
      </div>

      {toast && (
        <div
          role="status"
          className={`fixed bottom-4 right-4 z-50 max-w-sm rounded-md px-4 py-2.5 text-sm text-white ${toast.err ? 'bg-red-700' : 'bg-zinc-900'}`}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}