// frontend/app/employees/[id]/page.js

'use client';

import { useParams, useRouter } from 'next/navigation';
import AppShell from '../../components/AppShell';
import MonthlyView from '../../components/MonthlyView';

export default function EmployeeDetail() {
  const { id } = useParams();
  const router = useRouter();

  return (
    <AppShell title="Employee Attendance" autoSync>
      <button
        onClick={() => router.push('/employees')}
        className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-800"
      >
        <span>←</span> Back to Employee List
      </button>
      <MonthlyView id={id} />
    </AppShell>
  );
}