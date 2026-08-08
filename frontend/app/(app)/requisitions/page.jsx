'use client';

import { useCallback, useEffect, useState } from 'react';
import { FileText, Plus, Loader2, CheckCircle2, XCircle, ArrowRight } from 'lucide-react';
import { api } from '@/utils/api';
import { Card, PageHeader, StatCard, Spinner, EmptyState, ErrorBanner, Badge, Modal, Field, inputCls, btnPrimary, btnSecondary } from '@/components/ui';
import ToastStack from '@/components/toast';

export default function RequisitionsPage() {
  const [requisitions, setRequisitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [detail, setDetail] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [materials, setMaterials] = useState([]);
  const [orders, setOrders] = useState([]);
  const [form, setForm] = useState({ orderId: '', requiredDate: '', remarks: '' });
  const [items, setItems] = useState([{ materialId: '', qty: '', reason: '' }]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const pushToast = useCallback((type, message) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4500);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get('/requisitions');
      setRequisitions(data.requisitions || []);
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
    const [m, o] = await Promise.all([api.get('/materials'), api.get('/orders')]);
    setMaterials(m.materials || []);
    setOrders((o.orders || []).filter((x) => !['Completed', 'Cancelled'].includes(x.orderStatus)));
    setForm({ orderId: '', requiredDate: '', remarks: '' });
    setItems([{ materialId: '', qty: '', reason: '' }]);
    setSaveError(null);
    setCreateOpen(true);
  };

  const openDetail = async (pr) => {
    try {
      const data = await api.get(`/requisitions/${pr.id}`);
      setDetail(data);
    } catch (err) {
      pushToast('error', err.message);
    }
  };

  const transition = async (pr, status) => {
    try {
      const data = await api.post(`/requisitions/${pr.id}/status`, { status });
      pushToast('success', data.message);
      setDetail(null);
      load();
    } catch (err) {
      pushToast('error', err.message);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    const validItems = items.filter((i) => i.materialId && i.qty);
    try {
      const data = await api.post('/requisitions', {
        orderId: form.orderId || undefined,
        requiredDate: form.requiredDate || undefined,
        remarks: form.remarks,
        items: validItems.map((i) => ({ materialId: Number(i.materialId), qty: Number(i.qty), reason: i.reason })),
      });
      pushToast('success', data.message);
      setCreateOpen(false);
      load();
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const pending = requisitions.filter((r) => ['Draft', 'Pending_Approval', 'Approved'].includes(r.status));
  const converted = requisitions.filter((r) => r.status === 'Converted');
  const rejected = requisitions.filter((r) => r.status === 'Rejected');

  return (
    <div>
      <PageHeader
        title="Purchase Requisitions"
        subtitle="Shortage detected by MRP → requisition → approval → purchase order"
        actions={
          <button onClick={openCreate} className={btnPrimary}>
            <Plus className="h-4 w-4" /> New requisition
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatCard label="Pending" value={pending.length} icon={FileText} tint="bg-amber-50 text-amber-600" />
        <StatCard label="Converted to PO" value={converted.length} icon={ArrowRight} tint="bg-indigo-50 text-indigo-600" />
        <StatCard label="Rejected" value={rejected.length} icon={XCircle} tint="bg-rose-50 text-rose-600" />
      </div>

      <Card className="mt-5 overflow-hidden">
        {error && <ErrorBanner message={error} onRetry={load} />}
        {loading ? (
          <Spinner label="Loading requisitions…" />
        ) : requisitions.length === 0 ? (
          <EmptyState title="No requisitions" message="Run MRP and generate a PR from shortages, or create one manually." icon={FileText} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3">PR No</th>
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Items</th>
                  <th className="px-4 py-3">Required by</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requisitions.map((pr) => (
                  <tr key={pr.id} className="transition-colors hover:bg-slate-50/80">
                    <td className="px-4 py-3.5">
                      <button onClick={() => openDetail(pr)} className="font-mono text-[13px] font-semibold text-indigo-600 hover:underline">{pr.prNo}</button>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-slate-700">{pr.orderNo || '—'}</td>
                    <td className="px-4 py-3.5 text-sm text-slate-600">{pr.itemCount}</td>
                    <td className="px-4 py-3.5 text-sm text-slate-600">{pr.requiredDate ? String(pr.requiredDate).slice(0, 10) : '—'}</td>
                    <td className="px-4 py-3.5"><Badge>{pr.status}</Badge></td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="inline-flex gap-1.5">
                        {['Draft', 'Pending_Approval'].includes(pr.status) && (
                          <button onClick={() => transition(pr, 'Approved')} className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                          </button>
                        )}
                        {pr.status === 'Approved' && (
                          <a href={`/purchase-orders?pr=${pr.id}`} className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-medium text-indigo-700 transition hover:bg-indigo-100">
                            Convert to PO <ArrowRight className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Detail */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.requisition?.prNo || 'Requisition'} subtitle={`Order ${detail?.requisition?.orderId || '—'} · ${detail?.requisition?.remarks || ''}`} icon={FileText}>
        {detail && (
          <div>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-3">Material</th>
                    <th className="px-4 py-3 text-right">Qty</th>
                    <th className="px-4 py-3">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {detail.items.map((it) => (
                    <tr key={it.id}>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-slate-800">{it.materialName}</p>
                        <p className="font-mono text-[11px] text-slate-400">{it.materialCode}</p>
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-slate-800">{Number(it.qty)} {it.unit}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{it.reason || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              {detail.requisition.status === 'Draft' && (
                <button onClick={() => transition(detail.requisition, 'Approved')} className={btnPrimary}>
                  <CheckCircle2 className="h-4 w-4" /> Approve
                </button>
              )}
              {['Draft', 'Pending_Approval'].includes(detail.requisition.status) && (
                <button onClick={() => transition(detail.requisition, 'Rejected')} className={btnSecondary}>
                  <XCircle className="h-4 w-4" /> Reject
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Create */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New purchase requisition" subtitle="Manual entry — or generate from MRP on the MRP page" icon={FileText} wide>
        <form onSubmit={submit}>
          {saveError && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700">{saveError}</div>
          )}
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Related order">
              <select className={inputCls} value={form.orderId} onChange={(e) => setForm((f) => ({ ...f, orderId: e.target.value }))}>
                <option value="">— Optional —</option>
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>{o.orderNo}</option>
                ))}
              </select>
            </Field>
            <Field label="Required date">
              <input type="date" className={inputCls} value={form.requiredDate} onChange={(e) => setForm((f) => ({ ...f, requiredDate: e.target.value }))} />
            </Field>
            <Field label="Remarks">
              <input className={inputCls} value={form.remarks} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} />
            </Field>
          </div>

          <div className="mt-5 space-y-2.5">
            {items.map((it, i) => (
              <div key={i} className="grid grid-cols-12 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-2.5">
                <select className={`col-span-6 ${inputCls}`} value={it.materialId} onChange={(e) => setItems((ls) => ls.map((x, idx) => (idx === i ? { ...x, materialId: e.target.value } : x)))}>
                  <option value="">Material…</option>
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>{m.materialCode} · {m.materialName}</option>
                  ))}
                </select>
                <input type="number" min="0.001" step="0.001" placeholder="Qty" className={`col-span-2 ${inputCls}`} value={it.qty} onChange={(e) => setItems((ls) => ls.map((x, idx) => (idx === i ? { ...x, qty: e.target.value } : x)))} />
                <input placeholder="Reason (e.g. MRP shortage)" className={`col-span-4 ${inputCls}`} value={it.reason} onChange={(e) => setItems((ls) => ls.map((x, idx) => (idx === i ? { ...x, reason: e.target.value } : x)))} />
              </div>
            ))}
            <button type="button" onClick={() => setItems((ls) => [...ls, { materialId: '', qty: '', reason: '' }])} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-indigo-300 px-3 py-2 text-sm font-medium text-indigo-600 transition hover:bg-indigo-50">
              <Plus className="h-4 w-4" /> Add item
            </button>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-5">
            <button type="button" onClick={() => setCreateOpen(false)} className={btnSecondary}>Cancel</button>
            <button type="submit" disabled={saving} className={btnPrimary}>
              {saving ? (<><Loader2 className="h-4 w-4 animate-spin" /> Creating…</>) : (<>Create requisition</>)}
            </button>
          </div>
        </form>
      </Modal>

      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
    </div>
  );
}
