// frontend/app/employees/page.js

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, RefreshCw } from 'lucide-react';
import { IBM_Plex_Sans } from 'next/font/google';
import SideNavBar from '../components/SideNavBar';
import DeviceStatus from '../components/DeviceStatus';
import { formatDateTime, useTimeFormat } from '../timeFormat';
import { confirmDialog } from '../../lib/dialog';

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
  } catch {}
  window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: { at, result } }));
  return result;
}

const fmtSyncTime = (iso) => formatDateTime(iso);

const fields = [
  { key: 'employeeId', label: 'Employee ID', required: true },
  { key: 'name', label: 'Name', required: true },
  { key: 'joinDate', label: 'Join date', type: 'date' },
  { key: 'grade', label: 'Grade' },
  { key: 'line', label: 'Line' },
  { key: 'designation', label: 'Designation' },
  { key: 'department', label: 'Department' },
  { key: 'section', label: 'Section' },
  { key: 'subSection', label: 'Sub section' },
  { key: 'cardNo', label: 'Card no' },
  { key: 'proximityId', label: 'Proximity ID (device ID)', required: true },
];
const fieldMap = Object.fromEntries(fields.map((f) => [f.key, f]));

// Form sections: left = title + description, right = fields
const sections = [
  { title: 'Basic details', desc: 'Employee ID and name appear on every report.', keys: ['employeeId', 'name', 'joinDate'] },
  {
    title: 'Job details',
    desc: 'Used for filtering and printed on the monthly time card.',
    keys: ['grade', 'line', 'designation', 'department', 'section', 'subSection'],
  },
  {
    title: 'Attendance device',
    desc: 'Proximity ID must match the user ID stored on the device.',
    keys: ['proximityId', 'cardNo'],
  },
];

const empty = Object.fromEntries(fields.map((f) => [f.key, '']));

const searchFields = [
  ['employeeId', 'Employee ID'],
  ['proximityId', 'Proximity ID'],
  ['name', 'Name'],
];
const emptySearch = { employeeId: '', proximityId: '', name: '' };

const norm = (v) => String(v ?? '').toLowerCase().trim();

/* ---------- shared classes ---------- */
const focus = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700/40';
const inputCls =
  'w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/25';
const btnPrimary = `rounded-md bg-teal-800 px-4 py-2 text-sm font-medium text-white hover:bg-teal-900 disabled:opacity-60 ${focus}`;
const btnSecondary = `rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60 ${focus}`;
const linkBtn = `rounded text-sm font-medium text-teal-800 hover:underline disabled:opacity-60 ${focus}`;
const dangerLink = `rounded text-sm font-medium text-red-700 hover:underline ${focus}`;
const th = 'px-4 py-2.5 font-medium whitespace-nowrap';
const td = 'px-4 py-3 align-middle';

function Note({ type, children }) {
  return (
    <div
      role={type === 'err' ? 'alert' : 'status'}
      className={`mb-4 rounded-md border border-l-4 border-zinc-300 bg-white px-4 py-3 text-sm ${
        type === 'ok' ? 'border-l-teal-800 text-zinc-800' : 'border-l-red-700 text-red-700'
      }`}
    >
      {children}
    </div>
  );
}

