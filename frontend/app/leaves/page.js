// frontend/app/leaves/page.js

'use client';

import { useCallback, useEffect, useState } from 'react';
import { Pencil, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import AppShell from '../components/AppShell';
import EmployeeSearch, { EmployeeInfo } from '../components/EmployeeSearch';
import { api } from '../../lib/api';
import { todayDhaka, fmtDate } from '../../lib/format';

const TYPES = [
  ['CL', 'Casual Leave'],
  ['SL', 'Sick Leave'],
  ['EL', 'Earned Leave'],
];

const input =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

export default function LeavesPage() {
  const [emp, setEmp] = useState(null);
  const [date, setDate] = useState('');
  const [type, setType] = useState('CL');
  const [note, setNote] = useState('');
  const [editId, setEditId] = useState(null);
  const [month, setMonth] = useState(todayDhaka().slice(0, 7));
  const [list, setList] = useState([]);
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const qs = new URLSearchParams({ month });
      if (emp) qs.set('employee', emp._id);
      setList(await api(`/api/leaves?${qs}`));
    } catch (e) {
      setMsg({ type: 'err', text: e.message });
    }
  }, [month, emp]);

  useEffect(() => {
    load();
  }, [load]);

  const reset = () => {
    setDate('');
    setType('CL');
    setNote('');
    setEditId(null);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!emp) return setMsg({ type: 'err', text: 'Search and select an employee first.' });
    setSaving(true);
    setMsg(null);
    try {
      await api(editId ? `/api/leaves/${editId}` : '/api/leaves', {
        method: editId ? 'PUT' : 'POST',
        body: JSON.stringify({ employee: emp._id, date, type, note }),
      });
      setMsg({ type: 'ok', text: editId ? 'Leave updated.' : `${type} assigned to ${emp.name} on ${fmtDate(date)}.` });
      if (date.slice(0, 7) !== month) setMonth(date.slice(0, 7));
      reset();
      load();
    } catch (err) {
      setMsg({ type: 'err', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const edit = (l) => {
    setEmp(l.employee);
    setEditId(l._id);
    setDate(l.date);
    setType(l.type);
    setNote(l.note || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const remove = async (l) => {
    if (!confirm(`Delete ${l.type} of ${l.employee.name} on ${fmtDate(l.date)}?`)) return;
    try {
      await api(`/api/leaves/${l._id}`, { method: 'DELETE' });
      load();
    } catch (err) {
      setMsg({ type: 'err', text: err.message });
    }
  };

  return (
    <AppShell title="Leave Management">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Leave Management (CL / SL / EL)</h2>
          <p className="text-xs text-slate-500">Search an employee, pick the absent date and leave type. Holidays cannot be assigned leave.</p>
        </div>
        <EmployeeSearch
          onSelect={(x) => {
            setEmp(x);
            reset();
          }}
        />
      </div>

      {msg && (
        <div
          className={`mb-4 flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm ${
            msg.type === 'ok' ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {msg.type === 'ok' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
          {msg.text}
        </div>
      )}

      {emp && (
        <div className="mb-4">
          <div className="mb-2 flex items-center gap-3">
            <span className="text-sm font-semibold text-slate-800">{emp.name}</span>
            <button onClick={() => { setEmp(null); reset(); }} className="text-xs font-medium text-blue-600 hover:text-blue-800">
              Clear selection
            </button>
          </div>
          <EmployeeInfo emp={emp} />
        </div>
      )}

      <form onSubmit={submit} className="mb-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-800">
          {editId ? 'Edit Leave' : 'Assign Leave'}
        </div>
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Absent Date <span className="text-red-500">*</span></label>
            <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={input} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Leave Type <span className="text-red-500">*</span></label>
            <select value={type} onChange={(e) => setType(e.target.value)} className={input}>
              {TYPES.map(([k, label]) => (
                <option key={k} value={k}>
                  {k} - {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Note (optional)</label>
            <input maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} className={input} />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
          {editId && (
            <button type="button" onClick={reset} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">
              Cancel
            </button>
          )}
          <button disabled={saving || !emp} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-60">
            {saving ? 'Saving...' : editId ? 'Update Leave' : 'Save Leave'}
          </button>
        </div>
      </form>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            Leave Records {emp ? `- ${emp.name}` : '- all employees'}
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">{list.length}</span>
          </div>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            Month
            <input
              type="month"
              value={month}
              onChange={(e) => e.target.value && setMonth(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-blue-500"
            />
          </label>
        </div>
        <div className="max-h-[calc(100vh-460px)] min-h-[160px] overflow-auto">
          <table className="w-full min-w-[620px] text-sm">
            <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 text-left font-semibold">Date</th>
                <th className="px-5 py-3 text-left font-semibold">Employee</th>
                <th className="px-5 py-3 text-left font-semibold">Type</th>
                <th className="px-5 py-3 text-left font-semibold">Note</th>
                <th className="px-5 py-3 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.map((l) => (
                <tr key={l._id} className="hover:bg-blue-50">
                  <td className="px-5 py-3 font-medium text-slate-800">{fmtDate(l.date)}</td>
                  <td className="px-5 py-3 text-slate-700">
                    {l.employee.name} <span className="text-xs text-slate-400">({l.employee.employeeId})</span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="inline-block rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-medium text-sky-700 ring-1 ring-inset ring-sky-200">
                      {l.type}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-600">{l.note || '—'}</td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => edit(l)} title="Edit" aria-label="Edit" className="rounded-md p-2 text-slate-500 hover:bg-blue-100 hover:text-blue-700">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => remove(l)} title="Delete" aria-label="Delete" className="rounded-md p-2 text-slate-500 hover:bg-red-100 hover:text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!list.length && (
                <tr>
                  <td colSpan={5} className="px-3 py-12 text-center text-sm text-slate-400">
                    No leave records for this month.
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