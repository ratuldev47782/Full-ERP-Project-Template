// frontend/app/employees/page.js

'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Plus, X, Search, Pencil, Trash2, Users, CheckCircle2, AlertCircle, Menu, LogOut, RefreshCw } from 'lucide-react';
import SideNavBar from '../components/SideNavBar';

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

const fmtSyncTime = (iso) =>
  iso ? new Date(iso).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) : null;

const fields = [
  { key: 'employeeId', label: 'Employee ID', required: true },
  { key: 'name', label: 'Name', required: true },
  { key: 'joinDate', label: 'Join Date', type: 'date' },
  { key: 'grade', label: 'Grade' },
  { key: 'line', label: 'Line' },
  { key: 'designation', label: 'Designation' },
  { key: 'department', label: 'Department' },
  { key: 'section', label: 'Section' },
  { key: 'subSection', label: 'Sub Section' },
  { key: 'cardNo', label: 'Card No' },
  { key: 'proximityId', label: 'Proximity ID / Device ID', required: true },
];

const empty = Object.fromEntries(fields.map((f) => [f.key, '']));

const th = 'px-5 py-4 text-left font-semibold whitespace-nowrap';
const td = 'px-5 py-4 align-middle';

const input =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

export default function EmployeesPage() {
  const router = useRouter();
  const path = usePathname();

  const [form, setForm] = useState(empty);
  const [list, setList] = useState([]);
  const [editId, setEditId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
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
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      await api(editId ? `/api/employees/${editId}` : '/api/employees', {
        method: editId ? 'PUT' : 'POST',
        body: JSON.stringify(form),
      });
      setMsg({ type: 'ok', text: editId ? 'Employee updated successfully.' : 'Employee registered successfully.' });
      if (editId) setShowForm(false);
      reset();
      load();
    } catch (err) {
      setMsg({ type: 'err', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const edit = (emp) => {
    setEditId(emp._id);
    setShowForm(true);
    setForm(
      Object.fromEntries(
        fields.map((f) => [
          f.key,
          f.key === 'joinDate' ? (emp.joinDate ? emp.joinDate.slice(0, 10) : '') : emp[f.key] || '',
        ])
      )
    );
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const remove = async (emp) => {
    if (!confirm(`Are you sure you want to delete ${emp.name} (${emp.employeeId})?`)) return;
    try {
      await api(`/api/employees/${emp._id}`, { method: 'DELETE' });
      load();
    } catch (err) {
      setMsg({ type: 'err', text: err.message });
    }
  };

  const shown = list.filter((e) =>
    [e.employeeId, e.name, e.proximityId, e.department, e.designation]
      .join(' ')
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  if (!ready) return null;

  return (
    <div className="flex h-screen bg-slate-100 text-slate-800">
      <SideNavBar
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        onLogout={logout}
      />

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
            <h1 className="truncate text-base font-semibold text-slate-800">Employees</h1>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div className="hidden text-right leading-tight sm:block">
              <div className="text-[10px] uppercase tracking-wide text-slate-400">Last synced</div>
              <div className="text-xs font-medium text-slate-600">{fmtSyncTime(lastSync) || 'Not yet'}</div>
            </div>

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

        <main className="flex-1 overflow-auto p-4 md:p-6">
          {/* Page header */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Employees</h2>
              <p className="text-xs text-slate-500">Register and manage employees. Click a row to view attendance.</p>
            </div>
            <button
              onClick={() => {
                if (showForm) reset();
                setShowForm((s) => !s);
              }}
              className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium shadow-sm transition ${
                showForm
                  ? 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {showForm ? 'Close Form' : 'New Employee'}
            </button>
          </div>

          {/* Message */}
          {msg && (
            <div
              className={`mb-4 flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm ${
                msg.type === 'ok'
                  ? 'border-green-200 bg-green-50 text-green-700'
                  : 'border-red-200 bg-red-50 text-red-700'
              }`}
            >
              {msg.type === 'ok' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0" />
              )}
              {msg.text}
            </div>
          )}

          {/* Form */}
          {showForm && (
            <form onSubmit={submit} className="mb-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-5 py-3">
                <Users className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-semibold text-slate-800">{editId ? 'Edit Employee' : 'New Employee'}</span>
              </div>

              <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
                {fields.map((f) => (
                  <div key={f.key}>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      {f.label} {f.required && <span className="text-red-500">*</span>}
                    </label>
                    <input
                      type={f.type || 'text'}
                      required={f.required}
                      value={form[f.key]}
                      onChange={(e) => change(f.key, e.target.value)}
                      className={`${input} ${f.key === 'proximityId' ? 'border-blue-300 bg-blue-50/60' : ''}`}
                    />
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
                <button
                  type="button"
                  onClick={reset}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                >
                  Clear
                </button>
                <button
                  disabled={saving}
                  className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
                >
                  {saving ? 'Saving...' : editId ? 'Update' : 'Register'}
                </button>
              </div>
            </form>
          )}

          {/* List */}
          <div className="w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-slate-500" />
                <span className="text-sm font-semibold text-slate-800">Employee List</span>
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">{shown.length}</span>
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, ID, department..."
                  className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            <div className="max-h-[calc(100vh-260px)] overflow-auto">
              <table className="w-full min-w-[760px] table-fixed text-sm">
                <colgroup>
                  <col className="w-[12%]" />
                  <col className="w-[20%]" />
                  <col className="w-[22%]" />
                  <col className="w-[17%]" />
                  <col className="w-[17%]" />
                  <col className="w-[12%]" />
                </colgroup>

                <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className={th}>Emp ID</th>
                    <th className={th}>Proximity ID / Device ID</th>
                    <th className={th}>Name</th>
                    <th className={th}>Designation</th>
                    <th className={th}>Department</th>
                    <th className={`${th} text-right`}>Action</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {shown.map((e) => (
                    <tr
                      key={e._id}
                      onClick={() => router.push(`/employees/${e._id}`)}
                      className="cursor-pointer transition hover:bg-blue-50"
                    >
                      <td className={`${td} break-words font-medium text-slate-800`}>{e.employeeId}</td>
                      <td className={td}>
                        <span className="inline-block rounded-md bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                          {e.proximityId}
                        </span>
                      </td>
                      <td className={`${td} break-words font-medium text-slate-800`}>{e.name}</td>
                      <td className={`${td} break-words text-slate-600`}>{e.designation || '—'}</td>
                      <td className={`${td} break-words text-slate-600`}>{e.department || '—'}</td>
                      <td className={td}>
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={(ev) => {
                              ev.stopPropagation();
                              edit(e);
                            }}
                            title="Edit"
                            aria-label="Edit"
                            className="rounded-md p-2 text-slate-500 hover:bg-blue-100 hover:text-blue-700"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(ev) => {
                              ev.stopPropagation();
                              remove(e);
                            }}
                            title="Delete"
                            aria-label="Delete"
                            className="rounded-md p-2 text-slate-500 hover:bg-red-100 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!shown.length && (
                    <tr>
                      <td colSpan={6} className="px-3 py-12 text-center text-sm text-slate-400">
                        No employees found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
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
