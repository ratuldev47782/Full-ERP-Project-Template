// frontend/app/employees/[id]/page.js

'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Menu, RefreshCw } from 'lucide-react';
import { IBM_Plex_Sans } from 'next/font/google';
import SideNavBar from '../../components/SideNavBar';
import DeviceStatus from '../../components/DeviceStatus';
import MonthlyView from '../../components/MonthlyView';

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

const fmtSyncTime = (iso) =>
  iso ? new Date(iso).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) : null;

/* ---------- shared classes ---------- */
const focus = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700/40';
const btnSecondary = `rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60 ${focus}`;
const linkBtn = `rounded text-sm font-medium text-teal-800 hover:underline disabled:opacity-60 ${focus}`;

export default function EmployeeDetail() {
  const { id } = useParams();
  const router = useRouter();
  const path = usePathname();

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

  // Auto sync (ekbar): page khulle device theke sync
  useEffect(() => {
    if (ready && !autoDone.current) {
      autoDone.current = true;
      sync(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const logout = () => {
    localStorage.removeItem('token');
    router.replace('/login');
  };

  if (!ready) return null;

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
            <h1 className="truncate text-sm font-semibold text-zinc-900">Attendance</h1>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <DeviceStatus />
            <span className="hidden text-sm text-zinc-500 tabular-nums sm:inline">
              Last synced {fmtSyncTime(lastSync) || 'not yet'}
            </span>
            <button onClick={() => sync(false)} disabled={syncing} className={`${btnSecondary} flex items-center gap-2 py-1.5`}>
              <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin motion-reduce:animate-none' : ''}`} />
              {syncing ? 'Syncing' : 'Sync'}
            </button>
            <button onClick={logout} className={linkBtn}>
              Log out
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-8">
          <div className="max-w-4xl">
            <Link href="/employees" className={`mb-4 inline-block ${linkBtn}`}>
              Back to employees
            </Link>
            <MonthlyView id={id} />
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