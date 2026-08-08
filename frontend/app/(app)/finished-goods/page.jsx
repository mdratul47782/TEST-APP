'use client';

import { useCallback, useEffect, useState } from 'react';
import { Box, Plus, Loader2, PackageCheck } from 'lucide-react';
import { api } from '@/utils/api';
import { Card, PageHeader, StatCard, Spinner, EmptyState, ErrorBanner, Badge, Modal, Field, inputCls, btnPrimary, btnSecondary } from '@/components/ui';
import ToastStack from '@/components/toast';

export default function FinishedGoodsPage() {
  const [fg, setFg] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [productionOrders, setProductionOrders] = useState([]);
  const [form, setForm] = useState({ productionOrderId: '', color: '', size: '', qty: '', cartonNo: '' });
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
      const data = await api.get('/shipping/finished-goods');
      setFg(data.finishedGoods || []);
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
    setForm({ productionOrderId: '', color: '', size: '', qty: '', cartonNo: '' });
    setCreateOpen(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data = await api.post('/shipping/finished-goods', {
        productionOrderId: Number(form.productionOrderId),
        color: form.color || undefined,
        size: form.size || undefined,
        qty: Number(form.qty),
        cartonNo: form.cartonNo || undefined,
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

  const markPacked = async (item) => {
    try {
      const data = await api.post(`/shipping/finished-goods/${item.id}/status`, { status: 'Packed' });
      pushToast('success', data.message);
      load();
    } catch (err) {
      pushToast('error', err.message);
    }
  };

  const inStock = fg.filter((f) => f.status === 'In_Stock').reduce((s, f) => s + f.qty, 0);
  const packed = fg.filter((f) => f.status === 'Packed').reduce((s, f) => s + f.qty, 0);

  return (
    <div>
      <PageHeader
        title="Finished Goods"
        subtitle="Completed production → FG warehouse → packing → shipment"
        actions={
          <button onClick={openCreate} className={btnPrimary}>
            <Plus className="h-4 w-4" /> Add FG stock
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatCard label="In stock (pieces)" value={inStock.toLocaleString()} icon={Box} tint="bg-emerald-50 text-emerald-600" />
        <StatCard label="Packed (pieces)" value={packed.toLocaleString()} icon={PackageCheck} tint="bg-sky-50 text-sky-600" />
        <StatCard label="FG records" value={fg.length} icon={Box} tint="bg-slate-50 text-slate-600" />
      </div>

      <Card className="mt-5 overflow-hidden">
        {error && <ErrorBanner message={error} onRetry={load} />}
        {loading ? (
          <Spinner label="Loading finished goods…" />
        ) : fg.length === 0 ? (
          <EmptyState title="No finished goods" message="Move completed production output to the FG warehouse." icon={Box} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3">FG No</th>
                  <th className="px-4 py-3">Order / Style</th>
                  <th className="px-4 py-3">Color</th>
                  <th className="px-4 py-3">Size</th>
                  <th className="px-4 py-3 text-right">Qty</th>
                  <th className="px-4 py-3">Carton</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {fg.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3.5 font-mono text-[13px] font-semibold text-slate-800">{f.fgNo}</td>
                    <td className="px-4 py-3.5">
                      <p className="text-sm font-medium text-slate-800">{f.styleNumber || '—'}</p>
                      <p className="text-xs text-slate-400">{f.orderNo || ''}</p>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-slate-600">{f.color || '—'}</td>
                    <td className="px-4 py-3.5 text-sm text-slate-600">{f.size || '—'}</td>
                    <td className="px-4 py-3.5 text-right text-sm font-semibold text-slate-800">{f.qty}</td>
                    <td className="px-4 py-3.5 font-mono text-xs text-slate-600">{f.cartonNo || '—'}</td>
                    <td className="px-4 py-3.5"><Badge>{f.status}</Badge></td>
                    <td className="px-4 py-3.5 text-right">
                      {f.status === 'In_Stock' && (
                        <button onClick={() => markPacked(f)} className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-xs font-medium text-sky-700 transition hover:bg-sky-100">
                          <PackageCheck className="h-3.5 w-3.5" /> Pack
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Add finished goods" subtitle="From a production order to FG warehouse" icon={Box}>
        <form onSubmit={submit}>
          <div className="space-y-4">
            <Field label="Production order" required>
              <select required className={inputCls} value={form.productionOrderId} onChange={(e) => setForm((f) => ({ ...f, productionOrderId: e.target.value }))}>
                <option value="">— Select —</option>
                {productionOrders.map((p) => (
                  <option key={p.id} value={p.id}>{p.productionOrderNo} · {p.styleNumber}</option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Color">
                <input className={inputCls} value={form.color} onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))} placeholder="Black" />
              </Field>
              <Field label="Size">
                <input className={inputCls} value={form.size} onChange={(e) => setForm((f) => ({ ...f, size: e.target.value }))} placeholder="M" />
              </Field>
              <Field label="Qty" required>
                <input required type="number" min="1" className={inputCls} value={form.qty} onChange={(e) => setForm((f) => ({ ...f, qty: e.target.value }))} />
              </Field>
              <Field label="Carton no">
                <input className={inputCls} value={form.cartonNo} onChange={(e) => setForm((f) => ({ ...f, cartonNo: e.target.value }))} />
              </Field>
            </div>
          </div>
          <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-5">
            <button type="button" onClick={() => setCreateOpen(false)} className={btnSecondary}>Cancel</button>
            <button type="submit" disabled={saving} className={btnPrimary}>
              {saving ? (<><Loader2 className="h-4 w-4 animate-spin" /> Adding…</>) : (<>Add to FG</>)}
            </button>
          </div>
        </form>
      </Modal>

      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
    </div>
  );
}
