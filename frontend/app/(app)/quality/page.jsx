'use client';

import { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, Plus, Loader2 } from 'lucide-react';
import { api } from '@/utils/api';
import { Card, PageHeader, StatCard, Spinner, EmptyState, ErrorBanner, Badge, Modal, Field, inputCls, btnPrimary, btnSecondary, selectCls } from '@/components/ui';
import ToastStack from '@/components/toast';

const QC_TYPES = ['Cutting', 'Sewing_Inline', 'End_Line', 'Finishing', 'Final'];
const QC_RESULTS = ['Passed', 'Failed', 'Rework'];

export default function QualityPage() {
  const [checks, setChecks] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [productionOrders, setProductionOrders] = useState([]);
  const [form, setForm] = useState({ referenceType: 'End_Line', productionOrderId: '', result: 'Passed', defectCode: '', defectQty: '0', remarks: '' });
  const [saving, setSaving] = useState(false);

  const pushToast = useCallback((type, message) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4500);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [c, s] = await Promise.all([api.get('/quality'), api.get('/quality/stats')]);
      setChecks(c.checks || []);
      setStats(s.stats);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = async () => {
    const p = await api.get('/production');
    setProductionOrders(p.productionOrders || []);
    setForm({ referenceType: 'End_Line', productionOrderId: '', result: 'Passed', defectCode: '', defectQty: '0', remarks: '' });
    setCreateOpen(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data = await api.post('/quality', {
        referenceType: form.referenceType,
        productionOrderId: form.productionOrderId || undefined,
        result: form.result,
        defectCode: form.defectCode || undefined,
        defectQty: Number(form.defectQty) || 0,
        remarks: form.remarks || undefined,
      });
      pushToast('success', data.message);
      setCreateOpen(false);
      load();
    } catch (err) {
      pushToast('error', err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Quality"
        subtitle="Cutting → Inline → End-line → Finishing → Final inspection checkpoints"
        actions={
          <button onClick={openCreate} className={btnPrimary}>
            <Plus className="h-4 w-4" /> Record check
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Total checks" value={stats?.total ?? 0} icon={ShieldCheck} tint="bg-slate-50 text-slate-600" />
        <StatCard label="Passed" value={stats?.passed ?? 0} icon={ShieldCheck} tint="bg-emerald-50 text-emerald-600" />
        <StatCard label="Failed" value={stats?.failed ?? 0} icon={ShieldCheck} tint="bg-rose-50 text-rose-600" />
        <StatCard label="Rework" value={stats?.rework ?? 0} icon={ShieldCheck} tint="bg-amber-50 text-amber-600" />
      </div>

      <Card className="mt-5 overflow-hidden">
        {error && <ErrorBanner message={error} onRetry={load} />}
        {loading ? (
          <Spinner label="Loading checks…" />
        ) : checks.length === 0 ? (
          <EmptyState title="No quality checks" message="Record QC at each production checkpoint." icon={ShieldCheck} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3">Check No</th>
                  <th className="px-4 py-3">Checkpoint</th>
                  <th className="px-4 py-3">Production order</th>
                  <th className="px-4 py-3">Result</th>
                  <th className="px-4 py-3">Defect</th>
                  <th className="px-4 py-3 text-right">Defect qty</th>
                  <th className="px-4 py-3">Inspector</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {checks.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3.5 font-mono text-[13px] font-semibold text-slate-800">{c.checkNo}</td>
                    <td className="px-4 py-3.5 text-sm text-slate-600">{c.referenceType.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3.5 text-sm text-slate-700">{c.productionOrderNo || '—'}</td>
                    <td className="px-4 py-3.5"><Badge>{c.result}</Badge></td>
                    <td className="px-4 py-3.5 text-sm text-slate-600">{c.defectCode || '—'}</td>
                    <td className="px-4 py-3.5 text-right text-sm font-semibold text-rose-600">{c.defectQty}</td>
                    <td className="px-4 py-3.5 text-sm text-slate-600">{c.checkedByName || '—'}</td>
                    <td className="px-4 py-3.5 text-xs text-slate-400">{new Date(c.checkedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Record quality check" subtitle="QA checkpoint result" icon={ShieldCheck}>
        <form onSubmit={submit}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Checkpoint" required>
                <select className={inputCls} value={form.referenceType} onChange={(e) => setForm((f) => ({ ...f, referenceType: e.target.value }))}>
                  {QC_TYPES.map((t) => (
                    <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </Field>
              <Field label="Production order">
                <select className={inputCls} value={form.productionOrderId} onChange={(e) => setForm((f) => ({ ...f, productionOrderId: e.target.value }))}>
                  <option value="">— Optional —</option>
                  {productionOrders.map((p) => (
                    <option key={p.id} value={p.id}>{p.productionOrderNo}</option>
                  ))}
                </select>
              </Field>
              <Field label="Result" required>
                <select className={inputCls} value={form.result} onChange={(e) => setForm((f) => ({ ...f, result: e.target.value }))}>
                  {QC_RESULTS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </Field>
              <Field label="Defect qty">
                <input type="number" min="0" className={inputCls} value={form.defectQty} onChange={(e) => setForm((f) => ({ ...f, defectQty: e.target.value }))} />
              </Field>
            </div>
            <Field label="Defect code">
              <input className={inputCls} value={form.defectCode} onChange={(e) => setForm((f) => ({ ...f, defectCode: e.target.value }))} placeholder="e.g. STITCH-01" />
            </Field>
            <Field label="Remarks">
              <textarea rows={2} className={inputCls} value={form.remarks} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} />
            </Field>
          </div>
          <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-5">
            <button type="button" onClick={() => setCreateOpen(false)} className={btnSecondary}>Cancel</button>
            <button type="submit" disabled={saving} className={btnPrimary}>
              {saving ? (<><Loader2 className="h-4 w-4 animate-spin" /> Recording…</>) : (<>Record check</>)}
            </button>
          </div>
        </form>
      </Modal>

      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
    </div>
  );
}
