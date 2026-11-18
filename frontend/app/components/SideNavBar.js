'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Home, Loader2, LogOut, Menu, Users, X } from 'lucide-react';

const focus = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700/40';

const initials = (username = '') => username.slice(0, 2).toUpperCase();

// `adminOnly` links are hidden for everyone whose designation is not Admin.
const LINKS = [
  { href: '/', label: 'Dashboard', icon: Home },
  { href: '/users', label: 'Manage users', icon: Users, adminOnly: true },
];

export default function SideNavBar({ user, isAdmin, onSignOut, signingOut }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const links = LINKS.filter((link) => !link.adminOnly || isAdmin);

  return (
    <>
      {/* Mobile hamburger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className={`fixed left-3 top-3 z-30 rounded-md border border-zinc-300 bg-white p-2 text-zinc-700 hover:bg-zinc-50 md:hidden ${focus}`}
      >
        <Menu className="h-4 w-4" aria-hidden="true" />
      </button>

      {/* Mobile backdrop */}
      {open ? (
        <div className="fixed inset-0 z-30 bg-zinc-900/40 md:hidden" onClick={() => setOpen(false)} aria-hidden="true" />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-zinc-300 bg-white transition-transform md:static md:translate-x-0 motion-reduce:transition-none ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand */}
        <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/HKD_LOGO.png" alt="HKD logo" className="h-9 w-9 shrink-0 object-contain" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-zinc-900">HKD Outdoor</p>
              <p className="text-xs text-zinc-500">Attendance ERP</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className={`rounded-md p-1.5 text-zinc-500 hover:bg-zinc-50 md:hidden ${focus}`}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Links */}
        <nav className="flex-1 space-y-1 overflow-auto p-3" aria-label="Main">
          {links.map(({ href, label, icon: LinkIcon }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href);

            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-2.5 rounded-md border-l-2 px-3 py-2 text-sm font-medium ${focus} ${
                  active
                    ? 'border-teal-800 bg-zinc-50 text-teal-900'
                    : 'border-transparent text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
                }`}
              >
                <LinkIcon className="h-4 w-4" aria-hidden="true" />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Current user + sign out */}
        <div className="border-t border-zinc-200 p-3">
          <div className="flex items-center gap-3 px-1 pb-3">
            <div className="flex h-9 w-9 flex-none items-center justify-center rounded-md border border-zinc-300 bg-zinc-100 text-xs font-semibold text-zinc-500">
              {initials(user?.username)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-zinc-900">{user?.username}</p>
              <p className="truncate text-xs text-zinc-500">{user?.work?.designation || '—'}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onSignOut}
            disabled={signingOut}
            className={`flex w-full items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60 ${focus}`}
          >
            {signingOut ? (
              <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            ) : (
              <LogOut className="h-4 w-4" aria-hidden="true" />
            )}
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </aside>
    </>
  );
}