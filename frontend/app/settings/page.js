// frontend/app/settings/page.js

'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { IBM_Plex_Sans } from 'next/font/google';
import { Menu, RefreshCw } from 'lucide-react';
import SideNavBar from '../components/SideNavBar';
import DeviceStatus from '../components/DeviceStatus';
import { formatDateTime, formatClock, useTimeFormat } from '../timeFormat';

const plex = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600'] });

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

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const input =
  'w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm tabular-nums outline-none placeholder:text-zinc-400 focus:border-teal-700 focus:ring-2 focus:ring-teal-700/25';

const toMin = (t) => {
  const [h, m] = String(t || '0:0').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};
const hours = (m) => `${Number((Math.max(m, 0) / 60).toFixed(2))} h`;
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const pad = (n) => String(n).padStart(2, '0');

/* ---------- parts ---------- */

// One settings group: description on the left, fields on the right, divided by a rule.
function Row({ title, desc, children }) {
  return (
    <div className="grid gap-4 border-t border-zinc-200 px-5 py-6 first:border-t-0 md:grid-cols-[220px_1fr] md:gap-8">
      <div>
        <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
        <p className="mt-1 text-sm leading-snug text-zinc-500">{desc}</p>
      </div>
      <div>{children}</div>
    </div>
  );
}

// Office minus lunch equals working time, written as arithmetic.
function Equation({ total, lunch }) {
  const Fig = ({ label, value, strong }) => (
    <div>
      <div className="text-xs text-zinc-500">{label}</div>
      <div className={`tabular-nums ${strong ? 'text-2xl font-semibold text-teal-800' : 'text-xl text-zinc-800'}`}>
        {value}
      </div>
    </div>
  );
  const Op = ({ c }) => <span className="pb-0.5 text-xl text-zinc-300">{c}</span>;
  return (
    <div className="flex flex-wrap items-end gap-x-5 gap-y-2 border-b border-zinc-200 px-5 py-5">
      <Fig label="Office" value={hours(total)} />
      <Op c="−" />
      <Fig label="Lunch" value={hours(lunch)} />
      <Op c="=" />
      <Fig label="Paid working time" value={hours(total - lunch)} strong />
    </div>
  );
}

