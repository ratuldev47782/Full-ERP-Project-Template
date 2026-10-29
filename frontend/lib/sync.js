// frontend/lib/sync.js

// frontend/lib/sync.js
// Shob page theke ek-i sync function. Sync shesh hole 'attendance:synced' event fire hoy,
// jeta shuney page-gulo nijeder data auto reload kore.

import { api } from './api';

export const LAST_SYNC_KEY = 'lastSync';
export const SYNC_EVENT = 'attendance:synced';

export async function runSync() {
  const result = await api('/api/sync', { method: 'POST' });
  const at = new Date().toISOString();
  try {
    localStorage.setItem(LAST_SYNC_KEY, at);
  } catch {}
  window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: { at, result } }));
  return result;
}

export const fmtSyncTime = (iso) =>
  iso ? new Date(iso).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) : null;