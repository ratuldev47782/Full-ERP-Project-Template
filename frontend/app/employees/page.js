// frontend/app/employees/page.js

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '../components/AppShell';
import { api } from '../../lib/api';

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

  // compact input
  const input =
    'w-full rounded border border-slate-300 px-2 py-1 text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500';

  return (
    <AppShell title="Register Employee">
      {/* Toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <button
          onClick={() => {
            if (showForm) reset();
            setShowForm((s) => !s);
          }}
          className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          {showForm ? 'Close Form' : '+ New Employee'}
        </button>
        {msg && (
          <span className={`text-sm ${msg.type === 'ok' ? 'text-green-600' : 'text-red-600'}`}>{msg.text}</span>
        )}
      </div>

      {/* Compact form (collapsible) */}
      {showForm && (
        <form onSubmit={submit} className="mb-4 rounded border border-slate-200 bg-white shadow-sm">
          <div className="border-b bg-slate-50 px-4 py-2 text-sm font-semibold">
            {editId ? 'Edit Employee' : 'New Employee'}
          </div>

          <div className="grid gap-3 p-4 sm:grid-cols-3 lg:grid-cols-6">
            {fields.map((f) => (
              <div key={f.key}>
                <label className="mb-0.5 block text-[11px] font-medium text-slate-600">
                  {f.label} {f.required && <span className="text-red-500">*</span>}
                </label>
                <input
                  type={f.type || 'text'}
                  required={f.required}
                  value={form[f.key]}
                  onChange={(e) => change(f.key, e.target.value)}
                  className={`${input} ${f.key === 'proximityId' ? 'border-blue-400 bg-blue-50' : ''}`}
                />
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 border-t bg-slate-50 px-4 py-2">
            <button
              disabled={saving}
              className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? 'Saving...' : editId ? 'Update' : 'Register'}
            </button>
            <button
              type="button"
              onClick={reset}
              className="rounded border border-slate-300 bg-white px-4 py-1.5 text-sm hover:bg-slate-100"
            >
              Clear
            </button>
          </div>
        </form>
      )}

      {/* List - main focus */}
      <div className="rounded border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b bg-slate-50 px-4 py-2">
          <span className="text-sm font-semibold">
            Employee List ({shown.length}) <span className="ml-2 text-xs font-normal text-slate-500">Click a row to view attendance</span>
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="w-36 rounded border border-slate-300 px-2 py-1 text-xs outline-none focus:border-blue-500"
          />
        </div>

        <div className="max-h-[calc(100vh-190px)] overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 z-10 bg-slate-100 text-xs uppercase text-slate-600">
              <tr>
                {['Emp ID', 'Name', 'Join Date', 'Grade', 'Line', 'Designation', 'Department', 'Section', 'Sub Section', 'Card No', 'Proximity Id', 'Action'].map(
                  (h) => (
                    <th key={h} className="whitespace-nowrap border-b px-3 py-3">
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {shown.map((e) => (
                <tr
                  key={e._id}
                  onClick={() => router.push(`/employees/${e._id}`)}
                  className="cursor-pointer border-b hover:bg-blue-50"
                >
                  <td className="px-3 py-3 font-medium">{e.employeeId}</td>
                  <td className="px-3 py-3">{e.name}</td>
                  <td className="whitespace-nowrap px-3 py-3">{fmtDate(e.joinDate)}</td>
                  <td className="px-3 py-3">{e.grade}</td>
                  <td className="px-3 py-3">{e.line}</td>
                  <td className="px-3 py-3">{e.designation}</td>
                  <td className="px-3 py-3">{e.department}</td>
                  <td className="px-3 py-3">{e.section}</td>
                  <td className="px-3 py-3">{e.subSection}</td>
                  <td className="px-3 py-3">{e.cardNo}</td>
                  <td className="px-3 py-3 font-semibold text-blue-700">{e.proximityId}</td>
                  <td className="whitespace-nowrap px-3 py-3">
                    <button
                      onClick={(ev) => {
                        ev.stopPropagation();
                        edit(e);
                      }}
                      className="mr-2 text-xs text-blue-600 hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={(ev) => {
                        ev.stopPropagation();
                        remove(e);
                      }}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {!shown.length && (
                <tr>
                  <td colSpan={12} className="px-3 py-8 text-center text-slate-400">
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