// frontend/app/employees/page.js

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '../components/AppShell';
import { api } from '../../lib/api';
import { SYNC_EVENT } from '../../lib/sync';

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
  { key: 'proximityId', label: 'Proximity Id (Device ID)', required: true },
];

const empty = Object.fromEntries(fields.map((f) => [f.key, '']));

// yyyy-mm-dd -> dd-mm-yyyy
const fmtDate = (d) => (d ? d.slice(0, 10).split('-').reverse().join('-') : '-');
const initials = (n) =>
  (n || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

const th = 'border-b border-slate-200 px-3 py-3 font-semibold';
const td = 'break-words px-3 py-3 align-middle';

export default function EmployeesPage() {
  const router = useRouter();
  const [form, setForm] = useState(empty);
  const [list, setList] = useState([]);
  const [editId, setEditId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [msg, setMsg] = useState(null); // { type: 'ok' | 'err', text }
  const [saving, setSaving] = useState(false);

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

  const input =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

  return (
    <AppShell title="Employees">
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
          className={`rounded-lg px-4 py-2 text-sm font-medium shadow-sm transition ${
            showForm
              ? 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {showForm ? 'Close Form' : '+ New Employee'}
        </button>
      </div>

      {msg && (
        <div
          className={`mb-4 rounded-lg border px-4 py-2.5 text-sm ${
            msg.type === 'ok'
              ? 'border-green-200 bg-green-50 text-green-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <form onSubmit={submit} className="mb-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-white px-5 py-3">
            <span className="h-2 w-2 rounded-full bg-blue-600" />
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
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-800">Employee List</span>
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">{shown.length}</span>
          </div>
          <div className="relative w-full sm:w-64">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="7" />
              <path strokeLinecap="round" d="m20 20-3.5-3.5" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, ID, department..."
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>

        <div className="max-h-[calc(100vh-260px)] overflow-y-auto overflow-x-hidden">
          <table className="w-full table-fixed text-left text-sm">
            <colgroup>
              <col className="w-[14%] md:w-[9%]" />
              <col className="w-[30%] md:w-[20%]" />
              <col className="hidden xl:table-column w-[8%]" />
              <col className="hidden 2xl:table-column w-[5%]" />
              <col className="hidden 2xl:table-column w-[5%]" />
              <col className="hidden md:table-column w-[12%]" />
              <col className="hidden md:table-column w-[12%]" />
              <col className="hidden lg:table-column w-[9%]" />
              <col className="hidden xl:table-column w-[9%]" />
              <col className="hidden xl:table-column w-[7%]" />
              <col className="w-[22%] md:w-[10%]" />
              <col className="w-[34%] md:w-[10%]" />
            </colgroup>

            <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className={th}>Emp ID</th>
                <th className={th}>Name</th>
                <th className={`${th} hidden xl:table-cell`}>Joined</th>
                <th className={`${th} hidden 2xl:table-cell`}>Grade</th>
                <th className={`${th} hidden 2xl:table-cell`}>Line</th>
                <th className={`${th} hidden md:table-cell`}>Designation</th>
                <th className={`${th} hidden md:table-cell`}>Department</th>
                <th className={`${th} hidden lg:table-cell`}>Section</th>
                <th className={`${th} hidden xl:table-cell`}>Sub Section</th>
                <th className={`${th} hidden xl:table-cell`}>Card No</th>
                <th className={th}>Device ID</th>
                <th className={`${th} text-right`}>Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {shown.map((e) => (
                <tr
                  key={e._id}
                  onClick={() => router.push(`/employees/${e._id}`)}
                  className="group cursor-pointer transition odd:bg-white even:bg-slate-50/40 hover:bg-blue-50"
                >
                  <td className={`${td} font-medium text-slate-800`}>{e.employeeId}</td>
                  <td className={td}>
                    <div className="flex items-center gap-2.5">
                      <span className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700 sm:flex">
                        {initials(e.name)}
                      </span>
                      <div className="min-w-0">
                        <div className="font-medium text-slate-800 group-hover:text-blue-700">{e.name}</div>
                        <div className="text-[11px] text-slate-500 md:hidden">
                          {[e.designation, e.department].filter(Boolean).join(' • ')}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className={`${td} hidden text-slate-600 xl:table-cell`}>{fmtDate(e.joinDate)}</td>
                  <td className={`${td} hidden 2xl:table-cell`}>{e.grade}</td>
                  <td className={`${td} hidden 2xl:table-cell`}>{e.line}</td>
                  <td className={`${td} hidden text-slate-700 md:table-cell`}>{e.designation}</td>
                  <td className={`${td} hidden md:table-cell`}>
                    {e.department && (
                      <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                        {e.department}
                      </span>
                    )}
                  </td>
                  <td className={`${td} hidden lg:table-cell`}>{e.section}</td>
                  <td className={`${td} hidden xl:table-cell`}>{e.subSection}</td>
                  <td className={`${td} hidden xl:table-cell`}>{e.cardNo}</td>
                  <td className={td}>
                    <span className="inline-block rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                      {e.proximityId}
                    </span>
                  </td>
                  <td className={`${td} text-right`}>
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <button
                        onClick={(ev) => {
                          ev.stopPropagation();
                          edit(e);
                        }}
                        className="rounded-md border border-slate-200 px-2 py-1 text-xs text-blue-600 hover:border-blue-300 hover:bg-blue-50"
                      >
                        Edit
                      </button>
                      <button
                        onClick={(ev) => {
                          ev.stopPropagation();
                          remove(e);
                        }}
                        className="rounded-md border border-slate-200 px-2 py-1 text-xs text-red-600 hover:border-red-300 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!shown.length && (
                <tr>
                  <td colSpan={12} className="px-3 py-12 text-center text-sm text-slate-400">
                    No employees found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}