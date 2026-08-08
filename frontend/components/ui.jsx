'use client';

import { X, Loader2, Inbox } from 'lucide-react';

/* ------------------------------ class presets ------------------------------ */

export const btnPrimary =
  'flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 transition hover:from-indigo-700 hover:to-violet-700 disabled:cursor-not-allowed disabled:opacity-50';
export const btnSecondary =
  'flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50';
export const btnDanger =
  'flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-medium text-rose-600 shadow-sm transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50';
export const inputCls =
  'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10';
export const selectCls =
  'appearance-none rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 pr-8 text-sm text-slate-900 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10';

/* -------------------------------- Card ------------------------------------ */

export function Card({ children, className = '' }) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>{children}</div>
  );
}

/* ------------------------------ Page header -------------------------------- */

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </div>
  );
}

/* ------------------------------- Stat card --------------------------------- */

export function StatCard({ label, value, icon: Icon, tint, sub }) {
  return (
    <div className="flex items-center gap-3.5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tint}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold leading-none tracking-tight text-slate-900">{value}</p>
        <p className="mt-1 truncate text-xs font-medium text-slate-500">{label}</p>
        {sub && <p className="mt-0.5 text-[11px] text-slate-400">{sub}</p>}
      </div>
    </div>
  );
}

/* --------------------------------- Badge ----------------------------------- */

const BADGE_PALETTE = {
  green: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  red: 'bg-rose-100 text-rose-800 ring-rose-200',
  amber: 'bg-amber-100 text-amber-800 ring-amber-200',
  blue: 'bg-sky-100 text-sky-800 ring-sky-200',
  indigo: 'bg-indigo-100 text-indigo-800 ring-indigo-200',
  violet: 'bg-violet-100 text-violet-800 ring-violet-200',
  slate: 'bg-slate-100 text-slate-700 ring-slate-200',
  teal: 'bg-teal-100 text-teal-800 ring-teal-200',
};

const STATUS_COLOR = {
  Draft: 'slate',
  Booked: 'blue',
  Confirmed: 'indigo',
  In_Production: 'violet',
  In_Cutting: 'violet',
  In_Sewing: 'blue',
  In_Finishing: 'teal',
  In_Stock: 'teal',
  In_Progress: 'blue',
  Planned: 'slate',
  Completed: 'green',
  Completed_S: 'green',
  Cancelled: 'red',
  Passed: 'green',
  Failed: 'red',
  Pending: 'amber',
  Pending_QC: 'amber',
  QC_Passed: 'green',
  QC_Failed: 'red',
  Received: 'green',
  Partially_Received: 'amber',
  Approved: 'green',
  Converted: 'indigo',
  Rejected: 'red',
  Active: 'green',
  Superseded: 'slate',
  Released: 'slate',
  Requested: 'amber',
  Issued: 'green',
  Partial: 'amber',
  Shipped: 'indigo',
  Partially_Shipped: 'amber',
  Packed: 'teal',
  Ready_For_Cutting: 'teal',
  OK: 'green',
  Purchase: 'amber',
  Normal: 'slate',
  High: 'amber',
  Urgent: 'red',
  Rework: 'amber',
};

export function Badge({ children, color, className = '' }) {
  const resolved = color || STATUS_COLOR[children] || 'slate';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${BADGE_PALETTE[resolved]} ${className}`}
    >
      {children}
    </span>
  );
}

/* -------------------------------- Spinner ---------------------------------- */

export function Spinner({ label = 'Loading…' }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <Loader2 className="h-7 w-7 animate-spin text-indigo-500" />
      <p className="mt-3 text-sm text-slate-500">{label}</p>
    </div>
  );
}

/* ------------------------------ Empty state -------------------------------- */

export function EmptyState({ title = 'Nothing here yet', message, icon: Icon = Inbox, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        <Icon className="h-7 w-7" />
      </div>
      <h3 className="mt-4 text-sm font-semibold text-slate-800">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-500">{message}</p>
      {action}
    </div>
  );
}

/* --------------------------------- Modal ----------------------------------- */

export function Modal({ open, onClose, title, subtitle, icon: Icon, iconBg = 'bg-indigo-50 text-indigo-600', children, wide = false }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm sm:items-center">
      <div className={`w-full ${wide ? 'max-w-4xl' : 'max-w-xl'} rounded-2xl bg-white shadow-2xl`}>
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-3">
            {Icon && (
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconBg}`}>
                <Icon className="h-5 w-5" />
              </div>
            )}
            <div>
              <h2 className="text-base font-semibold text-slate-900">{title}</h2>
              {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

/* --------------------------------- Error ----------------------------------- */

export function ErrorBanner({ message, onRetry }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
      <p className="text-sm text-rose-700">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="shrink-0 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-100">
          Retry
        </button>
      )}
    </div>
  );
}

/* ------------------------------ Field label -------------------------------- */

export function Field({ label, required, children, hint }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

/* ------------------------------ Modal footer ------------------------------- */

export function ModalFooter({ onCancel, submitLabel, saving, children }) {
  return (
    <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-5">
      <button type="button" onClick={onCancel} className={btnSecondary}>
        Cancel
      </button>
      {children}
      <button type="submit" disabled={saving} className={btnPrimary}>
        {saving ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Saving…
          </>
        ) : (
          submitLabel
        )}
      </button>
    </div>
  );
}

export { STATUS_COLOR };
