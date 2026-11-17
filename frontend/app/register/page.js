'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// Dropdown options live here (no separate options file / table).
const FACTORIES = ['Main Factory', 'Unit 2', 'Unit 3', 'Corporate Office'];
const FLOORS = ['Ground Floor', '1st Floor', '2nd Floor', '3rd Floor', '4th Floor'];
const DEPARTMENTS = [
  'Production',
  'Quality Assurance',
  'Maintenance',
  'Store & Inventory',
  'Human Resources',
  'Accounts & Finance',
  'Information Technology',
  'Sales & Marketing',
];
const DESIGNATIONS = [
  'Operator',
  'Senior Operator',
  'Technician',
  'Supervisor',
  'Executive',
  'Senior Executive',
  'Assistant Manager',
  'Manager',
  'General Manager',
];

const PICTURE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_PICTURE_BYTES = 2 * 1024 * 1024;
const EMPTY_FORM = { username: '', password: '', factory: '', floor: '', department: '', designation: '' };

const fieldBase =
  'block w-full rounded-lg border bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none transition ' +
  'placeholder:text-slate-400 disabled:cursor-not-allowed disabled:bg-slate-100';
const fieldIdle =
  'border-slate-300 hover:border-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-400/30';
const fieldBad = 'border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-500/20';

const Icon = ({ children }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors peer-focus:text-amber-600"
    aria-hidden="true"
  >
    {children}
  </svg>
);

const SELECT_ICONS = {
  factory: (
    <>
      <path d="M3 21V9l6 4V9l6 4V5h3a3 3 0 0 1 3 3v13" />
      <path d="M3 21h18" />
    </>
  ),
  floor: (
    <>
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3 13 9 5 9-5" />
    </>
  ),
  department: (
    <>
      <rect x="3" y="4" width="7" height="7" rx="1" />
      <rect x="14" y="4" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  designation: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    </>
  ),
};

