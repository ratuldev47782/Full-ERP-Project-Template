// frontend/app/holidays/page.js

'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import AppShell from '../components/AppShell';
import { api } from '../../lib/api';
import { todayDhaka, fmtDate, dayName } from '../../lib/format';

const input =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

export default function HolidaysPage() {
  const [year, setYear] = useState(todayDhaka().slice(0, 4));
  const [list, setList] = useState([]);
  const [date, setDate] = useState('');
  const [name, setName] = useState('');
  const [editId, setEditId] = useState(null);
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!/^\d{4}$/.test(year)) return;
    setLoading(true);
    try {
      setList(await api(`/api/holidays?year=${year}`));
    } catch (e) {
      setMsg({ type: 'err', text: e.message });
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    load();
  }, [load]);

  const reset = () => {
    setDate('');
    setName('');
    setEditId(null);
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const r = await api(editId ? `/api/holidays/${editId}` : '/api/holidays', {
        method: editId ? 'PUT' : 'POST',
        body: JSON.stringify({ date, name }),
      });
      let text = editId ? 'Holiday updated.' : 'Holiday added.';
      if (r.conflictingLeaves) text += ` Note: ${r.conflictingLeaves} leave record(s) exist on this date; the report will show Holiday.`;
      setMsg({ type: 'ok', text });
      if (date.slice(0, 4) !== year) setYear(date.slice(0, 4));
      reset();
      load();
    } catch (err) {
      setMsg({ type: 'err', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const edit = (h) => {
    setEditId(h._id);
    setDate(h.date);
    setName(h.name);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const remove = async (h) => {
    if (!confirm(`Delete holiday "${h.name}" (${fmtDate(h.date)})?`)) return;
    try {
      await api(`/api/holidays/${h._id}`, { method: 'DELETE' });
      load();
    } catch (err) {
      setMsg({ type: 'err', text: err.message });
    }
  };

  return (
    <AppShell title="Holidays">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Holiday Management</h2>
          <p className="text-xs text-slate-500">Configured holidays automatically show as Holiday in every report.</p>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          Year
          <input
            type="number"
            min="2000"
            max="2100"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="w-24 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-blue-500"
          />
        </label>
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

      <form onSubmit={submit} className="mb-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-800">
          {editId ? 'Edit Holiday' : 'Add Holiday'}
        </div>
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Date <span className="text-red-500">*</span></label>
            <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={input} />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-600">Holiday Name / Description <span className="text-red-500">*</span></label>
            <input required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} className={input} />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
          {editId && (
            <button type="button" onClick={reset} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">
              Cancel
            </button>
          )}
          <button disabled={saving} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-60">
            {!editId && <Plus className="h-4 w-4" />}
            {saving ? 'Saving...' : editId ? 'Update' : 'Add Holiday'}
          </button>
        </div>
      </form>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-3 text-sm font-semibold text-slate-800">
          Holidays in {year}
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">{list.length}</span>
          {loading && <span className="text-xs font-normal text-slate-500">Loading...</span>}
        </div>
        <div className="max-h-[calc(100vh-420px)] min-h-[160px] overflow-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 text-left font-semibold">Date</th>
                <th className="px-5 py-3 text-left font-semibold">Day</th>
                <th className="px-5 py-3 text-left font-semibold">Name</th>
                <th className="px-5 py-3 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.map((h) => (
                <tr key={h._id} className="hover:bg-blue-50">
                  <td className="px-5 py-3 font-medium text-slate-800">{fmtDate(h.date)}</td>
                  <td className="px-5 py-3 text-slate-600">{dayName(h.date)}</td>
                  <td className="px-5 py-3 text-slate-700">{h.name}</td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => edit(h)} title="Edit" aria-label="Edit" className="rounded-md p-2 text-slate-500 hover:bg-blue-100 hover:text-blue-700">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => remove(h)} title="Delete" aria-label="Delete" className="rounded-md p-2 text-slate-500 hover:bg-red-100 hover:text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!list.length && (
                <tr>
                  <td colSpan={4} className="px-3 py-12 text-center text-sm text-slate-400">
                    No holidays configured for {year}.
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