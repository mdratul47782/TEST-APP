'use client';

import { useEffect, useState } from 'react';
import { X, Loader2, CheckCircle2, XCircle, Clock3, ClipboardCheck, AlertTriangle } from 'lucide-react';
import { api } from '@/utils/api';

const OPTIONS = [
  {
    value: 'Passed',
    icon: CheckCircle2,
    selected: 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500',
    idle: 'border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/40',
    iconColor: 'text-emerald-600',
    desc: 'Material meets quality standards.',
  },
  {
    value: 'Failed',
    icon: XCircle,
    selected: 'border-rose-500 bg-rose-50 ring-2 ring-rose-500',
    idle: 'border-slate-200 bg-white hover:border-rose-300 hover:bg-rose-50/40',
    iconColor: 'text-rose-600',
    desc: 'Material rejected - needs follow-up.',
  },
  {
    value: 'Pending',
    icon: Clock3,
    selected: 'border-amber-500 bg-amber-50 ring-2 ring-amber-500',
    idle: 'border-slate-200 bg-white hover:border-amber-300 hover:bg-amber-50/40',
    iconColor: 'text-amber-600',
    desc: 'Awaiting QA test.',
  },
];

export default function UpdateStatusModal({ material, onClose, onUpdated }) {
  const [selected, setSelected] = useState('Pending');
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (material) {
      setSelected(material.testStatus || 'Pending');
      setRemarks('');
      setError(null);
    }
  }, [material]);

  if (!material) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const data = await api.put(`/materials/${material.id}/status`, {
        testStatus: selected,
        remarks: remarks.trim(),
      });
      onUpdated(data.message || 'Test status updated.');
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to update status.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <ClipboardCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Update test status</h2>
              <p className="text-xs text-slate-500">
                <span className="font-mono font-medium text-slate-700">{material.materialCode}</span> · {material.materialName} — an audit log entry will be recorded.
              </p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5">
          {error && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="grid gap-3">
            {OPTIONS.map(({ value, icon: Icon, selected: selectedClass, idle, iconColor, desc }) => (
              <button
                key={value}
                type="button"
                onClick={() => setSelected(value)}
                className={`flex items-start gap-3 rounded-xl border p-4 text-left transition ${selected === value ? selectedClass : idle}`}
              >
                <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${selected === value ? iconColor : 'text-slate-400'}`} />
                <span>
                  <span className="block text-sm font-semibold">{value}</span>
                  <span className={`block text-xs ${selected === value ? 'text-slate-500' : 'text-slate-400'}`}>{desc}</span>
                </span>
              </button>
            ))}
          </div>

          <div className="mt-5">
            <label htmlFor="remarks" className="mb-1.5 block text-sm font-medium text-slate-700">
              Remarks <span className="text-xs font-normal text-slate-400">(optional)</span>
            </label>
            <textarea
              id="remarks"
              rows={3}
              placeholder="e.g. Shrinkage 2.5% after 3 wash cycles - within tolerance."
              className="w-full resize-none rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          </div>

          <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-5">
            <button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 transition hover:from-emerald-700 hover:to-teal-700 disabled:cursor-not-allowed disabled:opacity-60">
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                </>
              ) : (
                <>
                  <ClipboardCheck className="h-4 w-4" /> Record status
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
