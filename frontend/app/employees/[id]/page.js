// frontend/app/employees/[id]/page.js

'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { RefreshCw } from 'lucide-react';
import { IBM_Plex_Sans } from 'next/font/google';
import SideNavBar from '../../components/SideNavBar';
import MonthlyView from '../../components/MonthlyView';
import { formatDateTime, useTimeFormat } from '../../timeFormat';

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

/* ---------- shared classes ---------- */
const focus = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700/40';
const btnSecondary = `rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60 ${focus}`;
const linkBtn = `rounded text-sm font-medium text-teal-800 hover:underline disabled:opacity-60 ${focus}`;

export default function EmployeeDetail() {
  useTimeFormat();
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
        onOpen={() => setMobileOpen(true)}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        onLogout={logout}
      />

      <div className="flex min-w-0 flex-1 flex-col">
                <main className="pt-16 flex-1 overflow-auto p-4 md:p-8">
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