// frontend/app/settings/page.js

'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  CheckCircle2,
  AlertCircle,
  Menu,
  LogOut,
  RefreshCw,
  Clock,
  Utensils,
  CalendarOff,
  Building2,
  Save,
  Hourglass,
  Briefcase,
  Info,
} from 'lucide-react';
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

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const input =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100';

const toMin = (t) => {
  const [h, m] = String(t || '0:0').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};
const hours = (m) => `${Number((Math.max(m, 0) / 60).toFixed(2))} h`;
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/* ---------- small UI parts ---------- */

function Section({ icon: Icon, title, desc, tone = 'blue', children }) {
  const tones = {
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    purple: 'bg-purple-50 text-purple-600',
    emerald: 'bg-emerald-50 text-emerald-600',
  };
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
          <p className="text-xs text-slate-500">{desc}</p>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Stat({ icon: Icon, label, value, tone }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tone}`}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
        <div className="truncate text-lg font-bold text-slate-800">{value}</div>
      </div>
    </div>
  );
}

function DayTimeline({ start, end, lunchStart, lunchEnd }) {
  const os = toMin(start);
  const oe = toMin(end);
  const total = oe - os;
  if (total <= 0) return null;
  const ls = clamp(((toMin(lunchStart) - os) / total) * 100, 0, 100);
  const le = clamp(((toMin(lunchEnd) - os) / total) * 100, 0, 100);
  const lunchOk = le > ls;

  return (
    <div>
      <div className="relative h-8 overflow-hidden rounded-lg bg-blue-500/90">
        {lunchOk && (
          <div
            className="absolute inset-y-0 flex items-center justify-center bg-amber-300 text-[10px] font-semibold text-amber-900"
            style={{ left: `${ls}%`, width: `${le - ls}%` }}
          >
            Lunch
          </div>
        )}
        <span className="absolute inset-y-0 left-2 flex items-center text-[11px] font-semibold text-white">Work</span>
        <span className="absolute inset-y-0 right-2 flex items-center text-[11px] font-semibold text-white">Work</span>
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] font-medium text-slate-500">
        <span>{start}</span>
        <span>{end}</span>
      </div>
    </div>
  );
}

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
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
      <label className="mb-1.5 block text-xs font-medium text-slate-600">{label}</label>
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

        <main className="flex-1 overflow-auto">
          <div className="mx-auto max-w-5xl p-4 md:p-6">
            <div className="mb-5">
              <h2 className="text-xl font-bold text-slate-800">Working Hour Settings</h2>
              <p className="mt-0.5 text-sm text-slate-500">
                Office hours, lunch, weekend and company details used for attendance, OT and PDF.
              </p>
            </div>

            {msg && (
              <div
                className={`mb-5 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${
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

            {!f ? (
              !msg && (
                <div className="space-y-4">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-white" />
                  ))}
                </div>
              )
            ) : (
              <form onSubmit={save} className="space-y-5">
                {/* Summary stats */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Stat icon={Briefcase} label="Total Office Duration" value={hours(total)} tone="bg-blue-50 text-blue-600" />
                  <Stat icon={Utensils} label="Lunch Duration" value={hours(lunch)} tone="bg-amber-50 text-amber-600" />
                  <Stat
                    icon={Hourglass}
                    label="Actual Working Hours"
                    value={hours(total - lunch)}
                    tone="bg-emerald-50 text-emerald-600"
                  />
                </div>

                {/* Office + lunch times */}
                <Section
                  icon={Clock}
                  title="Office & Lunch Time"
                  desc="Working hours and the lunch break that is deducted from them."
                >
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {time('officeStart', 'Office Start Time')}
                    {time('officeEnd', 'Office End Time')}
                    {time('lunchStart', 'Lunch Start Time')}
                    {time('lunchEnd', 'Lunch End Time')}
                  </div>

                  <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      Day preview
                    </div>
                    <DayTimeline
                      start={f.officeStart}
                      end={f.officeEnd}
                      lunchStart={f.lunchStart}
                      lunchEnd={f.lunchEnd}
                    />
                  </div>
                </Section>

                {/* Weekend */}
                <Section
                  icon={CalendarOff}
                  title="Weekend Days"
                  desc="Selected days are treated as weekly holidays in reports."
                  tone="purple"
                >
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                    {WEEKDAYS.map((d, i) => {
                      const on = f.weekendDays.includes(i);
                      return (
                        <label
                          key={d}
                          className={`flex cursor-pointer select-none flex-col items-center gap-1 rounded-xl border px-2 py-3 text-sm font-semibold transition ${
                            on
                              ? 'border-purple-300 bg-purple-50 text-purple-700 shadow-sm'
                              : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={on}
                            onChange={() => toggleDay(i)}
                          />
                          {d}
                          <span className="text-[10px] font-medium">{on ? 'Off' : 'Work'}</span>
                        </label>
                      );
                    })}
                  </div>
                </Section>

                {/* Company */}
                <Section
                  icon={Building2}
                  title="Company Details"
                  desc="Shown in the header of the monthly PDF time card."
                  tone="emerald"
                >
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-slate-600">Company Name</label>
                      <input
                        value={f.companyName}
                        onChange={(e) => set('companyName', e.target.value)}
                        className={input}
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-slate-600">Company Address</label>
                      <input
                        value={f.companyAddress}
                        onChange={(e) => set('companyAddress', e.target.value)}
                        className={input}
                      />
                    </div>
                  </div>
                </Section>

                {/* Sticky save bar */}
                <div className="sticky bottom-0 -mx-4 border-t border-slate-200 bg-white/90 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Info className="h-4 w-4 shrink-0 text-slate-400" />
                      OT grace period is fixed at 15 minutes (not editable).
                    </span>
                    <button
                      disabled={saving}
                      className="flex shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
                    >
                      <Save className="h-4 w-4" />
                      {saving ? 'Saving...' : 'Save Settings'}
                    </button>
                  </div>
                </div>
              </form>
            )}
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