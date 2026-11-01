// frontend/app/reports/page.js

'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Search, Menu, RefreshCw } from 'lucide-react';
import { IBM_Plex_Sans } from 'next/font/google';
import SideNavBar from '../components/SideNavBar';
import DeviceStatus from '../components/DeviceStatus';
import MonthlyView from '../components/MonthlyView';
import { formatDateTime, useTimeFormat } from '../timeFormat';

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

const fmtSyncTime = (iso) => formatDateTime(iso);

/* ---------- shared classes ---------- */
const focus = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700/40';
const inputCls =
  'rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/25';
const btnSecondary = `rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60 ${focus}`;
const linkBtn = `rounded text-sm font-medium text-teal-800 hover:underline disabled:opacity-60 ${focus}`;

/* ---------- Search: Employee ID ar Proximity ID, alada alada input ---------- */
function SearchBox({ by, label, placeholder, onSelect }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const seq = useRef(0);
  const box = useRef(null);
  const inputId = `search-${by}`;

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
        const r = await api(`/api/employee-search?q=${encodeURIComponent(term)}&by=${by}`);
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
  }, [q, by]);

  // bairer jaygay click korle dropdown bondho
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
    const term = q.trim().toLowerCase();
    const exact = results.find((r) => String(r[by] || '').toLowerCase() === term);
    if (exact) pick(exact);
    else if (results.length === 1) pick(results[0]);
  };

  return (
    <div ref={box} className="w-full sm:w-72">
      <label htmlFor={inputId} className="mb-1 block text-sm font-medium text-zinc-700">
        {label}
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          id={inputId}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          className={`${inputCls} w-full pl-9`}
        />
        {open && q.trim() && (
          <div className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-md border border-zinc-300 bg-white shadow-md">
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
                  <span className={by === 'employeeId' ? 'font-semibold text-teal-800' : 'font-medium text-zinc-800'}>
                    {e.employeeId}
                  </span>
                  <span className="ml-2 text-zinc-600">{e.name}</span>
                </span>
                <span
                  className={`shrink-0 text-xs tabular-nums ${
                    by === 'proximityId' ? 'font-semibold text-teal-800' : 'text-zinc-500'
                  }`}
                >
                  Device {e.proximityId}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ReportsPage() {
  useTimeFormat();
  const router = useRouter();
  const path = usePathname();

  const [emp, setEmp] = useState(null);
  const [searchKey, setSearchKey] = useState(0); // employee select hole duto input-i clear hoy

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

  const pickEmp = (e) => {
    setEmp(e);
    setSearchKey((k) => k + 1);
  };

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
            <h1 className="truncate text-sm font-semibold text-zinc-900">Attendance report</h1>
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
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-zinc-900">Employee attendance report</h2>
              <p className="mt-1 mb-4 text-sm text-zinc-500">
                Search by employee ID or by proximity ID, pick a month, then view the report, download the PDF or print it.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                <SearchBox
                  key={`employeeId-${searchKey}`}
                  by="employeeId"
                  label="Employee ID"
                  placeholder="Search by employee ID"
                  onSelect={pickEmp}
                />
                <SearchBox
                  key={`proximityId-${searchKey}`}
                  by="proximityId"
                  label="Proximity ID"
                  placeholder="Search by proximity ID"
                  onSelect={pickEmp}
                />
              </div>
            </div>

            {emp ? (
              <MonthlyView key={emp._id} id={emp._id} />
            ) : (
              <div className="rounded-md border border-dashed border-zinc-300 bg-white px-4 py-16 text-center text-sm text-zinc-500">
                Search by Employee ID or Proximity ID above to view a report.
              </div>
            )}
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