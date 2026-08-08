'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Warehouse,
  ShieldCheck,
  FileCheck2,
  ClipboardCheck,
  Eye,
  EyeOff,
  Loader2,
  LogIn,
  UserPlus,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import { api, storeAuth, getToken } from '@/utils/api';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
  });

  const setField = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  // Already authenticated? Skip straight to the dashboard.
  useEffect(() => {
    if (getToken()) router.replace('/dashboard');
  }, [router]);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      setError(null);
      setSubmitting(true);
      try {
        const endpoint = mode === 'login' ? '/auth/login' : '/auth/register';
        const payload =
          mode === 'login'
            ? { email: form.email, password: form.password }
            : { name: form.name, email: form.email, password: form.password };

        const data = await api.post(endpoint, payload);
        storeAuth(data.token, data.user);
        router.replace('/dashboard');
      } catch (err) {
        setError(err.message || 'Something went wrong. Please try again.');
      } finally {
        setSubmitting(false);
      }
    },
    [mode, form, router]
  );

  const inputClass =
    'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10';

  return (
    <div className="flex min-h-screen">
      {/* ------------------------- Brand panel ------------------------- */}
      <aside className="relative hidden w-[46%] overflow-hidden bg-gradient-to-br from-indigo-950 via-indigo-900 to-violet-950 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, rgba(129,140,248,0.35) 0, transparent 45%), radial-gradient(circle at 80% 70%, rgba(167,139,250,0.3) 0, transparent 45%)',
          }}
        />
        <div className="relative z-10 p-10">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20 backdrop-blur">
              <Warehouse className="h-6 w-6 text-indigo-200" />
            </div>
            <div>
              <p className="text-lg font-semibold tracking-tight">Test Material Warehouse</p>
              <p className="text-xs text-indigo-200/80">Garments Factory Quality Management</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 px-10">
          <h1 className="max-w-md text-3xl font-bold leading-tight tracking-tight">
            Every fabric, trim and zipper — tracked from receiving bay to QA approval.
          </h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-indigo-200/90">
            A role-based inventory system tailored for outdoor-apparel factories like HKD Outdoor
            Innovations Ltd. with Cloudinary-hosted test certificates and a full QA audit trail.
          </p>

          <ul className="mt-8 space-y-4">
            {[
              { icon: FileCheck2, text: 'Cloudinary-hosted quality test reports, one click away' },
              { icon: ClipboardCheck, text: 'Color-coded test status with full audit log' },
              { icon: ShieldCheck, text: 'Simple JWT authentication with role-based access' },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-sm text-indigo-100">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15">
                  <Icon className="h-4 w-4 text-indigo-200" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 p-10 text-xs text-indigo-200/60">
          Next.js · Express.js · MySQL (Drizzle ORM) · Cloudinary
        </p>
      </aside>

      {/* --------------------------- Auth card -------------------------- */}
      <main className="flex flex-1 items-center justify-center bg-slate-100 px-4 py-10">
        <div className="w-full max-w-md animate-fade-in-up">
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 shadow-lg shadow-indigo-600/25">
              <Warehouse className="h-7 w-7 text-white" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              {mode === 'login' ? 'Welcome back' : 'Create your account'}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {mode === 'login'
                ? 'Sign in to manage the material warehouse.'
                : 'Register a new team member to get started.'}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60 sm:p-8">
            {/* Mode toggle */}
            <div className="mb-6 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
              {[
                { key: 'login', label: 'Sign in', icon: LogIn },
                { key: 'register', label: 'Register', icon: UserPlus },
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setMode(key);
                    setError(null);
                  }}
                  className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    mode === key
                      ? 'bg-white text-indigo-700 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>

            {error && (
              <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700 animate-fade-in">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'register' && (
                <div>
                  <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-slate-700">
                    Full name
                  </label>
                  <input
                    id="name"
                    type="text"
                    required
                    placeholder="e.g. Rafiq Ahmed"
                    className={inputClass}
                    value={form.name}
                    onChange={setField('name')}
                  />
                </div>
              )}

              <div>
                <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  placeholder="you@factory.com"
                  className={inputClass}
                  value={form.email}
                  onChange={setField('email')}
                />
              </div>

              <div>
                <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    placeholder="••••••••"
                    className={`${inputClass} pr-11`}
                    value={form.password}
                    onChange={setField('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 transition hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {mode === 'register' && (
                <p className="rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs leading-relaxed text-slate-500">
                  New accounts are created with the{' '}
                  <span className="font-semibold text-slate-700">Store Manager</span> role. Roles such as{' '}
                  <span className="font-medium text-slate-600">Admin</span> or{' '}
                  <span className="font-medium text-slate-600">QA Inspector</span> are assigned by an
                  existing Admin.
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 transition hover:from-indigo-700 hover:to-violet-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {mode === 'login' ? 'Signing in…' : 'Creating account…'}
                  </>
                ) : (
                  <>
                    {mode === 'login' ? 'Sign in' : 'Create account'}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-white/60 px-4 py-3 text-center text-xs text-slate-500">
            Demo accounts (seeded via <code className="font-mono">npm run db:seed</code>):{' '}
            <span className="font-medium text-slate-700">admin@factory.com</span> /{' '}
            <span className="font-medium text-slate-700">Admin@123</span>
          </div>
        </div>
      </main>
    </div>
  );
}
