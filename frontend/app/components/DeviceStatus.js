'use client';

import { useEffect, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API || 'http://localhost:5000';
const STATUS_INTERVAL = 30000;

export default function DeviceStatus() {
  const [status, setStatus] = useState(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let active = true;
    let timeout;

    const checkStatus = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API}/api/status`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          cache: 'no-store',
        });

        if (response.status === 401) {
          active = false;
          localStorage.removeItem('token');
          window.location.href = '/login';
          return;
        }

        if (!response.ok) throw new Error(`Status request failed (HTTP ${response.status})`);
        const data = await response.json();
        if (active) {
          setStatus(data);
          setUnavailable(false);
        }
      } catch {
        if (active) setUnavailable(true);
      } finally {
        if (active) timeout = setTimeout(checkStatus, STATUS_INTERVAL);
      }
    };

    checkStatus();
    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, []);

  const connected = status?.connected;
  const label = unavailable
    ? 'Status unavailable'
    : connected === undefined
      ? 'Checking device'
      : connected
        ? 'Device connected'
        : 'Device disconnected';
  const color = unavailable || connected === undefined
    ? 'bg-slate-50 text-slate-600'
    : connected
      ? 'bg-emerald-50 text-emerald-700'
      : 'bg-red-50 text-red-700';
  const dot = unavailable || connected === undefined
    ? 'bg-slate-400'
    : connected
      ? 'bg-emerald-500'
      : 'bg-red-500';

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${color}`}
      title={status?.error || label}
      role="status"
      aria-live="polite"
    >
      <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden="true" />
      {label}
    </span>
  );
}
