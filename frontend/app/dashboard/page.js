// frontend/app/dashboard/page.js

'use client';
import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Trash2 } from 'lucide-react';
import AppShell from '../components/AppShell';
import { api } from '../../lib/api';
import { runSync, SYNC_EVENT } from '../../lib/sync';

const today = () => new Date().toLocaleDateString('en-CA');
const time = (d) =>
  d ? new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—';
const dateTime = (d) =>
  new Date(d).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' });

const statusColor = {
  Present: 'text-green-600',
  Absent: 'text-red-600',
  'Missing Out': 'text-amber-600',
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
  const [tab, setTab] = useState('daily');
  const [date, setDate] = useState(today());
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState(null);
  const [msg, setMsg] = useState(null);
  const [syncing, setSyncing] = useState(false);

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

  return (
    <AppShell title="Dashboard">
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
    </AppShell>
  );
}