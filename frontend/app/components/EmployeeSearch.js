'use client';

import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { api } from '../../lib/api';
import { fmtDate } from '../../lib/format';

// Employee ID / Proximity ID (ba naam) diye search
export default function EmployeeSearch({ onSelect, placeholder = 'Search by Employee ID or Proximity ID...' }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setResults([]);
      setBusy(false);
      return;
    }
    const my = ++seq.current;
    setBusy(true);
    const t = setTimeout(async () => {
      try {
        const r = await api(`/api/employee-search?q=${encodeURIComponent(term)}`);
        if (my === seq.current) {
          setResults(r);
          setOpen(true);
        }
      } catch {
        if (my === seq.current) setResults([]);
      } finally {
        if (my === seq.current) setBusy(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const pick = (emp) => {
    onSelect(emp);
    setQ('');
    setResults([]);
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const term = q.trim().toLowerCase();
    const exact = results.find((r) => r.employeeId.toLowerCase() === term || r.proximityId.toLowerCase() === term);
    if (exact) pick(exact);
    else if (results.length === 1) pick(results[0]);
  };

  return (
    <div className="relative w-full sm:w-96">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
      {open && q.trim() && (
        <div className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {busy && <div className="px-3 py-2 text-xs text-slate-500">Searching...</div>}
          {!busy && !results.length && <div className="px-3 py-2 text-xs text-slate-500">No employee found.</div>}
          {results.map((e) => (
            <button
              key={e._id}
              type="button"
              onClick={() => pick(e)}
              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-blue-50"
            >
              <span className="min-w-0 truncate">
                <span className="font-medium text-slate-800">{e.employeeId}</span>
                <span className="ml-2 text-slate-600">{e.name}</span>
              </span>
              <span className="shrink-0 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                {e.proximityId}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const fields = [
  ['Emp ID', 'employeeId'],
  ['Name', 'name'],
  ['Join Date', 'joinDate'],
  ['Grade', 'grade'],
  ['Line', 'line'],
  ['Designation', 'designation'],
  ['Department', 'department'],
  ['Section', 'section'],
  ['Sub Section', 'subSection'],
  ['Card No', 'cardNo'],
  ['Device ID', 'proximityId'],
];

export function EmployeeInfo({ emp }) {
  if (!emp) return null;
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:grid-cols-3 md:grid-cols-6">
      {fields.map(([label, key]) => (
        <div key={key} className="min-w-0">
          <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
          <div
            className={`truncate text-xs ${key === 'proximityId' ? 'font-semibold text-blue-700' : 'text-slate-700'}`}
          >
            {key === 'joinDate' ? fmtDate(emp.joinDate) : emp[key] || '-'}
          </div>
        </div>
      ))}
    </div>
  );
}