export default function EmployeesPage() {
  useTimeFormat();
  const router = useRouter();
  const path = usePathname();

  const [form, setForm] = useState(empty);
  const [list, setList] = useState([]);
  const [editId, setEditId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formErr, setFormErr] = useState(null);
  const [search, setSearch] = useState(emptySearch);
  const [msg, setMsg] = useState(null); // { type: 'ok' | 'err', text }
  const [saving, setSaving] = useState(false);

  // header / sidebar shell
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [toast, setToast] = useState(null); // { err, text }

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

  // Overlay khola thakle: Esc diye bondho + background scroll lock
  useEffect(() => {
    if (!showForm) return;
    const onKey = (e) => {
      if (e.key === 'Escape' && !saving) closeForm();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showForm, saving]);

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

  const logout = () => {
    localStorage.removeItem('token');
    router.replace('/login');
  };

  const load = async () => {
    try {
      setList(await api('/api/employees'));
    } catch (e) {
      setMsg({ type: 'err', text: e.message });
    }
  };

  useEffect(() => {
    load();
    const h = () => load();
    window.addEventListener(SYNC_EVENT, h);
    return () => window.removeEventListener(SYNC_EVENT, h);
  }, []);

  const change = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const reset = () => {
    setForm(empty);
    setEditId(null);
    setFormErr(null);
  };

  const openNew = () => {
    reset();
    setMsg(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    reset();
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormErr(null);
    try {
      await api(editId ? `/api/employees/${editId}` : '/api/employees', {
        method: editId ? 'PUT' : 'POST',
        body: JSON.stringify(form),
      });
      setMsg({ type: 'ok', text: editId ? 'Employee updated.' : 'Employee registered.' });
      closeForm();
      load();
    } catch (err) {
      setFormErr(err.message);
    } finally {
      setSaving(false);
    }
  };

  const edit = (emp) => {
    setMsg(null);
    setFormErr(null);
    setEditId(emp._id);
    setForm(
      Object.fromEntries(
        fields.map((f) => [
          f.key,
          f.key === 'joinDate' ? (emp.joinDate ? emp.joinDate.slice(0, 10) : '') : emp[f.key] || '',
        ])
      )
    );
    setShowForm(true);
  };

  const remove = async (emp) => {
    const ok = await confirmDialog({
      title: 'Delete employee?',
      text: `Delete ${emp.name} (${emp.employeeId})? This cannot be undone.`,
    });
    if (!ok) return;
    try {
      await api(`/api/employees/${emp._id}`, { method: 'DELETE' });
      load();
    } catch (err) {
      setMsg({ type: 'err', text: err.message });
    }
  };

  // Tinta search input-er shob condition ekshathe milte hobe
  const shown = list.filter(
    (e) =>
      norm(e.employeeId).includes(norm(search.employeeId)) &&
      norm(e.proximityId).includes(norm(search.proximityId)) &&
      norm(e.name).includes(norm(search.name))
  );
  const hasSearch = Object.values(search).some(Boolean);
  const plural = (n) => `${n} employee${n === 1 ? '' : 's'}`;

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
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold text-zinc-900">Employees</h2>
                <p className="mt-1 text-sm text-zinc-500">Register employees. Open a name to see their attendance.</p>
              </div>
              <button onClick={openNew} className={btnPrimary}>
                New employee
              </button>
            </div>

            {msg && <Note type={msg.type}>{msg.text}</Note>}

            <div className="overflow-hidden rounded-md border border-zinc-300 bg-white">
              {/* Search */}
              <div className="grid gap-3 p-4 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
                {searchFields.map(([key, label]) => (
                  <div key={key}>
                    <label htmlFor={`search-${key}`} className="mb-1 block text-sm text-zinc-700">
                      {label}
                    </label>
                    <input
                      id={`search-${key}`}
                      value={search[key]}
                      onChange={(e) => setSearch((s) => ({ ...s, [key]: e.target.value }))}
                      className={inputCls}
                    />
                  </div>
                ))}
                <div className="flex h-[38px] items-center">
                  {hasSearch && (
                    <button type="button" onClick={() => setSearch(emptySearch)} className={linkBtn}>
                      Clear search
                    </button>
                  )}
                </div>
              </div>

              <div className="border-t border-zinc-200 px-4 py-2.5 text-sm text-zinc-500 tabular-nums">
                {hasSearch ? `${shown.length} of ${plural(list.length)}` : plural(list.length)}
              </div>

              {/* Table */}
              <div className="overflow-x-auto border-t border-zinc-300">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="border-b border-zinc-300 bg-zinc-50 text-zinc-500">
                    <tr>
                      <th className={th}>Employee ID</th>
                      <th className={th}>Proximity ID</th>
                      <th className={th}>Name</th>
                      <th className={th}>Designation</th>
                      <th className={th}>Department</th>
                      <th className={`${th} text-right`}>Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {shown.map((e) => (
                      <tr
                        key={e._id}
                        onClick={() => router.push(`/employees/${e._id}`)}
                        className="cursor-pointer hover:bg-zinc-50"
                      >
                        <td className={`${td} tabular-nums text-zinc-900`}>{e.employeeId}</td>
                        <td className={`${td} tabular-nums text-zinc-700`}>{e.proximityId}</td>
                        <td className={td}>
                          <Link
                            href={`/employees/${e._id}`}
                            onClick={(ev) => ev.stopPropagation()}
                            className={`rounded font-medium text-zinc-900 hover:underline ${focus}`}
                          >
                            {e.name}
                          </Link>
                        </td>
                        <td className={`${td} text-zinc-600`}>{e.designation || '-'}</td>
                        <td className={`${td} text-zinc-600`}>{e.department || '-'}</td>
                        <td className={td}>
                          <div className="flex justify-end gap-4">
                            <button
                              onClick={(ev) => {
                                ev.stopPropagation();
                                edit(e);
                              }}
                              className={linkBtn}
                            >
                              Edit
                            </button>
                            <button
                              onClick={(ev) => {
                                ev.stopPropagation();
                                remove(e);
                              }}
                              className={dangerLink}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!shown.length && (
                      <tr>
                        <td colSpan={6} className="px-4 py-12 text-center text-sm text-zinc-500">
                          {hasSearch
                            ? 'No employee matches this search. Clear the search to see everyone.'
                            : 'No employees yet. Use New employee to add one.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* New / edit employee overlay */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-zinc-900/40 p-4 md:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="employee-form-title"
        >
          <form
            onSubmit={submit}
            className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-md border border-zinc-300 bg-white"
          >
            <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-5 py-4">
              <h3 id="employee-form-title" className="text-base font-semibold text-zinc-900">
                {editId ? 'Edit employee' : 'New employee'}
              </h3>
              <button type="button" onClick={closeForm} disabled={saving} className={linkBtn}>
                Close
              </button>
            </div>

            <div className="overflow-y-auto px-5">
              {formErr && (
                <div className="pt-4">
                  <Note type="err">{formErr}</Note>
                </div>
              )}

              {sections.map((sec, i) => (
                <section
                  key={sec.title}
                  className={`grid gap-4 py-5 md:grid-cols-[220px_1fr] md:gap-6 ${i > 0 ? 'border-t border-zinc-200' : ''}`}
                >
                  <div>
                    <h4 className="text-sm font-semibold text-zinc-900">{sec.title}</h4>
                    <p className="mt-1 text-sm text-zinc-500">{sec.desc}</p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {sec.keys.map((k) => {
                      const f = fieldMap[k];
                      return (
                        <div key={k}>
                          <label htmlFor={`f-${k}`} className="mb-1 block text-sm text-zinc-700">
                            {f.label}
                            {f.required && <span className="text-red-700"> *</span>}
                          </label>
                          <input
                            id={`f-${k}`}
                            type={f.type || 'text'}
                            required={f.required}
                            autoFocus={k === 'employeeId'}
                            value={form[k]}
                            onChange={(e) => change(k, e.target.value)}
                            className={inputCls}
                          />
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-zinc-200 px-5 py-3">
              <button type="button" onClick={reset} disabled={saving} className={linkBtn}>
                Clear form
              </button>
              <button type="button" onClick={closeForm} disabled={saving} className={btnSecondary}>
                Cancel
              </button>
              <button disabled={saving} className={btnPrimary}>
                {saving ? 'Saving' : editId ? 'Save changes' : 'Register employee'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          role="status"
          className={`fixed bottom-4 right-4 z-[60] max-w-sm rounded-md bg-zinc-900 px-4 py-2.5 text-sm text-white ${
            toast.err ? 'border-l-4 border-red-500' : ''
          }`}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}