'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Loader2, Upload, FileText, AlertTriangle, PackagePlus } from 'lucide-react';
import { api } from '@/utils/api';
import { Field, inputCls, ModalFooter } from './ui';

const CATEGORIES = ['Fabric', 'Trim', 'Accessory', 'Webbing', 'Elastic', 'Zipper'];
const TEST_STATUSES = ['Pending', 'Passed', 'Failed'];
const UNIT_SUGGESTIONS = ['pcs', 'm', 'yd', 'kg', 'roll', 'set', 'dozen'];

const initialForm = {
  materialCode: '',
  materialName: '',
  category: 'Fabric',
  supplierId: '',
  stockQuantity: '',
  unit: 'pcs',
  rackLocation: '',
  testStatus: 'Pending',
};

export default function AddMaterialModal({ open, onClose, suppliers, warehouses = [], onAdded }) {
  const [form, setForm] = useState(initialForm);
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setForm(initialForm);
      setFile(null);
      setError(null);
    }
  }, [open]);

  const handleFiles = useCallback((files) => {
    const picked = files && files[0];
    if (!picked) return;
    if (picked.size > 10 * 1024 * 1024) {
      setError('File exceeds the 10 MB limit.');
      return;
    }
    setFile(picked);
    setError(null);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('material_code', form.materialCode.trim());
      fd.append('material_name', form.materialName.trim());
      fd.append('category', form.category);
      if (form.supplierId) fd.append('supplier_id', form.supplierId);
      fd.append('stock_quantity', form.stockQuantity || '0');
      fd.append('unit', form.unit.trim() || 'pcs');
      fd.append('rack_location', form.rackLocation.trim());
      fd.append('test_status', form.testStatus);
      if (form.warehouseId) fd.append('warehouse_id', form.warehouseId);
      if (file) fd.append('document', file);

      const data = await api.post('/materials', fd, { isFormData: true });
      onAdded(data.message || 'Material added successfully.');
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to add material.');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <PackagePlus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Add new inventory item</h2>
              <p className="text-xs text-slate-500">Register a received material with warehouse location & certificate.</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5">
          {error && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Material code" required>
              <input required placeholder="e.g. FBR-2411" className={inputCls} value={form.materialCode} onChange={(e) => setForm((f) => ({ ...f, materialCode: e.target.value }))} />
            </Field>
            <Field label="Material name" required>
              <input required placeholder="e.g. Ripstop Nylon 210D" className={inputCls} value={form.materialName} onChange={(e) => setForm((f) => ({ ...f, materialName: e.target.value }))} />
            </Field>

            <Field label="Category" required>
              <select className={inputCls} value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Supplier">
              <select className={inputCls} value={form.supplierId} onChange={(e) => setForm((f) => ({ ...f, supplierId: e.target.value }))}>
                <option value="">— Select supplier —</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.supplierName}</option>
                ))}
              </select>
            </Field>

            <Field label="Stock quantity">
              <input type="number" min="0" step="0.001" placeholder="0" className={inputCls} value={form.stockQuantity} onChange={(e) => setForm((f) => ({ ...f, stockQuantity: e.target.value }))} />
            </Field>
            <Field label="Unit">
              <input list="unit-suggestions" placeholder="pcs" className={inputCls} value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} />
              <datalist id="unit-suggestions">
                {UNIT_SUGGESTIONS.map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>
            </Field>

            <Field label="Rack location">
              <input placeholder="e.g. A-03-02" className={inputCls} value={form.rackLocation} onChange={(e) => setForm((f) => ({ ...f, rackLocation: e.target.value }))} />
            </Field>
            <Field label="Warehouse">
              <select className={inputCls} value={form.warehouseId || ''} onChange={(e) => setForm((f) => ({ ...f, warehouseId: e.target.value }))}>
                <option value="">— Select warehouse —</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.warehouseName}</option>
                ))}
              </select>
            </Field>

            <Field label="Initial test status">
              <select className={inputCls} value={form.testStatus} onChange={(e) => setForm((f) => ({ ...f, testStatus: e.target.value }))}>
                {TEST_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </Field>
          </div>

          {/* Certificate upload */}
          <div className="mt-5">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Quality test report / certificate (Cloudinary)</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx,.xls,.xlsx,.csv"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            {file ? (
              <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <FileText className="h-5 w-5 shrink-0 text-emerald-600" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">{file.name}</p>
                  <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB — will be uploaded to Cloudinary</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white hover:text-rose-500"
                  aria-label="Remove file"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current && fileInputRef.current.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  handleFiles(e.dataTransfer.files);
                }}
                className={`flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-6 text-sm transition ${
                  dragging
                    ? 'border-indigo-400 bg-indigo-50 text-indigo-600'
                    : 'border-slate-300 bg-slate-50 text-slate-500 hover:border-indigo-300 hover:bg-indigo-50/50 hover:text-indigo-600'
                }`}
              >
                <Upload className="h-5 w-5" />
                <span className="font-medium">Click to upload or drag & drop</span>
                <span className="text-xs text-slate-400">PDF, images or Excel — max 10 MB</span>
              </button>
            )}
          </div>

          <ModalFooter onCancel={onClose} submitLabel="Add material" saving={saving} />
        </form>
      </div>
    </div>
  );
}
