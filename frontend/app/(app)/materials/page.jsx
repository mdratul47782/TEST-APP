'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Boxes,
  Plus,
  Search,
  RefreshCw,
  FileText,
  ExternalLink,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock3,
  ClipboardCheck,
  Box,
  Filter,
  ChevronDown,
  FlaskConical,
} from 'lucide-react';
import { api, getStoredUser } from '@/utils/api';
import StatusBadge from '@/components/status-badge';
import ToastStack from '@/components/toast';
import AddMaterialModal from '@/components/add-material-modal';
import UpdateStatusModal from '@/components/update-status-modal';
import { Card, PageHeader, StatCard, EmptyState, ErrorBanner, btnSecondary, btnPrimary } from '@/components/ui';

const CATEGORIES = ['Fabric', 'Trim', 'Accessory', 'Webbing', 'Elastic', 'Zipper'];
const STATUS_FILTERS = ['All', 'Pending', 'Passed', 'Failed'];

const CATEGORY_STYLES = {
  Fabric: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  Trim: 'bg-sky-50 text-sky-700 ring-sky-200',
  Accessory: 'bg-violet-50 text-violet-700 ring-violet-200',
  Webbing: 'bg-teal-50 text-teal-700 ring-teal-200',
  Elastic: 'bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200',
  Zipper: 'bg-slate-100 text-slate-600 ring-slate-200',
};

