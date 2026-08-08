'use client';

import { useCallback, useEffect, useState } from 'react';
import { Warehouse as WarehouseIcon, Boxes, Plus, Loader2, CheckCircle2, XCircle, ScrollText } from 'lucide-react';
import { api } from '@/utils/api';
import { Card, PageHeader, StatCard, Spinner, EmptyState, ErrorBanner, Badge, Modal, Field, inputCls, btnPrimary, btnSecondary } from '@/components/ui';
import ToastStack from '@/components/toast';

const TABS = [
  { key: 'overview', label: 'Stock overview', icon: Boxes },
  { key: 'ledger', label: 'Transaction ledger', icon: ScrollText },
  { key: 'adjustments', label: 'Adjustments', icon: Plus },
  { key: 'rolls', label: 'Fabric rolls', icon: WarehouseIcon },
];

export default function WarehousePage() {
  const [tab, setTab] = useState('overview');
  const [materials, setMaterials] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [adjustments, setAdjustments] = useState([]);
  const [rolls, setRolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toasts, setToasts] = useState([]);

  const [adjModal, setAdjModal] = useState(false);
  const [adjForm, setAdjForm] = useState({ materialId: '', qty: '', reason: '' });
  const [adjSaving, setAdjSaving] = useState(false);
  const [materialOptions, setMaterialOptions] = useState([]);

  const pushToast = useCallback((type, message) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4500);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ov, led, adj, rollsRes] = await Promise.all([
        api.get('/stock/overview'),
        api.get('/stock/ledger'),
        api.get('/stock/adjustments'),
        api.get('/stock/fabric-rolls'),
      ]);
      setMaterials(ov.materials || []);
      setTransactions(led.transactions || []);
      setAdjustments(adj.adjustments || []);
      setRolls(rollsRes.rolls || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const openAdj = async () => {
    const m = await api.get('/materials');
    setMaterialOptions(m.materials || []);
    setAdjForm({ materialId: '', qty: '', reason: '' });
    setAdjModal(true);
  };

  const submitAdj = async (e) => {
    e.preventDefault();
    setAdjSaving(true);
    try {
      const data = await api.post('/stock/adjustments', adjForm);
      pushToast('success', data.message);
      setAdjModal(false);
      loadAll();
    } catch (err) {
      pushToast('error', err.message);
    } finally {
      setAdjSaving(false);
    }
  };

  const adjAction = async (adj, action) => {
    try {
      const data = await api.post(`/stock/adjustments/${adj.id}/${action}`);
      pushToast('success', data.message);
      loadAll();
    } catch (err) {
      pushToast('error', err.message);
    }
  };

  const totalPhysical = materials.reduce((s, m) => s + Number(m.physical || 0), 0);
  const totalReserved = materials.reduce((s, m) => s + Number(m.reserved || 0), 0);
  const totalAvailable = materials.reduce((s, m) => s + Number(m.available || 0), 0);
  const lowStock = materials.filter((m) => m.lowStock).length;

  const fmt = (v) => Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });

  return (
    <div>
      <PageHeader
        title="Warehouse"
        subtitle="Physical, reserved and available stock — every movement audited in the ledger"
        actions={
          <button onClick={openAdj} className={btnSecondary}>
            <Plus className="h-4 w-4" /> Request adjustment
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Physical stock" value={fmt(totalPhysical)} icon={Boxes} tint="bg-sky-50 text-sky-600" sub="sum of units" />
        <StatCard label="Reserved" value={fmt(totalReserved)} icon={WarehouseIcon} tint="bg-amber-50 text-amber-600" sub="committed to orders" />
        <StatCard label="Available" value={fmt(totalAvailable)} icon={CheckCircle2} tint="bg-emerald-50 text-emerald-600" sub="physical − reserved" />
        <StatCard label="Low stock SKUs" value={lowStock} icon={WarehouseIcon} tint="bg-rose-50 text-rose-600" />
      </div>

      {/* Tabs */}
      <div className="mt-6 flex flex-wrap gap-2">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
              tab === key ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {error && <div className="mt-4"><ErrorBanner message={error} onRetry={loadAll} /></div>}

      {loading ? (
        <Card className="mt-4"><Spinner label="Loading warehouse data…" /></Card>
      ) : (
        <Card className="mt-4 overflow-hidden">
          {tab === 'overview' && (
            materials.length === 0 ? (
              <EmptyState title="No materials" message="Register materials to see stock." icon={Boxes} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-left">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      <th className="px-4 py-3">Material</th>
                      <th className="px-4 py-3 text-right">Physical</th>
                      <th className="px-4 py-3 text-right">Reserved</th>
                      <th className="px-4 py-3 text-right">Available</th>
                      <th className="px-4 py-3 text-right">Safety</th>
                      <th className="px-4 py-3">Rack</th>
                      <th className="px-4 py-3">QA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {materials.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50/80">
                        <td className="px-4 py-3.5">
                          <p className="text-sm font-semibold text-slate-800">{m.materialName}</p>
                          <p className="font-mono text-[11px] text-slate-400">{m.materialCode} · {m.unit}</p>
                        </td>
                        <td className="px-4 py-3.5 text-right text-sm font-semibold text-slate-800">{fmt(m.physical)}</td>
                        <td className="px-4 py-3.5 text-right text-sm text-amber-600">{fmt(m.reserved)}</td>
                        <td className="px-4 py-3.5 text-right text-sm font-semibold text-emerald-600">{fmt(m.available)}</td>
                        <td className="px-4 py-3.5 text-right text-sm text-slate-500">{fmt(m.safetyStock)}</td>
                        <td className="px-4 py-3.5 font-mono text-xs text-slate-600">{m.rackLocation || '—'}</td>
                        <td className="px-4 py-3.5"><Badge>{m.testStatus}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {tab === 'ledger' && (
            transactions.length === 0 ? (
              <EmptyState title="No transactions yet" message="GRNs, issues and adjustments will appear here." icon={ScrollText} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-left">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Material</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3 text-right">Qty</th>
                      <th className="px-4 py-3 text-right">Balance</th>
                      <th className="px-4 py-3">Reference</th>
                      <th className="px-4 py-3">By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {transactions.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50/80">
                        <td className="px-4 py-3 text-xs text-slate-500">{t.createdAt ? new Date(t.createdAt).toLocaleString() : ''}</td>
                        <td className="px-4 py-3.5">
                          <p className="text-sm font-medium text-slate-800">{t.materialName}</p>
                          <p className="font-mono text-[11px] text-slate-400">{t.materialCode}</p>
                        </td>
                        <td className="px-4 py-3.5"><Badge>{t.transactionType}</Badge></td>
                        <td className={`px-4 py-3.5 text-right text-sm font-semibold ${Number(t.qty) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {Number(t.qty) > 0 ? '+' : ''}{fmt(t.qty)}
                        </td>
                        <td className="px-4 py-3.5 text-right text-sm text-slate-700">{fmt(t.balanceAfter)}</td>
                        <td className="px-4 py-3.5 text-xs text-slate-500">{t.referenceType ? `${t.referenceType}#${t.referenceId}` : '—'}</td>
                        <td className="px-4 py-3.5 text-xs text-slate-500">{t.createdByName || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {tab === 'adjustments' && (
            adjustments.length === 0 ? (
              <EmptyState title="No adjustments" message="Request a stock adjustment (e.g. damaged fabric write-off)." icon={Plus} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-left">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      <th className="px-4 py-3">No</th>
                      <th className="px-4 py-3">Material</th>
                      <th className="px-4 py-3 text-right">Qty</th>
                      <th className="px-4 py-3">Reason</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {adjustments.map((a) => (
                      <tr key={a.id} className="hover:bg-slate-50/80">
                        <td className="px-4 py-3.5 font-mono text-[13px] font-semibold text-slate-800">{a.adjustmentNo}</td>
                        <td className="px-4 py-3.5 text-sm text-slate-700">{a.materialName}</td>
                        <td className={`px-4 py-3.5 text-right text-sm font-semibold ${Number(a.qty) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {Number(a.qty) > 0 ? '+' : ''}{fmt(a.qty)}
                        </td>
                        <td className="px-4 py-3.5 text-xs text-slate-500">{a.reason}</td>
                        <td className="px-4 py-3.5"><Badge>{a.status}</Badge></td>
                        <td className="px-4 py-3.5 text-right">
                          {a.status === 'Pending' && (
                            <div className="inline-flex gap-1.5">
                              <button onClick={() => adjAction(a, 'approve')} className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100">
                                <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                              </button>
                              <button onClick={() => adjAction(a, 'reject')} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-100">
                                <XCircle className="h-3.5 w-3.5" /> Reject
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {tab === 'rolls' && (
            rolls.length === 0 ? (
              <EmptyState title="No fabric rolls" message="Fabric received via GRN with roll details will appear here." icon={WarehouseIcon} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-left">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      <th className="px-4 py-3">Roll</th>
                      <th className="px-4 py-3">Material</th>
                      <th className="px-4 py-3 text-right">Length</th>
                      <th className="px-4 py-3 text-right">Remaining</th>
                      <th className="px-4 py-3">Shade</th>
                      <th className="px-4 py-3">Width</th>
                      <th className="px-4 py-3">GSM</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rolls.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/80">
                        <td className="px-4 py-3.5 font-mono text-[13px] font-semibold text-slate-800">{r.rollNo}</td>
                        <td className="px-4 py-3.5">
                          <p className="text-sm font-medium text-slate-800">{r.materialName}</p>
                          <p className="font-mono text-[11px] text-slate-400">{r.materialCode}</p>
                        </td>
                        <td className="px-4 py-3.5 text-right text-sm text-slate-700">{fmt(r.length)} m</td>
                        <td className="px-4 py-3.5 text-right text-sm font-semibold text-emerald-600">{fmt(r.remainingLength)} m</td>
                        <td className="px-4 py-3.5 text-sm text-slate-600">{r.shade || '—'}</td>
                        <td className="px-4 py-3.5 text-sm text-slate-600">{r.width || '—'}</td>
                        <td className="px-4 py-3.5 text-sm text-slate-600">{r.gsm || '—'}</td>
                        <td className="px-4 py-3.5"><Badge>{r.status}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </Card>
      )}

      {/* Adjustment modal */}
      <Modal open={adjModal} onClose={() => setAdjModal(false)} title="Request stock adjustment" subtitle="Approved by Admin before it touches the ledger" icon={Plus}>
        <form onSubmit={submitAdj}>
          <div className="space-y-4">
            <Field label="Material" required>
              <select required className={inputCls} value={adjForm.materialId} onChange={(e) => setAdjForm((f) => ({ ...f, materialId: e.target.value }))}>
                <option value="">— Select material —</option>
                {materialOptions.map((m) => (
                  <option key={m.id} value={m.id}>{m.materialCode} · {m.materialName}</option>
                ))}
              </select>
            </Field>
            <Field label="Quantity (negative = out)" required>
              <input required type="number" step="0.001" className={inputCls} value={adjForm.qty} onChange={(e) => setAdjForm((f) => ({ ...f, qty: e.target.value }))} placeholder="-50 or 25" />
            </Field>
            <Field label="Reason" required>
              <input required className={inputCls} value={adjForm.reason} onChange={(e) => setAdjForm((f) => ({ ...f, reason: e.target.value }))} placeholder="Damaged rolls, cycle count difference…" />
            </Field>
          </div>
          <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-5">
            <button type="button" onClick={() => setAdjModal(false)} className={btnSecondary}>Cancel</button>
            <button type="submit" disabled={adjSaving} className={btnPrimary}>
              {adjSaving ? (<><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</>) : (<>Submit request</>)}
            </button>
          </div>
        </form>
      </Modal>

      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
    </div>
  );
}
