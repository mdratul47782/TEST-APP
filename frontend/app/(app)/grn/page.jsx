'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PackageCheck, Plus, Loader2, ShieldCheck, XCircle } from 'lucide-react';
import { api } from '@/utils/api';
import { Card, PageHeader, StatCard, Spinner, EmptyState, ErrorBanner, Badge, Modal, Field, inputCls, selectCls, btnPrimary, btnSecondary } from '@/components/ui';
import ToastStack from '@/components/toast';

function GrnPageContent() {
  const searchParams = useSearchParams();
  const [grns, setGrns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toasts, setToasts] = useState([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [pos, setPos] = useState([]);
  const [poDetail, setPoDetail] = useState(null);
  const [warehouses, setWarehouses] = useState([]);
  const [form, setForm] = useState({ poId: '', receivedDate: '', invoiceNo: '', deliveryChallanNo: '', warehouseId: '' });
  const [items, setItems] = useState([]); // {materialId, receivedQty, acceptedQty, rejectedQty, batch, lot}
  const [rolls, setRolls] = useState({});
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
      const data = await api.get('/grn');
      setGrns(data.grns || []);
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
    const [poData, whData] = await Promise.all([api.get('/purchase-orders'), api.get('/stock/warehouses')]);
    const openPos = (poData.purchaseOrders || []).filter((p) => ['Approved', 'Partially_Received'].includes(p.status));
    setPos(openPos);
    setWarehouses(whData.warehouses || []);
    setForm({ poId: '', receivedDate: new Date().toISOString().slice(0, 10), invoiceNo: '', deliveryChallanNo: '', warehouseId: whData.warehouses?.[0]?.id || '' });
    setItems([]);
    setRolls({});
    setSaveError(null);
    setCreateOpen(true);
  };

  // deep link from PO page
  useEffect(() => {
    const poId = searchParams.get('po');
    if (poId) {
      (async () => {
        try {
          const [poData, whData] = await Promise.all([api.get('/purchase-orders'), api.get('/stock/warehouses')]);
          const openPos = (poData.purchaseOrders || []).filter((p) => ['Approved', 'Partially_Received'].includes(p.status));
          setPos(openPos);
          setWarehouses(whData.warehouses || []);
          setForm((f) => ({ ...f, poId, receivedDate: new Date().toISOString().slice(0, 10), warehouseId: whData.warehouses?.[0]?.id || '' }));
          setItems([]);
          setRolls({});
          setSaveError(null);
          setCreateOpen(true);
        } catch (err) {
          pushToast('error', err.message);
        }
      })();
    }
  }, [searchParams, pushToast]);

  const selectPo = async (poId) => {
    setForm((f) => ({ ...f, poId }));
    if (!poId) {
      setPoDetail(null);
      setItems([]);
      return;
    }
    try {
      const data = await api.get(`/purchase-orders/${poId}`);
      setPoDetail(data);
      setItems(
        (data.items || [])
          .filter((it) => Number(it.receivedQty) < Number(it.qty))
          .map((it) => ({
            materialId: it.materialId,
            materialCode: it.materialCode,
            materialName: it.materialName,
            unit: it.unit,
            remaining: Number(it.qty) - Number(it.receivedQty) - Number(it.cancelledQty),
            receivedQty: '',
            acceptedQty: '',
            rejectedQty: '0',
            batch: '',
            lot: '',
          }))
      );
      setRolls({});
    } catch (err) {
      pushToast('error', err.message);
    }
  };

  const setItem = (i, k) => (e) => setItems((ls) => ls.map((x, idx) => (idx === i ? { ...x, [k]: e.target.value } : x)));
  const setRoll = (materialId, k) => (e) => setRolls((r) => ({ ...r, [materialId]: { ...(r[materialId] || {}), [k]: e.target.value } }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      const payloadItems = items
        .filter((it) => it.receivedQty && Number(it.receivedQty) > 0)
        .map((it) => ({
          materialId: it.materialId,
          receivedQty: Number(it.receivedQty),
          acceptedQty: Number(it.acceptedQty),
          rejectedQty: Number(it.rejectedQty) || 0,
          batch: it.batch || undefined,
          lot: it.lot || undefined,
        }));
      if (payloadItems.length === 0) {
        setSaveError('Enter received quantities first.');
        setSaving(false);
        return;
      }
      const rollsPayload = Object.entries(rolls)
        .filter(([, r]) => r.rollNo)
        .map(([materialId, r]) => ({ materialId: Number(materialId), rollNo: r.rollNo, length: r.length, width: r.width, shade: r.shade, gsm: r.gsm || undefined }));

      const data = await api.post('/grn', {
        poId: Number(form.poId),
        receivedDate: form.receivedDate,
        invoiceNo: form.invoiceNo || undefined,
        deliveryChallanNo: form.deliveryChallanNo || undefined,
        warehouseId: form.warehouseId || undefined,
        items: payloadItems,
        rolls: rollsPayload,
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

  const transition = async (grn, status) => {
    try {
      const data = await api.post(`/grn/${grn.id}/status`, { status });
      pushToast('success', data.message);
      load();
    } catch (err) {
      pushToast('error', err.message);
    }
  };

  const openDetail = async (grn) => {
    try {
      const data = await api.get(`/grn/${grn.id}`);
      setDetail(data);
    } catch (err) {
      pushToast('error', err.message);
    }
  };

  const pending = grns.filter((g) => g.status === 'Pending_QC');

  return (
    <div>
      <PageHeader
        title="Goods Receiving (GRN)"
        subtitle="Supplier delivery → receive → QC → accepted stock enters the ledger"
        actions={
          <button onClick={openCreate} className={btnPrimary}>
            <Plus className="h-4 w-4" /> Receive goods
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatCard label="Pending QC" value={pending.length} icon={ShieldCheck} tint="bg-amber-50 text-amber-600" />
        <StatCard label="Total GRNs" value={grns.length} icon={PackageCheck} tint="bg-slate-50 text-slate-600" />
      </div>

      <Card className="mt-5 overflow-hidden">
        {error && <ErrorBanner message={error} onRetry={load} />}
        {loading ? (
          <Spinner label="Loading GRNs…" />
        ) : grns.length === 0 ? (
          <EmptyState title="No goods received" message="Receive supplier deliveries against open purchase orders." icon={PackageCheck} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3">GRN No</th>
                  <th className="px-4 py-3">PO</th>
                  <th className="px-4 py-3">Supplier</th>
                  <th className="px-4 py-3">Received</th>
                  <th className="px-4 py-3">Invoice</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {grns.map((g) => (
                  <tr key={g.id} className="transition-colors hover:bg-slate-50/80">
                    <td className="px-4 py-3.5">
                      <button onClick={() => openDetail(g)} className="font-mono text-[13px] font-semibold text-indigo-600 hover:underline">{g.grnNo}</button>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-sm text-slate-700">{g.poNo || '—'}</td>
                    <td className="px-4 py-3.5 text-sm text-slate-700">{g.supplierName || '—'}</td>
                    <td className="px-4 py-3.5 text-sm text-slate-600">{String(g.receivedDate).slice(0, 10)}</td>
                    <td className="px-4 py-3.5 text-sm text-slate-600">{g.invoiceNo || '—'}</td>
                    <td className="px-4 py-3.5"><Badge>{g.status}</Badge></td>
                    <td className="px-4 py-3.5 text-right">
                      {g.status === 'Pending_QC' && (
                        <div className="inline-flex gap-1.5">
                          <button onClick={() => transition(g, 'QC_Passed')} className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100">
                            <ShieldCheck className="h-3.5 w-3.5" /> Pass
                          </button>
                          <button onClick={() => transition(g, 'QC_Failed')} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-100">
                            <XCircle className="h-3.5 w-3.5" /> Fail
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Receive modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Receive goods" subtitle="Accepted quantities enter stock; rejected go back to supplier" icon={PackageCheck} wide>
        <form onSubmit={submit}>
          {saveError && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700">{saveError}</div>
          )}
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Purchase order" required>
              <select required className={inputCls} value={form.poId} onChange={(e) => selectPo(e.target.value)}>
                <option value="">— Select open PO —</option>
                {pos.map((p) => (
                  <option key={p.id} value={p.id}>{p.poNo} · {p.supplierName} · remaining {p.remainingQty}</option>
                ))}
              </select>
            </Field>
            <Field label="Received date" required>
              <input required type="date" className={inputCls} value={form.receivedDate} onChange={(e) => setForm((f) => ({ ...f, receivedDate: e.target.value }))} />
            </Field>
            <Field label="Warehouse">
              <select className={inputCls} value={form.warehouseId} onChange={(e) => setForm((f) => ({ ...f, warehouseId: e.target.value }))}>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.warehouseName}</option>
                ))}
              </select>
            </Field>
            <Field label="Invoice no">
              <input className={inputCls} value={form.invoiceNo} onChange={(e) => setForm((f) => ({ ...f, invoiceNo: e.target.value }))} />
            </Field>
            <Field label="Delivery challan">
              <input className={inputCls} value={form.deliveryChallanNo} onChange={(e) => setForm((f) => ({ ...f, deliveryChallanNo: e.target.value }))} />
            </Field>
          </div>

          {items.length > 0 ? (
            <div className="mt-5 space-y-3">
              {items.map((it, i) => (
                <div key={it.materialId} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-800">{it.materialName} <span className="font-mono text-[11px] text-slate-400">{it.materialCode}</span></p>
                    <span className="text-xs text-slate-400">remaining on PO: {it.remaining} {it.unit}</span>
                  </div>
                  <div className="mt-2 grid grid-cols-12 items-center gap-2">
                    <input type="number" min="0" step="0.001" placeholder="Received" className={`col-span-3 ${inputCls}`} value={it.receivedQty} onChange={setItem(i, 'receivedQty')} />
                    <input type="number" min="0" step="0.001" placeholder="Accepted" className={`col-span-3 ${inputCls}`} value={it.acceptedQty} onChange={setItem(i, 'acceptedQty')} />
                    <input type="number" min="0" step="0.001" placeholder="Rejected" className={`col-span-2 ${inputCls}`} value={it.rejectedQty} onChange={setItem(i, 'rejectedQty')} />
                    <input placeholder="Batch / lot" className={`col-span-2 ${inputCls}`} value={it.batch} onChange={setItem(i, 'batch')} />
                    {it.unit === 'm' || it.unit === 'yd' ? (
                      <span className="col-span-2 text-[10px] font-medium text-slate-400">fabric → add rolls below</span>
                    ) : (
                      <span className="col-span-2" />
                    )}
                  </div>
                  {(it.unit === 'm' || it.unit === 'yd') && (
                    <div className="mt-2 grid grid-cols-12 items-center gap-2 rounded-lg bg-white p-2">
                      <input placeholder="Roll no" className={`col-span-3 ${inputCls}`} value={rolls[it.materialId]?.rollNo || ''} onChange={setRoll(it.materialId, 'rollNo')} />
                      <input type="number" step="0.01" placeholder="Length" className={`col-span-2 ${inputCls}`} value={rolls[it.materialId]?.length || ''} onChange={setRoll(it.materialId, 'length')} />
                      <input type="number" step="0.01" placeholder="Width" className={`col-span-2 ${inputCls}`} value={rolls[it.materialId]?.width || ''} onChange={setRoll(it.materialId, 'width')} />
                      <input placeholder="Shade" className={`col-span-2 ${inputCls}`} value={rolls[it.materialId]?.shade || ''} onChange={setRoll(it.materialId, 'shade')} />
                      <input type="number" placeholder="GSM" className={`col-span-2 ${inputCls}`} value={rolls[it.materialId]?.gsm || ''} onChange={setRoll(it.materialId, 'gsm')} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : poDetail ? (
            <p className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">All items on this PO are fully received.</p>
          ) : (
            <p className="mt-5 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">Select a PO to load its outstanding items.</p>
          )}

          <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-5">
            <button type="button" onClick={() => setCreateOpen(false)} className={btnSecondary}>Cancel</button>
            <button type="submit" disabled={saving} className={btnPrimary}>
              {saving ? (<><Loader2 className="h-4 w-4 animate-spin" /> Receiving…</>) : (<>Record GRN</>)}
            </button>
          </div>
        </form>
      </Modal>

      {/* Detail modal */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.grn?.grnNo || 'GRN'} subtitle={`${detail?.grn?.supplierName || ''} · ${detail?.grn?.invoiceNo || ''}`} icon={PackageCheck} wide>
        {detail && (
          <div>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Badge>{detail.grn.status}</Badge>
              <span className="text-xs text-slate-400">PO {detail.grn.poNo} · {detail.grn.warehouseName || ''}</span>
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-3">Material</th>
                    <th className="px-4 py-3 text-right">Received</th>
                    <th className="px-4 py-3 text-right">Accepted</th>
                    <th className="px-4 py-3 text-right">Rejected</th>
                    <th className="px-4 py-3">Batch/Lot</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {detail.items.map((it) => (
                    <tr key={it.id}>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-slate-800">{it.materialName}</p>
                        <p className="font-mono text-[11px] text-slate-400">{it.materialCode}</p>
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-slate-700">{Number(it.receivedQty)}</td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-emerald-600">{Number(it.acceptedQty)}</td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-rose-600">{Number(it.rejectedQty)}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{it.batch || it.lot ? `${it.batch || ''} / ${it.lot || ''}` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {detail.rolls?.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-sm font-semibold text-slate-700">Fabric rolls</p>
                <div className="flex flex-wrap gap-2">
                  {detail.rolls.map((r) => (
                    <span key={r.id} className="rounded-lg bg-slate-100 px-3 py-1.5 font-mono text-xs text-slate-700">
                      {r.rollNo} · {r.length} m{r.shade ? ` · ${r.shade}` : ''}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
    </div>
  );
}

export default function GrnPage() {
  return (
    <Suspense fallback={<Card><Spinner label="Loading GRN…" /></Card>}>
      <GrnPageContent />
    </Suspense>
  );
}
