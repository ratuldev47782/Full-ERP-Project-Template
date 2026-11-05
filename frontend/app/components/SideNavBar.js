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
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import DeviceStatus from './DeviceStatus';
import { formatDateTime } from '../timeFormat';

const API = process.env.NEXT_PUBLIC_API || 'http://localhost:5000';
const LAST_SYNC_KEY = 'lastSync';
const SYNC_EVENT = 'attendance:synced';
const COLLAPSED_KEY = 'sidebarCollapsed';

/*
 * Module-level cache. The sidebar is remounted on every page navigation
 * (because it is rendered inside each page), but this variable survives
 * client-side navigation, so the sidebar starts in the right state
 * immediately instead of starting expanded and animating to collapsed.
 */
let collapsedCache = null;

const menu = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/employees', label: 'Employees', icon: Users },
  { href: '/attendance', label: 'Attendance Register', icon: ClipboardList },
  { href: '/reports', label: 'Attendance Report', icon: FileText },
  { href: '/leaves', label: 'Leave Management', icon: CalendarCheck },
  { href: '/holidays', label: 'Holidays', icon: CalendarDays },
  { href: '/settings', label: 'Settings', icon: Settings },
];

/* Short date + time for the collapsed sidebar, e.g. { date: '2 Nov', time: '14:05' } */
function shortStamp(iso) {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return null;
  return {
    date: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    time: d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
  };
}

/* ---------- Device status + sync ---------- */

function DevicePanel({ showLabels }) {
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [msg, setMsg] = useState(null); // { err, text, short }

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
      setMsg({
        text: `Synced: ${written} new punch${written === 1 ? '' : 'es'}`,
        short: `+${written} new`,
      });
    } catch (e) {
      setMsg({ err: true, text: `Sync failed: ${e.message}`, short: 'Failed' });
    } finally {
      setSyncing(false);
    }
  }, [syncing]);

  /* Collapsed: icon button + download log in small text */
  if (!showLabels) {
    const stamp = shortStamp(lastSync);
    const fullLog = lastSync ? `Last sync ${formatDateTime(lastSync)}` : 'Never synced';

    return (
      <div className="flex flex-col items-center gap-2 border-t border-slate-200 px-1 py-3">
        <DeviceStatus compact />
        <button
          onClick={sync}
          disabled={syncing}
          title="Download / Sync"
          aria-label="Download / Sync"
          className="rounded-full p-2 text-slate-600 transition hover:bg-slate-100 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin motion-reduce:animate-none' : ''}`} />
        </button>

        {/* Download log */}
        <div className="w-full text-center leading-tight" title={msg ? msg.text : fullLog} aria-live="polite">
          {syncing ? (
            <p className="text-[9px] font-medium text-blue-600">Downloading</p>
          ) : (
            <>
              <p className="text-[9px] text-slate-400">Last sync</p>
              {stamp ? (
                <>
                  <p className="text-[9px] text-slate-500">{stamp.date}</p>
                  <p className="text-[9px] font-medium text-slate-600">{stamp.time}</p>
                </>
              ) : (
                <p className="text-[9px] text-slate-500">never</p>
              )}
            </>
          )}
          {msg && !syncing && (
            <p
              role="status"
              className={`mt-0.5 text-[9px] font-semibold ${msg.err ? 'text-red-600' : 'text-emerald-700'}`}
            >
              {msg.short}
            </p>
          )}
        </div>
      </div>
    );
  }

  /* Expanded */
  return (
    <div className="border-t border-slate-200 px-3 py-3">
      <div className="rounded-xl bg-slate-50 p-3">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Device</p>
        <DeviceStatus />

        <button
          onClick={sync}
          disabled={syncing}
          title="Download / Sync"
          className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin motion-reduce:animate-none' : ''}`} />
          {syncing ? 'Downloading...' : 'Download / Sync'}
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

function SidebarBody({ showLabels, path, onLogout, onToggleCollapse }) {
  // onToggleCollapse is only passed for the desktop sidebar
  const CollapseIcon = showLabels ? PanelLeftClose : PanelLeftOpen;
  const collapseLabel = showLabels ? 'Collapse sidebar' : 'Expand sidebar';

  return (
    <>
      <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden px-3 py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {menu.map((m) => {
          const active = path === m.href || path.startsWith(`${m.href}/`);
          const Icon = m.icon;
          return (
            <Link
              key={m.href}
              href={m.href}
              title={m.label}
              aria-label={m.label}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium transition ${
                active
                  ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-100'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              } ${showLabels ? '' : 'justify-center px-0'}`}
            >
              <Icon className={`h-5 w-5 shrink-0 ${active ? 'text-blue-600' : 'text-slate-400'}`} />
              {showLabels && <span className="truncate whitespace-nowrap">{m.label}</span>}
            </Link>
          );
        })}
      </nav>

      <DevicePanel showLabels={showLabels} />

      <div
        className={`flex items-center gap-1 border-t border-slate-200 p-3 ${
          showLabels ? 'justify-between' : 'flex-col'
        }`}
      >
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            title={`${collapseLabel} (Ctrl+B)`}
            aria-label={collapseLabel}
            aria-expanded={showLabels}
            className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <CollapseIcon className="h-5 w-5" />
          </button>
        )}

        <button
          onClick={onLogout}
          title="Logout"
          aria-label="Logout"
          className="rounded-full p-2 text-slate-500 transition hover:bg-red-50 hover:text-red-600"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </>
  );
}

