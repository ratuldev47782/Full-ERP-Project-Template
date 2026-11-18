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
 * The logged-in check is just localStorage: the user details saved at login are
 * the session. No user details -> back to the login page.
 *
 * Usage:
 *   <AppShell>{({ user, isAdmin }) => <YourPage />}</AppShell>
 */
export default function AppShell({ children }) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const stored = window.localStorage.getItem('erp_user');

    if (!stored) {
      router.replace('/login');
      return;
    }

    try {
      setUser(JSON.parse(stored));
      setChecking(false);
    } catch {
      window.localStorage.removeItem('erp_user');
      router.replace('/login');
    }
  }, [router]);

  const signOut = () => {
    window.localStorage.removeItem('erp_user');
    router.replace('/login');
  };

  const isAdmin = isAdminUser(user);

  return (
    <div className={`flex h-screen bg-zinc-100 text-zinc-900 ${plex.className}`}>
      <SideNavBar user={user} isAdmin={isAdmin} onSignOut={signOut} />

      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1 overflow-auto p-4 pt-16 md:p-5 md:pt-5">
          {checking ? (
            <div className="flex items-center gap-2 px-1 text-sm text-zinc-500">
              <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              Checking your login…
            </div>
          ) : null}

          {!checking && user ? children({ user, isAdmin }) : null}
        </main>
      </div>
    </div>
  );
}
