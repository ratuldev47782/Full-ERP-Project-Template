// frontend/app/reports/page.js

'use client';

import { useState } from 'react';
import AppShell from '../components/AppShell';
import EmployeeSearch from '../components/EmployeeSearch';
import MonthlyView from '../components/MonthlyView';

export default function ReportsPage() {
  const [emp, setEmp] = useState(null);

  return (
    <AppShell title="Attendance Report">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Employee Attendance Report</h2>
          <p className="text-xs text-slate-500">Search an employee, pick a month, view the report or download the PDF.</p>
        </div>
        <EmployeeSearch onSelect={setEmp} />
      </div>

      {emp ? (
        <MonthlyView key={emp._id} id={emp._id} />
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-16 text-center text-sm text-slate-400">
          Search by Employee ID or Proximity ID to view a report.
        </div>
      )}
    </AppShell>
  );
}