'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Pencil, Search, Trash2, X } from 'lucide-react';

import AppShell, { API_URL } from '../components/AppShell';

// Same dropdown values as the register page, plus "Admin" (admins can promote users here;
// the public register form does not offer it).
const FACTORIES = ['Main Factory', 'Unit 2', 'Unit 3', 'Corporate Office'];
const FLOORS = ['Ground Floor', '1st Floor', '2nd Floor', '3rd Floor', '4th Floor'];
const DEPARTMENTS = [
  'Production',
  'Quality Assurance',
  'Maintenance',
  'Store & Inventory',
  'Human Resources',
  'Accounts & Finance',
  'Information Technology',
  'Sales & Marketing',
];
const DESIGNATIONS = [
  'Operator',
  'Senior Operator',
  'Technician',
  'Supervisor',
  'Executive',
  'Senior Executive',
  'Assistant Manager',
  'Manager',
  'General Manager',
  'Admin',
];

const SELECTS = [
  { id: 'factory', label: 'Factory', options: FACTORIES },
  { id: 'floor', label: 'Floor', options: FLOORS },
  { id: 'department', label: 'Department', options: DEPARTMENTS },
  { id: 'designation', label: 'Designation', options: DESIGNATIONS },
];

const focus = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700/40';
const inputCls =
  'block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/25 disabled:opacity-60';
const btnSecondary = `rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60 ${focus}`;
const btnDanger = `inline-flex items-center justify-center gap-2 rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 ${focus}`;
const btnPrimary = `inline-flex items-center justify-center gap-2 rounded-md bg-teal-800 px-4 py-2 text-sm font-medium text-white hover:bg-teal-900 disabled:opacity-60 ${focus}`;
const th = 'px-3 py-2.5 font-medium whitespace-nowrap';
const td = 'px-3 py-2 align-top';
const thead = 'sticky top-0 z-10 border-b border-zinc-300 bg-zinc-50 text-zinc-500';

const initials = (username = '') => username.slice(0, 2).toUpperCase();

