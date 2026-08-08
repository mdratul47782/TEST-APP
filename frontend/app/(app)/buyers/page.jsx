'use client';

import { useCallback, useEffect, useState } from 'react';
import { Users, Plus, Pencil, X, AlertTriangle, Loader2 } from 'lucide-react';
import { api } from '@/utils/api';
import { Card, PageHeader, StatCard, Spinner, EmptyState, ErrorBanner, Badge, Modal, Field, inputCls, btnPrimary, btnSecondary } from '@/components/ui';
import ToastStack from '@/components/toast';

const empty = {
  buyerCode: '',
  buyerName: '',
  contactPerson: '',
  email: '',
  phone: '',
  address: '',
  paymentTerms: '',
  shippingTerms: '',
  currency: 'USD',
};

export default function BuyersPage() {
  const [buyers, setBuyers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null); // null | {mode:'create'} | {mode:'edit', buyer}
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [toasts, setToasts] = useState([]);

  const pushToast = useCallback((type, message) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4500);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get('/buyers');
      setBuyers(data.buyers || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setForm(empty);
    setSaveError(null);
    setModal({ mode: 'create' });
  };

  const openEdit = (buyer) => {
    setForm({
      buyerCode: buyer.buyerCode || '',
      buyerName: buyer.buyerName || '',
      contactPerson: buyer.contactPerson || '',
      email: buyer.email || '',
      phone: buyer.phone || '',
      address: buyer.address || '',
      paymentTerms: buyer.paymentTerms || '',
      shippingTerms: buyer.shippingTerms || '',
      currency: buyer.currency || 'USD',
    });
    setSaveError(null);
    setModal({ mode: 'edit', buyer });
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      if (modal.mode === 'create') {
        const data = await api.post('/buyers', form);
        pushToast('success', data.message);
      } else {
        const data = await api.put(`/buyers/${modal.buyer.id}`, form);
        pushToast('success', data.message);
      }
      setModal(null);
      load();
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async (buyer) => {
    if (!window.confirm(`Deactivate buyer ${buyer.buyerName}?`)) return;
    try {
      const data = await api.delete(`/buyers/${buyer.id}`);
      pushToast('info', data.message);
      load();
    } catch (err) {
      pushToast('error', err.message);
    }
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const active = buyers.filter((b) => b.isActive);
  const inactive = buyers.filter((b) => !b.isActive);

  return (
    <div>
      <PageHeader
        title="Buyers"
        subtitle={`${buyers.length} buyers · Columbia, Decathlon, Walmart…`}
        actions={
          <button onClick={openCreate} className={btnPrimary}>
            <Plus className="h-4 w-4" /> New buyer
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatCard label="Active buyers" value={active.length} icon={Users} tint="bg-indigo-50 text-indigo-600" />
        <StatCard label="Inactive" value={inactive.length} icon={Users} tint="bg-slate-50 text-slate-600" />
      </div>

      <Card className="mt-5 overflow-hidden">
        {error && <ErrorBanner message={error} onRetry={load} />}
        {loading ? (
          <Spinner label="Loading buyers…" />
        ) : buyers.length === 0 ? (
          <EmptyState title="No buyers yet" message="Create your first buyer (e.g. Columbia) to start booking orders." icon={Users} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Buyer</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Terms</th>
                  <th className="px-4 py-3">Currency</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {buyers.map((b) => (
                  <tr key={b.id} className="transition-colors hover:bg-slate-50/80">
                    <td className="px-4 py-3.5 font-mono text-[13px] font-semibold text-slate-900">{b.buyerCode}</td>
                    <td className="px-4 py-3.5">
                      <p className="text-sm font-medium text-slate-800">{b.buyerName}</p>
                      <p className="text-xs text-slate-400">{b.address || ''}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="text-sm text-slate-700">{b.contactPerson || '—'}</p>
                      <p className="text-xs text-slate-400">{b.email || b.phone || ''}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="text-xs text-slate-600">{b.paymentTerms || '—'}</p>
                      <p className="text-xs text-slate-400">{b.shippingTerms || ''}</p>
                    </td>
                    <td className="px-4 py-3.5 text-sm font-medium text-slate-700">{b.currency}</td>
                    <td className="px-4 py-3.5"><Badge>{b.isActive ? 'Active' : 'Cancelled'}</Badge></td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="inline-flex gap-1.5">
                        <button onClick={() => openEdit(b)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700">
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </button>
                        {b.isActive && (
                          <button onClick={() => deactivate(b)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-rose-500 shadow-sm transition hover:border-rose-200 hover:bg-rose-50">
                            <X className="h-3.5 w-3.5" /> Deactivate
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

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.mode === 'create' ? 'New buyer' : 'Edit buyer'} subtitle="Columbia, Decathlon, Walmart…" icon={Users}>
        <form onSubmit={submit}>
          {saveError && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {saveError}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Buyer code" required>
              <input required placeholder="e.g. COL" className={inputCls} value={form.buyerCode} onChange={set('buyerCode')} disabled={modal?.mode === 'edit'} />
            </Field>
            <Field label="Buyer name" required>
              <input required placeholder="e.g. Columbia Sportswear" className={inputCls} value={form.buyerName} onChange={set('buyerName')} />
            </Field>
            <Field label="Contact person">
              <input placeholder="e.g. David Chen" className={inputCls} value={form.contactPerson} onChange={set('contactPerson')} />
            </Field>
            <Field label="Email">
              <input type="email" className={inputCls} value={form.email} onChange={set('email')} />
            </Field>
            <Field label="Phone">
              <input className={inputCls} value={form.phone} onChange={set('phone')} />
            </Field>
            <Field label="Currency">
              <input maxLength={3} placeholder="USD" className={inputCls} value={form.currency} onChange={set('currency')} />
            </Field>
            <Field label="Payment terms">
              <input placeholder="Net 60 days" className={inputCls} value={form.paymentTerms} onChange={set('paymentTerms')} />
            </Field>
            <Field label="Shipping terms">
              <input placeholder="FOB Chittagong" className={inputCls} value={form.shippingTerms} onChange={set('shippingTerms')} />
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Address">
              <textarea rows={2} className={inputCls} value={form.address} onChange={set('address')} />
            </Field>
          </div>
          <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-5">
            <button type="button" onClick={() => setModal(null)} className={btnSecondary}>Cancel</button>
            <button type="submit" disabled={saving} className={btnPrimary}>
              {saving ? (<><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>) : (<>Save buyer</>)}
            </button>
          </div>
        </form>
      </Modal>

      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
    </div>
  );
}
