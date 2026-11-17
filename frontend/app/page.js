'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const initials = (username = '') => username.slice(0, 2).toUpperCase();

export default function ProtectedHomePage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let active = true;

    fetch(`${API_URL}/api/auth/me`, { credentials: 'include', cache: 'no-store' })
      .then(async (response) => {
        if (response.status === 401) {
          router.replace('/login');
          return null;
        }

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data.error || 'Could not load your account.');
        }

        return data.user;
      })
      .then((value) => {
        if (active && value) setUser(value);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      });

    return () => {
      active = false;
    };
  }, [router]);

  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true);

    try {
      await fetch(`${API_URL}/api/auth/logout`, { method: 'POST', credentials: 'include' });
    } finally {
      router.replace('/login');
      router.refresh();
    }
  };

  const work = user?.work ?? {};
  const details = [
    { label: 'Factory', value: work.factory },
    { label: 'Floor', value: work.floor },
    { label: 'Department', value: work.department },
    { label: 'Designation', value: work.designation },
  ];

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-sky-500 text-[10px] font-bold tracking-wide text-white">
              ERP
            </span>
            <span className="text-sm font-semibold text-slate-900">ERP Suite</span>
          </div>

          <button
            type="button"
            onClick={signOut}
            disabled={signingOut}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-400 hover:text-slate-900 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/10 disabled:cursor-wait disabled:opacity-70"
          >
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        {error ? (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </div>
        ) : null}

        {!user && !error ? (
          <p className="text-sm text-slate-500">Loading your account…</p>
        ) : null}

        {user ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex h-16 w-16 flex-none items-center justify-center overflow-hidden rounded-2xl bg-slate-100 text-lg font-semibold text-slate-500">
                {user.profilePicture ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`${API_URL}${user.profilePicture}`}
                    alt={`${user.username} profile picture`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  initials(user.username)
                )}
              </div>

              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">
                  Signed in
                </p>
                <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight text-slate-900">
                  {user.username}
                </h1>
              </div>
            </div>

            <dl className="mt-8 grid gap-4 sm:grid-cols-2">
              {details.map((detail) => (
                <div
                  key={detail.label}
                  className="rounded-xl border border-slate-200 bg-slate-50/70 p-4"
                >
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    {detail.label}
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-slate-900">{detail.value || '—'}</dd>
                </div>
              ))}
            </dl>

            <p className="mt-8 rounded-xl bg-indigo-50 px-4 py-3 text-xs leading-relaxed text-indigo-800">
              This is the protected page. Sign out and open the address again — the frontend
              middleware will send you back to the login page.
            </p>
          </div>
        ) : null}
      </main>
    </div>
  );
}
