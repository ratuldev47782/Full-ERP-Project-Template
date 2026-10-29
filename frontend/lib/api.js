// frontend/lib/api.js

const API = process.env.NEXT_PUBLIC_API || 'http://localhost:5000';

export async function api(path, options = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const res = await fetch(API + path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
  });
  if (res.status === 401 && path !== '/api/login') {
    localStorage.removeItem('token');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  if (!res.headers.get('content-type')?.includes('application/json')) {
    throw new Error(`API returned a non-JSON response (HTTP ${res.status}). Check the API URL and backend route.`);
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}