function FieldError({ id, children }) {
  if (!children) return null;
  return (
    <p id={id} className="mt-1.5 text-xs font-medium text-red-600">
      {children}
    </p>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const fileInput = useRef(null);
  const previewUrl = useRef('');

  const [form, setForm] = useState(EMPTY_FORM);
  const [picture, setPicture] = useState(null);
  const [preview, setPreview] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const update = (field) => (event) => {
    const { value } = event.target;
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  };

  const showPreview = (url) => {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = url;
    setPreview(url);
  };

  useEffect(
    () => () => {
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    },
    []
  );

  const pickPicture = (event) => {
    const file = event.target.files?.[0] ?? null;
    setFieldErrors((current) => ({ ...current, profilePicture: undefined }));

    if (!file) {
      setPicture(null);
      showPreview('');
      return;
    }

    if (!PICTURE_TYPES.includes(file.type)) {
      setPicture(null);
      showPreview('');
      setFieldErrors((current) => ({ ...current, profilePicture: 'Choose a JPG, PNG, WEBP or GIF image.' }));
      event.target.value = '';
      return;
    }

    if (file.size > MAX_PICTURE_BYTES) {
      setPicture(null);
      showPreview('');
      setFieldErrors((current) => ({ ...current, profilePicture: 'The image must be 2 MB or smaller.' }));
      event.target.value = '';
      return;
    }

    setPicture(file);
    showPreview(URL.createObjectURL(file));
  };

  const clearPicture = () => {
    setPicture(null);
    showPreview('');
    if (fileInput.current) fileInput.current.value = '';
  };

  const validate = () => {
    const errors = {};

    if (!/^[a-zA-Z0-9._-]{3,30}$/.test(form.username.trim())) {
      errors.username = 'Use 3-30 letters, numbers, dots, dashes or underscores.';
    }
    if (form.password.length < 6) {
      errors.password = 'Password must be at least 6 characters long.';
    }
    ['factory', 'floor', 'department', 'designation'].forEach((field) => {
      if (!form[field]) errors[field] = 'This field is required.';
    });

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const submit = async (event) => {
    event.preventDefault();
    if (loading || !validate()) return;

    setError('');
    setLoading(true);

    try {
      const payload = new FormData();
      payload.append('username', form.username.trim());
      payload.append('password', form.password);
      payload.append('factory', form.factory);
      payload.append('floor', form.floor);
      payload.append('department', form.department);
      payload.append('designation', form.designation);
      if (picture) payload.append('profilePicture', picture);

      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        credentials: 'include',
        body: payload,
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed. Please try again.');
      }

      router.replace('/');
      router.refresh();
    } catch (requestError) {
      setError(requestError.message);
      setLoading(false);
    }
  };

  const selects = [
    { id: 'factory', label: 'Factory', options: FACTORIES, placeholder: 'Select factory' },
    { id: 'floor', label: 'Floor', options: FLOORS, placeholder: 'Select floor' },
    { id: 'department', label: 'Department', options: DEPARTMENTS, placeholder: 'Select department' },
    { id: 'designation', label: 'Designation', options: DESIGNATIONS, placeholder: 'Select designation' },
  ];

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-100 p-4 py-10">
      {/* Soft background accents */}
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-amber-200/50 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-32 h-[28rem] w-[28rem] rounded-full bg-slate-300/60 blur-3xl" />

      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10 lg:grid-cols-[2fr_3fr]">
        <div className="absolute inset-x-0 top-0 z-10 h-1 bg-amber-400" />

        {/* Illustration */}
        <div className="hidden flex-col items-center justify-center gap-6 bg-gradient-to-br from-amber-50 to-amber-100/60 p-8 lg:flex">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mobile-login-animate.svg" alt="Person using a mobile device" className="w-full max-w-sm" />
        </div>

        {/* Form */}
        <form onSubmit={submit} noValidate className="flex flex-col justify-center">
          {/* Brand header */}
          <div className="flex items-center justify-center gap-3 border-b border-slate-200 bg-slate-50 px-6 py-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/HKD_LOGO.png" alt="HKD logo" className="h-12 w-12 shrink-0 object-contain" />
            <span className="h-10 w-px bg-slate-300" />
            <div className="flex flex-col items-start">
              <h1 className="text-sm font-bold tracking-[0.18em] text-slate-800 sm:text-base">
                HKD OUTDOOR INNOVATIONS LTD
              </h1>
              <span className="text-[10px] font-semibold uppercase tracking-[0.35em] text-amber-600">
                HKD ERP
              </span>
            </div>
          </div>

          <div className="space-y-5 p-6 sm:p-8">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Create your account</h2>
              <p className="mt-1 text-sm text-slate-500">
                Add your details once. You will be signed in right after registering.
              </p>
            </div>

            <div aria-live="polite">
              {error ? (
                <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="username" className="mb-1.5 block text-xs font-medium text-slate-600">
                  User name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="username"
                    placeholder="e.g. rahim.ahmed"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    autoFocus
                    value={form.username}
                    onChange={update('username')}
                    disabled={loading}
                    aria-invalid={fieldErrors.username ? 'true' : undefined}
                    aria-describedby={fieldErrors.username ? 'username-error' : undefined}
                    className={`peer ${fieldBase} ${fieldErrors.username ? fieldBad : fieldIdle}`}
                  />
                  <Icon>
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
                  </Icon>
                </div>
                <FieldError id="username-error">{fieldErrors.username}</FieldError>
              </div>

              <div>
                <label htmlFor="password" className="mb-1.5 block text-xs font-medium text-slate-600">
                  Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="At least 6 characters"
                    value={form.password}
                    onChange={update('password')}
                    disabled={loading}
                    aria-invalid={fieldErrors.password ? 'true' : undefined}
                    aria-describedby={fieldErrors.password ? 'password-error' : undefined}
                    className={`peer ${fieldBase} ${fieldErrors.password ? fieldBad : fieldIdle} pr-14`}
                  />
                  <Icon>
                    <rect x="4" y="11" width="16" height="10" rx="2" />
                    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                  </Icon>
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-pressed={showPassword}
                    className="absolute inset-y-0 right-0 rounded-r-lg px-3 text-xs font-medium text-slate-500 outline-none hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-amber-400/60"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                <FieldError id="password-error">{fieldErrors.password}</FieldError>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-900">Work information</h3>
                <span className="text-xs text-slate-500">All fields required</span>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {selects.map((select) => (
                  <div key={select.id}>
                    <label htmlFor={select.id} className="mb-1.5 block text-xs font-medium text-slate-600">
                      {select.label} <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <select
                        id={select.id}
                        value={form[select.id]}
                        onChange={update(select.id)}
                        disabled={loading}
                        aria-invalid={fieldErrors[select.id] ? 'true' : undefined}
                        aria-describedby={fieldErrors[select.id] ? `${select.id}-error` : undefined}
                        className={`peer ${fieldBase} ${fieldErrors[select.id] ? fieldBad : fieldIdle} appearance-none pr-10`}
                      >
                        <option value="">{select.placeholder}</option>
                        {select.options.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                      <Icon>{SELECT_ICONS[select.id]}</Icon>
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                        aria-hidden="true"
                      >
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </div>
                    <FieldError id={`${select.id}-error`}>{fieldErrors[select.id]}</FieldError>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="profilePicture" className="mb-1.5 block text-xs font-medium text-slate-600">
                Profile picture
              </label>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex h-16 w-16 flex-none items-center justify-center overflow-hidden rounded-xl border border-dashed border-amber-300 bg-amber-50">
                  {preview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={preview} alt="Selected profile picture" className="h-full w-full object-cover" />
                  ) : (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-6 w-6 text-amber-500"
                      aria-hidden="true"
                    >
                      <path d="M20 21a8 8 0 0 0-16 0" />
                      <circle cx="12" cy="8" r="4" />
                    </svg>
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInput.current?.click()}
                      disabled={loading}
                      className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 outline-none transition hover:border-amber-400 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-amber-400/60 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {picture ? 'Change image' : 'Choose image'}
                    </button>
                    {picture ? (
                      <button
                        type="button"
                        onClick={clearPicture}
                        disabled={loading}
                        className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 outline-none transition hover:text-red-600 focus-visible:text-red-600"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                  <p className="mt-1.5 max-w-[16rem] truncate text-xs text-slate-500">
                    {picture ? picture.name : 'JPG, PNG, WEBP or GIF · up to 2 MB'}
                  </p>
                </div>

                <input
                  ref={fileInput}
                  id="profilePicture"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={pickPicture}
                  className="sr-only"
                />
              </div>
              <FieldError id="profilePicture-error">{fieldErrors.profilePicture}</FieldError>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-400 py-2.5 text-sm font-semibold text-slate-900 shadow-sm outline-none transition hover:bg-amber-500 focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? (
                <svg className="h-4 w-4 animate-spin motion-reduce:animate-none" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
                  <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
              ) : null}
              {loading ? 'Creating account…' : 'Register'}
            </button>

            <p className="border-t border-slate-100 pt-5 text-center text-sm text-slate-500">
              Already have an account?{' '}
              <Link href="/login" className="font-semibold text-amber-600 transition hover:text-amber-700">
                Sign in
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}