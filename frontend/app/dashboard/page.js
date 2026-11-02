// frontend/app/dashboard/page.js

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { RefreshCw, Trash2, Menu } from 'lucide-react';
import { IBM_Plex_Sans } from 'next/font/google';
import SideNavBar from '../components/SideNavBar';
import DeviceStatus from '../components/DeviceStatus';
import { formatDateTime, formatTime, useTimeFormat } from '../timeFormat';
import { confirmDialog } from '../../lib/dialog';

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

// Shob date/time Bangladesh time (Asia/Dhaka) onujayi dekhano hoy.
const TZ = 'Asia/Dhaka';
const todayDhaka = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ }); // yyyy-mm-dd
const fmtDate = (d) => (d ? String(d).slice(0, 10).split('-').reverse().join('-') : '-'); // dd-mm-yyyy
const fmtTime = (d) => formatTime(d, { timeZone: TZ });
const fmtDateTime = (d) => formatDateTime(d, { timeZone: TZ });

const addDays = (s, n) => {
  const d = new Date(`${s}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const dayNum = (s) => s.slice(8, 10);
const dayShort = (s) => new Date(`${s}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' });

/* ---------- shared classes ---------- */
const focus = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700/40';
const inputCls =
  'rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/25';
const btnSecondary = `rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60 ${focus}`;
const btnDanger = `rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 ${focus}`;
const linkBtn = `rounded text-sm font-medium text-teal-800 hover:underline disabled:opacity-60 ${focus}`;
const th = 'px-4 py-2.5 font-medium whitespace-nowrap';
const td = 'px-4 py-2.5 align-top';

/* ---------- colors (chart) ---------- */
const C = {
  present: '#115e59', // teal-800
  grid: '#e4e4e7', // zinc-200
  text: '#71717a', // zinc-500
  strong: '#18181b', // zinc-900
};

/* ---------- data helpers ---------- */
const OFF = new Set(['Holiday', 'Weekend', 'Not Joined']);
const LEAVES = new Set(['CL', 'SL', 'EL']);

// Ek din-er daily rows theke ginti
function tally(rows) {
  const t = { employees: rows.length, present: 0, missing: 0, absent: 0, leave: 0, off: 0, ot: 0 };
  for (const r of rows) {
    if (r.status === 'Present') t.present++;
    else if (r.status === 'Missing Out') t.missing++;
    else if (r.status === 'Absent') t.absent++;
    else if (LEAVES.has(r.status)) t.leave++;
    else if (OFF.has(r.status)) t.off++;
    t.ot += (r.otFinalMinutes || 0) / 60;
  }
  t.ot = Number(t.ot.toFixed(1));
  t.counted = t.present + t.missing + t.absent + t.leave; // working-day-te jader hisab hoy
  t.attended = t.present + t.missing;
  t.rate = t.counted ? Number(((t.attended / t.counted) * 100).toFixed(1)) : null;
  return t;
}

/* ---------- SVG charts (kono extra package lage na) ---------- */
// value null hole line bhenge jay (holiday/weekend)
function LineChart({ data, ariaLabel }) {
  const W = 640;
  const H = 230;
  const pl = 34;
  const pr = 12;
  const pt = 14;
  const pb = 38;
  const iw = W - pl - pr;
  const ih = H - pt - pb;
  const slot = iw / data.length;
  const x = (i) => pl + slot * i + slot / 2;
  const y = (v) => pt + ih - (v / 100) * ih;

  // null diye bhag kora segment
  const segs = [];
  let cur = [];
  data.forEach((d, i) => {
    if (d.value == null) {
      if (cur.length) segs.push(cur);
      cur = [];
    } else cur.push([i, d.value]);
  });
  if (cur.length) segs.push(cur);

  const showAll = data.length <= 7;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={ariaLabel}>
      {[0, 25, 50, 75, 100].map((v) => (
        <g key={v}>
          <line x1={pl} x2={W - pr} y1={y(v)} y2={y(v)} stroke={C.grid} strokeWidth="1" />
          <text x={pl - 6} y={y(v) + 3} textAnchor="end" fontSize="10" fill={C.text}>
            {v}%
          </text>
        </g>
      ))}
      {segs.map((seg, k) =>
        seg.length > 1 ? (
          <polyline
            key={k}
            points={seg.map(([i, v]) => `${x(i)},${y(v)}`).join(' ')}
            fill="none"
            stroke={C.present}
            strokeWidth="2"
            strokeLinejoin="round"
          />
        ) : null
      )}
      {data.map((d, i) => {
        const last = i === data.length - 1;
        return (
          <g key={d.date}>
            {d.value != null && (
              <>
                <circle cx={x(i)} cy={y(d.value)} r="3.5" fill={C.present}>
                  <title>{`${fmtDate(d.date)} - Attendance: ${d.value}%`}</title>
                </circle>
                {(showAll || last) && (
                  <text x={x(i)} y={y(d.value) - 8} textAnchor="middle" fontSize="10" fill={C.strong} fontWeight="600">
                    {d.value}%
                  </text>
                )}
              </>
            )}
            <text x={x(i)} y={H - 22} textAnchor="middle" fontSize="10" fill={last ? C.strong : C.text} fontWeight={last ? 600 : 400}>
              {dayNum(d.date)}
            </text>
            <text x={x(i)} y={H - 9} textAnchor="middle" fontSize="9" fill={C.text}>
              {dayShort(d.date)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function Panel({ title, note, children }) {
  return (
    <section className="rounded-md border border-zinc-300 bg-white">
      <div className="border-b border-zinc-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
        {note && <p className="mt-0.5 text-xs text-zinc-500">{note}</p>}
      </div>
      <div className="px-4 py-3">{children}</div>
    </section>
  );
}

// Department-wise: registered shob department dekhay (data na thakleo). Kotojon attend korlo / hisab-er moddhe
function DeptBars({ rows }) {
  const map = new Map();
  for (const r of rows) {
    const k = (r.department || '').trim() || 'Unassigned';
    const g = map.get(k) || { name: k, registered: 0, counted: 0, attended: 0 };
    g.registered++;
    const counted = r.status === 'Present' || r.status === 'Missing Out' || r.status === 'Absent' || LEAVES.has(r.status);
    if (counted) {
      g.counted++;
      if (r.status === 'Present' || r.status === 'Missing Out') g.attended++;
    }
    map.set(k, g);
  }
  // A-Z, Unassigned shobar shesh-e
  const list = [...map.values()].sort((a, b) => {
    if (a.name === 'Unassigned') return 1;
    if (b.name === 'Unassigned') return -1;
    return a.name.localeCompare(b.name);
  });
  const max = Math.max(1, ...list.map((g) => g.counted));

  if (!list.length) {
    return <p className="py-10 text-center text-sm text-zinc-500">No registered employees yet.</p>;
  }

  return (
    <ul className="max-h-[26rem] space-y-2.5 overflow-y-auto pr-1">
      {list.map((g) => (
        <li key={g.name}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate text-zinc-800">
              {g.name}
              <span className="ml-2 text-xs text-zinc-500 tabular-nums">{g.registered} registered</span>
            </span>
            <span className="shrink-0 text-zinc-500 tabular-nums">
              {g.counted ? (
                <>
                  <span className="font-medium text-zinc-900">{g.attended}</span> / {g.counted}
                </>
              ) : (
                'No record'
              )}
            </span>
          </div>
          <div
            className="h-3 bg-zinc-100"
            style={{ width: g.counted ? `${(g.counted / max) * 100}%` : '100%' }}
            role="img"
            aria-label={
              g.counted
                ? `${g.name}: ${g.attended} of ${g.counted} attended`
                : `${g.name}: no working-day record for this date`
            }
          >
            {g.counted > 0 && <div className="h-full bg-teal-800" style={{ width: `${(g.attended / g.counted) * 100}%` }} />}
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function Dashboard() {
  useTimeFormat();
  const router = useRouter();
  const path = usePathname();

  const [date, setDate] = useState(todayDhaka());
  const [range, setRange] = useState(7);
  const [trend, setTrend] = useState([]);
  const [rows, setRows] = useState([]); // selected date-er daily rows
  const [loadingTrend, setLoadingTrend] = useState(false);
  const [tab, setTab] = useState('daily');
  const [tabRows, setTabRows] = useState([]);
  const [status, setStatus] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false); // page-er Sync / Clear
  const [tick, setTick] = useState(0); // sync hole data reload korar jonno
  const cache = useRef(new Map());
  const reqId = useRef(0);

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

  const headerSync = async () => {
    if (shellSyncing) return;
    setShellSyncing(true);
    try {
      const r = await runSync();
      setToast({ text: `Synced: ${r.written} new punches (${r.logs} logs on device).` });
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

  // Ek din-er daily data. Ager din-er data cache hoy; ajker data cache hoy na.
  const fetchDay = useCallback(async (d) => {
    const cached = cache.current.get(d);
    if (cached) return cached;
    const r = await api(`/api/daily?date=${d}`);
    if (d < todayDhaka()) cache.current.set(d, r);
    return r;
  }, []);

  // Trend: selected date-er pichone `range` din
  useEffect(() => {
    const my = ++reqId.current;
    (async () => {
      setLoadingTrend(true);
      try {
        const dates = Array.from({ length: range }, (_, i) => addDays(date, i - (range - 1)));
        const all = await Promise.all(dates.map(fetchDay));
        if (my !== reqId.current) return;
        setTrend(dates.map((d, i) => ({ date: d, ...tally(all[i]) })));
        setRows(all[all.length - 1]);
      } catch (e) {
        if (my === reqId.current) setMsg({ err: true, text: e.message });
      } finally {
        if (my === reqId.current) setLoadingTrend(false);
      }
    })();
  }, [date, range, tick, fetchDay]);

  // Punch logs / employees tab
  useEffect(() => {
    if (tab === 'daily') return;
    let cancelled = false;
    (async () => {
      try {
        const r = await api(tab === 'logs' ? `/api/logs?date=${date}` : '/api/employees');
        if (!cancelled) setTabRows(r);
      } catch (e) {
        if (!cancelled) setMsg({ err: true, text: e.message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, date, tick]);

  const checkStatus = useCallback(async () => {
    try {
      setStatus(await api('/api/status'));
    } catch { }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Header-er Sync button ba ei page-er Sync, jekono jaygay sync hole auto reload
  useEffect(() => {
    const h = () => {
      cache.current.clear();
      setTick((t) => t + 1);
      checkStatus();
    };
    window.addEventListener(SYNC_EVENT, h);
    return () => window.removeEventListener(SYNC_EVENT, h);
  }, [checkStatus]);

  async function sync() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await runSync(); // event fire hobe, data auto reload hobe
      setMsg({ text: `Sync complete: ${r.written} new punches saved (${r.logs} logs on device).` });
    } catch (e) {
      setMsg({ err: true, text: `Sync failed: ${e.message}` });
    }
    setBusy(false);
  }

  // Device log clear: age missing log upload + verify, tarpor user confirm korle delete
  async function clearDevice() {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      // Step 1: missing log upload + verify (delete hoy na)
      const p = await api('/api/clear-device/prepare', { method: 'POST' });
      if (!p.logs) {
        setMsg({ text: 'There is no log on the device.' });
        return;
      }
      window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: { at: new Date().toISOString() } }));

      // Step 2: user-ke jiggesh
      const ok = await confirmDialog({
        title: 'Delete device logs?',
        lines: [
          `Device-e ${p.logs} ta log ache.`,
          `DB-te age theke chilo: ${p.alreadyInDb}`,
          `Notun upload holo: ${p.uploaded}`,
          'Sob log DB-te verified.',
          '',
          'Ebar device theke shob log DELETE korbo?',
          'Eta undo kora jay na.',
        ],
        confirmText: 'Delete logs',
      });
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
      setBusy(false);
    }
  }

  if (!ready) return null;

  const today = trend.length ? trend[trend.length - 1] : null;
  const isOffDay = today && today.counted === 0;
  const kpis = today
    ? [
        ['Employees', today.employees, 'text-zinc-900'],
        ['Present', today.attended, 'text-teal-800'],
        ['Absent', today.absent, today.absent > 0 ? 'text-red-700' : 'text-zinc-900'],
        ['Missing out', today.missing, today.missing > 0 ? 'text-red-700' : 'text-zinc-900'],
        ['On leave', today.leave, 'text-zinc-900'],
        ['Holiday / off', today.off, 'text-zinc-900'],
        ['OT hours', today.ot, 'text-teal-800'],
        ['Attendance', today.rate == null ? '-' : `${today.rate}%`, 'text-zinc-900'],
      ]
    : [];

  const statusTone = (st) => (st === 'Absent' || st === 'Missing Out' ? 'font-medium text-red-700' : 'font-medium');

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
            <h1 className="truncate text-sm font-semibold text-zinc-900">Dashboard</h1>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <DeviceStatus />
            <span className="hidden text-sm text-zinc-500 tabular-nums sm:inline">
              Last synced {fmtSyncTime(lastSync) || 'not yet'}
            </span>
            <button onClick={headerSync} disabled={shellSyncing} className={`${btnSecondary} flex items-center gap-2 py-1.5`}>
              <RefreshCw className={`h-4 w-4 ${shellSyncing ? 'animate-spin motion-reduce:animate-none' : ''}`} />
              {shellSyncing ? 'Syncing' : 'Sync'}
            </button>
            <button onClick={logout} className={linkBtn}>
              Log out
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-8">
          <div className="max-w-6xl">
            {/* Title + date */}
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold text-zinc-900">Attendance overview</h2>
                <p className="mt-1 text-sm text-zinc-500 tabular-nums">
                  {fmtDate(date)}
                  {loadingTrend ? ', loading' : ''}
                  {isOffDay ? ', no working-day records (holiday, weekend or no data)' : ''}
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm text-zinc-700">
                Date
                <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className={inputCls} />
              </label>
            </div>

            {/* Device bar */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-zinc-300 bg-white px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-zinc-700">
                <span
                  className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${
                    status ? (status.connected ? 'bg-teal-700' : 'bg-red-700') : 'bg-zinc-400'
                  }`}
                />
                <span className="break-words tabular-nums">
                  {status
                    ? status.connected
                      ? `Device connected (${status.ip}:${status.port})`
                      : `Device disconnected (${status.ip}:${status.port})`
                    : 'Checking device connection'}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={sync} disabled={busy} className={`${btnSecondary} flex items-center gap-2`}>
                  <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin motion-reduce:animate-none' : ''}`} />
                  {busy ? 'Working' : 'Sync from device'}
                </button>
                <button onClick={clearDevice} disabled={busy} className={`${btnDanger} flex items-center gap-2`}>
                  <Trash2 className="h-4 w-4" />
                  Clear device logs
                </button>
              </div>
            </div>

            {msg && (
              <div
                role={msg.err ? 'alert' : 'status'}
                className={`mb-4 rounded-md border border-l-4 border-zinc-300 bg-white px-4 py-3 text-sm ${
                  msg.err ? 'border-l-red-700 text-red-700' : 'border-l-teal-700 text-zinc-800'
                }`}
              >
                {msg.text}
              </div>
            )}
            {status && !status.connected && (
              <div role="alert" className="mb-4 rounded-md border border-l-4 border-zinc-300 border-l-red-700 bg-white px-4 py-3 text-sm text-red-700">
                Unable to connect to the device: {status.error}
              </div>
            )}

            {/* KPI strip */}
            {today && (
              <div
                role="group"
                aria-label="Summary for selected date"
                className="mb-5 grid grid-cols-2 gap-px border border-zinc-300 bg-zinc-200 sm:grid-cols-4 lg:grid-cols-8"
              >
                {kpis.map(([label, value, tone]) => (
                  <div key={label} className="bg-white px-3 py-2.5">
                    <div className="text-xs text-zinc-500">{label}</div>
                    <div className={`text-xl font-semibold tabular-nums ${tone}`}>{value}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Range */}
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-zinc-900">Trends</h3>
              <div role="radiogroup" aria-label="Chart range" className="inline-flex overflow-hidden rounded-md border border-zinc-300 bg-white">
                {[7, 14].map((n, i) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={range === n}
                    onClick={() => setRange(n)}
                    className={`px-3 py-1.5 text-sm font-medium ${i > 0 ? 'border-l border-zinc-300' : ''} ${
                      range === n ? 'bg-teal-800 text-white' : 'text-zinc-700 hover:bg-zinc-50'
                    } ${focus}`}
                  >
                    Last {n} days
                  </button>
                ))}
              </div>
            </div>

            {/* Charts */}
            <div className="mb-6 grid gap-4 lg:grid-cols-2">
              <Panel title="Attendance rate" note="Present divided by employees counted that day (leave and absent included).">
                {trend.length ? (
                  <LineChart
                    data={trend.map((d) => ({ date: d.date, value: d.rate }))}
                    ariaLabel={`Attendance rate for the last ${range} days, ending ${fmtDate(date)}`}
                  />
                ) : (
                  <p className="py-16 text-center text-sm text-zinc-500">{loadingTrend ? 'Loading' : 'No data.'}</p>
                )}
              </Panel>

              <Panel title="Department attendance" note={`Attended out of counted employees on ${fmtDate(date)}. All registered departments.`}>
                <DeptBars rows={rows} />
              </Panel>
            </div>

            {/* Tabs */}
            <div className="mb-3 flex flex-wrap gap-1 border-b border-zinc-300" role="tablist">
              {[
                ['daily', 'Daily attendance'],
                ['logs', 'Punch logs'],
                ['users', 'Employees'],
              ].map(([k, label]) => (
                <button
                  key={k}
                  role="tab"
                  aria-selected={tab === k}
                  onClick={() => {
                    setTab(k);
                    if (k !== 'daily') setTabRows([]);
                  }}
                  className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
                    tab === k ? 'border-teal-800 text-teal-900' : 'border-transparent text-zinc-600 hover:text-zinc-900'
                  } ${focus}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Table */}
            <div className="overflow-hidden rounded-md border border-zinc-300 bg-white">
              <div className="overflow-x-auto">
                {tab === 'daily' ? (
                  rows.length === 0 ? (
                    <div className="px-4 py-12 text-center text-sm text-zinc-500">
                      No attendance records found for this date. Use Sync from device to retrieve records.
                    </div>
                  ) : (
                    <table className="w-full min-w-[720px] text-left text-sm">
                      <thead className="border-b border-zinc-300 bg-zinc-50 text-zinc-500">
                        <tr>
                          {['Emp ID', 'Device ID', 'Name', 'Check-in', 'Check-out', 'Hours', 'Punches', 'Status'].map((h) => (
                            <th key={h} className={th}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200">
                        {rows.map((r) => {
                          const quiet = OFF.has(r.status);
                          return (
                            <tr key={r._id} className={`tabular-nums ${quiet ? 'bg-zinc-50 text-zinc-500' : 'text-zinc-800'}`}>
                              <td className={`${td} font-medium`}>{r.employeeId}</td>
                              <td className={td}>{r.proximityId || '-'}</td>
                              <td className={td}>{r.name}</td>
                              <td className={td}>{fmtTime(r.inTime)}</td>
                              <td className={td}>{fmtTime(r.outTime)}</td>
                              <td className={td}>{r.hours ?? '-'}</td>
                              <td className={td}>{r.punches || '-'}</td>
                              <td className={td}>
                                {r.status ? (
                                  <>
                                    <span className={statusTone(r.status)}>
                                      {r.status === 'Missing Out' ? 'Missing check-out' : r.status}
                                    </span>
                                    {r.holidayName && <div className="truncate text-xs text-zinc-500">{r.holidayName}</div>}
                                  </>
                                ) : (
                                  '-'
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )
                ) : tabRows.length === 0 ? (
                  <div className="px-4 py-12 text-center text-sm text-zinc-500">
                    {tab === 'users' ? 'No employees found.' : 'No punch logs found for this date.'}
                  </div>
                ) : tab === 'logs' ? (
                  <table className="w-full min-w-[480px] text-left text-sm">
                    <thead className="border-b border-zinc-300 bg-zinc-50 text-zinc-500">
                      <tr>
                        {['Device ID', 'Name', 'Timestamp'].map((h) => (
                          <th key={h} className={th}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 text-zinc-800 tabular-nums">
                      {tabRows.map((r) => (
                        <tr key={r._id}>
                          <td className={`${td} font-medium`}>{r.userId}</td>
                          <td className={td}>{r.name || '-'}</td>
                          <td className={td}>{fmtDateTime(r.timestamp)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <table className="w-full min-w-[480px] text-left text-sm">
                    <thead className="border-b border-zinc-300 bg-zinc-50 text-zinc-500">
                      <tr>
                        {['Emp ID', 'Device ID', 'Name', 'Department'].map((h) => (
                          <th key={h} className={th}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 text-zinc-800 tabular-nums">
                      {tabRows.map((r) => (
                        <tr key={r._id}>
                          <td className={`${td} font-medium`}>{r.employeeId}</td>
                          <td className={td}>{r.proximityId || '-'}</td>
                          <td className={td}>{r.name}</td>
                          <td className={td}>{r.department || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
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