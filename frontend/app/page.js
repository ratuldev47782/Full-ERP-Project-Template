'use client';

import { IBM_Plex_Sans } from 'next/font/google';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Loader2, LogOut } from 'lucide-react';

const plex = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], display: 'swap' });

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// Flat Teal & Zinc theme
const focus = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700/40';
const btnSecondary = `inline-flex items-center gap-2 rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60 ${focus}`;

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
    <div className={`min-h-screen bg-zinc-100 text-zinc-900 ${plex.className}`}>
      <header className="border-b border-zinc-300 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/HKD_LOGO.png" alt="HKD logo" className="h-9 w-9 shrink-0 object-contain" />
            <span className="h-7 w-px bg-zinc-300" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-zinc-900">HKD Outdoor Innovations Ltd</p>
              <p className="text-xs text-zinc-500">Attendance ERP</p>
            </div>
          </div>

          <button type="button" onClick={signOut} disabled={signingOut} className={btnSecondary}>
            {signingOut ? (
              <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            ) : (
              <LogOut className="h-4 w-4" aria-hidden="true" />
            )}
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-4 px-4 py-6 sm:px-6 sm:py-8">
        {error ? (
          <div
            role="alert"
            className="rounded-md border border-l-4 border-zinc-300 border-l-red-700 bg-white px-4 py-2.5 text-sm text-red-700"
          >
            {error}
          </div>
        ) : null}

        {!user && !error ? (
          <div className="flex items-center gap-2 px-1 text-sm text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            Loading your account…
          </div>
        ) : null}

        {user ? (
          <>
            <div>
              <h2 className="text-2xl font-semibold text-zinc-900">Welcome, {user.username}</h2>
              <p className="mt-0.5 text-sm text-zinc-500">You are signed in.</p>
            </div>

            <section className="rounded-md border border-zinc-300 bg-white">
              <div className="flex items-center gap-4 border-b border-zinc-200 px-4 py-3">
                <div className="flex h-14 w-14 flex-none items-center justify-center overflow-hidden rounded-md border border-zinc-300 bg-zinc-100 text-base font-semibold text-zinc-500">
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

                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-semibold text-zinc-900">{user.username}</h3>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-500">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-teal-700" />
                    Signed in
                  </p>
                </div>
              </div>

              {/* KPI-style strip: 1px lines come from gap-px on a zinc-200 background */}
              <dl className="grid grid-cols-2 gap-px bg-zinc-200 sm:grid-cols-4">
                {details.map((detail) => (
                  <div key={detail.label} className="bg-white px-3 py-2">
                    <dt className="text-xs text-zinc-500">{detail.label}</dt>
                    <dd className="mt-0.5 text-sm font-semibold text-teal-800">{detail.value || '—'}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <div className="rounded-md border border-l-4 border-zinc-300 border-l-teal-700 bg-white px-4 py-2.5 text-sm text-zinc-800">
              This is the protected page. Sign out and open the address again — the frontend middleware
              will send you back to the login page.
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}