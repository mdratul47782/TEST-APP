'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ShoppingBag, Plus, Loader2, ArrowRight, PackageCheck } from 'lucide-react';
import { api } from '@/utils/api';
import { Card, PageHeader, StatCard, Spinner, EmptyState, ErrorBanner, Badge, Modal, Field, inputCls, selectCls, btnPrimary, btnSecondary } from '@/components/ui';
import ToastStack from '@/components/toast';

const PO_STATUSES = ['Draft', 'Approved', 'Partially_Received', 'Received', 'Cancelled'];

function PurchaseOrdersPageContent() {
  const searchParams = useSearchParams();
  const [pos, setPos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toasts, setToasts] = useState([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [form, setForm] = useState({ supplierId: '', deliveryDate: '', currency: 'USD' });
  const [items, setItems] = useState([{ materialId: '', qty: '', unitPrice: '' }]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const [convertPr, setConvertPr] = useState(null); // { pr } loaded from query
  const [convertForm, setConvertForm] = useState({ supplierId: '', deliveryDate: '', currency: 'USD' });
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
      const data = await api.get('/purchase-orders');
      setPos(data.purchaseOrders || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // PR conversion deep-link
  useEffect(() => {
    const prId = searchParams.get('pr');
    if (prId) {
      (async () => {
        try {
          const [prData, supData] = await Promise.all([api.get(`/requisitions/${prId}`), api.get('/suppliers')]);
          setConvertPr(prData);
          setSuppliers(supData.suppliers || []);
          setConvertForm({ supplierId: '', deliveryDate: '', currency: 'USD' });
        } catch (err) {
          pushToast('error', err.message);
        }
      })();
    }
  }, [searchParams, pushToast]);

  const openCreate = async () => {
    const [s, m] = await Promise.all([api.get('/suppliers'), api.get('/materials')]);
    setSuppliers(s.suppliers || []);
    setMaterials(m.materials || []);
    setForm({ supplierId: '', deliveryDate: '', currency: 'USD' });
    setItems([{ materialId: '', qty: '', unitPrice: '' }]);
    setSaveError(null);
    setCreateOpen(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      const data = await api.post('/purchase-orders', {
        supplierId: Number(form.supplierId),
        deliveryDate: form.deliveryDate || undefined,
        currency: form.currency,
        items: items.filter((i) => i.materialId && i.qty).map((i) => ({ materialId: Number(i.materialId), qty: Number(i.qty), unitPrice: i.unitPrice || undefined })),
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

  const submitConvert = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      const data = await api.post(`/purchase-orders/from-pr/${convertPr.requisition.id}`, {
        supplierId: Number(convertForm.supplierId),
        deliveryDate: convertForm.deliveryDate || undefined,
        currency: convertForm.currency,
      });
      pushToast('success', data.message);
      setConvertPr(null);
      load();
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const transition = async (po, status) => {
    try {
      const data = await api.post(`/purchase-orders/${po.id}/status`, { status });
      pushToast('success', data.message);
      load();
    } catch (err) {
      pushToast('error', err.message);
    }
  };

  const openDetail = async (po) => {
    try {
      const data = await api.get(`/purchase-orders/${po.id}`);
      setDetail(data);
    } catch (err) {
      pushToast('error', err.message);
    }
  };

  const open = pos.filter((p) => ['Draft', 'Approved', 'Partially_Received'].includes(p.status));
  const received = pos.filter((p) => p.status === 'Received');

  return (
    <div>
      <PageHeader
        title="Purchase Orders"
        subtitle="Convert approved requisitions, track receive progress, capture supplier pricing"
        actions={
          <button onClick={openCreate} className={btnPrimary}>
            <Plus className="h-4 w-4" /> New PO
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatCard label="Open POs" value={open.length} icon={ShoppingBag} tint="bg-sky-50 text-sky-600" />
        <StatCard label="Fully Received" value={received.length} icon={PackageCheck} tint="bg-emerald-50 text-emerald-600" />
        <StatCard label="Total POs" value={pos.length} icon={ShoppingBag} tint="bg-slate-50 text-slate-600" />
      </div>

      <Card className="mt-5 overflow-hidden">
        {error && <ErrorBanner message={error} onRetry={load} />}
        {loading ? (
          <Spinner label="Loading purchase orders…" />
        ) : pos.length === 0 ? (
          <EmptyState title="No purchase orders" message="Approve a requisition and convert it, or create a PO directly." icon={ShoppingBag} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3">PO No</th>
                  <th className="px-4 py-3">Supplier</th>
                  <th className="px-4 py-3">Delivery</th>
                  <th className="px-4 py-3 text-right">Qty</th>
                  <th className="px-4 py-3 text-right">Received</th>
                  <th className="px-4 py-3 text-right">Remaining</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pos.map((po) => (
                  <tr key={po.id} className="transition-colors hover:bg-slate-50/80">
                    <td className="px-4 py-3.5">
                      <button onClick={() => openDetail(po)} className="font-mono text-[13px] font-semibold text-indigo-600 hover:underline">{po.poNo}</button>
                      {po.prId && <p className="text-[11px] text-slate-400">from PR #{po.prId}</p>}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-slate-700">{po.supplierName || '—'}</td>
                    <td className="px-4 py-3.5 text-sm text-slate-600">{po.deliveryDate ? String(po.deliveryDate).slice(0, 10) : '—'}</td>
                    <td className="px-4 py-3.5 text-right text-sm font-semibold text-slate-800">{Number(po.totalQty).toLocaleString()}</td>
                    <td className="px-4 py-3.5 text-right text-sm text-emerald-600">{Number(po.receivedQty).toLocaleString()}</td>
                    <td className="px-4 py-3.5 text-right text-sm text-rose-600">{Number(po.remainingQty).toLocaleString()}</td>
                    <td className="px-4 py-3.5"><Badge>{po.status}</Badge></td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <select value={po.status} onChange={(e) => transition(po, e.target.value)} className={`rounded-lg border px-2 py-1.5 text-xs font-medium shadow-sm outline-none ${selectCls}`}>
                          {PO_STATUSES.map((s) => (
                            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                          ))}
                        </select>
                        {['Approved', 'Partially_Received'].includes(po.status) && (
                          <a href={`/grn?po=${po.id}`} className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100">
                            Receive <ArrowRight className="h-3.5 w-3.5" />
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

      {/* New PO */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New purchase order" subtitle="Place a PO directly (no PR)" icon={ShoppingBag} wide>
        <form onSubmit={submit}>
          {saveError && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700">{saveError}</div>
          )}
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Supplier" required>
              <select required className={inputCls} value={form.supplierId} onChange={(e) => setForm((f) => ({ ...f, supplierId: e.target.value }))}>
                <option value="">— Select —</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.supplierName}</option>
                ))}
              </select>
            </Field>
            <Field label="Delivery date">
              <input type="date" className={inputCls} value={form.deliveryDate} onChange={(e) => setForm((f) => ({ ...f, deliveryDate: e.target.value }))} />
            </Field>
            <Field label="Currency">
              <input maxLength={3} className={inputCls} value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))} />
            </Field>
          </div>
          <div className="mt-5 space-y-2.5">
            {items.map((it, i) => (
              <div key={i} className="grid grid-cols-12 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-2.5">
                <select className={`col-span-5 ${inputCls}`} value={it.materialId} onChange={(e) => setItems((ls) => ls.map((x, idx) => (idx === i ? { ...x, materialId: e.target.value } : x)))}>
                  <option value="">Material…</option>
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>{m.materialCode} · {m.materialName}</option>
                  ))}
                </select>
                <input type="number" min="0.001" step="0.001" placeholder="Qty" className={`col-span-3 ${inputCls}`} value={it.qty} onChange={(e) => setItems((ls) => ls.map((x, idx) => (idx === i ? { ...x, qty: e.target.value } : x)))} />
                <input type="number" min="0" step="0.0001" placeholder="Unit price" className={`col-span-3 ${inputCls}`} value={it.unitPrice} onChange={(e) => setItems((ls) => ls.map((x, idx) => (idx === i ? { ...x, unitPrice: e.target.value } : x)))} />
              </div>
            ))}
            <button type="button" onClick={() => setItems((ls) => [...ls, { materialId: '', qty: '', unitPrice: '' }])} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-indigo-300 px-3 py-2 text-sm font-medium text-indigo-600 transition hover:bg-indigo-50">
              <Plus className="h-4 w-4" /> Add item
            </button>
          </div>
          <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-5">
            <button type="button" onClick={() => setCreateOpen(false)} className={btnSecondary}>Cancel</button>
            <button type="submit" disabled={saving} className={btnPrimary}>
              {saving ? (<><Loader2 className="h-4 w-4 animate-spin" /> Creating…</>) : (<>Create PO</>)}
            </button>
          </div>
        </form>
      </Modal>

      {/* Convert PR */}
      <Modal open={!!convertPr} onClose={() => setConvertPr(null)} title={`Convert ${convertPr?.requisition?.prNo || ''} to PO`} subtitle={`${convertPr?.items?.length || 0} material line(s) · choose the supplier`} icon={ArrowRight}>
        <form onSubmit={submitConvert}>
          {saveError && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700">{saveError}</div>
          )}
          <div className="mb-4 overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-2">Material</th>
                  <th className="px-4 py-2 text-right">Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {convertPr?.items?.map((it) => (
                  <tr key={it.id}>
                    <td className="px-4 py-2 text-sm text-slate-700">{it.materialName}</td>
                    <td className="px-4 py-2 text-right text-sm font-semibold text-slate-800">{Number(it.qty)} {it.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Supplier" required>
              <select required className={inputCls} value={convertForm.supplierId} onChange={(e) => setConvertForm((f) => ({ ...f, supplierId: e.target.value }))}>
                <option value="">— Select supplier —</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.supplierName}</option>
                ))}
              </select>
            </Field>
            <Field label="Delivery date">
              <input type="date" className={inputCls} value={convertForm.deliveryDate} onChange={(e) => setConvertForm((f) => ({ ...f, deliveryDate: e.target.value }))} />
            </Field>
            <Field label="Currency">
              <input maxLength={3} className={inputCls} value={convertForm.currency} onChange={(e) => setConvertForm((f) => ({ ...f, currency: e.target.value }))} />
            </Field>
          </div>
          <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-5">
            <button type="button" onClick={() => setConvertPr(null)} className={btnSecondary}>Cancel</button>
            <button type="submit" disabled={saving} className={btnPrimary}>
              {saving ? (<><Loader2 className="h-4 w-4 animate-spin" /> Converting…</>) : (<>Convert to PO</>)}
            </button>
          </div>
        </form>
      </Modal>

      {/* Detail */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.purchaseOrder?.poNo || 'PO'} subtitle={detail?.purchaseOrder?.supplierName || ''} icon={ShoppingBag} wide>
        {detail && (
          <div>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Badge>{detail.purchaseOrder.status}</Badge>
              <span className="text-xs text-slate-400">{detail.purchaseOrder.currency} · ordered {String(detail.purchaseOrder.orderDate).slice(0, 10)}</span>
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-3">Material</th>
                    <th className="px-4 py-3 text-right">Qty</th>
                    <th className="px-4 py-3 text-right">Unit price</th>
                    <th className="px-4 py-3 text-right">Received</th>
                    <th className="px-4 py-3 text-right">Remaining</th>
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
                      <td className="px-4 py-3 text-right text-sm text-slate-700">{it.unitPrice ?? '—'}</td>
                      <td className="px-4 py-3 text-right text-sm text-emerald-600">{Number(it.receivedQty)}</td>
                      <td className="px-4 py-3 text-right text-sm text-rose-600">{Math.max(0, Number(it.qty) - Number(it.receivedQty) - Number(it.cancelledQty))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {detail.grns?.length > 0 && (
              <p className="mt-3 text-xs text-slate-400">{detail.grns.length} GRN(s) against this PO</p>
            )}
          </div>
        )}
      </Modal>

      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
    </div>
  );
}

export default function PurchaseOrdersPage() {
  return (
    <Suspense fallback={<Card><Spinner label="Loading purchase orders…" /></Card>}>
      <PurchaseOrdersPageContent />
    </Suspense>
  );
}
