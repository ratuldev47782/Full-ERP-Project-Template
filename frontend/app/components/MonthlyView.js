// frontend/app/components/MonthlyView.js

'use client';

import { useEffect, useState } from 'react';
import { Download, Printer, Loader2, Pencil } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API || 'http://localhost:5000';
const SYNC_EVENT = 'attendance:synced';

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

// PDF blob fetch (token header shoho)
async function fetchPdfBlob(path) {
  const res = await fetch(API + path, { headers: authHeader() });
  if (res.status === 401) unauthorized();
  if (!res.ok) {
    let msg = 'PDF request failed';
    try {
      msg = (await res.json()).error || msg;
    } catch {}
    throw new Error(msg);
  }
  return res.blob();
}

// PDF download: browser-e save kore
async function downloadFile(path, filename) {
  const url = URL.createObjectURL(await fetchPdfBlob(path));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Print: ekoi server PDF hidden iframe-e khule print dialog dekhay
async function printFile(path) {
  const url = URL.createObjectURL(await fetchPdfBlob(path));
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  iframe.src = url;
  iframe.onload = () => {
    setTimeout(() => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch {
        window.open(url, '_blank');
      }
    }, 400);
  };
  document.body.appendChild(iframe);
  setTimeout(() => {
    iframe.remove();
    URL.revokeObjectURL(url);
  }, 120000);
}

/* ---------- formatting (Asia/Dhaka) ---------- */
const TZ = 'Asia/Dhaka';
const pad = (n) => String(n).padStart(2, '0');
const todayDhaka = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ });
const fmtDate = (d) => (d ? String(d).slice(0, 10).split('-').reverse().join('-') : '-');
const fmtTime = (d) =>
  d ? new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: TZ }) : '-';