/* ---------- Sidebar ---------- */

/**
 * Collapse state works two ways:
 *  - Uncontrolled (default): the sidebar manages its own state and remembers it in localStorage.
 *  - Controlled: pass `collapsed` and `onToggleCollapse` from the parent layout.
 */
export default function SideNavBar({
  collapsed: collapsedProp,
  onToggleCollapse,
  mobileOpen = false,
  onOpen,
  onClose,
  onLogout,
}) {
  const path = usePathname();
  // Controlled only when the parent gives BOTH the value and a handler;
  // otherwise the sidebar manages its own state (so the toggle always works).
  const controlled = collapsedProp !== undefined && typeof onToggleCollapse === 'function';

  // Start from the module cache so remounts during navigation keep the right width.
  const [innerCollapsed, setInnerCollapsed] = useState(collapsedCache ?? false);
  // Only animate the width after the user actually toggles, never on mount/navigation.
  const [animate, setAnimate] = useState(false);
  const collapsed = controlled ? collapsedProp : innerCollapsed;

  // Restore saved preference (after mount to avoid hydration mismatch)
  useEffect(() => {
    if (controlled) return;
    try {
      const saved = localStorage.getItem(COLLAPSED_KEY) === '1';
      collapsedCache = saved;
      setInnerCollapsed(saved);
    } catch {}
  }, [controlled]);

  const toggle = useCallback(() => {
    if (controlled) {
      setAnimate(true);
      onToggleCollapse?.();
      return;
    }
    setAnimate(true);
    const next = !innerCollapsed;
    collapsedCache = next;
    try {
      localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0');
    } catch {}
    setInnerCollapsed(next);
  }, [controlled, onToggleCollapse, innerCollapsed]);

  // Ctrl/Cmd + B toggles the sidebar
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);

  // Close mobile drawer on Escape
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen, onClose]);

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

      {/* Desktop sidebar (shrinkable) */}
      <aside
        style={{ width: collapsed ? 76 : 256 }}
        className={`hidden shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-white md:flex ${
          animate ? 'transition-[width] duration-200 motion-reduce:transition-none' : ''
        }`}
      >
        <Brand showLabel={!collapsed} />
        <SidebarBody showLabels={!collapsed} path={path} onLogout={onLogout} onToggleCollapse={toggle} />
      </aside>

      {/* Mobile drawer (always expanded) */}
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