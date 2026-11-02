'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'attendanceTimeFormat';
const CHANGE_EVENT = 'attendance:time-format-changed';
const DEFAULT_FORMAT = '24-hour';

function readTimeFormat() {
  if (typeof window === 'undefined') return DEFAULT_FORMAT;
  return localStorage.getItem(STORAGE_KEY) === '12-hour' ? '12-hour' : DEFAULT_FORMAT;
}

export function useTimeFormat() {
  const [timeFormat, setTimeFormatState] = useState(DEFAULT_FORMAT);

  useEffect(() => {
    const update = () => setTimeFormatState(readTimeFormat());
    update();
    window.addEventListener(CHANGE_EVENT, update);
    window.addEventListener('storage', update);
    return () => {
      window.removeEventListener(CHANGE_EVENT, update);
      window.removeEventListener('storage', update);
    };
  }, []);

  const setTimeFormat = (format) => {
    if (format !== '12-hour' && format !== '24-hour') {
      throw new Error('Time format must be 12-hour or 24-hour.');
    }
    localStorage.setItem(STORAGE_KEY, format);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  };

  return [timeFormat, setTimeFormat];
}

function formatOptions(options) {
  return { ...options, hour12: readTimeFormat() === '12-hour' };
}

function capitalizeDayPeriod(value) {
  return value.replace(/\b(am|pm)\b/i, (period) => period.toUpperCase());
}

export function formatTime(value, options = {}) {
  if (!value) return '-';
  return capitalizeDayPeriod(
    new Date(value).toLocaleTimeString('en-GB', formatOptions({
      hour: '2-digit',
      minute: '2-digit',
      ...options,
    }))
  );
}

export function formatDateTime(value, options = {}) {
  if (!value) return null;
  return capitalizeDayPeriod(
    new Date(value).toLocaleString('en-GB', formatOptions({
      dateStyle: 'short',
      timeStyle: 'short',
      ...options,
    }))
  );
}

export function formatClock(value) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(value || ''));
  if (!match) return value;
  const hour = Number(match[1]);
  if (readTimeFormat() === '24-hour') return `${match[1]}:${match[2]}`;
  return `${String(hour % 12 || 12).padStart(2, '0')}:${match[2]} ${hour < 12 ? 'AM' : 'PM'}`;
}

export function formatDuration(minutes) {
  if (minutes == null || !Number.isFinite(Number(minutes))) return '-';
  const totalMinutes = Math.max(0, Math.round(Number(minutes)));
  const hours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;
  if (!totalMinutes) return '0h';
if (!hours) return `${remainingMinutes}m`;
  return remainingMinutes ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

export function formatHours(hours) {
  if (hours == null || !Number.isFinite(Number(hours))) return '-';
  return formatDuration(Number(hours) * 60);
}
