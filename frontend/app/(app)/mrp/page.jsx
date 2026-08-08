'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Calculator, RefreshCw, ShieldCheck, ShoppingCart, AlertTriangle, Loader2, ArrowRight } from 'lucide-react';
import { api } from '@/utils/api';
import { Card, PageHeader, StatCard, Spinner, EmptyState, ErrorBanner, Badge, btnPrimary, btnSecondary, inputCls } from '@/components/ui';
import ToastStack from '@/components/toast';

const fmt = (v) => Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 1 });

function MrpPageContent() {
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState('');
  const [loading, setLoading] = useState(true);
  const [calcLoading, setCalcLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [reserving, setReserving] = useState(false);
  const [prLoading, setPrLoading] = useState(false);
  const [toasts, setToasts] = useState([]);

  const pushToast = useCallback((type, message) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4500);
  }, []);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get('/orders');
      const open = (data.orders || []).filter((o) => !['Completed', 'Cancelled'].includes(o.orderStatus));
      setOrders(open);
      const preselected = searchParams.get('order');
      setSelectedOrder((prev) => prev || (open.find((o) => String(o.id) === preselected) ? preselected : ''));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [searchParams]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const calculate = useCallback(async (orderId) => {
    setCalcLoading(true);
    setError(null);
    try {
      const data = await api.get(`/mrp/orders/${orderId}`);
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setCalcLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedOrder) calculate(selectedOrder);
    else setResult(null);
  }, [selectedOrder, calculate]);

  const reserve = async () => {
    if (!selectedOrder) return;
    setReserving(true);
    try {
      const data = await api.post(`/mrp/orders/${selectedOrder}/reserve`);
      pushToast('success', data.message);
      calculate(selectedOrder);
    } catch (err) {
      pushToast('error', err.message);
    } finally {
      setReserving(false);
    }
  };

  const generatePr = async () => {
    if (!selectedOrder) return;
    setPrLoading(true);
    try {
      const data = await api.post(`/requisitions/from-mrp/${selectedOrder}`);
      pushToast('success', data.message);
    } catch (err) {
      pushToast('error', err.message);
    } finally {
      setPrLoading(false);
    }
  };

  const shortageMaterials = result?.requirements?.filter((r) => r.shortage > 0) || [];
  const okMaterials = result?.requirements?.filter((r) => r.shortage <= 0) || [];

  return (
    <div>
      <PageHeader
        title="Material Requirement Planning"
        subtitle="Order qty × BOM consumption × (1 + wastage%) − available stock − incoming POs = shortage"
        actions={
          <button onClick={() => selectedOrder && calculate(selectedOrder)} disabled={calcLoading || !selectedOrder} className={btnSecondary}>
            <RefreshCw className={`h-4 w-4 ${calcLoading ? 'animate-spin' : ''}`} /> Recalculate
          </button>
        }
      />

      <Card className="mb-5 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex-1">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Select order to plan</label>
            <select className={inputCls} value={selectedOrder} onChange={(e) => setSelectedOrder(e.target.value)}>
              <option value="">— Choose an open order —</option>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.orderNo} · {o.buyerName} · {o.totalQty?.toLocaleString()} pcs · delivery {String(o.deliveryDate).slice(0, 10)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button onClick={reserve} disabled={!result || reserving} className={btnPrimary}>
              {reserving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Reserve stock
            </button>
            <button onClick={generatePr} disabled={!result || shortageMaterials.length === 0 || prLoading} className={btnSecondary} title="Create purchase requisition from shortages">
              {prLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
              Create PR from shortage
            </button>
          </div>
        </div>
      </Card>

      {error && <ErrorBanner message={error} onRetry={() => selectedOrder && calculate(selectedOrder)} />}

      {!selectedOrder ? (
        <Card>
          <EmptyState
            title="Pick an order to run MRP"
            message="Choose an open sales order — the engine will compute every material requirement, wastage, availability and shortage."
            icon={Calculator}
          />
        </Card>
      ) : calcLoading ? (
        <Card><Spinner label="Computing material requirements…" /></Card>
      ) : result ? (
        <div>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard label="Materials in BOM" value={result.requirements.length} icon={Calculator} tint="bg-indigo-50 text-indigo-600" />
            <StatCard label="In shortage" value={shortageMaterials.length} icon={AlertTriangle} tint="bg-amber-50 text-amber-600" />
            <StatCard label="Total shortage" value={`${fmt(result.totalShortage)} u`} icon={ShoppingCart} tint="bg-rose-50 text-rose-600" />
            <StatCard label="OK materials" value={okMaterials.length} icon={ShieldCheck} tint="bg-emerald-50 text-emerald-600" />
          </div>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-3">Material</th>
                    <th className="px-4 py-3 text-right">Required</th>
                    <th className="px-4 py-3 text-right">Stock</th>
                    <th className="px-4 py-3 text-right">Reserved</th>
                    <th className="px-4 py-3 text-right">Available</th>
                    <th className="px-4 py-3 text-right">Incoming</th>
                    <th className="px-4 py-3 text-right">Shortage</th>
                    <th className="px-4 py-3">Suggested supplier</th>
                    <th className="px-4 py-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {result.requirements.map((r) => (
                    <tr key={r.materialId} className={`transition-colors hover:bg-slate-50/80 ${r.shortage > 0 ? 'bg-amber-50/40' : ''}`}>
                      <td className="px-4 py-3.5">
                        <p className="text-sm font-semibold text-slate-800">{r.materialName}</p>
                        <p className="font-mono text-[11px] text-slate-400">
                          {r.materialCode} · {r.unit} · gross {fmt(r.grossQty)} +{r.wastagePct}%
                        </p>
                      </td>
                      <td className="px-4 py-3.5 text-right text-sm font-semibold text-slate-800">{fmt(r.netQty)}</td>
                      <td className="px-4 py-3.5 text-right text-sm text-slate-700">{fmt(r.physical)}</td>
                      <td className="px-4 py-3.5 text-right text-sm text-amber-600">{fmt(r.reserved)}</td>
                      <td className="px-4 py-3.5 text-right text-sm text-slate-700">{fmt(r.available)}</td>
                      <td className="px-4 py-3.5 text-right text-sm text-sky-600">{fmt(r.incoming)}</td>
                      <td className="px-4 py-3.5 text-right">
                        {r.shortage > 0 ? (
                          <span className="font-bold text-rose-600">{fmt(r.shortage)}</span>
                        ) : (
                          <span className="text-emerald-600">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        {r.preferredSupplier ? (
                          <div>
                            <p className="text-sm font-medium text-slate-700">{r.preferredSupplier.name}</p>
                            <p className="text-[11px] text-slate-400">
                              MOQ {fmt(r.preferredSupplier.moq)} · lead {r.preferredSupplier.leadTimeDays ?? '—'}d
                            </p>
                          </div>
                        ) : (
                          <span className="text-sm text-slate-400">No linked supplier</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <Badge>{r.action}</Badge>
                        {r.shortage > 0 && (
                          <p className="mt-1 text-[10px] font-medium text-slate-400">suggest {fmt(r.suggestedQty)} {r.unit}</p>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {shortageMaterials.length > 0 && (
            <Card className="mt-4 border-amber-200 bg-amber-50/60 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-amber-800">
                <AlertTriangle className="h-4 w-4" /> Purchase required
              </p>
              <ul className="mt-2 space-y-1.5">
                {shortageMaterials.map((r) => (
                  <li key={r.materialId} className="text-sm text-amber-900">
                    <span className="font-semibold">{r.materialName}</span> — required {fmt(r.netQty)} {r.unit}, available {fmt(r.available)}, incoming {fmt(r.incoming)} → <span className="font-bold">shortage {fmt(r.shortage)} {r.unit}</span>
                    {r.suggestedQty > 0 && <span className="text-slate-500"> · suggested purchase {fmt(r.suggestedQty)} {r.unit}</span>}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      ) : (
        <Card>
          <EmptyState title="No BOM data" message="This order has lines without an active BOM. Add a BOM to the style first." icon={Calculator} />
        </Card>
      )}

      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
    </div>
  );
}

export default function MrpPage() {
  return (
    <Suspense fallback={<Card><Spinner label="Loading MRP…" /></Card>}>
      <MrpPageContent />
    </Suspense>
  );
}
