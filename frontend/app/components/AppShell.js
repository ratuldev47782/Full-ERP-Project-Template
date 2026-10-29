// frontend/app/components/AppShell.js

'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const menu = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/employees', label: 'Employees', icon: '👤' },
];

export default function AppShell({ title, children }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('token')) router.replace('/login');
    else setReady(true);
  }, [router]);

  const logout = () => {
    localStorage.removeItem('token');
    router.replace('/login');
  };

  if (!ready) return null;

  return (
    <div className="flex h-screen bg-slate-100 text-slate-800">
      {/* Sidebar */}
      <aside className={`${open ? 'w-60' : 'w-16'} flex flex-col bg-slate-900 text-slate-200 transition-all duration-200`}>
        <div className="flex h-14 items-center justify-between border-b border-slate-700 px-4">
          {open && <span className="text-sm font-bold tracking-wide">ATTENDANCE ERP</span>}
          <button onClick={() => setOpen(!open)} className="rounded p-1 hover:bg-slate-700" title="Toggle menu">
            ☰
          </button>
        </div>
        <nav className="flex-1 space-y-1 p-2">
          {menu.map((m) => {
            const active = path === m.href;
            return (
              <Link
                key={m.href}
                href={m.href}
                className={`flex items-center gap-3 rounded px-3 py-2 text-sm ${
                  active ? 'bg-blue-600 text-white' : 'hover:bg-slate-700'
                }`}
              >
                <span>{m.icon}</span>
                {open && <span>{m.label}</span>}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b bg-white px-6 shadow-sm">
          <h1 className="text-base font-semibold">{title}</h1>
          <button onClick={logout} className="rounded bg-red-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600">
            Logout
          </button>
        </header>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}