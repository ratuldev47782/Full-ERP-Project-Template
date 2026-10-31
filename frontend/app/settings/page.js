// frontend/app/settings/page.js

'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import AppShell from '../components/AppShell';
import { api } from '../../lib/api';
import { WEEKDAYS } from '../../lib/format';

const input =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

const toMin = (t) => {
  const [h, m] = String(t || '0:0').split(':').map(Number);
  return h * 60 + m;
};
const hours = (m) => `${Number((m / 60).toFixed(2))} Hours`;

export default function SettingsPage() {
  const [f, setF] = useState(null);
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api('/api/settings')
      .then(setF)
      .catch((e) => setMsg({ type: 'err', text: e.message }));
  }, []);

  const set = (k, v) => setF((o) => ({ ...o, [k]: v }));
  const toggleDay = (i) =>
    setF((o) => ({
      ...o,
      weekendDays: o.weekendDays.includes(i) ? o.weekendDays.filter((d) => d !== i) : [...o.weekendDays, i].sort(),
    }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      setF(await api('/api/settings', { method: 'PUT', body: JSON.stringify(f) }));
      setMsg({ type: 'ok', text: 'Settings saved. All attendance and OT calculations now use these values.' });
    } catch (err) {
      setMsg({ type: 'err', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const total = f ? toMin(f.officeEnd) - toMin(f.officeStart) : 0;
  const lunch = f ? toMin(f.lunchEnd) - toMin(f.lunchStart) : 0;

  const time = (k, label) => (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      <input type="time" required value={f[k]} onChange={(e) => set(k, e.target.value)} className={input} />
    </div>
  );

  return (
    <AppShell title="Settings">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-800">Working Hour Settings</h2>
        <p className="text-xs text-slate-500">Office hours, lunch, weekend and company details used for attendance, OT and PDF.</p>
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

      {!f ? (
        <div className="text-sm text-slate-500">Loading...</div>
      ) : (
        <form onSubmit={save} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
            {time('officeStart', 'Office Start Time')}
            {time('officeEnd', 'Office End Time')}
            {time('lunchStart', 'Lunch Start Time')}
            {time('lunchEnd', 'Lunch End Time')}
          </div>

          <div className="grid grid-cols-1 gap-3 border-t border-slate-100 px-5 py-4 sm:grid-cols-3">
            {[
              ['Total Office Duration', hours(total)],
              ['Lunch Duration', hours(lunch)],
              ['Actual Working Hours', hours(total - lunch)],
            ].map(([a, b]) => (
              <div key={a} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5">
                <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{a}</div>
                <div className="text-sm font-semibold text-slate-800">{b}</div>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-100 px-5 py-4">
            <div className="mb-2 text-xs font-medium text-slate-600">Weekend days</div>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((d, i) => (
                <label
                  key={d}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${
                    f.weekendDays.includes(i) ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-slate-300 text-slate-600'
                  }`}
                >
                  <input type="checkbox" checked={f.weekendDays.includes(i)} onChange={() => toggleDay(i)} />
                  {d}
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 border-t border-slate-100 p-5 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Company Name (PDF header)</label>
              <input value={f.companyName} onChange={(e) => set('companyName', e.target.value)} className={input} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Company Address (PDF header)</label>
              <input value={f.companyAddress} onChange={(e) => set('companyAddress', e.target.value)} className={input} />
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
            <span className="text-xs text-slate-500">OT grace period: fixed 15 minutes (not editable).</span>
            <button
              disabled={saving}
              className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      )}
    </AppShell>
  );
}