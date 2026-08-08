'use client';

import { useCallback, useEffect, useState } from 'react';
import { Box, Plus, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { api } from '@/utils/api';
import { Card, PageHeader, StatCard, Spinner, EmptyState, ErrorBanner, Badge, Modal, Field, inputCls, btnPrimary, btnSecondary } from '@/components/ui';
import ToastStack from '@/components/toast';

export default function IssuesPage() {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toasts, setToasts] = useState([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [productionOrders, setProductionOrders] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [form, setForm] = useState({ productionOrderId: '', warehouseId: '', issuedTo: '' });
  const [items, setItems] = useState([{ materialId: '', requestedQty: '' }]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const [detail, setDetail] = useState(null);
  const [issueQtyMap, setIssueQtyMap] = useState({});

  const pushToast = useCallback((type, message) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4500);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get('/issues');
      setIssues(data.issues || []);
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
    const [p, m, w] = await Promise.all([api.get('/production'), api.get('/materials'), api.get('/stock/warehouses')]);
    setProductionOrders(p.productionOrders || []);
    setMaterials(m.materials || []);
    setWarehouses(w.warehouses || []);
    setForm({ productionOrderId: '', warehouseId: w.warehouses?.[0]?.id || '', issuedTo: '' });
    setItems([{ materialId: '', requestedQty: '' }]);
    setSaveError(null);
    setCreateOpen(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      const data = await api.post('/issues', {
        productionOrderId: form.productionOrderId || undefined,
        warehouseId: form.warehouseId || undefined,
        issuedTo: form.issuedTo || undefined,
        items: items.filter((i) => i.materialId && i.requestedQty).map((i) => ({ materialId: Number(i.materialId), requestedQty: Number(i.requestedQty) })),
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

  const openDetail = async (issue) => {
    try {
      const data = await api.get(`/issues/${issue.id}`);
      setDetail(data);
      const map = {};
      (data.items || []).forEach((it) => {
        map[it.id] = Number(it.requestedQty) - Number(it.issuedQty);
      });
      setIssueQtyMap(map);
    } catch (err) {
      pushToast('error', err.message);
    }
  };

  const issueStock = async () => {
    try {
      const data = await api.post(`/issues/${detail.issue.id}/status`, { status: 'Issued', issuedItems: issueQtyMap });
      pushToast('success', data.message);
      setDetail(null);
      load();
    } catch (err) {
      pushToast('error', err.message);
    }
  };

  const reject = async (issue) => {
    try {
      const data = await api.post(`/issues/${issue.id}/status`, { status: 'Rejected' });
      pushToast('info', data.message);
      load();
    } catch (err) {
      pushToast('error', err.message);
    }
  };

  const requested = issues.filter((i) => i.status === 'Requested').length;
  const issued = issues.filter((i) => ['Issued', 'Partial'].includes(i.status)).length;

  return (
    <div>
      <PageHeader
        title="Material Issues"
        subtitle="Production requests material → warehouse approves → stock decrements + reservation released"
        actions={
          <button onClick={openCreate} className={btnPrimary}>
            <Plus className="h-4 w-4" /> New issue request
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatCard label="Requested" value={requested} icon={Box} tint="bg-amber-50 text-amber-600" />
        <StatCard label="Issued / Partial" value={issued} icon={Box} tint="bg-emerald-50 text-emerald-600" />
        <StatCard label="Total" value={issues.length} icon={Box} tint="bg-slate-50 text-slate-600" />
      </div>

      <Card className="mt-5 overflow-hidden">
        {error && <ErrorBanner message={error} onRetry={load} />}
        {loading ? (
          <Spinner label="Loading issues…" />
        ) : issues.length === 0 ? (
          <EmptyState title="No material issues" message="Production orders request material through issues (MI-00001…)." icon={Box} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3">Issue No</th>
                  <th className="px-4 py-3">Production order</th>
                  <th className="px-4 py-3">Materials</th>
                  <th className="px-4 py-3">Issued to</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {issues.map((iss) => (
                  <tr key={iss.id} className="transition-colors hover:bg-slate-50/80">
                    <td className="px-4 py-3.5">
                      <button onClick={() => openDetail(iss)} className="font-mono text-[13px] font-semibold text-indigo-600 hover:underline">{iss.issueNo}</button>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-slate-700">{iss.productionOrderNo || '—'}</td>
                    <td className="px-4 py-3.5 text-sm text-slate-600">
                      {iss.items.map((it) => `${it.materialCode} (${Number(it.issuedQty)}/${Number(it.requestedQty)})`).join(', ')}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-slate-600">{iss.issuedTo || '—'}</td>
                    <td className="px-4 py-3.5"><Badge>{iss.status}</Badge></td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="inline-flex gap-1.5">
                        {['Requested', 'Approved'].includes(iss.status) && (
                          <button onClick={() => openDetail(iss)} className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Issue stock
                          </button>
                        )}
                        {['Requested'].includes(iss.status) && (
                          <button onClick={() => reject(iss)} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-100">
                            <XCircle className="h-3.5 w-3.5" /> Reject
                          </button>
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

      {/* Create */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New material issue request" subtitle="Warehouse approves and issues stock" icon={Box} wide>
        <form onSubmit={submit}>
          {saveError && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700">{saveError}</div>
          )}
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Production order">
              <select className={inputCls} value={form.productionOrderId} onChange={(e) => setForm((f) => ({ ...f, productionOrderId: e.target.value }))}>
                <option value="">— Optional —</option>
                {productionOrders.map((p) => (
                  <option key={p.id} value={p.id}>{p.productionOrderNo} · {p.styleNumber}</option>
                ))}
              </select>
            </Field>
            <Field label="Warehouse">
              <select className={inputCls} value={form.warehouseId} onChange={(e) => setForm((f) => ({ ...f, warehouseId: e.target.value }))}>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.warehouseName}</option>
                ))}
              </select>
            </Field>
            <Field label="Issued to">
              <input className={inputCls} value={form.issuedTo} onChange={(e) => setForm((f) => ({ ...f, issuedTo: e.target.value }))} placeholder="Cutting floor" />
            </Field>
          </div>

          <div className="mt-5 space-y-2.5">
            {items.map((it, i) => (
              <div key={i} className="grid grid-cols-12 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-2.5">
                <select className={`col-span-8 ${inputCls}`} value={it.materialId} onChange={(e) => setItems((ls) => ls.map((x, idx) => (idx === i ? { ...x, materialId: e.target.value } : x)))}>
                  <option value="">Material…</option>
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>{m.materialCode} · {m.materialName} ({Number(m.stockQuantity)} {m.unit})</option>
                  ))}
                </select>
                <input type="number" min="0.001" step="0.001" placeholder="Qty" className={`col-span-4 ${inputCls}`} value={it.requestedQty} onChange={(e) => setItems((ls) => ls.map((x, idx) => (idx === i ? { ...x, requestedQty: e.target.value } : x)))} />
              </div>
            ))}
            <button type="button" onClick={() => setItems((ls) => [...ls, { materialId: '', requestedQty: '' }])} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-indigo-300 px-3 py-2 text-sm font-medium text-indigo-600 transition hover:bg-indigo-50">
              <Plus className="h-4 w-4" /> Add material
            </button>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-5">
            <button type="button" onClick={() => setCreateOpen(false)} className={btnSecondary}>Cancel</button>
            <button type="submit" disabled={saving} className={btnPrimary}>
              {saving ? (<><Loader2 className="h-4 w-4 animate-spin" /> Requesting…</>) : (<>Submit request</>)}
            </button>
          </div>
        </form>
      </Modal>

      {/* Issue detail */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.issue?.issueNo || ''} subtitle={`Status: ${detail?.issue?.status || ''}`} icon={Box}>
        {detail && (
          <div>
            <div className="space-y-2.5">
              {detail.items.map((it) => (
                <div key={it.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">{it.materialName}</p>
                    <p className="font-mono text-[11px] text-slate-400">{it.materialCode} · requested {Number(it.requestedQty)} {it.unit}</p>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    className="w-28 rounded-lg border border-slate-300 px-2.5 py-2 text-sm outline-none focus:border-indigo-500"
                    value={issueQtyMap[it.id] ?? 0}
                    onChange={(e) => setIssueQtyMap((m) => ({ ...m, [it.id]: e.target.value }))}
                    disabled={!['Requested', 'Approved'].includes(detail.issue.status)}
                  />
                </div>
              ))}
            </div>
            {['Requested', 'Approved'].includes(detail.issue.status) && (
              <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-5">
                <button onClick={issueStock} className={btnPrimary}>
                  <CheckCircle2 className="h-4 w-4" /> Issue stock
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
    </div>
  );
}
