// frontend/app/components/SideNavBar.js

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  LogOut,
  X,
  Menu,
  Settings,
  CalendarDays,
  CalendarCheck,
  FileText,
  ClipboardList,
  RefreshCw,
} from 'lucide-react';
import DeviceStatus from './DeviceStatus';
import { formatDateTime } from '../timeFormat';

const API = process.env.NEXT_PUBLIC_API || 'http://localhost:5000';
const LAST_SYNC_KEY = 'lastSync';
const SYNC_EVENT = 'attendance:synced';

const menu = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/employees', label: 'Employees', icon: Users },
  { href: '/attendance', label: 'Attendance Register', icon: ClipboardList },
  { href: '/reports', label: 'Attendance Report', icon: FileText },
  { href: '/leaves', label: 'Leave Management', icon: CalendarCheck },
  { href: '/holidays', label: 'Holidays', icon: CalendarDays },
  { href: '/settings', label: 'Settings', icon: Settings },
];

/* ---------- Device status + sync ---------- */

function DevicePanel({ showLabels }) {
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [msg, setMsg] = useState(null); // { err, text }

  useEffect(() => {
    setLastSync(localStorage.getItem(LAST_SYNC_KEY));
    const onSynced = (e) => setLastSync(e.detail?.at || localStorage.getItem(LAST_SYNC_KEY));
    window.addEventListener(SYNC_EVENT, onSynced);
    return () => window.removeEventListener(SYNC_EVENT, onSynced);
  }, []);

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 6000);
    return () => clearTimeout(t);
  }, [msg]);

  const sync = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    setMsg(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/sync`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (res.status === 401) {
        localStorage.removeItem('token');
        window.location.href = '/login';
        return;
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Sync failed (HTTP ${res.status})`);

      const at = new Date().toISOString();
      try {
        localStorage.setItem(LAST_SYNC_KEY, at);
      } catch {}
      setLastSync(at);
      window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: { at, result: data } }));

      const written = data.written ?? 0;
      setMsg({ text: `Synced: ${written} new punch${written === 1 ? '' : 'es'}` });
    } catch (e) {
      setMsg({ err: true, text: `Sync failed: ${e.message}` });
    } finally {
      setSyncing(false);
    }
  }, [syncing]);

  if (!showLabels) {
    return (
      <div className="flex flex-col items-center gap-2 border-t border-slate-200 px-3 py-3">
        <DeviceStatus compact />
        <button
          onClick={sync}
          disabled={syncing}
          title="Sync from device"
          aria-label="Sync from device"
          className="rounded-full p-2 text-slate-600 transition hover:bg-slate-100 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin motion-reduce:animate-none' : ''}`} />
        </button>
      </div>
    );
  }

  return (
    <div className="border-t border-slate-200 px-3 py-3">
      <div className="rounded-xl bg-slate-50 p-3">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Device</p>
        <DeviceStatus />

        <button
          onClick={sync}
          disabled={syncing}
          title="Sync from device"
          className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin motion-reduce:animate-none' : ''}`} />
          {syncing ? 'Syncing...' : 'Sync from device'}
        </button>

        <p className="mt-1.5 truncate text-[11px] text-slate-500" title={lastSync ? formatDateTime(lastSync) : 'Never synced'}>
          Last sync {lastSync ? formatDateTime(lastSync) : 'never'}
        </p>

        {msg && (
          <p className={`mt-1 text-[11px] ${msg.err ? 'text-red-600' : 'text-emerald-700'}`} role="status">
            {msg.text}
          </p>
        )}
      </div>
    </div>
  );
}

/* ---------- Sidebar parts ---------- */

function Brand({ showLabel }) {
  return (
    <div
      className={`flex h-[72px] shrink-0 items-center gap-3 border-b border-slate-200 ${
        showLabel ? 'px-5' : 'justify-center'
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/HKD_LOGO.png"
        alt="HKD Outdoor Innovations LTD. logo"
        className={`shrink-0 object-contain ${showLabel ? 'h-10 w-auto max-w-[56px]' : 'h-9 w-9'}`}
      />
      {showLabel && (
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-bold text-slate-900">HKD Outdoor</p>
          <p className="truncate text-[11px] font-medium text-slate-500">Innovations LTD.</p>
        </div>
      )}
    </div>
  );
}

function SidebarBody({ showLabels, path, onLogout }) {
  return (
    <>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {menu.map((m) => {
          const active = path === m.href || path.startsWith(`${m.href}/`);
          const Icon = m.icon;
          return (
            <Link
              key={m.href}
              href={m.href}
              title={m.label}
              className={`flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium transition ${
                active
                  ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-100'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              } ${showLabels ? '' : 'justify-center px-0'}`}
            >
              <Icon className={`h-5 w-5 shrink-0 ${active ? 'text-blue-600' : 'text-slate-400'}`} />
              {showLabels && <span className="truncate">{m.label}</span>}
            </Link>
          );
        })}
      </nav>

      <DevicePanel showLabels={showLabels} />

      <div className="border-t border-slate-200 p-3">
        <button
          onClick={onLogout}
          title="Logout"
          className={`flex w-full items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-red-50 hover:text-red-600 ${
            showLabels ? '' : 'justify-center px-0'
          }`}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {showLabels && <span>Logout</span>}
        </button>
      </div>
    </>
  );
}

/* ---------- Sidebar ---------- */

export default function SideNavBar({ collapsed = false, mobileOpen = false, onOpen, onClose, onLogout }) {
  const path = usePathname();

  return (
    <>
      {/* Mobile menu button (pages no longer have a top bar) */}
      <button
        onClick={onOpen}
        className="fixed left-3 top-3 z-30 rounded-lg border border-slate-200 bg-white p-2 text-slate-600 shadow-sm md:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Desktop sidebar */}
      <aside
        style={{ width: collapsed ? 76 : 256 }}
        className="hidden shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-white transition-[width] duration-200 md:flex"
      >
        <Brand showLabel={!collapsed} />
        <SidebarBody showLabels={!collapsed} path={path} onLogout={onLogout} />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={onClose} />
          <aside className="relative flex h-full w-64 flex-col bg-white shadow-xl">
            <Brand showLabel />
            <button
              onClick={onClose}
              className="absolute right-3 top-5 rounded-full p-1.5 text-slate-500 hover:bg-slate-100"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarBody showLabels path={path} onLogout={onLogout} />
          </aside>
        </div>
      )}
    </>
  );
}
