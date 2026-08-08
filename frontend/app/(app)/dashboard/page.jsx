'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ShoppingCart,
  Boxes,
  ShoppingBag,
  Factory,
  Ship,
  AlertTriangle,
  PackageCheck,
  ArrowRight,
  RefreshCw,
  Clock3,
  CheckCircle2,
  FileText,
} from 'lucide-react';
import { api } from '@/utils/api';
import { Card, PageHeader, StatCard, Spinner, ErrorBanner, Badge } from '@/components/ui';

const fmt = (v) => {
  const n = Number(v || 0);
  return Number.isFinite(n) ? n.toLocaleString() : '0';
};

export default function DashboardPage() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get('/dashboard/summary');
      setSummary(data);
    } catch (err) {
      setError(err.message || 'Failed to load dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <Spinner label="Computing factory KPIs…" />;

  if (error || !summary) {
    return (
      <div>
        <PageHeader title="Management Dashboard" subtitle="Factory-wide KPIs across sales, material, purchase, production and shipping" />
        <ErrorBanner message={error || 'No data'} onRetry={load} />
      </div>
    );
  }

  const { sales, material, purchase, production, shipping } = summary;

  return (
    <div>
      <PageHeader
        title="Management Dashboard"
        subtitle="Sales → Material → Purchase → Production → Shipment, in one view"
        actions={
          <button onClick={load} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        }
      />

      {/* ------------------------------ Sales ------------------------------ */}
      <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-500">
        <ShoppingCart className="h-4 w-4" /> Sales
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Open Orders" value={fmt(sales.openOrders)} icon={ShoppingCart} tint="bg-indigo-50 text-indigo-600" />
        <StatCard label="Total Order Qty" value={fmt(sales.totalOrderQty)} icon={Boxes} tint="bg-sky-50 text-sky-600" />
        <StatCard label="Upcoming Deliveries" value={fmt(sales.upcomingDeliveries)} icon={Clock3} tint="bg-emerald-50 text-emerald-600" />
        <StatCard label="Delayed Orders" value={fmt(sales.delayedOrders)} icon={AlertTriangle} tint="bg-rose-50 text-rose-600" />
      </div>

      {/* ----------------------------- Materials --------------------------- */}
      <h2 className="mb-3 mt-8 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-500">
        <Boxes className="h-4 w-4" /> Material
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Total Materials" value={fmt(material.totalMaterials)} icon={Boxes} tint="bg-indigo-50 text-indigo-600" />
        <StatCard label="Physical Stock" value={fmt(material.physicalQty)} icon={PackageCheck} tint="bg-sky-50 text-sky-600" sub="sum of units across SKUs" />
        <StatCard label="Reserved" value={fmt(material.reservedQty)} icon={Clock3} tint="bg-amber-50 text-amber-600" sub="committed to orders" />
        <StatCard label="Available" value={fmt(material.availableQty)} icon={CheckCircle2} tint="bg-emerald-50 text-emerald-600" sub="physical − reserved" />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
          {fmt(material.lowStockCount)} low-stock materials
        </span>
        <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-800">
          {fmt(material.incomingQty)} units incoming on open POs
        </span>
      </div>

      {/* ----------------------------- Purchase ---------------------------- */}
      <h2 className="mb-3 mt-8 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-500">
        <ShoppingBag className="h-4 w-4" /> Purchase
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Pending PRs" value={fmt(purchase.pendingPR)} icon={FileText} tint="bg-violet-50 text-violet-600" />
        <StatCard label="Open POs" value={fmt(purchase.openPO)} icon={ShoppingBag} tint="bg-sky-50 text-sky-600" />
        <StatCard label="Overdue POs" value={fmt(purchase.overduePO)} icon={AlertTriangle} tint="bg-rose-50 text-rose-600" />
      </div>

      {/* ----------------------------- Production -------------------------- */}
      <h2 className="mb-3 mt-8 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-500">
        <Factory className="h-4 w-4" /> Production
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <StatCard label="Ready for Cutting" value={fmt(production.readyForCutting)} icon={Factory} tint="bg-teal-50 text-teal-600" />
        <StatCard label="In Cutting" value={fmt(production.cutting)} icon={Factory} tint="bg-indigo-50 text-indigo-600" />
        <StatCard label="In Sewing" value={fmt(production.sewing)} icon={Factory} tint="bg-sky-50 text-sky-600" />
        <StatCard label="In Finishing" value={fmt(production.finishing)} icon={Factory} tint="bg-violet-50 text-violet-600" />
        <StatCard label="WIP (pieces)" value={fmt(production.wip)} icon={Clock3} tint="bg-amber-50 text-amber-600" />
      </div>

      {/* ------------------------------ Shipping --------------------------- */}
      <h2 className="mb-3 mt-8 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-500">
        <Ship className="h-4 w-4" /> Shipping
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Ready to Ship" value={fmt(shipping.readyToShip)} icon={Ship} tint="bg-emerald-50 text-emerald-600" sub="FG in stock (pieces)" />
        <StatCard label="Packed" value={fmt(shipping.packed)} icon={PackageCheck} tint="bg-sky-50 text-sky-600" sub="FG packed (pieces)" />
        <StatCard label="Shipped" value={fmt(shipping.shipped)} icon={Ship} tint="bg-indigo-50 text-indigo-600" sub="FG shipped (pieces)" />
        <StatCard label="Shipments Completed" value={fmt(shipping.Completed)} icon={CheckCircle2} tint="bg-teal-50 text-teal-600" />
      </div>

      {/* Quick links */}
      <Card className="mt-8 p-5">
        <h3 className="text-sm font-semibold text-slate-800">Jump into the workflow</h3>
        <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { href: '/orders', label: 'Book a sales order' },
            { href: '/mrp', label: 'Run MRP & reserve stock' },
            { href: '/requisitions', label: 'Create a purchase requisition' },
            { href: '/purchase-orders', label: 'Convert PR to purchase order' },
            { href: '/grn', label: 'Receive goods (GRN)' },
            { href: '/production', label: 'Plan production' },
          ].map((l) => (
            <Link key={l.href} href={l.href} className="group flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700">
              {l.label}
              <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-indigo-500" />
            </Link>
          ))}
        </div>
        <p className="mt-4 text-xs text-slate-400">
          Generated {new Date(summary.generatedAt).toLocaleString()} · <Badge>Live</Badge>
        </p>
      </Card>
    </div>
  );
}
