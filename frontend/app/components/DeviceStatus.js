'use client';

import { useEffect, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API || 'http://localhost:5000';
const STATUS_INTERVAL = 30000;

export default function DeviceStatus({ compact = false }) {
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

  const connected = unavailable ? undefined : status?.connected;
  const where = status?.ip ? ` (${status.ip})` : '';
  const label = unavailable
    ? 'Status unavailable'
    : connected === undefined
      ? 'Checking device'
      : connected
        ? `Device connected${where}`
        : `Device disconnected${where}`;

  const dot =
    unavailable || connected === undefined ? 'bg-slate-400' : connected ? 'bg-emerald-500' : 'bg-red-500';
  const text =
    unavailable || connected === undefined ? 'text-slate-500' : connected ? 'text-emerald-700' : 'text-red-700';

  if (compact) {
    return (
      <span
        className="inline-flex items-center justify-center"
        title={status?.error || label}
        role="status"
        aria-live="polite"
      >
        <span className={`h-2.5 w-2.5 rounded-full ${dot}`} aria-hidden="true" />
        <span className="sr-only">{label}</span>
      </span>
    );
  }

  return (
    <span
      className={`flex items-start gap-2 text-[11px] font-medium leading-snug ${text}`}
      title={status?.error || label}
      role="status"
      aria-live="polite"
    >
      <span className={`mt-[3px] h-2 w-2 shrink-0 rounded-full ${dot}`} aria-hidden="true" />
      <span className="min-w-0 break-words">{label}</span>
    </span>
  );
}
