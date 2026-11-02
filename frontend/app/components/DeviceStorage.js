// frontend/app/components/DeviceStorage.js
// Device-er log memory board: total capacity, used, remaining ar usage bar.
// Shob number ashe /api/status theke, jeta device-er getInfo() theke asha
// logCounts / logCapacity ferot dey.
//
// Ekhane device-er log clear korar option-o ache. Dashboard-er moto-i 2 step:
//   /api/clear-device/prepare -> DB-te missing log upload + verify (delete nai)
//   /api/clear-device/confirm -> user confirm korle abar verify kore delete

'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Trash2 } from 'lucide-react';
import { formatDateTime } from '../timeFormat';
import { confirmDialog } from '../../lib/dialog';

const API = process.env.NEXT_PUBLIC_API || 'http://localhost:5000';

// status cache backend-e 30s, tai tar cheye beshi beshi device-e jai na
const POLL_MS = 30000;
const SYNC_EVENT = 'attendance:synced';

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const pctOf = (used, cap) => (cap > 0 ? clamp((used / cap) * 100, 0, 100) : 0);
const count = (n) => Number(n).toLocaleString('en-US');
// 200k capacity hole koyekta log 0.00% dekhay, tai chhoto value alada kore likhi
const pctLabel = (p) => {
  if (p === 0) return '0%';
  if (p < 0.01) return '<0.01%';
  return `${p < 1 ? p.toFixed(2) : p.toFixed(1)}%`;
};

async function apiCall(path, options = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const res = await fetch(API + path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    cache: 'no-store',
  });
  if (res.status === 401) {
    localStorage.removeItem('token');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    throw new Error(`API returned a non-JSON response (HTTP ${res.status}). Check the API URL and backend route.`);
  }
  if (!res.ok) throw new Error((data && data.error) || `Request failed (HTTP ${res.status})`);
  return data;
}

function Stat({ label, value, hint }) {
  return (
    <div className="border-l border-zinc-200 pl-5 first:border-l-0 first:pl-0">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-0.5 text-xl font-semibold tabular-nums text-zinc-900">{value}</div>
      <div className="mt-0.5 text-xs text-zinc-500">{hint}</div>
    </div>
  );
}

