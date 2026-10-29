// frontend/app/dashboard/page.js

'use client';
import { useEffect, useState, useCallback } from 'react';
import AppShell from '../components/AppShell';
import { api } from '../../lib/api';

const today = () => new Date().toLocaleDateString('en-CA');
const time = (d) => (d ? new Date(d).toLocaleTimeString('en-GB') : '—');
const dateTime = (d) => new Date(d).toLocaleString('en-GB');

export default function Dashboard() {
  const [tab, setTab] = useState('daily');
  const [date, setDate] = useState(today());
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState(null);
  const [msg, setMsg] = useState(null);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    try {
      const path = tab === 'daily' ? `/api/daily?date=${date}` : tab === 'logs' ? `/api/logs?date=${date}` : '/api/employees';
      setRows(await api(path));
    } catch (e) { setMsg({ err: true, text: e.message }); }
  }, [tab, date]);

  const checkStatus = useCallback(async () => {
    try { setStatus(await api('/api/status')); } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { checkStatus(); }, [checkStatus]);

  async function sync() {
    setSyncing(true); setMsg(null);
    try {
      const r = await api('/api/sync', { method: 'POST' });
      setMsg({ text: `Sync complete: ${r.users} users and ${r.logs} attendance logs retrieved.` });
      load(); checkStatus();
    } catch (e) { setMsg({ err: true, text: `Sync failed: ${e.message}` }); }
    setSyncing(false);
  }

  return (
    <AppShell title="Dashboard">
      <div className="top">
        <div className="status">
          <span className={`dot ${status ? (status.connected ? 'on' : 'off') : ''}`} />
          {status ? (status.connected ? `Device connected (${status.ip}:${status.port})` : `Device disconnected (${status.ip}:${status.port})`) : 'Checking device connection...'}
        </div>
        <div className="actions">
          <button onClick={sync} disabled={syncing}>{syncing ? 'Syncing...' : 'Sync from Device'}</button>
        </div>
      </div>

      <div className="tabs">
        {[['daily', 'Daily Attendance'], ['logs', 'Punch Logs'], ['users', 'Device Users']].map(([k, label]) => (
          <button key={k} className={`tab ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>

      {msg && <p className={`msg ${msg.err ? 'err' : ''}`}>{msg.text}</p>}
      {status && !status.connected && <p className="msg err">Unable to connect to the device: {status.error}</p>}

      {tab !== 'users' && (
        <div className="bar">
          <label>Date <input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        </div>
      )}

      <div className="table-wrap">
        {rows.length === 0 ? (
          <div className="empty">
            {tab === 'users' ? 'No employees found.' : 'No attendance records found for this date. Use "Sync from Device" to retrieve records.'}
          </div>
        ) : tab === 'daily' ? (
          <table>
            <thead><tr><th>Employee ID</th><th>Name</th><th>Check-in</th><th>Check-out</th><th>Hours</th><th>Punches</th><th>Status</th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r._id}>
                <td>{r.employeeId}</td><td>{r.name}</td><td>{time(r.inTime)}</td><td>{time(r.outTime)}</td>
                <td>{r.hours ?? '—'}</td><td>{r.punches}</td>
                <td className={r.status === 'Present' ? '' : 'warn'}>
                  {r.status === 'Missing Out' ? 'Missing check-out' : r.status}
                </td>
              </tr>))}
            </tbody>
          </table>
        ) : tab === 'logs' ? (
          <table>
            <thead><tr><th>Device User ID</th><th>Name</th><th>Timestamp</th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r._id}><td>{r.userId}</td><td>{r.name}</td><td>{dateTime(r.timestamp)}</td></tr>))}
            </tbody>
          </table>
        ) : (
          <table>
            <thead><tr><th>Device User ID</th><th>Name</th></tr></thead>
            <tbody>{rows.map((r) => (<tr key={r._id}><td>{r.proximityId}</td><td>{r.name}</td></tr>))}</tbody>
          </table>
        )}
      </div>
    </AppShell>
  );
}
