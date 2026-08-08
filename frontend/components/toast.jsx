'use client';

import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const STYLES = {
  success: { icon: CheckCircle2, box: 'border-emerald-200 bg-white', text: 'text-emerald-600', bar: 'bg-emerald-500' },
  error: { icon: XCircle, box: 'border-rose-200 bg-white', text: 'text-rose-600', bar: 'bg-rose-500' },
  info: { icon: Info, box: 'border-sky-200 bg-white', text: 'text-sky-600', bar: 'bg-sky-500' },
  warning: { icon: AlertTriangle, box: 'border-amber-200 bg-white', text: 'text-amber-600', bar: 'bg-amber-500' },
};

export default function ToastStack({ toasts = [], onDismiss }) {
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2.5">
      {toasts.map((t) => {
        const style = STYLES[t.type] || STYLES.info;
        const Icon = style.icon;
        return (
          <div
            key={t.id}
            className={`pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded-xl border p-4 shadow-xl shadow-slate-200/60 animate-fade-in-up ${style.box}`}
          >
            <span className={`absolute inset-y-0 left-0 w-1 ${style.bar}`} />
            <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${style.text}`} />
            <p className="flex-1 text-sm font-medium text-slate-800">{t.message}</p>
            <button
              onClick={() => onDismiss(t.id)}
              className="rounded-md p-1 text-slate-300 transition hover:bg-slate-50 hover:text-slate-500"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
