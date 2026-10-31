// frontend/app/settings/page.js

'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { CheckCircle2, AlertCircle, Menu, LogOut, RefreshCw } from 'lucide-react';
import SideNavBar from '../components/SideNavBar';

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

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const input =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

const toMin = (t) => {
  const [h, m] = String(t || '0:0').split(':').map(Number);
  return h * 60 + m;
};
const hours = (m) => `${Number((m / 60).toFixed(2))} Hours`;

export default function SettingsPage() {
  const router = useRouter();
  const path = usePathname();

  const [f, setF] = useState(null);
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

  useEffect(() => {
    api('/api/settings')
      .then(setF)
      .catch((e) => setMsg({ type: 'err', text: e.message }));
  }, []);

  const set = (k, v) => setF((o) => ({ ...o, [k]: v }));
  const toggleDay = (i) =>
    setF((o) => ({
      ...o,
      weekendDays: o.weekendDays.includes(i) ? o.weekendDays.filter((d) => d !== i) : [...o.weekendDays, i].sort(),
    }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      setF(await api('/api/settings', { method: 'PUT', body: JSON.stringify(f) }));
      setMsg({ type: 'ok', text: 'Settings saved. All attendance and OT calculations now use these values.' });
    } catch (err) {
      setMsg({ type: 'err', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const total = f ? toMin(f.officeEnd) - toMin(f.officeStart) : 0;
  const lunch = f ? toMin(f.lunchEnd) - toMin(f.lunchStart) : 0;

  const time = (k, label) => (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      <input type="time" required value={f[k]} onChange={(e) => set(k, e.target.value)} className={input} />
    </div>
  );

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
            <h1 className="truncate text-base font-semibold text-slate-800">Settings</h1>
          </div>

          <div className="flex shrink-0 items-center gap-2">
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
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-800">Working Hour Settings</h2>
            <p className="text-xs text-slate-500">Office hours, lunch, weekend and company details used for attendance, OT and PDF.</p>
          </div>

          {msg && (
            <div
              className={`mb-4 flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm ${
                msg.type === 'ok' ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700'
              }`}
            >
              {msg.type === 'ok' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
              {msg.text}
            </div>
          )}

          {!f ? (
            <div className="text-sm text-slate-500">Loading...</div>
          ) : (
            <form onSubmit={save} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
                {time('officeStart', 'Office Start Time')}
                {time('officeEnd', 'Office End Time')}
                {time('lunchStart', 'Lunch Start Time')}
                {time('lunchEnd', 'Lunch End Time')}
              </div>

              <div className="grid grid-cols-1 gap-3 border-t border-slate-100 px-5 py-4 sm:grid-cols-3">
                {[
                  ['Total Office Duration', hours(total)],
                  ['Lunch Duration', hours(lunch)],
                  ['Actual Working Hours', hours(total - lunch)],
                ].map(([a, b]) => (
                  <div key={a} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5">
                    <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{a}</div>
                    <div className="text-sm font-semibold text-slate-800">{b}</div>
                  </div>
                ))}
              </div>

              <div className="border-t border-slate-100 px-5 py-4">
                <div className="mb-2 text-xs font-medium text-slate-600">Weekend days</div>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAYS.map((d, i) => (
                    <label
                      key={d}
                      className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${
                        f.weekendDays.includes(i) ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-slate-300 text-slate-600'
                      }`}
                    >
                      <input type="checkbox" checked={f.weekendDays.includes(i)} onChange={() => toggleDay(i)} />
                      {d}
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 border-t border-slate-100 p-5 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Company Name (PDF header)</label>
                  <input value={f.companyName} onChange={(e) => set('companyName', e.target.value)} className={input} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Company Address (PDF header)</label>
                  <input value={f.companyAddress} onChange={(e) => set('companyAddress', e.target.value)} className={input} />
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
                <span className="text-xs text-slate-500">OT grace period: fixed 15 minutes (not editable).</span>
                <button
                  disabled={saving}
                  className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
                >
                  {saving ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </form>
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
          {toast.err ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
          <span>{toast.text}</span>
        </div>
      )}
    </div>
  );
}
