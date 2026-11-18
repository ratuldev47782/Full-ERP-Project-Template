'use client';

import { IBM_Plex_Sans } from 'next/font/google';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

import SideNavBar from './SideNavBar';

const plex = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], display: 'swap' });

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export const isAdminUser = (user) => (user?.work?.designation || '').toLowerCase() === 'admin';

/**
 * Wrapper for every protected page: page background, font, side navbar,
 * and the signed-in user.
 *
 * Usage:
 *   <AppShell>{({ user, isAdmin }) => <YourPage />}</AppShell>
 */
export default function AppShell({ children }) {
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
        if (!response.ok) throw new Error(data.error || 'Could not load your account.');

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

  const isAdmin = isAdminUser(user);

  return (
    <div className={`flex h-screen bg-zinc-100 text-zinc-900 ${plex.className}`}>
      <SideNavBar user={user} isAdmin={isAdmin} onSignOut={signOut} signingOut={signingOut} />

      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1 overflow-auto p-4 pt-16 md:p-5 md:pt-5">
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

          {user ? children({ user, isAdmin }) : null}
        </main>
      </div>
    </div>
  );
}