// A ruler: hour ticks along the office day with the lunch break cut out of the work bar.
function DayRuler({ start, end, lunchStart, lunchEnd }) {
  const os = toMin(start);
  const oe = toMin(end);
  const total = oe - os;
  if (total <= 0) {
    return <p className="text-sm text-red-700">Office end must be later than office start.</p>;
  }
  const pct = (m) => clamp(((m - os) / total) * 100, 0, 100);
  const ls = pct(toMin(lunchStart));
  const le = pct(toMin(lunchEnd));
  const lunchOk = le > ls;

  const ticks = [];
  for (let m = Math.ceil(os / 60) * 60; m <= oe; m += 60) ticks.push(m);
  const every = ticks.length > 12 ? 2 : 1;

  return (
    <div className="pb-5">
      <div className="relative h-7 rounded-sm bg-teal-800">
        {lunchOk && (
          <div
            className="absolute inset-y-0 border-x border-teal-800 bg-white"
            style={{
              left: `${ls}%`,
              width: `${le - ls}%`,
              backgroundImage:
                'repeating-linear-gradient(135deg, transparent 0 4px, rgb(228 228 231) 4px 5px)',
            }}
            title={`Lunch ${lunchStart} – ${lunchEnd}`}
          />
        )}
      </div>
      <div className="relative mt-1 h-8">
        {ticks.map((m, i) => (
          <div
            key={m}
            className="absolute top-0 -translate-x-1/2 text-center"
            style={{ left: `${pct(m)}%` }}
          >
            <div className="mx-auto h-1.5 w-px bg-zinc-400" />
            {i % every === 0 && (
              <div className="mt-0.5 text-[11px] tabular-nums text-zinc-500">
                {formatClock(`${pad(Math.floor(m / 60))}:00`)}
              </div>
            )}
          </div>
        ))}
      </div>
      <p className="mt-1 text-xs text-zinc-500">
        Works {formatClock(start)}–{formatClock(lunchOk ? lunchStart : end)}
        {lunchOk && `, lunch until ${formatClock(lunchEnd)}, works until ${formatClock(end)}`}.
      </p>
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const path = usePathname();
  const [timeFormat, setTimeFormat] = useTimeFormat();

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
      setMsg({ type: 'ok', text: 'Working-hour settings saved. Attendance and OT calculations now use these values.' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setMsg({ type: 'err', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const total = f ? toMin(f.officeEnd) - toMin(f.officeStart) : 0;
  const lunch = f ? toMin(f.lunchEnd) - toMin(f.lunchStart) : 0;
  const round = f ? clamp(Number(f.otRoundMin ?? 15) || 0, 0, 59) : 15;
  const hhmm = (m) => `${Math.floor(m / 60)}:${pad(m % 60)}`;

  const time = (k, label) => (
    <label className="block">
      <span className="mb-1 block text-sm text-zinc-700">{label}</span>
      <input type="time" required value={f[k]} onChange={(e) => set(k, e.target.value)} className={input} />
    </label>
  );

  if (!ready) return null;

  return (
    <div className={`${plex.className} flex h-screen bg-zinc-100 text-zinc-800`}>
      <SideNavBar
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        onLogout={logout}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-zinc-300 bg-white px-4 md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="rounded p-1.5 text-zinc-600 hover:bg-zinc-100 md:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <button
              onClick={() => setCollapsed((c) => !c)}
              className="hidden rounded p-1.5 text-zinc-600 hover:bg-zinc-100 md:block"
              title="Toggle sidebar"
              aria-label="Toggle sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="truncate text-base font-semibold text-zinc-900">Settings</h1>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <DeviceStatus />
            <span className="hidden text-xs text-zinc-500 sm:block">
              Last synced <span className="tabular-nums text-zinc-700">{fmtSyncTime(lastSync) || 'never'}</span>
            </span>

            <button
              onClick={() => sync(false)}
              disabled={syncing}
              title="Sync from device"
              className="flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{syncing ? 'Syncing…' : 'Sync'}</span>
            </button>

            <button onClick={logout} className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
              Log out
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <div className="mx-auto max-w-4xl p-4 md:p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold tracking-tight text-zinc-900">Working hours</h2>
              <p className="mt-1 max-w-xl text-sm text-zinc-500">
                Office hours, lunch break, weekends and company details. Attendance, overtime and the PDF time card
                all read from here.
              </p>
            </div>

            {msg && (
              <div
                role="status"
                className={`mb-6 border-l-4 bg-white px-4 py-3 text-sm ${
                  msg.type === 'ok' ? 'border-teal-700 text-zinc-800' : 'border-red-600 text-red-800'
                }`}
              >
                {msg.text}
              </div>
            )}

            {!f ? (
              !msg && <div className="h-72 animate-pulse rounded-md border border-zinc-200 bg-white" />
            ) : (
              <form onSubmit={save}>
                <div className="rounded-md border border-zinc-300 bg-white">
                  <Equation total={total} lunch={lunch} />

                  <Row title="Office and lunch" desc="Lunch is deducted from the office day.">
                    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                      {time('officeStart', 'Office start')}
                      {time('officeEnd', 'Office end')}
                      {time('lunchStart', 'Lunch start')}
                      {time('lunchEnd', 'Lunch end')}
                    </div>
                    <div className="mt-6">
                      <DayRuler
                        start={f.officeStart}
                        end={f.officeEnd}
                        lunchStart={f.lunchStart}
                        lunchEnd={f.lunchEnd}
                      />
                    </div>
                  </Row>

                  <Row title="Time format" desc="Choose how clock times are displayed throughout the app and in monthly PDFs.">
                    <div className="flex flex-wrap gap-3">
                      {[
                        ['12-hour', '12-hour (AM/PM)'],
                        ['24-hour', '24-hour'],
                      ].map(([value, label]) => (
                        <label
                          key={value}
                          className={`flex cursor-pointer items-center gap-2 rounded-md border px-4 py-2 text-sm ${
                            timeFormat === value
                              ? 'border-teal-700 bg-teal-50 text-teal-900'
                              : 'border-zinc-300 text-zinc-700 hover:bg-zinc-50'
                          }`}
                        >
                          <input
                            type="radio"
                            name="timeFormat"
                            value={value}
                            checked={timeFormat === value}
                            onChange={() => setTimeFormat(value)}
                            className="accent-teal-800"
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-zinc-500">Saved in this browser and applied immediately.</p>
                  </Row>

                  <Row title="Weekend" desc="Days marked off are weekly holidays in reports.">
                    <div role="group" aria-label="Weekend days" className="flex overflow-hidden rounded-md border border-zinc-300">
                      {WEEKDAYS.map((d, i) => {
                        const on = f.weekendDays.includes(i);
                        return (
                          <label
                            key={d}
                            className={`flex-1 cursor-pointer select-none border-l border-zinc-300 py-2.5 text-center text-sm first:border-l-0 focus-within:ring-2 focus-within:ring-inset focus-within:ring-teal-700 ${
                              on ? 'bg-teal-800 font-medium text-white' : 'bg-white text-zinc-600 hover:bg-zinc-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="sr-only"
                              checked={on}
                              onChange={() => toggleDay(i)}
                            />
                            {d}
                          </label>
                        );
                      })}
                    </div>
                    <p className="mt-2 text-xs text-zinc-500">
                      {f.weekendDays.length
                        ? `Off: ${f.weekendDays.map((i) => WEEKDAYS[i]).join(', ')}`
                        : 'No weekly day off selected.'}
                    </p>
                  </Row>

                  <Row
                    title="Overtime"
                    desc="Overtime is paid in full hours. Leftover minutes are rounded up to the next hour only when they are within this threshold of it."
                  >
                    <label className="block max-w-xs">
                      <span className="mb-1 block text-sm text-zinc-700">Rounding threshold</span>
                      <div className="relative">
                        <input
                          type="number"
                          required
                          min="0"
                          max="59"
                          step="1"
                          value={f.otRoundMin ?? 15}
                          onChange={(e) =>
                            set('otRoundMin', e.target.value === '' ? '' : Number(e.target.value))
                          }
                          className={`${input} pr-12`}
                        />
                        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-zinc-500">
                          min
                        </span>
                      </div>
                    </label>
                    <div className="mt-3 max-w-md text-xs text-zinc-500">
                      <p>
                        Leftover overtime rounds up to the next full hour when it is at least{' '}
                        <span className="font-medium text-zinc-700 tabular-nums">{60 - round} min</span>{' '}
                        past the hour{round === 0 ? ' (exact hours only)' : ''}.
                      </p>
                      <p className="mt-1 tabular-nums">
                        Example: {hhmm(120 - round)} counts as 2 hours, {hhmm(119 - round)} stays 1 hour.
                      </p>
                    </div>
                  </Row>

                  <Row title="Company" desc="Printed at the top of each monthly PDF time card.">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block">
                        <span className="mb-1 block text-sm text-zinc-700">Name</span>
                        <input
                          value={f.companyName}
                          onChange={(e) => set('companyName', e.target.value)}
                          className={input}
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-sm text-zinc-700">Address</span>
                        <input
                          value={f.companyAddress}
                          onChange={(e) => set('companyAddress', e.target.value)}
                          className={input}
                        />
                      </label>
                    </div>
                  </Row>
                </div>

                <div className="sticky bottom-0 -mx-4 mt-6 flex items-center justify-between gap-3 border-t border-zinc-300 bg-zinc-100/95 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
                  <span className="text-sm text-zinc-500 tabular-nums">
                    OT rounding threshold: {round} minutes.
                  </span>
                  <button
                    disabled={saving}
                    className="shrink-0 rounded-md bg-teal-800 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-900 focus:outline-none focus:ring-2 focus:ring-teal-700 focus:ring-offset-2 focus:ring-offset-zinc-100 disabled:opacity-60"
                  >
                    {saving ? 'Saving…' : 'Save changes'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </main>
      </div>

      {toast && (
        <div
          role="status"
          className={`fixed bottom-4 right-4 z-50 max-w-sm rounded-md px-4 py-3 text-sm text-white shadow-lg ${
            toast.err ? 'bg-red-700' : 'bg-zinc-900'
          }`}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}