const dayName = (dateStr) =>
  new Date(`${dateStr}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' });
const fmtHM = (min) => `${pad(Math.floor((min || 0) / 60))}:${pad((min || 0) % 60)}`;

// "02:30" -> 150, khali -> null, thik na hole NaN
const hmToMin = (s) => {
  const v = String(s || '').trim();
  if (!v) return null;
  const m = /^(\d{1,2}):([0-5]\d)$/.exec(v);
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
};

/* ---------- shared classes ---------- */
const focus = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700/40';
const inputCls =
  'rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/25';
const btnPrimary = `rounded-md bg-teal-800 px-4 py-2 text-sm font-medium text-white hover:bg-teal-900 disabled:opacity-60 ${focus}`;
const btnSecondary = `rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60 ${focus}`;
const linkBtn = `rounded text-sm font-medium text-teal-800 hover:underline disabled:opacity-60 ${focus}`;
const th = 'px-4 py-2.5 font-medium whitespace-nowrap';
const td = 'px-4 py-2.5 align-top';

const fields = [
  ['Join date', 'joinDate'],
  ['Grade', 'grade'],
  ['Line', 'line'],
  ['Designation', 'designation'],
  ['Department', 'department'],
  ['Section', 'section'],
  ['Sub section', 'subSection'],
  ['Card no', 'cardNo'],
];

// Month ruler: ek din = ekta tick. Rong shudhu status bujhate.
const tickTone = (status) => {
  switch (status) {
    case 'Present':
      return 'bg-teal-800';
    case 'Missing Out':
      return 'bg-red-700/50';
    case 'Absent':
      return 'bg-red-700';
    case 'CL':
    case 'SL':
    case 'EL':
      return 'bg-zinc-500';
    case 'Holiday':
    case 'Weekend':
      return 'bg-zinc-300';
    default:
      return 'border border-zinc-200 bg-white'; // future / not joined
  }
};

const legend = [
  ['Present', 'bg-teal-800'],
  ['Missing out', 'bg-red-700/50'],
  ['Absent', 'bg-red-700'],
  ['Leave', 'bg-zinc-500'],
  ['Holiday or weekend', 'bg-zinc-300'],
];

function MonthRuler({ days, summary }) {
  const last = days.length;
  return (
    <div>
      <div
        role="img"
        aria-label={`Month overview: ${summary.presentDays} present, ${summary.absent} absent, ${summary.missingOut} missing out, ${summary.holidayTotal} holiday or weekend, ${summary.leave} on leave`}
      >
        <div className="flex gap-px" aria-hidden="true">
          {days.map((d) => (
            <div
              key={d.date}
              title={`${fmtDate(d.date)}: ${d.status ? (d.status === 'Missing Out' ? 'Missing out' : d.status) : 'No record'}`}
              className={`h-6 flex-1 ${tickTone(d.status)}`}
            />
          ))}
        </div>
        <div className="mt-1 flex gap-px text-xs text-zinc-500 tabular-nums" aria-hidden="true">
          {days.map((d, i) => {
            const n = i + 1;
            const show = n === 1 || n % 5 === 0 || n === last;
            return (
              <div key={d.date} className="flex-1 whitespace-nowrap text-center">
                {show ? n : ''}
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-500">
        {legend.map(([label, tone]) => (
          <span key={label} className="inline-flex items-center gap-1.5">
            <span className={`inline-block h-3 w-3 ${tone}`} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------- Edit modal: In / Out / Overtime ---------- */
function EditDayModal({ empId, day, onClose, onSaved }) {
  const e = day.edit;
  const [inTime, setInTime] = useState(e?.inTime || '');
  const [outTime, setOutTime] = useState(e?.outTime || '');
  const [ot, setOt] = useState(e && e.otMinutes != null ? fmtHM(e.otMinutes) : '');
  const [note, setNote] = useState(e?.note || '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    const onKey = (ev) => {
      if (ev.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [saving, onClose]);

  const send = async (payload) => {
    setSaving(true);
    setErr(null);
    try {
      await api(`/api/employees/${empId}/attendance-edit`, {
        method: 'PUT',
        body: JSON.stringify({ date: day.date, ...payload }),
      });
      onSaved();
    } catch (x) {
      setErr(x.message);
    } finally {
      setSaving(false);
    }
  };

  const save = (ev) => {
    ev.preventDefault();
    const otMin = hmToMin(ot);
    if (Number.isNaN(otMin)) return setErr('Overtime must be in HH:MM format, for example 02:30.');
    send({ inTime, outTime, otMinutes: otMin, note });
  };

  const reset = () => send({ inTime: '', outTime: '', otMinutes: null, note: '' });

  const hint = 'mt-1 text-xs text-zinc-500 tabular-nums';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-zinc-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-day-title"
    >
      <form onSubmit={save} className="w-full max-w-md overflow-hidden rounded-md border border-zinc-300 bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-5 py-4">
          <h3 id="edit-day-title" className="text-base font-semibold text-zinc-900">
            Edit {fmtDate(day.date)} ({dayName(day.date)})
          </h3>
          <button type="button" onClick={onClose} disabled={saving} className={linkBtn}>
            Close
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {err && (
            <div role="alert" className="rounded-md border border-l-4 border-zinc-300 border-l-red-700 bg-white px-3 py-2 text-sm text-red-700">
              {err}
            </div>
          )}
          <p className="text-sm text-zinc-500">
            Leave a field empty to use the device punch. Device data is never changed; this only overrides the report and PDF.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="ed-in" className="mb-1 block text-sm text-zinc-700">In time</label>
              <input id="ed-in" type="time" value={inTime} onChange={(x) => setInTime(x.target.value)} className={`${inputCls} w-full`} />
              <p className={hint}>Device: {fmtTime(day.rawIn)}</p>
            </div>
            <div>
              <label htmlFor="ed-out" className="mb-1 block text-sm text-zinc-700">Out time</label>
              <input id="ed-out" type="time" value={outTime} onChange={(x) => setOutTime(x.target.value)} className={`${inputCls} w-full`} />
              <p className={hint}>Device: {fmtTime(day.rawOut)}</p>
            </div>
          </div>

          <div>
            <label htmlFor="ed-ot" className="mb-1 block text-sm text-zinc-700">Overtime (HH:MM)</label>
            <input
              id="ed-ot"
              value={ot}
              onChange={(x) => setOt(x.target.value)}
              placeholder="Auto"
              inputMode="numeric"
              className={`${inputCls} w-full`}
            />
            <p className={hint}>Auto calculation: {fmtHM(day.autoOtMinutes)}</p>
            <p className={hint}>When you enter overtime, Hours becomes regular hours plus this overtime.</p>
          </div>

          <div>
            <label htmlFor="ed-note" className="mb-1 block text-sm text-zinc-700">Note (optional)</label>
            <input id="ed-note" maxLength={200} value={note} onChange={(x) => setNote(x.target.value)} className={`${inputCls} w-full`} />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-zinc-200 px-5 py-3">
          <button
            type="button"
            onClick={reset}
            disabled={saving || !day.edited}
            className="rounded text-sm font-medium text-red-700 hover:underline disabled:opacity-40"
          >
            Reset to device data
          </button>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} disabled={saving} className={btnSecondary}>
              Cancel
            </button>
            <button disabled={saving} className={btnPrimary}>
              {saving ? 'Saving' : 'Save'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

// Ekjon employee-er mashik hajira + summary + edit + PDF download + print.
export default function MonthlyView({ id }) {
  const [month, setMonth] = useState(todayDhaka().slice(0, 7));
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [printBusy, setPrintBusy] = useState(false);
  const [tick, setTick] = useState(0); // sync / edit hole data reload korar jonno
  const [editing, setEditing] = useState(null); // day object

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const r = await api(`/api/employees/${id}/monthly?month=${month}`);
        if (!cancelled) setData(r);
      } catch (e) {
        if (!cancelled) setErr(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, month, tick]);

  useEffect(() => {
    const h = () => setTick((t) => t + 1);
    window.addEventListener(SYNC_EVENT, h);
    return () => window.removeEventListener(SYNC_EVENT, h);
  }, []);

  const emp = data?.employee;
  const s = data?.summary;
  const today = todayDhaka();

  const pdf = async () => {
    if (!emp) return;
    setPdfBusy(true);
    setErr(null);
    try {
      await downloadFile(`/api/employees/${id}/monthly-pdf?month=${month}`, `Attendance_${emp.employeeId}_${month}.pdf`);
    } catch (e) {
      setErr(e.message);
    } finally {
      setPdfBusy(false);
    }
  };

  const printPage = async () => {
    if (!emp) return;
    setPrintBusy(true);
    setErr(null);
    try {
      await printFile(`/api/employees/${id}/monthly-pdf?month=${month}`);
    } catch (e) {
      setErr(e.message);
    } finally {
      setPrintBusy(false);
    }
  };

  const num = (n) => Number(Number(n || 0).toFixed(2));
  const otHours = s ? num(s.otHours) : 0;
  // General hours = regular working hours (OT bad)
  const generalHours = data ? num(data.days.reduce((a, d) => a + (d.regularMinutes || 0), 0) / 60) : 0;
  const strong = 'text-zinc-900';
  const cells = s
    ? [
        ['Present', s.presentDays, strong],
        ['Absent', s.absent, s.absent > 0 ? 'text-red-700' : strong],
        ['Missing out', s.missingOut, s.missingOut > 0 ? 'text-red-700' : strong],
        ['CL', s.cl, strong],
        ['SL', s.sl, strong],
        ['EL', s.el, strong],
        ['OT hours', otHours, 'text-teal-800'],
        ['General hours', generalHours, strong],
      ]
    : [];

  return (
    <>
      <div className="mb-5">
        <h2 className="text-2xl font-semibold text-zinc-900">{emp ? emp.name : 'Employee attendance'}</h2>
        <p className="mt-1 text-sm text-zinc-500 tabular-nums">
          {emp ? `Employee ID ${emp.employeeId}, device ID ${emp.proximityId}` : loading ? 'Loading' : ''}
        </p>
      </div>

      {err && (
        <div role="alert" className="mb-4 rounded-md border border-l-4 border-zinc-300 border-l-red-700 bg-white px-4 py-3 text-sm text-red-700">
          {err}
        </div>
      )}

      <div className="overflow-hidden rounded-md border border-zinc-300 bg-white">
        {/* Employee details (compact) */}
        {emp && (
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 px-4 py-3 sm:grid-cols-4">
            {fields.map(([label, key]) => (
              <div key={key} className="min-w-0">
                <dt className="text-xs text-zinc-500">{label}</dt>
                <dd className="truncate text-sm text-zinc-900 tabular-nums">
                  {key === 'joinDate' ? fmtDate(emp.joinDate) : emp[key] || '-'}
                </dd>
              </div>
            ))}
          </dl>
        )}

        {/* Month controls */}
        <div className="flex flex-wrap items-center gap-3 border-t border-zinc-200 px-4 py-3">
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            Month
            <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className={inputCls} />
          </label>
          <button onClick={pdf} disabled={!emp || pdfBusy} className={`${btnSecondary} flex items-center gap-2`}>
            {pdfBusy ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <Download className="h-4 w-4" />}
            {pdfBusy ? 'Preparing PDF' : 'Download PDF'}
          </button>
          <button onClick={printPage} disabled={!emp || printBusy} className={`${btnSecondary} flex items-center gap-2`}>
            {printBusy ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <Printer className="h-4 w-4" />}
            {printBusy ? 'Preparing print' : 'Print'}
          </button>
          <span className="text-sm text-zinc-500">Times are in Bangladesh time. PDF and print include manual edits.</span>
          {loading && <span className="text-sm text-zinc-500">Loading</span>}
        </div>

        {/* Monthly summary: one ruled strip */}
        {s && (
          <div className="border-t border-zinc-200 px-4 py-3">
            <div role="group" aria-label="Monthly summary" className="grid grid-cols-4 gap-px border border-zinc-300 bg-zinc-200 lg:grid-cols-8">
              {cells.map(([label, value, tone]) => (
                <div key={label} className="bg-white px-3 py-2">
                  <div className="text-xs text-zinc-500">{label}</div>
                  <div className={`text-xl font-semibold tabular-nums ${tone}`}>{value}</div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-sm text-zinc-500 tabular-nums">
              Present includes {s.missingOut} day{s.missingOut === 1 ? '' : 's'} with a missing check-out. Holiday and weekend: {s.holidayTotal} days.
              General hours exclude overtime. Total hours with overtime: {num(s.totalHours)}.
            </p>
          </div>
        )}

        {/* Month ruler */}
        {s && (
          <div className="border-t border-zinc-200 px-4 py-3">
            <MonthRuler days={data.days} summary={s} />
          </div>
        )}

        {/* Daily table */}
        <div className="overflow-x-auto border-t border-zinc-300">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-zinc-300 bg-zinc-50 text-zinc-500">
              <tr>
                {['Date', 'Day', 'In', 'Out', 'Hours', 'Overtime', 'Punches', 'Status'].map((h) => (
                  <th key={h} className={th}>
                    {h}
                  </th>
                ))}
                <th className={`${th} text-right`}>Edit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {data?.days.map((d) => {
                const quiet = d.status === 'Holiday' || d.status === 'Weekend' || d.status === 'Not Joined';
                const bad = d.status === 'Absent' || d.status === 'Missing Out';
                const canEdit = d.date <= today;
                return (
                  <tr key={d.date} className={`tabular-nums ${quiet ? 'bg-zinc-50 text-zinc-500' : 'text-zinc-800'}`}>
                    <td className={`${td} font-medium`}>{fmtDate(d.date)}</td>
                    <td className={td}>{dayName(d.date)}</td>
                    <td className={td}>{fmtTime(d.inTime)}</td>
                    <td className={td}>{fmtTime(d.outTime)}</td>
                    <td className={td}>{d.hours ?? '-'}</td>
                    <td className={td}>
                      {d.status === 'Present' ? (
                        <>
                          <div className="font-medium">{fmtHM(d.otFinalMinutes)}</div>
                          {d.manualOt ? (
                            <div className="text-xs text-teal-800">manual</div>
                          ) : (
                            d.otActualMinutes > 0 &&
                            d.otActualMinutes !== d.otFinalMinutes && (
                              <div className="text-xs text-zinc-500">actual {fmtHM(d.otActualMinutes)}</div>
                            )
                          )}
                        </>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className={td}>{d.punches || '-'}</td>
                    <td className={td}>
                      {d.status ? (
                        <>
                          <span className={bad ? 'font-medium text-red-700' : 'font-medium'}>
                            {d.status === 'Missing Out' ? 'Missing out' : d.status}
                          </span>
                          {d.holidayName && (
                            <div className="truncate text-xs text-zinc-500">
                              {d.holidayName}
                              {d.status !== 'Holiday' ? ' (duty)' : ''}
                            </div>
                          )}
                        </>
                      ) : (
                        '-'
                      )}
                      {d.edited && <div className="text-xs font-medium text-teal-800">edited</div>}
                    </td>
                    <td className={td}>
                      <div className="flex justify-end">
                        {canEdit && d.status !== 'Not Joined' ? (
                          <button
                            onClick={() => setEditing(d)}
                            title="Edit In / Out / Overtime"
                            aria-label={`Edit ${fmtDate(d.date)}`}
                            className={`rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-teal-800 ${focus}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {data && !data.days.length && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-sm text-zinc-500">
                    No attendance data for this month.
                  </td>
                </tr>
              )}
            </tbody>
            {s && (
              <tfoot className="border-t border-zinc-300 bg-zinc-50 text-zinc-900 tabular-nums">
                <tr>
                  <td colSpan={4} className={`${td} font-semibold`}>
                    Total
                  </td>
                  <td className={`${td} font-semibold`}>
                    {num(s.totalHours)}
                    <span className="block text-xs font-normal text-zinc-500">total hours</span>
                  </td>
                  <td className={`${td} font-semibold text-teal-800`}>
                    {fmtHM(s.otFinalMinutes)}
                    <span className="block text-xs font-normal text-zinc-500">total overtime</span>
                  </td>
                  <td colSpan={3} className={td} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {editing && (
        <EditDayModal
          empId={id}
          day={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setTick((t) => t + 1);
          }}
        />
      )}
    </>
  );
}