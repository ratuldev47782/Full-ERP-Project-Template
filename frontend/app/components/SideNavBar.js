// frontend/app/components/SideNavBar.js

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  LogOut,
  X,
  Settings,
  CalendarDays,
  CalendarCheck,
  FileText,
  ClipboardList,
} from 'lucide-react';

const menu = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/employees', label: 'Employees', icon: Users },
  { href: '/attendance', label: 'Attendance Register', icon: ClipboardList },
  { href: '/reports', label: 'Attendance Report', icon: FileText },
  { href: '/leaves', label: 'Leave Management', icon: CalendarCheck },
  { href: '/holidays', label: 'Holidays', icon: CalendarDays },
  { href: '/settings', label: 'Settings', icon: Settings },
];

/* ---------- Sidebar parts ---------- */

function Brand({ showLabel }) {
  return (
    <div
      className={`flex h-[72px] shrink-0 items-center gap-3 border-b border-slate-200 ${
        showLabel ? 'px-5' : 'justify-center'
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/HKD_LOGO.png"
        alt="HKD Outdoor Innovations LTD. logo"
        className={`shrink-0 object-contain ${showLabel ? 'h-10 w-auto max-w-[56px]' : 'h-9 w-9'}`}
      />
      {showLabel && (
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-bold text-slate-900">HKD Outdoor</p>
          <p className="truncate text-[11px] font-medium text-slate-500">Innovations LTD.</p>
        </div>
      )}
    </div>
  );
}

function SidebarBody({ showLabels, path, onLogout }) {
  return (
    <>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {menu.map((m) => {
          const active = path === m.href || path.startsWith(`${m.href}/`);
          const Icon = m.icon;
          return (
            <Link
              key={m.href}
              href={m.href}
              title={m.label}
              className={`flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium transition ${
                active
                  ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-100'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              } ${showLabels ? '' : 'justify-center px-0'}`}
            >
              <Icon className={`h-5 w-5 shrink-0 ${active ? 'text-blue-600' : 'text-slate-400'}`} />
              {showLabels && <span className="truncate">{m.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-200 p-3">
        <button
          onClick={onLogout}
          title="Logout"
          className={`flex w-full items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-red-50 hover:text-red-600 ${
            showLabels ? '' : 'justify-center px-0'
          }`}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {showLabels && <span>Logout</span>}
        </button>
      </div>
    </>
  );
}

/* ---------- Sidebar ---------- */

export default function SideNavBar({ collapsed = false, mobileOpen = false, onClose, onLogout }) {
  const path = usePathname();

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        style={{ width: collapsed ? 76 : 256 }}
        className="hidden shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-white transition-[width] duration-200 md:flex"
      >
        <Brand showLabel={!collapsed} />
        <SidebarBody showLabels={!collapsed} path={path} onLogout={onLogout} />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={onClose} />
          <aside className="relative flex h-full w-64 flex-col bg-white shadow-xl">
            <Brand showLabel />
            <button
              onClick={onClose}
              className="absolute right-3 top-5 rounded-full p-1.5 text-slate-500 hover:bg-slate-100"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarBody showLabels path={path} onLogout={onLogout} />
          </aside>
        </div>
      )}
    </>
  );
}