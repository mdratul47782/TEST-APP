'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ShoppingCart, Plus, X, AlertTriangle, Loader2, Trash2, History } from 'lucide-react';
import { api } from '@/utils/api';
import { Card, PageHeader, StatCard, Spinner, EmptyState, ErrorBanner, Badge, Modal, Field, inputCls, selectCls, btnPrimary, btnSecondary } from '@/components/ui';
import ToastStack from '@/components/toast';

const ORDER_STATUSES = ['Draft', 'Booked', 'Confirmed', 'In_Production', 'Completed', 'Cancelled'];

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [buyers, setBuyers] = useState([]);
  const [styles, setStyles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toasts, setToasts] = useState([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ buyerId: '', orderDate: '', deliveryDate: '', currency: 'USD', priority: 'Normal', remarks: '' });
  const [lines, setLines] = useState([{ styleId: '', color: '', quantity: '', unitPrice: '' }]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const [detail, setDetail] = useState(null);
  const [amendments, setAmendments] = useState([]);

  const pushToast = useCallback((type, message) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4500);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get('/orders');
      setOrders(data.orders || []);
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
    const [b, s] = await Promise.all([api.get('/buyers'), api.get('/styles')]);
    setBuyers(b.buyers || []);
    setStyles(s.styles || []);
    const today = new Date().toISOString().slice(0, 10);
    setForm({ buyerId: '', orderDate: today, deliveryDate: '', currency: 'USD', priority: 'Normal', remarks: '' });
    setLines([{ styleId: '', color: '', quantity: '', unitPrice: '' }]);
    setSaveError(null);
    setCreateOpen(true);
  };

  const setFormField = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setLine = (i, k) => (e) => setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, [k]: e.target.value } : l)));
  const addLine = () => setLines((ls) => [...ls, { styleId: '', color: '', quantity: '', unitPrice: '' }]);
  const removeLine = (i) => setLines((ls) => (ls.length > 1 ? ls.filter((_, idx) => idx !== i) : ls));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    const payload = {
      ...form,
      buyerId: form.buyerId ? Number(form.buyerId) : null,
      lines: lines
        .filter((l) => l.styleId && l.color && l.quantity)
        .map((l) => ({ styleId: Number(l.styleId), color: l.color.trim(), quantity: Number(l.quantity), unitPrice: l.unitPrice || undefined })),
    };
    try {
      const data = await api.post('/orders', payload);
      pushToast('success', data.message);
      setCreateOpen(false);
      load();
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const transition = async (order, status) => {
    try {
      const data = await api.post(`/orders/${order.id}/status`, { status });
      pushToast('success', data.message);
      load();
    } catch (err) {
      pushToast('error', err.message);
    }
  };

  const openDetail = async (order) => {
    try {
      const [d, a] = await Promise.all([api.get(`/orders/${order.id}`), api.get(`/orders/${order.id}/amendments`)]);
      setDetail(d);
      setAmendments(a.amendments || []);
    } catch (err) {
      pushToast('error', err.message);
    }
  };

  const stats = useMemo(() => {
    const open = orders.filter((o) => !['Completed', 'Cancelled'].includes(o.orderStatus));
    const today = new Date().toISOString().slice(0, 10);
    return {
      open: open.length,
      totalQty: orders.reduce((s, o) => s + (o.totalQty || 0), 0),
      upcoming: open.filter((o) => String(o.deliveryDate) >= today).length,
      delayed: open.filter((o) => String(o.deliveryDate) < today).length,
    };
  }, [orders]);

  return (
    <div>
      <PageHeader
        title="Sales Orders"
        subtitle="Order booking from buyer POs · multi-color lines with size breakdowns"
        actions={
          <button onClick={openCreate} className={btnPrimary}>
            <Plus className="h-4 w-4" /> Book order
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Open Orders" value={stats.open} icon={ShoppingCart} tint="bg-indigo-50 text-indigo-600" />
        <StatCard label="Total Order Qty" value={stats.totalQty.toLocaleString()} icon={ShoppingCart} tint="bg-sky-50 text-sky-600" sub="pieces" />
        <StatCard label="Upcoming Deliveries" value={stats.upcoming} icon={ShoppingCart} tint="bg-emerald-50 text-emerald-600" />
        <StatCard label="Delayed Orders" value={stats.delayed} icon={AlertTriangle} tint="bg-rose-50 text-rose-600" />
      </div>

      <Card className="mt-5 overflow-hidden">
        {error && <ErrorBanner message={error} onRetry={load} />}
        {loading ? (
          <Spinner label="Loading orders…" />
        ) : orders.length === 0 ? (
          <EmptyState title="No orders booked" message="Book your first order — e.g. COL-2026-001 from Columbia for JK-1001." icon={ShoppingCart} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Buyer</th>
                  <th className="px-4 py-3">Delivery</th>
                  <th className="px-4 py-3">Qty</th>
                  <th className="px-4 py-3">Lines</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((o) => (
                  <tr key={o.id} className="transition-colors hover:bg-slate-50/80">
                    <td className="px-4 py-3.5">
                      <button onClick={() => openDetail(o)} className="font-mono text-[13px] font-semibold text-indigo-600 hover:underline">{o.orderNo}</button>
                      <p className="text-xs text-slate-400">Booked {String(o.orderDate).slice(0, 10)}</p>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-slate-700">{o.buyerName || '—'}</td>
                    <td className="px-4 py-3.5 text-sm text-slate-700">{String(o.deliveryDate).slice(0, 10)}</td>
                    <td className="px-4 py-3.5 text-sm font-semibold text-slate-800">{o.totalQty?.toLocaleString()}</td>
                    <td className="px-4 py-3.5 text-sm text-slate-600">{o.lineCount}</td>
                    <td className="px-4 py-3.5"><Badge>{o.priority}</Badge></td>
                    <td className="px-4 py-3.5"><Badge>{o.orderStatus}</Badge></td>
                    <td className="px-4 py-3.5 text-right">
                      <select
                        value={o.orderStatus}
                        onChange={(e) => transition(o, e.target.value)}
                        className={`rounded-lg border px-2 py-1.5 text-xs font-medium shadow-sm outline-none ${selectCls}`}
                      >
                        {ORDER_STATUSES.map((s) => (
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

      {/* Create order modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Book new sales order" subtitle="One order, multiple color lines" icon={ShoppingCart} wide>
        <form onSubmit={submit}>
          {saveError && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {saveError}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-4">
            <Field label="Buyer" required>
              <select required className={inputCls} value={form.buyerId} onChange={setFormField('buyerId')}>
                <option value="">— Select —</option>
                {buyers.map((b) => (
                  <option key={b.id} value={b.id}>{b.buyerName}</option>
                ))}
              </select>
            </Field>
            <Field label="Order date" required>
              <input required type="date" className={inputCls} value={form.orderDate} onChange={setFormField('orderDate')} />
            </Field>
            <Field label="Delivery date" required>
              <input required type="date" className={inputCls} value={form.deliveryDate} onChange={setFormField('deliveryDate')} />
            </Field>
            <Field label="Priority">
              <select className={inputCls} value={form.priority} onChange={setFormField('priority')}>
                <option>Normal</option>
                <option>High</option>
                <option>Urgent</option>
              </select>
            </Field>
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-700">Order lines <span className="text-xs font-normal text-slate-400">(color × quantity)</span></p>
              <button type="button" onClick={addLine} className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100">
                <Plus className="h-3.5 w-3.5" /> Add color line
              </button>
            </div>
            <div className="space-y-2.5">
              {lines.map((l, i) => (
                <div key={i} className="grid grid-cols-12 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-2.5">
                  <div className="col-span-5">
                    <select className={inputCls} value={l.styleId} onChange={setLine(i, 'styleId')}>
                      <option value="">Style…</option>
                      {styles.map((s) => (
                        <option key={s.id} value={s.id}>{s.styleNumber} · {s.productName}</option>
                      ))}
                    </select>
                  </div>
                  <input className={`col-span-2 ${inputCls}`} placeholder="Color" value={l.color} onChange={setLine(i, 'color')} />
                  <input className={`col-span-2 ${inputCls}`} placeholder="Qty" type="number" min="1" value={l.quantity} onChange={setLine(i, 'quantity')} />
                  <input className={`col-span-2 ${inputCls}`} placeholder="Price" type="number" step="0.01" value={l.unitPrice} onChange={setLine(i, 'unitPrice')} />
                  <button type="button" onClick={() => removeLine(i)} disabled={lines.length === 1} className="col-span-1 flex justify-center rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-500 disabled:opacity-30" aria-label="Remove line">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <Field label="Remarks">
              <textarea rows={2} className={inputCls} value={form.remarks} onChange={setFormField('remarks')} />
            </Field>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-5">
            <button type="button" onClick={() => setCreateOpen(false)} className={btnSecondary}>Cancel</button>
            <button type="submit" disabled={saving} className={btnPrimary}>
              {saving ? (<><Loader2 className="h-4 w-4 animate-spin" /> Booking…</>) : (<>Book order</>)}
            </button>
          </div>
        </form>
      </Modal>

      {/* Order detail */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.order?.orderNo || 'Order'} subtitle={`${detail?.order?.buyerName || ''} · delivery ${detail?.order?.deliveryDate || ''}`} icon={History} wide>
        {detail && (
          <div>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Badge>{detail.order.orderStatus}</Badge>
              <Badge>{detail.order.priority}</Badge>
              <span className="text-xs text-slate-400">Currency: {detail.order.currency}</span>
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-3">Style</th>
                    <th className="px-4 py-3">Color</th>
                    <th className="px-4 py-3">Qty</th>
                    <th className="px-4 py-3">Unit price</th>
                    <th className="px-4 py-3">BOM version</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {detail.lines.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3">
                        <p className="font-mono text-sm font-semibold text-slate-800">{l.styleNumber}</p>
                        <p className="text-xs text-slate-400">{l.productName}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">{l.color}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-800">{l.quantity}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{l.unitPrice ? `${detail.order.currency} ${l.unitPrice}` : '—'}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">v{l.bomVersionId || '—'}</td>
                      <td className="px-4 py-3"><Badge>{l.lineStatus}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {amendments.length > 0 && (
              <div className="mt-5">
                <p className="mb-2 text-sm font-semibold text-slate-700">Amendment history</p>
                <div className="space-y-1.5">
                  {amendments.map((a) => (
                    <p key={a.id} className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      <span className="font-semibold text-slate-800">{a.field}</span>: {a.oldValue || '—'} → {a.newValue || '—'}
                      <span className="ml-2 text-slate-400">{a.amendedAt ? new Date(a.amendedAt).toLocaleString() : ''}</span>
                    </p>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-5 flex flex-wrap gap-2">
              <Link href={`/mrp?order=${detail.order.id}`} className={btnPrimary}>
                Run MRP →
              </Link>
            </div>
          </div>
        )}
      </Modal>

      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
    </div>
  );
}
