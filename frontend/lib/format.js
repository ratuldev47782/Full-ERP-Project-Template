// frontend/lib/format.js
// Shob date/time Bangladesh time (Asia/Dhaka) onujayi dekhano hoy.

export const TZ = 'Asia/Dhaka';
const pad = (n) => String(n).padStart(2, '0');

export const todayDhaka = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ }); // yyyy-mm-dd
export const fmtDate = (d) => (d ? String(d).slice(0, 10).split('-').reverse().join('-') : '-'); // dd-mm-yyyy
export const fmtTime = (d) =>
  d ? new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: TZ }) : '—';
export const dayName = (dateStr) =>
  new Date(`${dateStr}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' });
export const fmtHM = (min) => `${pad(Math.floor((min || 0) / 60))}:${pad((min || 0) % 60)}`;
export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];