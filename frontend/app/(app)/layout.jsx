'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Boxes,
  Users,
  Shirt,
  ShoppingCart,
  ListTree,
  Calculator,
  FileText,
  ShoppingBag,
  PackageCheck,
  Warehouse,
  Factory,
  Handshake,
  Scissors,
  ShieldCheck,
  Box,
  Ship,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { getStoredUser, getToken, clearAuth } from '@/utils/api';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { section: 'Merchandising' },
  { href: '/buyers', label: 'Buyers', icon: Users },
  { href: '/styles', label: 'Styles & BOM', icon: Shirt },
  { href: '/orders', label: 'Sales Orders', icon: ShoppingCart },
  { section: 'Planning' },
  { href: '/mrp', label: 'MRP', icon: Calculator },
  { href: '/requisitions', label: 'Requisitions', icon: FileText },
  { section: 'Procurement' },
  { href: '/suppliers', label: 'Suppliers', icon: Handshake },
  { href: '/purchase-orders', label: 'Purchase Orders', icon: ShoppingBag },
  { href: '/grn', label: 'Goods Receiving', icon: PackageCheck },
  { section: 'Warehouse' },
  { href: '/materials', label: 'Material Master', icon: Boxes },
  { href: '/warehouse', label: 'Stock & Ledger', icon: Warehouse },
  { href: '/issues', label: 'Material Issues', icon: Box },
  { section: 'Production' },
  { href: '/production', label: 'Production Orders', icon: Factory },
  { href: '/cutting', label: 'Cutting', icon: Scissors },
  { href: '/quality', label: 'Quality', icon: ShieldCheck },
  { section: 'Shipping' },
  { href: '/finished-goods', label: 'Finished Goods', icon: Box },
  { href: '/shipments', label: 'Shipments', icon: Ship },
];

export default function AppShell({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/');
      return;
    }
    setUser(getStoredUser());
  }, [router]);

  useEffect(() => setSidebarOpen(false), [pathname]);

  const logout = () => {
    clearAuth();
    router.replace('/');
  };

  return (
    <div className="min-h-screen bg-slate-50 lg:flex lg:items-start">
      {/* Mobile top bar */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-200 bg-white/85 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600">
            <Factory className="h-5 w-5 text-white" />
          </div>
          <p className="text-sm font-bold tracking-tight text-slate-900">Garments ERP</p>
        </div>
        <button onClick={() => setSidebarOpen(true)} aria-label="Open menu" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 shadow-md shadow-indigo-600/25">
              <Factory className="h-5 w-5 text-white" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-bold tracking-tight text-slate-900">Garments ERP</p>
              <p className="text-[11px] text-slate-400">Material → Production → Ship</p>
            </div>
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 lg:hidden" aria-label="Close menu">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {NAV.map((item, i) =>
            item.section ? (
              <p key={`s-${i}`} className="mb-1 mt-4 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 first:mt-0">
                {item.section}
              </p>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className={`mb-0.5 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  pathname === item.href
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <item.icon className={`h-4 w-4 ${pathname === item.href ? 'text-indigo-600' : 'text-slate-400'}`} />
                {item.label}
              </Link>
            )
          )}
        </nav>

        <div className="border-t border-slate-100 p-4">
          {user && (
            <div className="mb-3 flex items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-sm font-bold text-white">
                {user.name?.[0] || 'U'}
              </div>
              <div className="min-w-0 leading-tight">
                <p className="truncate text-sm font-semibold text-slate-800">{user.name}</p>
                <p className="truncate text-[11px] text-slate-400">{user.role?.replace(/_/g, ' ')}</p>
              </div>
            </div>
          )}
          <button
            onClick={logout}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Backdrop for mobile */}
      {sidebarOpen && <div className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
