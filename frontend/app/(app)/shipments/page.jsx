'use client';

import { useCallback, useEffect, useState } from 'react';
import { Ship, Plus, Loader2, ArrowRight } from 'lucide-react';
import { api } from '@/utils/api';
import { Card, PageHeader, StatCard, Spinner, EmptyState, ErrorBanner, Badge, Modal, Field, inputCls, btnPrimary, btnSecondary, selectCls } from '@/components/ui';
import ToastStack from '@/components/toast';

const SHIPMENT_STATUSES = ['Planned', 'Partially_Shipped', 'Shipped', 'Completed'];

export default function ShipmentsPage() {
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [orders, setOrders] = useState([]);
  const [orderDetail, setOrderDetail] = useState(null);
  const [form, setForm] = useState({ salesOrderId: '', destination: '', shipmentDate: '' });
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [detail, setDetail] = useState(null);

  const pushToast = useCallback((type, message) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4500);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get('/shipping/shipments');
      setShipments(data.shipments || []);
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
    setOrders((o.orders || []).filter((x) => !['Completed', 'Cancelled'].includes(x.orderStatus)));
    setForm({ salesOrderId: '', destination: '', shipmentDate: '' });
    setItems([]);
    setOrderDetail(null);
    setSaveError(null);
    setCreateOpen(true);
  };

  const selectOrder = async (orderId) => {
    setForm((f) => ({ ...f, salesOrderId: orderId }));
    setItems([]);
    setOrderDetail(null);
    if (!orderId) return;
    try {
      const d = await api.get(`/orders/${orderId}`);
      setOrderDetail(d);
      setItems(
        (d.lines || []).map((l) => ({
          salesOrderLineId: l.id,
          styleNumber: l.styleNumber,
          color: l.color,
          quantity: l.quantity,
          qty: '',
          cartons: '',
        }))
      );
    } catch (err) {
      pushToast('error', err.message);
    }
  };

  const setItem = (i, k) => (e) => setItems((ls) => ls.map((x, idx) => (idx === i ? { ...x, [k]: e.target.value } : x)));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      const validItems = items.filter((it) => it.qty && Number(it.qty) > 0);
      if (validItems.length === 0) {
        setSaveError('Enter shipment quantities.');
        setSaving(false);
        return;
      }
      const data = await api.post('/shipping/shipments', {
        salesOrderId: Number(form.salesOrderId),
        destination: form.destination || undefined,
        shipmentDate: form.shipmentDate || undefined,
        items: validItems.map((it) => ({ salesOrderLineId: it.salesOrderLineId, qty: Number(it.qty), cartons: Number(it.cartons) || 0 })),
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

  const transition = async (shipment, status) => {
    try {
      const data = await api.post(`/shipping/shipments/${shipment.id}/status`, { status });
      pushToast('success', data.message);
      load();
    } catch (err) {
      pushToast('error', err.message);
    }
  };

  const openDetail = async (shipment) => {
    try {
      const data = await api.get(`/shipping/shipments/${shipment.id}`);
      setDetail(data);
    } catch (err) {
      pushToast('error', err.message);
    }
  };

  const planned = shipments.filter((s) => s.status === 'Planned').length;
  const shippedCount = shipments.filter((s) => ['Shipped', 'Completed'].includes(s.status)).length;

  return (
    <div>
      <PageHeader
        title="Shipments"
        subtitle="Plan shipment per confirmed order → dispatch → complete"
        actions={
          <button onClick={openCreate} className={btnPrimary}>
            <Plus className="h-4 w-4" /> Plan shipment
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatCard label="Planned" value={planned} icon={Ship} tint="bg-amber-50 text-amber-600" />
        <StatCard label="Shipped / Completed" value={shippedCount} icon={Ship} tint="bg-emerald-50 text-emerald-600" />
        <StatCard label="Total" value={shipments.length} icon={Ship} tint="bg-slate-50 text-slate-600" />
      </div>

      <Card className="mt-5 overflow-hidden">
        {error && <ErrorBanner message={error} onRetry={load} />}
        {loading ? (
          <Spinner label="Loading shipments…" />
        ) : shipments.length === 0 ? (
          <EmptyState title="No shipments" message="Plan a shipment against a confirmed order." icon={Ship} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3">Shipment</th>
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Buyer</th>
                  <th className="px-4 py-3">Destination</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shipments.map((s) => (
                  <tr key={s.id} className="transition-colors hover:bg-slate-50/80">
                    <td className="px-4 py-3.5">
                      <button onClick={() => openDetail(s)} className="font-mono text-[13px] font-semibold text-indigo-600 hover:underline">{s.shipmentNo}</button>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-sm text-slate-700">{s.orderNo || '—'}</td>
                    <td className="px-4 py-3.5 text-sm text-slate-700">{s.buyerName || '—'}</td>
                    <td className="px-4 py-3.5 text-sm text-slate-600">{s.destination || '—'}</td>
                    <td className="px-4 py-3.5 text-sm text-slate-600">{s.shipmentDate ? String(s.shipmentDate).slice(0, 10) : '—'}</td>
                    <td className="px-4 py-3.5"><Badge>{s.status}</Badge></td>
                    <td className="px-4 py-3.5 text-right">
                      <select value={s.status} onChange={(e) => transition(s, e.target.value)} className={`rounded-lg border px-2 py-1.5 text-xs font-medium shadow-sm outline-none ${selectCls}`}>
                        {SHIPMENT_STATUSES.map((st) => (
                          <option key={st} value={st}>{st.replace(/_/g, ' ')}</option>
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
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Plan shipment" subtitle="Ship quantities per order line + cartons" icon={Ship} wide>
        <form onSubmit={submit}>
          {saveError && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700">{saveError}</div>
          )}
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Order" required>
              <select required className={inputCls} value={form.salesOrderId} onChange={(e) => selectOrder(e.target.value)}>
                <option value="">— Select order —</option>
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>{o.orderNo} · {o.buyerName}</option>
                ))}
              </select>
            </Field>
            <Field label="Destination">
              <input className={inputCls} value={form.destination} onChange={(e) => setForm((f) => ({ ...f, destination: e.target.value }))} placeholder="Portland, OR, USA" />
            </Field>
            <Field label="Shipment date">
              <input type="date" className={inputCls} value={form.shipmentDate} onChange={(e) => setForm((f) => ({ ...f, shipmentDate: e.target.value }))} />
            </Field>
          </div>

          {items.length > 0 ? (
            <div className="mt-5 space-y-2.5">
              {items.map((it, i) => (
                <div key={it.salesOrderLineId} className="grid grid-cols-12 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-2.5">
                  <div className="col-span-6">
                    <p className="text-sm font-medium text-slate-800">{it.styleNumber} · {it.color}</p>
                    <p className="text-[11px] text-slate-400">order qty {it.quantity} pcs</p>
                  </div>
                  <input type="number" min="0" placeholder="Qty to ship" className={`col-span-3 ${inputCls}`} value={it.qty} onChange={setItem(i, 'qty')} />
                  <input type="number" min="0" placeholder="Cartons" className={`col-span-3 ${inputCls}`} value={it.cartons} onChange={setItem(i, 'cartons')} />
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-5 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">Select an order to load its lines.</p>
          )}

          <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-5">
            <button type="button" onClick={() => setCreateOpen(false)} className={btnSecondary}>Cancel</button>
            <button type="submit" disabled={saving} className={btnPrimary}>
              {saving ? (<><Loader2 className="h-4 w-4 animate-spin" /> Planning…</>) : (<>Plan shipment</>)}
            </button>
          </div>
        </form>
      </Modal>

      {/* Detail */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.shipment?.shipmentNo || ''} subtitle={`${detail?.shipment?.buyerName || ''} · ${detail?.shipment?.destination || ''}`} icon={Ship} wide>
        {detail && (
          <div>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Badge>{detail.shipment.status}</Badge>
              <span className="text-xs text-slate-400">order {detail.shipment.orderNo || '—'} · {detail.shipment.shipmentDate ? String(detail.shipment.shipmentDate).slice(0, 10) : ''}</span>
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-3">Style</th>
                    <th className="px-4 py-3">Color</th>
                    <th className="px-4 py-3 text-right">Qty</th>
                    <th className="px-4 py-3 text-right">Cartons</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {detail.items.map((it) => (
                    <tr key={it.id}>
                      <td className="px-4 py-3 font-mono text-sm font-semibold text-slate-800">{it.styleNumber || '—'}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{it.color || '—'}</td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-slate-800">{it.qty}</td>
                      <td className="px-4 py-3 text-right text-sm text-slate-600">{it.cartons}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-400">
              <ArrowRight className="h-3.5 w-3.5" /> Change status with the dropdown on the shipments list.
            </p>
          </div>
        )}
      </Modal>

      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
    </div>
  );
}