function EditDialog({ target, currentUserId, onClose, onSaved }) {
  const [form, setForm] = useState({
    username: target.username,
    password: '',
    factory: target.work?.factory || '',
    floor: target.work?.floor || '',
    department: target.work?.department || '',
    designation: target.work?.designation || '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const update = (field) => (event) => {
    const { value } = event.target;
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;

    if (!/^[a-zA-Z0-9._-]{3,30}$/.test(form.username.trim())) {
      setError('Use 3-30 letters, numbers, dots, dashes or underscores for the user name.');
      return;
    }
    if (form.password && form.password.length < 6) {
      setError('Password must be at least 6 characters long, or leave it blank to keep it.');
      return;
    }
    if (SELECTS.some((select) => !form[select.id])) {
      setError('Factory, floor, department and designation are required.');
      return;
    }

    setError('');
    setSaving(true);

    try {
      const response = await fetch(`${API_URL}/api/users/${target.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, username: form.username.trim() }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) throw new Error(data.error || 'Could not save changes.');

      onSaved(data.user);
    } catch (requestError) {
      setError(requestError.message);
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-user-title"
    >
      <form onSubmit={submit} noValidate className="w-full max-w-lg rounded-md border border-zinc-300 bg-white">
        <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-4 py-3">
          <div>
            <h3 id="edit-user-title" className="text-sm font-semibold text-zinc-900">
              Edit user
            </h3>
            <p className="mt-0.5 text-xs text-zinc-500">
              {target.id === currentUserId ? 'This is your own account.' : `Account #${target.id}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className={`rounded-md p-1.5 text-zinc-500 hover:bg-zinc-50 ${focus}`}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-4 px-4 py-4">
          {error ? (
            <div
              role="alert"
              className="rounded-md border border-l-4 border-zinc-300 border-l-red-700 bg-white px-4 py-2.5 text-sm text-red-700"
            >
              {error}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="edit-username" className="mb-1.5 block text-xs font-medium text-zinc-500">
                User name
              </label>
              <input
                id="edit-username"
                value={form.username}
                onChange={update('username')}
                disabled={saving}
                autoCapitalize="none"
                spellCheck={false}
                className={inputCls}
              />
            </div>

            <div>
              <label htmlFor="edit-password" className="mb-1.5 block text-xs font-medium text-zinc-500">
                New password
              </label>
              <input
                id="edit-password"
                type="text"
                value={form.password}
                onChange={update('password')}
                disabled={saving}
                autoComplete="off"
                placeholder="Leave blank to keep current"
                className={inputCls}
              />
            </div>

            {SELECTS.map((select) => (
              <div key={select.id}>
                <label htmlFor={`edit-${select.id}`} className="mb-1.5 block text-xs font-medium text-zinc-500">
                  {select.label}
                </label>
                <select
                  id={`edit-${select.id}`}
                  value={form[select.id]}
                  onChange={update(select.id)}
                  disabled={saving}
                  className={inputCls}
                >
                  <option value="">Select {select.label.toLowerCase()}</option>
                  {select.options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-zinc-200 px-4 py-3">
          <button type="button" onClick={onClose} disabled={saving} className={btnSecondary}>
            Cancel
          </button>
          <button type="submit" disabled={saving} className={btnPrimary}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            ) : null}
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  );
}

function DeleteDialog({ target, onClose, onDeleted }) {
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const confirm = async () => {
    if (deleting) return;
    setError('');
    setDeleting(true);

    try {
      const response = await fetch(`${API_URL}/api/users/${target.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) throw new Error(data.error || 'Could not delete the user.');

      onDeleted(target);
    } catch (requestError) {
      setError(requestError.message);
      setDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="delete-user-title"
    >
      <div className="w-full max-w-md rounded-md border border-zinc-300 bg-white">
        <div className="border-b border-zinc-200 px-4 py-3">
          <h3 id="delete-user-title" className="text-sm font-semibold text-zinc-900">
            Delete user
          </h3>
        </div>

        <div className="space-y-3 px-4 py-4 text-sm text-zinc-800">
          {error ? (
            <div
              role="alert"
              className="rounded-md border border-l-4 border-zinc-300 border-l-red-700 bg-white px-4 py-2.5 text-sm text-red-700"
            >
              {error}
            </div>
          ) : null}
          <p>
            Delete <span className="font-semibold text-zinc-900">{target.username}</span>? Their account and
            profile picture will be removed permanently. This cannot be undone.
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t border-zinc-200 px-4 py-3">
          <button type="button" onClick={onClose} disabled={deleting} className={btnSecondary}>
            Cancel
          </button>
          <button type="button" onClick={confirm} disabled={deleting} className={btnDanger}>
            {deleting ? (
              <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            ) : (
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            )}
            {deleting ? 'Deleting…' : 'Delete user'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ManageUsers({ user: me, isAdmin }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(isAdmin);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/api/users`, { credentials: 'include', cache: 'no-store' });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) throw new Error(data.error || 'Could not load users.');

      setRows(data.users);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;

    return rows.filter((row) =>
      [row.username, row.work?.factory, row.work?.department, row.work?.designation]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(needle))
    );
  }, [rows, query]);

  const handleSaved = (updated) => {
    setRows((current) => current.map((row) => (row.id === updated.id ? updated : row)));
    setNotice(`Saved changes for ${updated.username}.`);
    setEditing(null);
  };

  const handleDeleted = (removed) => {
    setRows((current) => current.filter((row) => row.id !== removed.id));
    setNotice(`Deleted ${removed.username}.`);
    setRemoving(null);
  };

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <h2 className="text-2xl font-semibold text-zinc-900">Manage users</h2>
        <div
          role="alert"
          className="rounded-md border border-l-4 border-zinc-300 border-l-red-700 bg-white px-4 py-2.5 text-sm text-red-700"
        >
          Only users with the Admin designation can edit other users.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <h2 className="text-2xl font-semibold text-zinc-900">Manage users</h2>
        <p className="mt-0.5 text-sm text-zinc-500 tabular-nums">{rows.length} registered users</p>
      </div>

      {notice ? (
        <div
          role="status"
          className="rounded-md border border-l-4 border-zinc-300 border-l-teal-700 bg-white px-4 py-2.5 text-sm text-zinc-800"
        >
          {notice}
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="rounded-md border border-l-4 border-zinc-300 border-l-red-700 bg-white px-4 py-2.5 text-sm text-red-700"
        >
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-zinc-300 bg-white px-4 py-2.5">
        <div className="relative w-full sm:w-72">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
            aria-hidden="true"
          />
          <label htmlFor="user-search" className="sr-only">
            Search users
          </label>
          <input
            id="user-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, factory, department…"
            className={`${inputCls} pl-9`}
          />
        </div>
        <button type="button" onClick={load} disabled={loading} className={btnSecondary}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      <div className="overflow-hidden rounded-md border border-zinc-300 bg-white">
        <div className="overflow-auto">
          <table className="w-full min-w-[720px] text-left text-[13px]">
            <thead className={thead}>
              <tr>
                <th className={th}>User</th>
                <th className={th}>Factory</th>
                <th className={th}>Floor</th>
                <th className={th}>Department</th>
                <th className={th}>Designation</th>
                <th className={`${th} text-right`}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 text-zinc-800 tabular-nums">
              {filtered.map((row) => (
                <tr key={row.id}>
                  <td className={td}>
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 flex-none items-center justify-center overflow-hidden rounded-md border border-zinc-300 bg-zinc-100 text-[11px] font-semibold text-zinc-500">
                        {row.profilePicture ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={`${API_URL}${row.profilePicture}`}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          initials(row.username)
                        )}
                      </div>
                      <span className="font-medium text-zinc-900">{row.username}</span>
                      {row.id === me.id ? <span className="text-xs text-zinc-500">(you)</span> : null}
                    </div>
                  </td>
                  <td className={td}>{row.work?.factory || '—'}</td>
                  <td className={td}>{row.work?.floor || '—'}</td>
                  <td className={td}>{row.work?.department || '—'}</td>
                  <td className={td}>
                    <span
                      className={
                        (row.work?.designation || '').toLowerCase() === 'admin'
                          ? 'font-semibold text-teal-800'
                          : undefined
                      }
                    >
                      {row.work?.designation || '—'}
                    </span>
                  </td>
                  <td className={`${td} text-right`}>
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setNotice('');
                          setEditing(row);
                        }}
                        className={`inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 ${focus}`}
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setNotice('');
                          setRemoving(row);
                        }}
                        disabled={row.id === me.id}
                        title={row.id === me.id ? 'You cannot delete your own account' : undefined}
                        className={`inline-flex items-center gap-1.5 rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white ${focus}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {loading && rows.length === 0 ? (
          <div className="flex items-center justify-center gap-2 px-4 py-12 text-sm text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            Loading users…
          </div>
        ) : null}

        {!loading && filtered.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-zinc-500">
            {query ? 'No users match your search.' : 'No users yet.'}
          </div>
        ) : null}
      </div>

      {removing ? (
        <DeleteDialog target={removing} onClose={() => setRemoving(null)} onDeleted={handleDeleted} />
      ) : null}

      {editing ? (
        <EditDialog
          key={editing.id}
          target={editing}
          currentUserId={me.id}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      ) : null}
    </div>
  );
}

export default function UsersPage() {
  return <AppShell>{({ user, isAdmin }) => <ManageUsers user={user} isAdmin={isAdmin} />}</AppShell>;
}