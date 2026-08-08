'use client';

import { useCallback, useEffect, useState } from 'react';
import { Factory, Plus, Loader2, ArrowRight, AlertTriangle } from 'lucide-react';
import { api } from '@/utils/api';
import { Card, PageHeader, StatCard, Spinner, EmptyState, ErrorBanner, Badge, Modal, Field, inputCls, btnPrimary, btnSecondary, selectCls } from '@/components/ui';
import ToastStack from '@/components/toast';

const STATUSES = ['Planned', 'Ready_For_Cutting', 'In_Cutting', 'In_Sewing', 'In_Finishing', 'Completed', 'Cancelled'];
const STAGES = ['Sewing_Input', 'Sewing_Output', 'Finishing_Input', 'Finishing_Output'];

export default function ProductionPage() {
  const [productionOrders, setProductionOrders] = useState([]);
  const [delayed, setDelayed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toasts, setToasts] = useState([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [orderLines, setOrderLines] = useState([]);
  const [form, setForm] = useState({ salesOrderLineId: '', qty: '', line: '', plannedStart: '', plannedEnd: '' });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const [detail, setDetail] = useState(null);
  const [outputForm, setOutputForm] = useState({ stage: 'Sewing_Input', qty: '', rejectionQty: '0' });
  const [outputSaving, setOutputSaving] = useState(false);

  const pushToast = useCallback((type, message) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4500);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, d] = await Promise.all([api.get('/production'), api.get('/production/delayed').catch(() => ({ delayedOrders: [] }))]);
      setProductionOrders(p.productionOrders || []);
      setDelayed(d.delayedOrders || []);
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
    const o = await api.get('/orders');
    const lines = [];
    for (const ord of (o.orders || []).filter((x) => !['Completed', 'Cancelled'].includes(x.orderStatus))) {
      const d = await api.get(`/orders/${ord.id}`);
      for (const l of d.lines || []) {
        lines.push({ id: l.id, label: `${ord.orderNo} · ${l.styleNumber} · ${l.color} · ${l.quantity} pcs` });
      }
    }
    setOrderLines(lines);
    setForm({ salesOrderLineId: '', qty: '', line: '', plannedStart: '', plannedEnd: '' });
    setSaveError(null);
    setCreateOpen(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      const data = await api.post('/production', { ...form, salesOrderLineId: Number(form.salesOrderLineId), qty: Number(form.qty) });
      pushToast('success', data.message);
      setCreateOpen(false);
      load();
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const transition = async (po, status) => {
    try {
      const data = await api.post(`/production/${po.id}/status`, { status });
      pushToast('success', data.message);
      load();
    } catch (err) {
      pushToast('error', err.message);
    }
  };

  const openDetail = async (po) => {
    try {
      const data = await api.get(`/production/${po.id}`);
      setDetail(data);
      setOutputForm({ stage: 'Sewing_Input', qty: '', rejectionQty: '0' });
    } catch (err) {
      pushToast('error', err.message);
    }
  };

  const recordOutput = async (e) => {
    e.preventDefault();
    setOutputSaving(true);
    try {
      const data = await api.post(`/production/${detail.productionOrder.id}/output`, { ...outputForm, qty: Number(outputForm.qty), rejectionQty: Number(outputForm.rejectionQty) });
      pushToast('success', data.message);
      openDetail(detail.productionOrder.id);
    } catch (err) {
      pushToast('error', err.message);
    } finally {
      setOutputSaving(false);
    }
  };

  const inCutting = productionOrders.filter((p) => p.status === 'In_Cutting').length;
  const inSewing = productionOrders.filter((p) => p.status === 'In_Sewing').length;
  const inFinishing = productionOrders.filter((p) => p.status === 'In_Finishing').length;

  return (
    <div>
      <PageHeader
        title="Production Orders"
        subtitle="Cutting → Sewing → Finishing with stage-wise input/output and WIP"
        actions={
          <button onClick={openCreate} className={btnPrimary}>
            <Plus className="h-4 w-4" /> New production order
          </button>
        }
      />

      {delayed.length > 0 && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
          <p className="text-sm text-rose-800">
            <span className="font-semibold">{delayed.length}</span> production order{delayed.length > 1 ? 's' : ''} delayed by material shortage — resolve via MRP / purchase.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="In Cutting" value={inCutting} icon={Factory} tint="bg-indigo-50 text-indigo-600" />
        <StatCard label="In Sewing" value={inSewing} icon={Factory} tint="bg-sky-50 text-sky-600" />
        <StatCard label="In Finishing" value={inFinishing} icon={Factory} tint="bg-violet-50 text-violet-600" />
        <StatCard label="Total orders" value={productionOrders.length} icon={Factory} tint="bg-slate-50 text-slate-600" />
      </div>

      <Card className="mt-5 overflow-hidden">
        {error && <ErrorBanner message={error} onRetry={load} />}
        {loading ? (
          <Spinner label="Loading production orders…" />
        ) : productionOrders.length === 0 ? (
          <EmptyState title="No production orders" message="Create a production order from a booked sales order line." icon={Factory} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3">Prod No</th>
                  <th className="px-4 py-3">Order / Style</th>
                  <th className="px-4 py-3 text-right">Qty</th>
                  <th className="px-4 py-3 text-right">Produced</th>
                  <th className="px-4 py-3 text-right">WIP</th>
                  <th className="px-4 py-3">Line</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {productionOrders.map((po) => (
                  <tr key={po.id} className="transition-colors hover:bg-slate-50/80">
                    <td className="px-4 py-3.5">
                      <button onClick={() => openDetail(po)} className="font-mono text-[13px] font-semibold text-indigo-600 hover:underline">{po.productionOrderNo}</button>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="text-sm font-medium text-slate-800">{po.styleNumber}</p>
                      <p className="text-xs text-slate-400">{po.orderNo || ''} · {po.productName}</p>
                    </td>
                    <td className="px-4 py-3.5 text-right text-sm font-semibold text-slate-800">{po.qty}</td>
                    <td className="px-4 py-3.5 text-right text-sm text-emerald-600">{po.produced}</td>
                    <td className="px-4 py-3.5 text-right text-sm font-semibold text-amber-600">{po.wip}</td>
                    <td className="px-4 py-3.5 text-sm text-slate-600">{po.line || '—'}</td>
                    <td className="px-4 py-3.5"><Badge>{po.status}</Badge></td>
                    <td className="px-4 py-3.5 text-right">
                      <select value={po.status} onChange={(e) => transition(po, e.target.value)} className={`rounded-lg border px-2 py-1.5 text-xs font-medium shadow-sm outline-none ${selectCls}`}>
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Create */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New production order" subtitle="From a booked sales order line" icon={Factory}>
        <form onSubmit={submit}>
          {saveError && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700">{saveError}</div>
          )}
          <div className="space-y-4">
            <Field label="Order line" required>
              <select required className={inputCls} value={form.salesOrderLineId} onChange={(e) => setForm((f) => ({ ...f, salesOrderLineId: e.target.value }))}>
                <option value="">— Select order line —</option>
                {orderLines.map((l) => (
                  <option key={l.id} value={l.id}>{l.label}</option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Production qty" required>
                <input required type="number" min="1" className={inputCls} value={form.qty} onChange={(e) => setForm((f) => ({ ...f, qty: e.target.value }))} />
              </Field>
              <Field label="Line / floor">
                <input className={inputCls} value={form.line} onChange={(e) => setForm((f) => ({ ...f, line: e.target.value }))} placeholder="Line 3" />
              </Field>
              <Field label="Planned start">
                <input type="date" className={inputCls} value={form.plannedStart} onChange={(e) => setForm((f) => ({ ...f, plannedStart: e.target.value }))} />
              </Field>
              <Field label="Planned end">
                <input type="date" className={inputCls} value={form.plannedEnd} onChange={(e) => setForm((f) => ({ ...f, plannedEnd: e.target.value }))} />
              </Field>
            </div>
          </div>
          <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-5">
            <button type="button" onClick={() => setCreateOpen(false)} className={btnSecondary}>Cancel</button>
            <button type="submit" disabled={saving} className={btnPrimary}>
              {saving ? (<><Loader2 className="h-4 w-4 animate-spin" /> Creating…</>) : (<>Create order</>)}
            </button>
          </div>
        </form>
      </Modal>

      {/* Detail */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.productionOrder?.productionOrderNo || ''} subtitle={`${detail?.productionOrder?.styleNumber || ''} · ${detail?.productionOrder?.orderNo || ''} · qty ${detail?.productionOrder?.qty || ''}`} icon={Factory} wide>
        {detail && (
          <div>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <Badge>{detail.productionOrder.status}</Badge>
              <span className="text-sm font-semibold text-emerald-600">{detail.produced} produced</span>
              <span className="text-sm font-semibold text-amber-600">{detail.wip} WIP</span>
            </div>

            <form onSubmit={recordOutput} className="mb-5 grid grid-cols-12 items-end gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
              <div className="col-span-4">
                <label className="mb-1 block text-xs font-medium text-slate-500">Stage</label>
                <select className={inputCls} value={outputForm.stage} onChange={(e) => setOutputForm((f) => ({ ...f, stage: e.target.value }))}>
                  {STAGES.map((s) => (
                    <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-3">
                <label className="mb-1 block text-xs font-medium text-slate-500">Qty</label>
                <input type="number" min="0" required className={inputCls} value={outputForm.qty} onChange={(e) => setOutputForm((f) => ({ ...f, qty: e.target.value }))} />
              </div>
              <div className="col-span-3">
                <label className="mb-1 block text-xs font-medium text-slate-500">Rejection</label>
                <input type="number" min="0" className={inputCls} value={outputForm.rejectionQty} onChange={(e) => setOutputForm((f) => ({ ...f, rejectionQty: e.target.value }))} />
              </div>
              <button type="submit" disabled={outputSaving} className="col-span-2 flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 transition hover:from-indigo-700 hover:to-violet-700 disabled:opacity-50">
                {outputSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                Record
              </button>
            </form>

            {detail.output.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      <th className="px-4 py-3">Stage</th>
                      <th className="px-4 py-3 text-right">Qty</th>
                      <th className="px-4 py-3 text-right">Rejection</th>
                      <th className="px-4 py-3">Recorded</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {detail.output.map((o) => (
                      <tr key={o.id}>
                        <td className="px-4 py-3 text-sm font-medium text-slate-700">{o.stage.replace(/_/g, ' ')}</td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-slate-800">{o.qty}</td>
                        <td className="px-4 py-3 text-right text-sm text-rose-600">{o.rejectionQty}</td>
                        <td className="px-4 py-3 text-xs text-slate-400">{new Date(o.recordedAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">No stage output recorded yet.</p>
            )}
          </div>
        )}
      </Modal>

      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
    </div>
  );
}
