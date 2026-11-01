// frontend/app/leaves/page.js

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Pencil, Trash2, CheckCircle2, AlertCircle, Search, Menu, LogOut, RefreshCw } from 'lucide-react';
import SideNavBar from '../components/SideNavBar';
import DeviceStatus from '../components/DeviceStatus';
import { formatDateTime, useTimeFormat } from '../timeFormat';

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

const fmtSyncTime = (iso) => formatDateTime(iso);

// Shob date/time Bangladesh time (Asia/Dhaka) onujayi dekhano hoy.
const TZ = 'Asia/Dhaka';

const todayDhaka = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ }); // yyyy-mm-dd
const fmtDate = (d) => (d ? String(d).slice(0, 10).split('-').reverse().join('-') : '-'); // dd-mm-yyyy

const TYPES = [
  ['CL', 'Casual Leave'],
  ['SL', 'Sick Leave'],
  ['EL', 'Earned Leave'],
];

const input =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

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

export default function LeavesPage() {
  useTimeFormat();
  const router = useRouter();
  const path = usePathname();

  const [emp, setEmp] = useState(null);
  const [date, setDate] = useState('');
  const [type, setType] = useState('CL');
  const [note, setNote] = useState('');
  const [editId, setEditId] = useState(null);
  const [month, setMonth] = useState(todayDhaka().slice(0, 7));
  const [list, setList] = useState([]);
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);

  // header / sidebar shell
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

  const load = useCallback(async () => {
    try {
      const qs = new URLSearchParams({ month });
      if (emp) qs.set('employee', emp._id);
      setList(await api(`/api/leaves?${qs}`));
    } catch (e) {
      setMsg({ type: 'err', text: e.message });
    }
  }, [month, emp]);

  useEffect(() => {
    load();
  }, [load]);

  const reset = () => {
    setDate('');
    setType('CL');
    setNote('');
    setEditId(null);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!emp) return setMsg({ type: 'err', text: 'Search and select an employee first.' });
    setSaving(true);
    setMsg(null);
    try {
      await api(editId ? `/api/leaves/${editId}` : '/api/leaves', {
        method: editId ? 'PUT' : 'POST',
        body: JSON.stringify({ employee: emp._id, date, type, note }),
      });
      setMsg({
        type: 'ok',
        text: editId
          ? 'Leave updated.'
          : `${type} assigned to ${emp.name} (${emp.employeeId} / ${emp.proximityId}) on ${fmtDate(date)}.`,
      });
      if (date.slice(0, 7) !== month) setMonth(date.slice(0, 7));
      reset();
      load();
    } catch (err) {
      setMsg({ type: 'err', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const edit = (l) => {
    setEmp(l.employee);
    setEditId(l._id);
    setDate(l.date);
    setType(l.type);
    setNote(l.note || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const remove = async (l) => {
    if (!confirm(`Delete ${l.type} of ${l.employee.name} on ${fmtDate(l.date)}?`)) return;
    try {
      await api(`/api/leaves/${l._id}`, { method: 'DELETE' });
      load();
    } catch (err) {
      setMsg({ type: 'err', text: err.message });
    }
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
            <h1 className="truncate text-base font-semibold text-slate-800">Leave Management</h1>
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
              <h2 className="text-lg font-semibold text-slate-800">Leave Management (CL / SL / EL)</h2>
              <p className="text-xs text-slate-500">
                Search an employee, pick the absent date and leave type. Holidays cannot be assigned leave.
              </p>
            </div>
            <EmployeeSearch
              onSelect={(x) => {
                setEmp(x);
                reset();
              }}
            />
          </div>

          {msg && (
            <div
              className={`mb-4 flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm ${
                msg.type === 'ok'
                  ? 'border-green-200 bg-green-50 text-green-700'
                  : 'border-red-200 bg-red-50 text-red-700'
              }`}
            >
              {msg.type === 'ok' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0" />
              )}
              {msg.text}
            </div>
          )}

          {emp && (
            <div className="mb-4">
              <div className="mb-2 flex items-center gap-3">
                <span className="text-sm font-semibold text-slate-800">{emp.name}</span>
                <button
                  onClick={() => {
                    setEmp(null);
                    reset();
                  }}
                  className="text-xs font-medium text-blue-600 hover:text-blue-800"
                >
                  Clear selection
                </button>
              </div>
              <EmployeeInfo emp={emp} />
            </div>
          )}

          <form onSubmit={submit} className="mb-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-800">
              {editId ? 'Edit Leave' : 'Assign Leave'}
            </div>
            <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Absent Date <span className="text-red-500">*</span>
                </label>
                <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={input} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Leave Type <span className="text-red-500">*</span>
                </label>
                <select value={type} onChange={(e) => setType(e.target.value)} className={input}>
                  {TYPES.map(([k, label]) => (
                    <option key={k} value={k}>
                      {k} - {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Note (optional)</label>
                <input maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} className={input} />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
              {editId && (
                <button
                  type="button"
                  onClick={reset}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
              )}
              <button
                disabled={saving || !emp}
                className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? 'Saving...' : editId ? 'Update Leave' : 'Save Leave'}
              </button>
            </div>
          </form>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                Leave Records {emp ? `- ${emp.name}` : '- all employees'}
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                  {list.length}
                </span>
              </div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                Month
                <input
                  type="month"
                  value={month}
                  onChange={(e) => e.target.value && setMonth(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-blue-500"
                />
              </label>
            </div>
            <div className="max-h-[calc(100vh-460px)] min-h-[160px] overflow-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3 text-left font-semibold">Date</th>
                    <th className="px-5 py-3 text-left font-semibold">Emp ID</th>
                    <th className="px-5 py-3 text-left font-semibold">Proximity ID</th>
                    <th className="px-5 py-3 text-left font-semibold">Name</th>
                    <th className="px-5 py-3 text-left font-semibold">Type</th>
                    <th className="px-5 py-3 text-left font-semibold">Note</th>
                    <th className="px-5 py-3 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {list.map((l) => (
                    <tr key={l._id} className="hover:bg-blue-50">
                      <td className="whitespace-nowrap px-5 py-3 font-medium text-slate-800">{fmtDate(l.date)}</td>
                      <td className="whitespace-nowrap px-5 py-3 font-medium text-slate-700">
                        {l.employee.employeeId}
                      </td>
                      <td className="px-5 py-3">
                        <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                          {l.employee.proximityId}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-slate-700">{l.employee.name}</td>
                      <td className="px-5 py-3">
                        <span className="inline-block rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-medium text-sky-700 ring-1 ring-inset ring-sky-200">
                          {l.type}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-slate-600">{l.note || '—'}</td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => edit(l)}
                            title="Edit"
                            aria-label="Edit"
                            className="rounded-md p-2 text-slate-500 hover:bg-blue-100 hover:text-blue-700"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => remove(l)}
                            title="Delete"
                            aria-label="Delete"
                            className="rounded-md p-2 text-slate-500 hover:bg-red-100 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!list.length && (
                    <tr>
                      <td colSpan={7} className="px-3 py-12 text-center text-sm text-slate-400">
                        No leave records for this month.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
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