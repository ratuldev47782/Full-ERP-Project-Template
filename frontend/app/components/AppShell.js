// frontend/app/components/AppShell.js

'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  Fingerprint,
  LayoutDashboard,
  Users,
  Menu,
  ChevronsLeft,
  ChevronsRight,
  LogOut,
  X,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Settings, CalendarDays, CalendarCheck, FileText
} from 'lucide-react';
import { runSync, fmtSyncTime, LAST_SYNC_KEY, SYNC_EVENT } from '../../lib/sync';

const menu = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/employees', label: 'Employees', icon: Users },
  { href: '/reports', label: 'Attendance Report', icon: FileText },
  { href: '/leaves', label: 'Leave Management', icon: CalendarCheck },
  { href: '/holidays', label: 'Holidays', icon: CalendarDays },
  { href: '/settings', label: 'Settings', icon: Settings },
];

/* ---------- Sidebar parts ---------- */

function Brand({ showLabel }) {
  return (
    <div className={`flex h-14 shrink-0 items-center gap-2.5 border-b border-white/10 ${showLabel ? 'px-4' : 'justify-center'}`}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600">
        <Fingerprint className="h-5 w-5 text-white" />
      </span>
      {showLabel && <span className="truncate text-sm font-bold tracking-wide text-white">ATTENDANCE ERP</span>}
    </div>
  );
}

function SidebarBody({ showLabels, path, onLogout, onToggle, collapsed }) {
  return (
    <>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {menu.map((m) => {
          const active = path === m.href || path.startsWith(`${m.href}/`);
          const Icon = m.icon;
          return (
            <Link
              key={m.href}
              href={m.href}
              title={m.label}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                active
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
              } ${showLabels ? '' : 'justify-center px-0'}`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {showLabels && <span className="truncate">{m.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-1 border-t border-white/10 p-3">
        {onToggle && (
          <button
            onClick={onToggle}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white ${
              showLabels ? '' : 'justify-center px-0'
            }`}
          >
            {collapsed ? <ChevronsRight className="h-5 w-5 shrink-0" /> : <ChevronsLeft className="h-5 w-5 shrink-0" />}
            {showLabels && <span>Collapse</span>}
          </button>
        )}
        <button
          onClick={onLogout}
          title="Logout"
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-red-500/20 hover:text-red-300 ${
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

/* ---------- Shell ---------- */

// autoSync = true dile page khulle ekbar device theke auto sync hoy
export default function AppShell({ title, children, autoSync = false }) {
  const path = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [toast, setToast] = useState(null); // { err, text }
  const autoDone = useRef(false);

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

  // onno jaygay (jemon dashboard-er button) sync hole last-synced time update
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

  // Auto sync (ekbar)
  useEffect(() => {
    if (ready && autoSync && !autoDone.current) {
      autoDone.current = true;
      sync(false); // page khulle device theke sync, shesh hole toast + table auto reload
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, autoSync]);

  const logout = () => {
    localStorage.removeItem('token');
    router.replace('/login');
  };

  if (!ready) return null;

  return (
    <div className="flex h-screen bg-slate-100 text-slate-800">
      {/* Desktop sidebar */}
      <aside
        style={{ width: collapsed ? 72 : 240 }}
        className="hidden shrink-0 flex-col overflow-hidden bg-gradient-to-b from-slate-900 to-slate-800 transition-[width] duration-200 md:flex"
      >
        <Brand showLabel={!collapsed} />
        <SidebarBody
          showLabels={!collapsed}
          collapsed={collapsed}
          path={path}
          onLogout={logout}
          onToggle={() => setCollapsed((c) => !c)}
        />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-slate-900/60" onClick={() => setMobileOpen(false)} />
          <aside className="relative flex h-full w-64 flex-col bg-gradient-to-b from-slate-900 to-slate-800 shadow-xl">
            <Brand showLabel />
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-3 rounded p-1 text-slate-300 hover:bg-white/10"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarBody showLabels path={path} onLogout={logout} />
          </aside>
        </div>
      )}

      {/* Main */}
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
            <h1 className="truncate text-base font-semibold text-slate-800">{title}</h1>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {/* Last synced time */}
            <div className="hidden text-right leading-tight sm:block">
              <div className="text-[10px] uppercase tracking-wide text-slate-400">Last synced</div>
              <div className="text-xs font-medium text-slate-600">{fmtSyncTime(lastSync) || 'Not yet'}</div>
            </div>

            {/* Sync button (shob page-e) */}
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

        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-4 right-4 z-50 flex max-w-sm items-start gap-2 rounded-lg border px-4 py-3 text-sm shadow-lg ${
            toast.err ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700'
          }`}
        >
          {toast.err ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
          <span>{toast.text}</span>
        </div>
      )}
    </div>
  );
}