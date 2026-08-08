'use client';

import { useCallback, useEffect, useState } from 'react';
import { Handshake, Plus, Pencil, Link2, Star, X, Loader2 } from 'lucide-react';
import { api } from '@/utils/api';
import { Card, PageHeader, StatCard, Spinner, EmptyState, ErrorBanner, Badge, Modal, Field, inputCls, btnPrimary, btnSecondary } from '@/components/ui';
import ToastStack from '@/components/toast';

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [modal, setModal] = useState(null); // {mode:'create'} | {mode:'edit', supplier}
  const [form, setForm] = useState({ supplierCode: '', supplierName: '', contactPerson: '', phone: '', email: '', paymentTerms: '', shippingTerms: '', rating: '' });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkSupplier, setLinkSupplier] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [linkForm, setLinkForm] = useState({ materialId: '', moq: '', unitPrice: '', leadTimeDays: '', isPreferred: false });
  const [linkSaving, setLinkSaving] = useState(false);
  const [supplierMaterials, setSupplierMaterials] = useState({});

  const pushToast = useCallback((type, message) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4500);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get('/suppliers');
      setSuppliers(data.suppliers || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const loadSupplierMaterials = async (supplierId) => {
    try {
      const data = await api.get(`/suppliers/${supplierId}/materials`);
      setSupplierMaterials((prev) => ({ ...prev, [supplierId]: data.items || [] }));
    } catch (err) {
      pushToast('error', err.message);
    }
  };

  const openLink = async (supplier) => {
    const m = await api.get('/materials');
    setMaterials(m.materials || []);
    setLinkSupplier(supplier);
    setLinkForm({ materialId: '', moq: '', unitPrice: '', leadTimeDays: '', isPreferred: false });
    setLinkOpen(true);
  };

  const submitLink = async (e) => {
    e.preventDefault();
    setLinkSaving(true);
    try {
      const data = await api.post('/suppliers/supplier-materials', {
        supplierId: linkSupplier.id,
        materialId: Number(linkForm.materialId),
        moq: linkForm.moq,
        unitPrice: linkForm.unitPrice,
        leadTimeDays: linkForm.leadTimeDays,
        isPreferred: linkForm.isPreferred,
      });
      pushToast('success', data.message);
      setLinkOpen(false);
      loadSupplierMaterials(linkSupplier.id);
    } catch (err) {
      pushToast('error', err.message);
    } finally {
      setLinkSaving(false);
    }
  };

  const openCreate = () => {
    setForm({ supplierCode: '', supplierName: '', contactPerson: '', phone: '', email: '', paymentTerms: '', shippingTerms: '', rating: '' });
    setSaveError(null);
    setModal({ mode: 'create' });
  };

  const openEdit = (s) => {
    setForm({
      supplierCode: s.supplierCode || '', supplierName: s.supplierName || '', contactPerson: s.contactPerson || '',
      phone: s.phone || '', email: s.email || '', paymentTerms: s.paymentTerms || '', shippingTerms: s.shippingTerms || '', rating: s.rating || '',
    });
    setSaveError(null);
    setModal({ mode: 'edit', supplier: s });
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      const data = modal.mode === 'create' ? await api.post('/suppliers', form) : await api.put(`/suppliers/${modal.supplier.id}`, form);
      pushToast('success', data.message);
      setModal(null);
      load();
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div>
      <PageHeader
        title="Suppliers"
        subtitle="Vendor master with MOQ, lead time, price and material links — powers MRP supplier suggestions"
        actions={
          <button onClick={openCreate} className={btnPrimary}>
            <Plus className="h-4 w-4" /> New supplier
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-2">
        <StatCard label="Active suppliers" value={suppliers.filter((s) => s.isActive).length} icon={Handshake} tint="bg-indigo-50 text-indigo-600" />
        <StatCard label="Total suppliers" value={suppliers.length} icon={Handshake} tint="bg-slate-50 text-slate-600" />
      </div>

      <Card className="mt-5 overflow-hidden">
        {error && <ErrorBanner message={error} onRetry={load} />}
        {loading ? (
          <Spinner label="Loading suppliers…" />
        ) : suppliers.length === 0 ? (
          <EmptyState title="No suppliers" message="Add suppliers and link them to materials with MOQ/lead time for MRP suggestions." icon={Handshake} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3">Supplier</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Terms</th>
                  <th className="px-4 py-3">Rating</th>
                  <th className="px-4 py-3">Materials linked</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {suppliers.map((s) => (
                  <tr key={s.id} className="transition-colors hover:bg-slate-50/80">
                    <td className="px-4 py-3.5">
                      <p className="text-sm font-semibold text-slate-800">{s.supplierName}</p>
                      <p className="font-mono text-[11px] text-slate-400">{s.supplierCode || '—'}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="text-sm text-slate-700">{s.contactPerson || '—'}</p>
                      <p className="text-xs text-slate-400">{s.email || s.phone || ''}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="text-xs text-slate-600">{s.paymentTerms || '—'}</p>
                      <p className="text-xs text-slate-400">{s.shippingTerms || ''}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      {s.rating ? (
                        <span className="inline-flex items-center gap-1 text-sm font-semibold text-amber-600">
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> {s.rating}
                        </span>
                      ) : (
                        <span className="text-sm text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <button onClick={() => loadSupplierMaterials(s.id)} className="text-sm font-medium text-indigo-600 hover:underline">
                        {(supplierMaterials[s.id]?.length ?? 0)} linked
                      </button>
                      {supplierMaterials[s.id] && (
                        <div className="mt-1 max-w-[220px] truncate text-[11px] text-slate-400">
                          {supplierMaterials[s.id].map((m) => `${m.materialCode}${m.isPreferred ? ' ★' : ''}`).join(', ')}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5"><Badge>{s.isActive ? 'Active' : 'Cancelled'}</Badge></td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="inline-flex gap-1.5">
                        <button onClick={() => openLink(s)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700">
                          <Link2 className="h-3.5 w-3.5" /> Link material
                        </button>
                        <button onClick={() => openEdit(s)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Supplier form */}
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.mode === 'create' ? 'New supplier' : 'Edit supplier'} subtitle="ABC Textile · Savar Fabric Mills…" icon={Handshake}>
        <form onSubmit={submit}>
          {saveError && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700">{saveError}</div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Supplier name" required>
              <input required className={inputCls} value={form.supplierName} onChange={set('supplierName')} placeholder="e.g. ABC Textile Ltd." />
            </Field>
            <Field label="Supplier code">
              <input className={inputCls} value={form.supplierCode} onChange={set('supplierCode')} placeholder="e.g. ABC-01" />
            </Field>
            <Field label="Contact person">
              <input className={inputCls} value={form.contactPerson} onChange={set('contactPerson')} />
            </Field>
            <Field label="Phone">
              <input className={inputCls} value={form.phone} onChange={set('phone')} />
            </Field>
            <Field label="Email">
              <input type="email" className={inputCls} value={form.email} onChange={set('email')} />
            </Field>
            <Field label="Rating (1–5)">
              <input type="number" min="1" max="5" className={inputCls} value={form.rating} onChange={set('rating')} />
            </Field>
            <Field label="Payment terms">
              <input className={inputCls} value={form.paymentTerms} onChange={set('paymentTerms')} placeholder="Net 30 days" />
            </Field>
            <Field label="Shipping terms">
              <input className={inputCls} value={form.shippingTerms} onChange={set('shippingTerms')} />
            </Field>
          </div>
          <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-5">
            <button type="button" onClick={() => setModal(null)} className={btnSecondary}>Cancel</button>
            <button type="submit" disabled={saving} className={btnPrimary}>
              {saving ? (<><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>) : (<>Save supplier</>)}
            </button>
          </div>
        </form>
      </Modal>

      {/* Link material modal */}
      <Modal open={linkOpen} onClose={() => setLinkOpen(false)} title={`Link material — ${linkSupplier?.supplierName || ''}`} subtitle="MOQ + lead time + price feed the MRP suggestion engine" icon={Link2}>
        <form onSubmit={submitLink}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Material" required>
                <select required className={inputCls} value={linkForm.materialId} onChange={(e) => setLinkForm((f) => ({ ...f, materialId: e.target.value }))}>
                  <option value="">— Select material —</option>
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>{m.materialCode} · {m.materialName} ({m.unit})</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="MOQ">
              <input type="number" step="0.001" className={inputCls} value={linkForm.moq} onChange={(e) => setLinkForm((f) => ({ ...f, moq: e.target.value }))} placeholder="100" />
            </Field>
            <Field label="Unit price">
              <input type="number" step="0.0001" className={inputCls} value={linkForm.unitPrice} onChange={(e) => setLinkForm((f) => ({ ...f, unitPrice: e.target.value }))} placeholder="4.50" />
            </Field>
            <Field label="Lead time (days)">
              <input type="number" className={inputCls} value={linkForm.leadTimeDays} onChange={(e) => setLinkForm((f) => ({ ...f, leadTimeDays: e.target.value }))} placeholder="12" />
            </Field>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input type="checkbox" checked={linkForm.isPreferred} onChange={(e) => setLinkForm((f) => ({ ...f, isPreferred: e.target.checked }))} className="h-4 w-4 rounded border-slate-300 text-indigo-600" />
                Preferred supplier
              </label>
            </div>
          </div>
          <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-5">
            <button type="button" onClick={() => setLinkOpen(false)} className={btnSecondary}>Cancel</button>
            <button type="submit" disabled={linkSaving} className={btnPrimary}>
              {linkSaving ? (<><Loader2 className="h-4 w-4 animate-spin" /> Linking…</>) : (<>Link material</>)}
            </button>
          </div>
        </form>
      </Modal>

      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
    </div>
  );
}
