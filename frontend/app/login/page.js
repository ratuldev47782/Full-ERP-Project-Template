// frontend/app/login/page.js

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

const API = process.env.NEXT_PUBLIC_API || 'http://localhost:5000';

const authHeader = () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const unauthorized = () => {
  localStorage.removeItem('token');
  window.location.href = '/login';
  throw new Error('Unauthorized');
};

async function api(path, options = {}) {
  const res = await fetch(API + path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...authHeader() },
  });
  if (res.status === 401 && path !== '/api/login') unauthorized();
  if (!res.headers.get('content-type')?.includes('application/json')) {
    throw new Error(`API returned a non-JSON response (HTTP ${res.status}). Check the API URL and backend route.`);
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

const input =
  'w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { token } = await api('/api/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      localStorage.setItem('token', token);
      router.replace('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg md:grid-cols-2">
        {/* Illustration */}
        <div className="hidden flex-col items-center justify-center bg-amber-50 p-6 md:flex">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mobile-login-animate.svg" alt="Person logging in on a mobile device" className="w-full max-w-sm" />
        </div>

        {/* Form */}
        <form onSubmit={submit} className="flex flex-col justify-center">
          {/* Brand header */}
          <div className="flex items-center justify-center gap-3 border-b border-slate-200 bg-slate-50 px-6 py-4">
            <img src="/HKD_LOGO.png" alt="HKD logo" className="h-12 w-12 shrink-0 object-contain" />
            <span className="h-10 w-px bg-slate-300" />
            <div className="flex flex-col items-start">
              <h1 className="text-sm font-bold tracking-[0.18em] text-slate-800 sm:text-base">
                HKD OUTDOOR INNOVATIONS LTD
              </h1>
              <span className="text-[10px] font-semibold uppercase tracking-[0.35em] text-amber-600">
                Attendance ERP
              </span>
            </div>
          </div>

          <div className="space-y-4 p-6 sm:p-8">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Username</label>
              <input required value={username} onChange={(e) => setUsername(e.target.value)} className={input} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Password</label>
              <input
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={input}
              />
            </div>
            {error && <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
            <button
              disabled={loading}
              className="w-full rounded bg-amber-400 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-500 disabled:opacity-60"
            >
              {loading ? 'Please wait...' : 'Login'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}