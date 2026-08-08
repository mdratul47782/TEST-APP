'use client';

import { useCallback, useEffect, useState } from 'react';
import { Scissors, Plus, Loader2 } from 'lucide-react';
import { api } from '@/utils/api';
import { Card, PageHeader, Spinner, EmptyState, ErrorBanner, Badge, Modal, Field, inputCls, btnPrimary, btnSecondary } from '@/components/ui';
import ToastStack from '@/components/toast';

export default function CuttingPage() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toasts, setToasts] = useState([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [productionOrders, setProductionOrders] = useState([]);
  const [form, setForm] = useState({ productionOrderId: '', markerNo: '', layNo: '', cutQty: '', plannedDate: '' });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const [detail, setDetail] = useState(null);
  const [itemForm, setItemForm] = useState({ materialId: '', plannedConsumption: '' });
  const [materials, setMaterials] = useState([]);
  const [bundleForm, setBundleForm] = useState({ bundleNo: '', size: '', qty: '' });

  const pushToast = useCallback((type, message) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4500);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get('/cutting');
      setPlans(data.cuttingPlans || []);
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
    setForm({ productionOrderId: '', markerNo: '', layNo: '', cutQty: '', plannedDate: '' });
    setSaveError(null);
    setCreateOpen(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      const data = await api.post('/cutting', { ...form, productionOrderId: Number(form.productionOrderId), cutQty: form.cutQty ? Number(form.cutQty) : undefined });
      pushToast('success', data.message);
      setCreateOpen(false);
      load();
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const openDetail = async (plan) => {
    try {
      const [d, m] = await Promise.all([api.get(`/cutting/${plan.id}`), api.get('/materials')]);
      setMaterials(m.materials || []);
      setDetail(d);
      setItemForm({ materialId: '', plannedConsumption: '' });
      setBundleForm({ bundleNo: '', size: '', qty: '' });
    } catch (err) {
      pushToast('error', err.message);
    }
  };

  const addItem = async (e) => {
    e.preventDefault();
    try {
      const data = await api.post(`/cutting/${detail.plan.id}/items`, { ...itemForm, materialId: Number(itemForm.materialId), plannedConsumption: Number(itemForm.plannedConsumption) });
      pushToast('success', data.message);
      openDetail(detail.plan);
    } catch (err) {
      pushToast('error', err.message);
    }
  };

  const recordActual = async (item) => {
    const actual = window.prompt('Actual consumption:', String(item.actualConsumption ?? item.plannedConsumption));
    if (actual === null) return;
    try {
      const data = await api.put(`/cutting/${detail.plan.id}/items/${item.id}`, { actualConsumption: Number(actual) });
      pushToast('success', 'Actual consumption recorded.');
      openDetail(detail.plan);
    } catch (err) {
      pushToast('error', err.message);
    }
  };

  const addBundle = async (e) => {
    e.preventDefault();
    try {
      const data = await api.post(`/cutting/${detail.plan.id}/bundles`, { ...bundleForm, qty: Number(bundleForm.qty), size: bundleForm.size || undefined });
      pushToast('success', data.message);
      openDetail(detail.plan);
    } catch (err) {
      pushToast('error', err.message);
    }
  };

  const transition = async (plan, status) => {
    try {
      const data = await api.post(`/cutting/${plan.id}/status`, { status });
      pushToast('success', data.message);
      setDetail(null);
      load();
    } catch (err) {
      pushToast('error', err.message);
    }
  };

  return (
    <div>
      <PageHeader
        title="Cutting"
        subtitle="Cutting plans with marker/lay, planned vs actual consumption, and bundles"
        actions={
          <button onClick={openCreate} className={btnPrimary}>
            <Plus className="h-4 w-4" /> New cutting plan
          </button>
        }
      />

      <Card className="mt-4 overflow-hidden">
        {error && <ErrorBanner message={error} onRetry={load} />}
        {loading ? (
          <Spinner label="Loading cutting plans…" />
        ) : plans.length === 0 ? (
          <EmptyState title="No cutting plans" message="Create a cutting plan against a production order." icon={Scissors} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3">Plan No</th>
                  <th className="px-4 py-3">Production order</th>
                  <th className="px-4 py-3">Marker / Lay</th>
                  <th className="px-4 py-3 text-right">Cut qty</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {plans.map((p) => (
                  <tr key={p.id} className="transition-colors hover:bg-slate-50/80">
                    <td className="px-4 py-3.5">
                      <button onClick={() => openDetail(p)} className="font-mono text-[13px] font-semibold text-indigo-600 hover:underline">{p.cuttingPlanNo}</button>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-slate-700">{p.productionOrderNo || '—'}</td>
                    <td className="px-4 py-3.5 text-sm text-slate-600">{p.markerNo || '—'} / {p.layNo || '—'}</td>
                    <td className="px-4 py-3.5 text-right text-sm font-semibold text-slate-800">{p.cutQty ?? '—'}</td>
                    <td className="px-4 py-3.5"><Badge>{p.status}</Badge></td>
                    <td className="px-4 py-3.5 text-right">
                      <button onClick={() => openDetail(p)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700">
                        Manage
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Create */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New cutting plan" subtitle="Marker, lay and planned cut quantity" icon={Scissors}>
        <form onSubmit={submit}>
          {saveError && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700">{saveError}</div>
          )}
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
              <Field label="Marker no">
                <input className={inputCls} value={form.markerNo} onChange={(e) => setForm((f) => ({ ...f, markerNo: e.target.value }))} />
              </Field>
              <Field label="Lay no">
                <input className={inputCls} value={form.layNo} onChange={(e) => setForm((f) => ({ ...f, layNo: e.target.value }))} />
              </Field>
              <Field label="Cut qty">
                <input type="number" min="1" className={inputCls} value={form.cutQty} onChange={(e) => setForm((f) => ({ ...f, cutQty: e.target.value }))} />
              </Field>
              <Field label="Planned date">
                <input type="date" className={inputCls} value={form.plannedDate} onChange={(e) => setForm((f) => ({ ...f, plannedDate: e.target.value }))} />
              </Field>
            </div>
          </div>
          <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-5">
            <button type="button" onClick={() => setCreateOpen(false)} className={btnSecondary}>Cancel</button>
            <button type="submit" disabled={saving} className={btnPrimary}>
              {saving ? (<><Loader2 className="h-4 w-4 animate-spin" /> Creating…</>) : (<>Create plan</>)}
            </button>
          </div>
        </form>
      </Modal>

      {/* Detail */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.plan?.cuttingPlanNo || ''} subtitle={`Marker ${detail?.plan?.markerNo || '—'} · Lay ${detail?.plan?.layNo || '—'}`} icon={Scissors} wide>
        {detail && (
          <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <Badge>{detail.plan.status}</Badge>
              <div className="flex gap-2">
                {detail.plan.status === 'Planned' && (
                  <button onClick={() => transition(detail.plan, 'In_Progress')} className={btnSecondary}>Start cutting</button>
                )}
                {['Planned', 'In_Progress'].includes(detail.plan.status) && (
                  <button onClick={() => transition(detail.plan, 'Completed')} className={btnPrimary}>Complete plan</button>
                )}
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {/* Consumption items */}
              <div className="rounded-xl border border-slate-200">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                  <p className="text-sm font-semibold text-slate-700">Fabric consumption</p>
                </div>
                <form onSubmit={addItem} className="grid grid-cols-12 items-center gap-2 border-b border-slate-100 bg-slate-50/60 p-3">
                  <select className={`col-span-6 ${inputCls}`} value={itemForm.materialId} onChange={(e) => setItemForm((f) => ({ ...f, materialId: e.target.value }))}>
                    <option value="">Material…</option>
                    {materials.map((m) => (
                      <option key={m.id} value={m.id}>{m.materialCode} · {m.materialName}</option>
                    ))}
                  </select>
                  <input type="number" step="0.001" placeholder="Planned" className={`col-span-4 ${inputCls}`} value={itemForm.plannedConsumption} onChange={(e) => setItemForm((f) => ({ ...f, plannedConsumption: e.target.value }))} />
                  <button type="submit" className="col-span-2 flex justify-center rounded-xl bg-indigo-600 p-2.5 text-white transition hover:bg-indigo-700">
                    <Plus className="h-4 w-4" />
                  </button>
                </form>
                {detail.items.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-slate-400">No consumption lines yet.</p>
                ) : (
                  detail.items.map((it) => (
                    <div key={it.id} className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-slate-800">{it.materialName}</p>
                        <p className="font-mono text-[11px] text-slate-400">{it.materialCode}</p>
                      </div>
                      <div className="text-right text-xs">
                        <p className="text-slate-500">planned {Number(it.plannedConsumption)}</p>
                        <p className="text-slate-700">actual {it.actualConsumption ?? '—'}</p>
                        <p className={Number(it.shortageQty) > 0 ? 'font-semibold text-rose-600' : 'text-emerald-600'}>
                          {Number(it.shortageQty) > 0 ? `short ${it.shortageQty}` : 'no shortage'}
                        </p>
                        <button onClick={() => recordActual(it)} className="mt-0.5 text-indigo-600 hover:underline">record actual</button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Bundles */}
              <div className="rounded-xl border border-slate-200">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                  <p className="text-sm font-semibold text-slate-700">Bundles</p>
                </div>
                <form onSubmit={addBundle} className="grid grid-cols-12 items-center gap-2 border-b border-slate-100 bg-slate-50/60 p-3">
                  <input placeholder="Bundle no" className={`col-span-4 ${inputCls}`} value={bundleForm.bundleNo} onChange={(e) => setBundleForm((f) => ({ ...f, bundleNo: e.target.value }))} />
                  <input placeholder="Size" className={`col-span-3 ${inputCls}`} value={bundleForm.size} onChange={(e) => setBundleForm((f) => ({ ...f, size: e.target.value }))} />
                  <input type="number" placeholder="Qty" className={`col-span-3 ${inputCls}`} value={bundleForm.qty} onChange={(e) => setBundleForm((f) => ({ ...f, qty: e.target.value }))} />
                  <button type="submit" className="col-span-2 flex justify-center rounded-xl bg-indigo-600 p-2.5 text-white transition hover:bg-indigo-700">
                    <Plus className="h-4 w-4" />
                  </button>
                </form>
                {detail.bundles.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-slate-400">No bundles yet.</p>
                ) : (
                  detail.bundles.map((b) => (
                    <div key={b.id} className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5 last:border-0">
                      <p className="font-mono text-sm font-semibold text-slate-800">{b.bundleNo}</p>
                      <p className="text-xs text-slate-500">{b.size || '—'} · {b.color || '—'} · {b.qty} pcs</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
    </div>
  );
}