const LOW_STOCK_THRESHOLD = 10;

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function MaterialsPage() {
  const [user, setUser] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortBy, setSortBy] = useState('recent');

  const [addOpen, setAddOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState(null);
  const [toasts, setToasts] = useState([]);

  const pushToast = useCallback((type, message) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4500);
  }, []);

  const loadData = useCallback(async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [materialsRes, suppliersRes, warehousesRes] = await Promise.all([
        api.get('/materials'),
        api.get('/suppliers'),
        api.get('/stock/warehouses').catch(() => ({ warehouses: [] })),
      ]);
      setMaterials(materialsRes.materials || []);
      setSuppliers(suppliersRes.suppliers || []);
      setWarehouses(warehousesRes.warehouses || []);
    } catch (err) {
      setError(err.message || 'Failed to load inventory data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  const stats = useMemo(() => {
    const count = (status) => materials.filter((m) => m.testStatus === status).length;
    return {
      total: materials.length,
      passed: count('Passed'),
      pending: count('Pending'),
      failed: count('Failed'),
      lowStock: materials.filter((m) => Number(m.stockQuantity) <= LOW_STOCK_THRESHOLD).length,
    };
  }, [materials]);

  const filteredMaterials = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = materials.filter((m) => {
      const matchesQuery =
        !q ||
        m.materialCode.toLowerCase().includes(q) ||
        m.materialName.toLowerCase().includes(q) ||
        (m.supplierName || '').toLowerCase().includes(q) ||
        (m.rackLocation || '').toLowerCase().includes(q);
      const matchesCategory = categoryFilter === 'All' || m.category === categoryFilter;
      const matchesStatus = statusFilter === 'All' || m.testStatus === statusFilter;
      return matchesQuery && matchesCategory && matchesStatus;
    });
    if (sortBy === 'name') list.sort((a, b) => a.materialName.localeCompare(b.materialName));
    else if (sortBy === 'lowstock') list.sort((a, b) => Number(a.stockQuantity) - Number(b.stockQuantity));
    return list;
  }, [materials, search, categoryFilter, statusFilter, sortBy]);

  const canAdd = user && ['Admin', 'Store_Manager'].includes(user.role);
  const canUpdateStatus = user && ['Admin', 'QA_Inspector'].includes(user.role);

  return (
    <div>
      <PageHeader
        title="Material Master"
        subtitle={`${materials.length} materials registered · track test status, warehouse location & certificates`}
        actions={
          <>
            <button onClick={() => loadData({ silent: true })} disabled={refreshing || loading} className={btnSecondary} title="Refresh data">
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              onClick={() => setAddOpen(true)}
              disabled={!canAdd}
              title={canAdd ? 'Add new inventory item' : 'Only Admin and Store Manager roles can add inventory'}
              className={btnPrimary}
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add material</span>
              <span className="sm:hidden">Add</span>
            </button>
          </>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {[
          { label: 'Total SKUs', value: stats.total, icon: Boxes, tint: 'bg-indigo-50 text-indigo-600' },
          { label: 'Passed', value: stats.passed, icon: CheckCircle2, tint: 'bg-emerald-50 text-emerald-600' },
          { label: 'Pending', value: stats.pending, icon: Clock3, tint: 'bg-amber-50 text-amber-600' },
          { label: 'Failed', value: stats.failed, icon: XCircle, tint: 'bg-rose-50 text-rose-600' },
        ].map(({ label, value, icon: Icon, tint }) => (
          <StatCard key={label} label={label} value={value} icon={Icon} tint={tint} />
        ))}
      </div>

      {stats.lowStock > 0 && !loading && (
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-sm text-amber-800">
            <span className="font-semibold">{stats.lowStock}</span> material{stats.lowStock > 1 ? 's are' : ' is'} at or below the reorder level ({LOW_STOCK_THRESHOLD} units) — schedule a reorder.
          </p>
        </div>
      )}

      <Card className="mt-5 overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Search code, name, supplier, rack…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Filter className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} aria-label="Filter by category" className="appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-8 pr-8 text-sm text-slate-700 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10">
                <option value="All">All categories</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            </div>
            <div className="relative">
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by test status" className="appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-3.5 pr-8 text-sm text-slate-700 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10">
                {STATUS_FILTERS.map((s) => (
                  <option key={s} value={s}>{s === 'All' ? 'All statuses' : s}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            </div>
            <div className="relative">
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} aria-label="Sort materials" className="appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-3.5 pr-8 text-sm text-slate-700 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10">
                <option value="recent">Newest first</option>
                <option value="name">Name A–Z</option>
                <option value="lowstock">Low stock first</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            </div>
          </div>
        </div>

        {error && <ErrorBanner message={error} onRetry={() => loadData()} />}

        {loading ? (
          <div className="divide-y divide-slate-100">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex items-center gap-6 px-4 py-4">
                <div className="h-4 w-24 animate-pulse rounded bg-slate-100" />
                <div className="h-4 w-32 animate-pulse rounded bg-slate-100" />
                <div className="h-4 w-20 animate-pulse rounded bg-slate-100" />
                <div className="h-6 w-20 animate-pulse rounded-full bg-slate-100" />
              </div>
            ))}
          </div>
        ) : filteredMaterials.length === 0 ? (
          <EmptyState
            title="No materials found"
            message={materials.length === 0 ? 'The warehouse is empty. Add your first material to get started.' : 'No materials match your current search or filters.'}
            icon={Box}
            action={
              materials.length > 0 ? (
                <button
                  onClick={() => {
                    setSearch('');
                    setCategoryFilter('All');
                    setStatusFilter('All');
                  }}
                  className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
                >
                  Clear filters
                </button>
              ) : null
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3">Material</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Supplier</th>
                  <th className="px-4 py-3">Stock</th>
                  <th className="px-4 py-3">Rack</th>
                  <th className="px-4 py-3">Test status</th>
                  <th className="px-4 py-3">Certificate</th>
                  <th className="px-4 py-3">Last tested</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMaterials.map((m) => {
                  const lowStock = Number(m.stockQuantity) <= LOW_STOCK_THRESHOLD;
                  return (
                    <tr key={m.id} className="group transition-colors hover:bg-slate-50/80">
                      <td className="px-4 py-3.5">
                        <p className="font-mono text-[13px] font-semibold text-slate-900">{m.materialCode}</p>
                        <p className="mt-0.5 max-w-[220px] truncate text-xs text-slate-500" title={m.materialName}>{m.materialName}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${CATEGORY_STYLES[m.category] || 'bg-slate-50 text-slate-600 ring-slate-200'}`}>
                          {m.category}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-sm text-slate-700">{m.supplierName || '—'}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${lowStock ? 'text-rose-600' : 'text-slate-800'}`}>
                          {Number(m.stockQuantity)} <span className="font-normal text-slate-400">{m.unit}</span>
                          {lowStock && <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        {m.rackLocation ? (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 font-mono text-xs font-medium text-slate-700">
                            <MapPin className="h-3 w-3 text-slate-400" />
                            {m.rackLocation}
                          </span>
                        ) : (
                          <span className="text-sm text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge status={m.testStatus} />
                      </td>
                      <td className="px-4 py-3.5">
                        {m.documentUrl ? (
                          <a href={m.documentUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-medium text-indigo-700 transition hover:border-indigo-300 hover:bg-indigo-100" title="Open quality test report (Cloudinary)">
                            <FileText className="h-3.5 w-3.5" />
                            Report
                            <ExternalLink className="h-3 w-3 opacity-60" />
                          </a>
                        ) : (
                          <span className="text-sm text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        {m.latestTest ? (
                          <div className="leading-tight">
                            <p className="text-xs font-medium text-slate-700">{formatDate(m.latestTest.testedAt)}</p>
                            <p className="text-[11px] text-slate-400">{m.latestTest.testedByName || 'Unknown'} · {m.latestTest.testResult}</p>
                          </div>
                        ) : (
                          <span className="text-sm text-slate-400">Not tested yet</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          onClick={() => setStatusTarget(m)}
                          disabled={!canUpdateStatus}
                          title={canUpdateStatus ? 'Update test status' : 'Only Admin and QA Inspector roles can update status'}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <ClipboardCheck className="h-3.5 w-3.5" />
                          Update
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {user && (
        <p className="mt-4 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
          <FlaskConical className="h-3.5 w-3.5" />
          Your role: <span className="font-medium text-slate-500">{user.role.replace(/_/g, ' ')}</span>
          {!canAdd && <span> · adding inventory is restricted to Admin / Store Manager</span>}
          {!canUpdateStatus && <span> · status updates are restricted to Admin / QA Inspector</span>}
        </p>
      )}

      <AddMaterialModal open={addOpen} onClose={() => setAddOpen(false)} suppliers={suppliers} warehouses={warehouses} onAdded={(message) => {
        pushToast('success', message);
        loadData({ silent: true });
      }} />
      <UpdateStatusModal material={statusTarget} onClose={() => setStatusTarget(null)} onUpdated={(message) => {
        pushToast('success', message);
        loadData({ silent: true });
      }} />
      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
    </div>
  );
}
