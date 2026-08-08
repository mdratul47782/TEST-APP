'use client';

import { useCallback, useEffect, useState } from 'react';
import { Shirt, Plus, Pencil, Layers, X, AlertTriangle, Loader2, Boxes } from 'lucide-react';
import { api } from '@/utils/api';
import { Card, PageHeader, Spinner, EmptyState, ErrorBanner, Badge, Modal, Field, inputCls, btnPrimary, btnSecondary } from '@/components/ui';
import ToastStack from '@/components/toast';

const emptyStyle = { styleNumber: '', productName: '', category: '', season: '', buyerId: '', smv: '', sizeRange: '', colorRange: '' };

export default function StylesPage() {
  const [styles, setStyles] = useState([]);
  const [buyers, setBuyers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toasts, setToasts] = useState([]);

  // create/edit style modal
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyStyle);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // BOM viewer
  const [bomView, setBomView] = useState(null); // { style, versions }
  const [bomDetail, setBomDetail] = useState(null); // { version, items }
  const [bomLoading, setBomLoading] = useState(false);
  const [bomItemModal, setBomItemModal] = useState(null);
  const [bomForm, setBomForm] = useState({ materialId: '', consumption: '', wastagePct: '0', preferredSupplierId: '' });
  const [materials, setMaterials] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [bomSaving, setBomSaving] = useState(false);

  const pushToast = useCallback((type, message) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4500);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, b] = await Promise.all([api.get('/styles'), api.get('/buyers')]);
      setStyles(s.styles || []);
      setBuyers(b.buyers || []);
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
    setForm(emptyStyle);
    setSaveError(null);
    setModal({ mode: 'create' });
  };

  const openEdit = (style) => {
    setForm({
      styleNumber: style.styleNumber || '',
      productName: style.productName || '',
      category: style.category || '',
      season: style.season || '',
      buyerId: style.buyerId || '',
      smv: style.smv || '',
      sizeRange: Array.isArray(style.sizeRange) ? style.sizeRange.join(', ') : '',
      colorRange: Array.isArray(style.colorRange) ? style.colorRange.join(', ') : '',
    });
    setSaveError(null);
    setModal({ mode: 'edit', style });
  };

  const submitStyle = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    const payload = {
      ...form,
      buyerId: form.buyerId ? Number(form.buyerId) : null,
      smv: form.smv || null,
      sizeRange: form.sizeRange ? form.sizeRange.split(',').map((s) => s.trim()).filter(Boolean) : null,
      colorRange: form.colorRange ? form.colorRange.split(',').map((s) => s.trim()).filter(Boolean) : null,
    };
    try {
      const data = modal.mode === 'create' ? await api.post('/styles', payload) : await api.put(`/styles/${modal.style.id}`, payload);
      pushToast('success', data.message);
      setModal(null);
      load();
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const openBom = async (style) => {
    setBomView({ style, versions: [] });
    setBomDetail(null);
    try {
      const data = await api.get(`/styles/${style.id}`);
      setBomView({ style, versions: data.bomVersions || [] });
    } catch (err) {
      pushToast('error', err.message);
    }
  };

  const openVersion = async (versionId) => {
    setBomLoading(true);
    try {
      const data = await api.get(`/styles/boms/${versionId}`);
      setBomDetail(data);
    } catch (err) {
      pushToast('error', err.message);
    } finally {
      setBomLoading(false);
    }
  };

  const createVersion = async (styleId) => {
    try {
      const data = await api.post(`/styles/${styleId}/boms`, { remarks: 'New version' });
      pushToast('success', data.message);
      const refreshed = await api.get(`/styles/${styleId}`);
      setBomView({ style: bomView.style, versions: refreshed.bomVersions || [] });
    } catch (err) {
      pushToast('error', err.message);
    }
  };

  const setVersionStatus = async (versionId, status) => {
    try {
      const data = await api.put(`/styles/boms/${versionId}/status`, { status });
      pushToast('success', data.message);
      if (bomView) {
        const refreshed = await api.get(`/styles/${bomView.style.id}`);
        setBomView({ style: bomView.style, versions: refreshed.bomVersions || [] });
      }
    } catch (err) {
      pushToast('error', err.message);
    }
  };

  const openBomItem = async () => {
    const [m, s] = await Promise.all([api.get('/materials'), api.get('/suppliers')]);
    setMaterials(m.materials || []);
    setSuppliers(s.suppliers || []);
    setBomForm({ materialId: '', consumption: '', wastagePct: '0', preferredSupplierId: '' });
    setBomItemModal(true);
  };

  const addBomItem = async (e) => {
    e.preventDefault();
    setBomSaving(true);
    try {
      const data = await api.post(`/styles/boms/${bomDetail.bomVersion.id}/items`, bomForm);
      pushToast('success', data.message);
      setBomItemModal(false);
      openVersion(bomDetail.bomVersion.id);
    } catch (err) {
      pushToast('error', err.message);
    } finally {
      setBomSaving(false);
    }
  };

  const deleteBomItem = async (itemId) => {
    if (!window.confirm('Remove this BOM item?')) return;
    try {
      const data = await api.delete(`/styles/boms/${bomDetail.bomVersion.id}/items/${itemId}`);
      pushToast('info', data.message);
      openVersion(bomDetail.bomVersion.id);
    } catch (err) {
      pushToast('error', err.message);
    }
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setBom = (k) => (e) => setBomForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div>
      <PageHeader
        title="Styles & BOM"
        subtitle={`${styles.length} styles · each style carries versioned BOMs referenced by orders`}
        actions={
          <button onClick={openCreate} className={btnPrimary}>
            <Plus className="h-4 w-4" /> New style
          </button>
        }
      />

      <Card className="mt-4 overflow-hidden">
        {error && <ErrorBanner message={error} onRetry={load} />}
        {loading ? (
          <Spinner label="Loading styles…" />
        ) : styles.length === 0 ? (
          <EmptyState title="No styles yet" message="Create a style like JK-1001 (Outdoor Jacket) to build its BOM." icon={Shirt} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3">Style</th>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Buyer</th>
                  <th className="px-4 py-3">Season</th>
                  <th className="px-4 py-3">SMV</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {styles.map((s) => (
                  <tr key={s.id} className="transition-colors hover:bg-slate-50/80">
                    <td className="px-4 py-3.5 font-mono text-[13px] font-semibold text-slate-900">{s.styleNumber}</td>
                    <td className="px-4 py-3.5">
                      <p className="text-sm font-medium text-slate-800">{s.productName}</p>
                      <p className="text-xs text-slate-400">{s.category || ''}</p>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-slate-700">{s.buyerName || '—'}</td>
                    <td className="px-4 py-3.5 text-sm text-slate-700">{s.season || '—'}</td>
                    <td className="px-4 py-3.5 text-sm text-slate-700">{s.smv ? `${s.smv} min` : '—'}</td>
                    <td className="px-4 py-3.5"><Badge>{s.status}</Badge></td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="inline-flex gap-1.5">
                        <button onClick={() => openBom(s)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700">
                          <Layers className="h-3.5 w-3.5" /> BOM
                        </button>
                        <button onClick={() => openEdit(s)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700">
                          <Pencil className="h-3.5 w-3.5" /> Edit
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

      {/* Style create/edit */}
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.mode === 'create' ? 'New style' : 'Edit style'} subtitle="JK-1001 · Outdoor Jacket · FW26" icon={Shirt}>
        <form onSubmit={submitStyle}>
          {saveError && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {saveError}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Style number" required>
              <input required placeholder="e.g. JK-1001" className={inputCls} value={form.styleNumber} onChange={set('styleNumber')} disabled={modal?.mode === 'edit'} />
            </Field>
            <Field label="Product name" required>
              <input required placeholder="e.g. Outdoor Jacket - Shell" className={inputCls} value={form.productName} onChange={set('productName')} />
            </Field>
            <Field label="Category">
              <input placeholder="Outerwear / Knit / Woven" className={inputCls} value={form.category} onChange={set('category')} />
            </Field>
            <Field label="Season">
              <input placeholder="e.g. FW26" className={inputCls} value={form.season} onChange={set('season')} />
            </Field>
            <Field label="Buyer">
              <select className={inputCls} value={form.buyerId} onChange={set('buyerId')}>
                <option value="">— Select buyer —</option>
                {buyers.map((b) => (
                  <option key={b.id} value={b.id}>{b.buyerName}</option>
                ))}
              </select>
            </Field>
            <Field label="SMV (minutes)">
              <input type="number" step="0.001" placeholder="28.500" className={inputCls} value={form.smv} onChange={set('smv')} />
            </Field>
            <Field label="Size range" hint="comma separated">
              <input placeholder="S, M, L, XL, XXL" className={inputCls} value={form.sizeRange} onChange={set('sizeRange')} />
            </Field>
            <Field label="Color range" hint="comma separated">
              <input placeholder="Black, Navy, Red" className={inputCls} value={form.colorRange} onChange={set('colorRange')} />
            </Field>
          </div>
          <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-5">
            <button type="button" onClick={() => setModal(null)} className={btnSecondary}>Cancel</button>
            <button type="submit" disabled={saving} className={btnPrimary}>
              {saving ? (<><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>) : (<>Save style</>)}
            </button>
          </div>
        </form>
      </Modal>

      {/* BOM viewer */}
      <Modal open={!!bomView} onClose={() => setBomView(null)} title={`BOM — ${bomView?.style?.styleNumber}`} subtitle={bomView?.style?.productName} icon={Layers} wide>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {bomView?.versions.map((v) => (
            <button
              key={v.id}
              onClick={() => openVersion(v.id)}
              className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                bomDetail?.bomVersion?.id === v.id ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300'
              }`}
            >
              v{v.versionNo} <span className="text-xs text-slate-400">({v.status.replace(/_/g, ' ')})</span>
            </button>
          ))}
          <button onClick={() => createVersion(bomView.style.id)} className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-dashed border-indigo-300 bg-indigo-50/50 px-3 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-50">
            <Plus className="h-4 w-4" /> New version
          </button>
        </div>

        {bomView?.versions.length === 0 && (
          <p className="mb-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">No BOM versions yet — create version 1 to start adding materials.</p>
        )}

        {bomDetail && (
          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs text-slate-500">
                Version {bomDetail.bomVersion.versionNo} · {bomDetail.bomVersion.status.replace(/_/g, ' ')}
                {bomDetail.bomVersion.remarks ? ` · ${bomDetail.bomVersion.remarks}` : ''}
              </p>
              {bomDetail.bomVersion.status !== 'Active' && (
                <button onClick={() => setVersionStatus(bomDetail.bomVersion.id, 'Active')} className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100">
                  Activate version
                </button>
              )}
              <button onClick={openBomItem} className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100">
                <Plus className="h-3.5 w-3.5" /> Add material
              </button>
            </div>
            {bomLoading ? (
              <Spinner label="Loading BOM…" />
            ) : bomDetail.items.length === 0 ? (
              <EmptyState title="BOM is empty" message="Add materials with consumption per piece (e.g. Shell Fabric 1.80 m/pc)." icon={Boxes} />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      <th className="px-4 py-3">Material</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Consumption</th>
                      <th className="px-4 py-3">Wastage %</th>
                      <th className="px-4 py-3">Unit</th>
                      <th className="px-4 py-3">Pref supplier</th>
                      <th className="px-4 py-3 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {bomDetail.items.map((it) => (
                      <tr key={it.id} className="hover:bg-slate-50/80">
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-slate-800">{it.materialName}</p>
                          <p className="font-mono text-[11px] text-slate-400">{it.materialCode || '—'}</p>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">{it.category || '—'}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-slate-800">{Number(it.consumption)}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{Number(it.wastagePct)}%</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{it.unit || '—'}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{it.preferredSupplierName || '—'}</td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => deleteBomItem(it.id)} className="rounded-lg p-1.5 text-slate-300 transition hover:bg-rose-50 hover:text-rose-500" aria-label="Remove">
                            <X className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Add BOM item */}
      <Modal open={bomItemModal} onClose={() => setBomItemModal(false)} title="Add BOM item" subtitle={`Version ${bomDetail?.bomVersion?.versionNo || 1} · consumption per piece`} icon={Boxes}>
        <form onSubmit={addBomItem}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Material" required>
                <select required className={inputCls} value={bomForm.materialId} onChange={setBom('materialId')}>
                  <option value="">— Select material —</option>
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>{m.materialCode} · {m.materialName} ({m.unit})</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Consumption per piece" required>
              <input required type="number" step="0.0001" placeholder="1.80" className={inputCls} value={bomForm.consumption} onChange={setBom('consumption')} />
            </Field>
            <Field label="Wastage %">
              <input type="number" step="0.01" placeholder="5.0" className={inputCls} value={bomForm.wastagePct} onChange={setBom('wastagePct')} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Preferred supplier">
                <select className={inputCls} value={bomForm.preferredSupplierId} onChange={setBom('preferredSupplierId')}>
                  <option value="">— No preference —</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.supplierName}</option>
                  ))}
                </select>
              </Field>
            </div>
          </div>
          <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-5">
            <button type="button" onClick={() => setBomItemModal(false)} className={btnSecondary}>Cancel</button>
            <button type="submit" disabled={bomSaving} className={btnPrimary}>
              {bomSaving ? (<><Loader2 className="h-4 w-4 animate-spin" /> Adding…</>) : (<>Add to BOM</>)}
            </button>
          </div>
        </form>
      </Modal>

      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
    </div>
  );
}