export default function DeviceStorage() {
  const [status, setStatus] = useState(null);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);
  const [readAt, setReadAt] = useState(null);
  const [clearing, setClearing] = useState(false);
  const [msg, setMsg] = useState(null); // { err, text }

  const load = useCallback(async (fresh = false) => {
    if (fresh) setLoading(true);
    try {
      const data = await apiCall(`/api/status${fresh ? '?fresh=1' : ''}`);
      setStatus(data);
      setErr(null);
      setReadAt(new Date());
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      if (fresh) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(() => load(), POLL_MS);
    // sync shesh hole log count bodlate pare, tai board-o refresh kori
    const onSync = () => load();
    window.addEventListener(SYNC_EVENT, onSync);
    return () => {
      clearInterval(timer);
      window.removeEventListener(SYNC_EVENT, onSync);
    };
  }, [load]);

  // Device log clear — dashboard-er same 2 step flow
  const clearDevice = async () => {
    if (clearing) return;
    setClearing(true);
    setMsg(null);
    try {
      // Step 1: device-er shob log DB-te upload + verify (device theke kichu delete hoy na)
      const p = await apiCall('/api/clear-device/prepare', { method: 'POST' });
      if (!p.logs) {
        setMsg({ text: 'There is no log on the device.' });
        return;
      }
      // notun log upload holo, tai baki page gulo reload hok
      window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: { at: new Date().toISOString() } }));

      // Step 2: user-ke jiggesh
      const ok = await confirmDialog({
        title: 'Delete device logs?',
        lines: [
          `The device holds ${p.logs} log(s).`,
          `Already in the database: ${p.alreadyInDb}`,
          `Newly uploaded: ${p.uploaded}`,
          'Every log is saved and verified in the database.',
          '',
          'Delete all logs from the device now?',
          'This cannot be undone.',
        ],
        confirmText: 'Delete logs',
      });
      if (!ok) {
        setMsg({
          text: `Cancelled. ${p.uploaded} log(s) were saved to the database; the device still keeps its logs.`,
        });
        return;
      }

      // Step 3: delete (server abar verify kore tarpor delete kore)
      const r = await apiCall('/api/clear-device/confirm', {
        method: 'POST',
        body: JSON.stringify({ confirm: 'CLEAR', expectedLogs: p.logs }),
      });
      setMsg({
        text: r.cleared
          ? `${r.logs} log(s) deleted from the device. All of them are safe in the database.`
          : 'Nothing was cleared.',
      });
      load(true); // device storage abar pora
    } catch (e) {
      setMsg({ err: true, text: e.message });
    } finally {
      setClearing(false);
    }
  };

  const info = status?.info || {};
  const capacity = Number(info.logCapacity) || 0;
  const used = Number(info.logCounts) || 0;
  const hasCapacity = capacity > 0;
  const remaining = Math.max(capacity - used, 0);
  const pct = pctOf(used, capacity);
  const bar = pct >= 90 ? 'bg-red-600' : pct >= 70 ? 'bg-amber-500' : 'bg-teal-800';
  const connected = status?.connected;
  const reading = status === null && !err;
  const busy = clearing || loading;

  return (
    <section className="mb-6 rounded-md border border-zinc-300 bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-200 px-5 py-4">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900">Device storage</h3>
          <p className="mt-1 max-w-md text-sm leading-snug text-zinc-500">
            Attendance log memory read from the device{status?.ip ? ` at ${status.ip}` : ''}.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={clearDevice}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-600/30 disabled:opacity-60"
          >
            <Trash2 className={`h-3.5 w-3.5 ${clearing ? 'animate-pulse' : ''}`} aria-hidden="true" />
            {clearing ? 'Working…' : 'Clear device logs'}
          </button>
          <button
            type="button"
            onClick={() => load(true)}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-teal-700/30 disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            {loading ? 'Reading…' : 'Refresh'}
          </button>
        </div>
      </div>

      {msg && (
        <div
          role={msg.err ? 'alert' : 'status'}
          className={`border-b border-zinc-200 px-5 py-3 text-sm ${
            msg.err ? 'bg-red-50 text-red-800' : 'bg-teal-50 text-teal-900'
          }`}
        >
          {msg.text}
        </div>
      )}

      {reading ? (
        <div className="grid grid-cols-2 gap-y-4 px-5 py-5 md:grid-cols-4" aria-hidden="true">
          {['Total log capacity', 'Used storage', 'Remaining capacity', 'Storage usage'].map((l) => (
            <div key={l} className="border-l border-zinc-200 pl-5 text-xs text-zinc-500 first:border-l-0 first:pl-0">
              {l}
              <div className="mt-2 h-6 w-16 animate-pulse rounded bg-zinc-200" />
            </div>
          ))}
        </div>
      ) : !connected ? (
        <div className="px-5 py-5 text-sm text-red-700" role="status">
          Could not read the device. {status?.error || err || 'Device not reachable.'}
        </div>
      ) : !hasCapacity ? (
        <div className="px-5 py-5 text-sm text-zinc-600" role="status">
          The device did not report its log capacity.{err ? ` ${err}` : ''}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-y-4 px-5 py-5 md:grid-cols-4">
            <Stat label="Total log capacity" value={count(capacity)} hint="logs maximum" />
            <Stat label="Used storage" value={count(used)} hint="logs on device" />
            <Stat label="Remaining capacity" value={count(remaining)} hint="logs free" />
            <Stat label="Storage usage" value={pctLabel(pct)} hint="of capacity" />
          </div>
          <div className="px-5 pb-5">
            <div
              className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-200"
              role="progressbar"
              aria-label="Device storage used"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(pct)}
            >
              <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-2 text-xs tabular-nums text-zinc-500">
              {count(used)} of {count(capacity)} logs used
              {readAt ? ` · read ${formatDateTime(readAt.toISOString())}` : ''}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Clearing logs uploads and verifies every log in the database first, then deletes them from the device.
            </p>
          </div>
        </>
      )}
    </section>
  );
}
