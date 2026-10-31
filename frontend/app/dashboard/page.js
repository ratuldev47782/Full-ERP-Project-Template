// frontend/app/dashboard/page.js

'use client';
import { useEffect, useState, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { RefreshCw, Trash2, Menu, LogOut, CheckCircle2, AlertCircle } from 'lucide-react';
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

const today = () => new Date().toLocaleDateString('en-CA');
const time = (d) =>
  d ? new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—';
const dateTime = (d) =>
  new Date(d).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' });

const statusColor = {
  Present: 'text-green-600',
  Absent: 'text-red-600',
  'Missing Out': 'text-amber-600',
  Holiday: 'text-purple-600',
  CL: 'text-sky-600',
  SL: 'text-sky-600',
  EL: 'text-sky-600',
  Weekend: 'text-slate-400',
  'Not Joined': 'text-slate-400',
};

const th = 'border-b px-2 py-3 sm:px-3';
const td = 'break-words px-2 py-2.5 sm:px-3';

const DeviceId = ({ v }) =>
  v ? (
    <span className="inline-block rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">{v}</span>
  ) : (
    '—'
  );

export default function Dashboard() {
  const router = useRouter();
  const path = usePathname();

  const [tab, setTab] = useState('daily');
  const [date, setDate] = useState(today());
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState(null);
  const [msg, setMsg] = useState(null);
  const [syncing, setSyncing] = useState(false);

  // header / sidebar shell
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [shellSyncing, setShellSyncing] = useState(false);
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

  const headerSync = async (silent = false) => {
    if (shellSyncing) return;
    setShellSyncing(true);
    try {
      const r = await runSync();
      if (!silent) setToast({ text: `Synced: ${r.written} new punches (${r.logs} logs on device).` });
    } catch (e) {
      setToast({ err: true, text: `Sync failed: ${e.message}` });
    } finally {
      setShellSyncing(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    router.replace('/login');
  };

  const load = useCallback(async () => {
    try {
      const path =
        tab === 'daily' ? `/api/daily?date=${date}` : tab === 'logs' ? `/api/logs?date=${date}` : '/api/employees';
      setRows(await api(path));
    } catch (e) {
      setMsg({ err: true, text: e.message });
    }
  }, [tab, date]);

  const checkStatus = useCallback(async () => {
    try {
      setStatus(await api('/api/status'));
    } catch {}
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Header-er Sync button ba ei page-er Sync, jekono jaygay sync hole auto reload
  useEffect(() => {
    const h = () => {
      load();
      checkStatus();
    };
    window.addEventListener(SYNC_EVENT, h);
    return () => window.removeEventListener(SYNC_EVENT, h);
  }, [load, checkStatus]);

  async function sync() {
    setSyncing(true);
    setMsg(null);
    try {
      const r = await runSync(); // event fire hobe, load() auto cholbe
      setMsg({ text: `Sync complete: ${r.written} new punches saved (${r.logs} logs on device).` });
    } catch (e) {
      setMsg({ err: true, text: `Sync failed: ${e.message}` });
    }
    setSyncing(false);
  }

  // Device log clear: age missing log upload + verify, tarpor user confirm korle delete
  async function clearDevice() {
    if (syncing) return;
    setSyncing(true);
    setMsg(null);
    try {
      // Step 1: missing log upload + verify (delete hoy na)
      const p = await api('/api/clear-device/prepare', { method: 'POST' });
      if (!p.logs) {
        setMsg({ text: 'Device-e kono log nai.' });
        return;
      }
      window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: { at: new Date().toISOString() } }));

      // Step 2: user-ke jiggesh
      const ok = confirm(
        `Device-e ${p.logs} ta log ache.\n` +
          `DB-te age theke chilo: ${p.alreadyInDb}\n` +
          `Notun upload holo: ${p.uploaded}\n` +
          `Sob log DB-te verified.\n\n` +
          `Ebar device theke shob log DELETE korbo?\nEta undo kora jay na.`
      );
      if (!ok) {
        setMsg({ text: `Delete cancel. ${p.uploaded} ta log DB-te upload hoyeche, device-e log ager moto ache.` });
        return;
      }

      // Step 3: delete (server abar verify kore)
      const r = await api('/api/clear-device/confirm', {
        method: 'POST',
        body: JSON.stringify({ confirm: 'CLEAR', expectedLogs: p.logs }),
      });
      setMsg({
  text: r.cleared
    ? `Device theke ${r.logs} ta log muchhe fela hoyeche. Ei ${r.logs} ta log DB-te safe ache.`
    : 'Kichu clear hoyni.',
});
    } catch (e) {
      setMsg({ err: true, text: e.message });
    } finally {
      setSyncing(false);
    }
  }

  const dot = status ? (status.connected ? 'bg-green-500' : 'bg-red-500') : 'bg-slate-400';

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
            <h1 className="truncate text-base font-semibold text-slate-800">Dashboard</h1>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <DeviceStatus />
            {/* Last synced time */}
            <div className="hidden text-right leading-tight sm:block">
              <div className="text-[10px] uppercase tracking-wide text-slate-400">Last synced</div>
              <div className="text-xs font-medium text-slate-600">{fmtSyncTime(lastSync) || 'Not yet'}</div>
            </div>

            {/* Sync button (shob page-e) */}
            <button
              onClick={() => headerSync(false)}
              disabled={shellSyncing}
              title="Sync from Device"
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${shellSyncing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{shellSyncing ? 'Syncing...' : 'Sync'}</span>
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
          {/* Top bar */}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm">
              <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} />
              <span className="break-words">
                {status
                  ? status.connected
                    ? `Device connected (${status.ip}:${status.port})`
                    : `Device disconnected (${status.ip}:${status.port})`
                  : 'Checking device connection...'}
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={sync}
                disabled={syncing}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Working...' : 'Sync from Device'}
              </button>
              <button
                onClick={clearDevice}
                disabled={syncing}
                className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-1.5 text-sm font-medium text-red-600 hover:bg-red-600 hover:text-white disabled:opacity-60"
              >
                <Trash2 className="h-4 w-4" />
                Clear Device Logs
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="mb-3 flex flex-wrap gap-1 border-b border-slate-200">
            {[
              ['daily', 'Daily Attendance'],
              ['logs', 'Punch Logs'],
              ['users', 'Device Users'],
            ].map(([k, label]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
                  tab === k
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {msg && <p className={`mb-3 text-sm ${msg.err ? 'text-red-600' : 'text-green-600'}`}>{msg.text}</p>}
          {status && !status.connected && (
            <p className="mb-3 text-sm text-red-600">Unable to connect to the device: {status.error}</p>
          )}

          {tab !== 'users' && (
            <div className="mb-3">
              <label className="text-sm font-medium">
                Date{' '}
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="ml-1 rounded border border-slate-300 px-2 py-1 text-sm outline-none focus:border-blue-500"
                />
              </label>
            </div>
          )}

          {/* Table */}
          <div className="rounded border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-hidden">
              {rows.length === 0 ? (
                <div className="px-3 py-8 text-center text-sm text-slate-400">
                  {tab === 'users'
                    ? 'No employees found.'
                    : 'No attendance records found for this date. Use "Sync from Device" to retrieve records.'}
                </div>
              ) : tab === 'daily' ? (
                <table className="w-full table-fixed text-left text-xs sm:text-sm">
                  <colgroup>
                    <col className="w-[13%]" />
                    <col className="w-[13%]" />
                    <col className="w-[19%]" />
                    <col className="w-[12%]" />
                    <col className="w-[12%]" />
                    <col className="w-[8%]" />
                    <col className="hidden sm:table-column w-[8%]" />
                    <col className="w-[15%]" />
                  </colgroup>
                  <thead className="bg-slate-100 text-[10px] uppercase text-slate-600 sm:text-xs">
                    <tr>
                      <th className={th}>Emp ID</th>
                      <th className={th}>Device ID</th>
                      <th className={th}>Name</th>
                      <th className={th}>Check-in</th>
                      <th className={th}>Check-out</th>
                      <th className={th}>Hours</th>
                      <th className={`${th} hidden sm:table-cell`}>Punches</th>
                      <th className={th}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r._id} className="border-b hover:bg-slate-50">
                        <td className={td}>{r.employeeId}</td>
                        <td className={td}>
                          <DeviceId v={r.proximityId ?? r.userId} />
                        </td>
                        <td className={td}>{r.name}</td>
                        <td className={td}>{time(r.inTime)}</td>
                        <td className={td}>{time(r.outTime)}</td>
                        <td className={td}>{r.hours ?? '—'}</td>
                        <td className={`${td} hidden sm:table-cell`}>{r.punches}</td>
                        <td className={`${td} font-medium ${statusColor[r.status] || ''}`}>
                          {r.status === 'Missing Out' ? 'Missing check-out' : r.status}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : tab === 'logs' ? (
                <table className="w-full table-fixed text-left text-xs sm:text-sm">
                  <colgroup>
                    <col className="w-[25%]" />
                    <col className="w-[40%]" />
                    <col className="w-[35%]" />
                  </colgroup>
                  <thead className="bg-slate-100 text-[10px] uppercase text-slate-600 sm:text-xs">
                    <tr>
                      <th className={th}>Device ID</th>
                      <th className={th}>Name</th>
                      <th className={th}>Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r._id} className="border-b hover:bg-slate-50">
                        <td className={td}>
                          <DeviceId v={r.userId} />
                        </td>
                        <td className={td}>{r.name}</td>
                        <td className={td}>{dateTime(r.timestamp)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="w-full table-fixed text-left text-xs sm:text-sm">
                  <colgroup>
                    <col className="w-[35%]" />
                    <col className="w-[65%]" />
                  </colgroup>
                  <thead className="bg-slate-100 text-[10px] uppercase text-slate-600 sm:text-xs">
                    <tr>
                      <th className={th}>Device ID</th>
                      <th className={th}>Name</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r._id} className="border-b hover:bg-slate-50">
                        <td className={td}>
                          <DeviceId v={r.proximityId} />
                        </td>
                        <td className={td}>{r.name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
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
          {toast.err ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
          <span>{toast.text}</span>
        </div>
      )}
    </div>
  );
}
