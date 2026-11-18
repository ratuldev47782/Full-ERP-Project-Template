'use client';

import AppShell, { API_URL } from './components/AppShell';

const initials = (username = '') => username.slice(0, 2).toUpperCase();

function Home({ user }) {
  const work = user.work ?? {};
  const details = [
    { label: 'Factory', value: work.factory },
    { label: 'Floor', value: work.floor },
    { label: 'Department', value: work.department },
    { label: 'Designation', value: work.designation },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-4">
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

        <dl className="grid grid-cols-2 gap-px bg-zinc-200 sm:grid-cols-4">
          {details.map((detail) => (
            <div key={detail.label} className="bg-white px-3 py-2">
              <dt className="text-xs text-zinc-500">{detail.label}</dt>
              <dd className="mt-0.5 text-sm font-semibold text-teal-800">{detail.value || '—'}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}

export default function ProtectedHomePage() {
  return <AppShell>{({ user }) => <Home user={user} />}</AppShell>;
}