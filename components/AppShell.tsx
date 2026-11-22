"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingCart,
  Receipt,
  Package,
  Tags,
  Users,
  Wallet,
  UserCog,
  KeyRound,
  LogOut,
  Menu,
  X,
} from "lucide-react";

export interface CurrentUser {
  id: number;
  nombre: string;
  email: string;
  rol: "admin" | "vendedor";
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Tablero", href: "/", icon: LayoutDashboard },
  { label: "Nueva venta", href: "/ventas/nueva", icon: ShoppingCart },
  { label: "Facturas", href: "/ventas", icon: Receipt },
  { label: "Productos y stock", href: "/productos", icon: Package },
  { label: "Categorías", href: "/productos/categorias", icon: Tags, adminOnly: true },
  { label: "Clientes", href: "/clientes", icon: Users },
  { label: "Cuentas corrientes", href: "/clientes/saldos", icon: Wallet },
  { label: "Usuarios", href: "/usuarios", icon: UserCog, adminOnly: true },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          if (active) {
            setLoading(false);
            router.replace("/login");
          }
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (active && data) {
          setUser(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setLoading(false);
          router.replace("/login");
        }
      });
    return () => {
      active = false;
    };
  }, [router]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-600">
        Cargando sesión...
      </div>
    );
  }

  if (!user) return null;

  const visibleItems = NAV_ITEMS.filter((item) =>
    item.adminOnly ? user.rol === "admin" : true
  );

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      {/* Sidebar desktop */}
      <aside className="no-print hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-slate-900 text-slate-100 border-r border-slate-800">
        <div className="h-16 flex items-center px-5 border-b border-slate-800">
          <span className="font-semibold tracking-tight text-base text-white">
            Gestión Comercial
          </span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href ||
                  (item.href !== "/productos" &&
                    item.href !== "/clientes" &&
                    item.href !== "/ventas" &&
                    pathname.startsWith(item.href + "/"));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-slate-800 text-xs text-slate-400">
          <p className="font-medium text-slate-200 truncate">{user.nombre}</p>
          <p className="capitalize mt-0.5">{user.rol}</p>
        </div>
      </aside>

      {/* Drawer móvil */}
      {mobileOpen && (
        <div className="no-print fixed inset-0 z-40 md:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/60"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative w-64 max-w-[80vw] bg-slate-900 text-slate-100 flex flex-col z-50">
            <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800">
              <span className="font-semibold text-base text-white">
                Gestión Comercial
              </span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="p-1.5 rounded-md text-slate-300 hover:bg-slate-800"
                aria-label="Cerrar menú"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1">
              {visibleItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-200 hover:bg-slate-800"
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Contenedor principal */}
      <div className="flex-1 md:pl-64 flex flex-col min-w-0">
        <header className="no-print h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="md:hidden p-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100"
              aria-label="Abrir menú"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-sm sm:text-base font-semibold text-slate-800 truncate">
              Sistema de Gestión Comercial
            </h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden sm:flex items-center gap-2 text-sm">
              <span className="font-medium text-slate-800">{user.nombre}</span>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                  user.rol === "admin"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-blue-100 text-blue-800"
                }`}
              >
                {user.rol}
              </span>
            </div>

            <Link
              href="/perfil"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Contraseña</span>
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-xs sm:text-sm font-medium text-slate-700 hover:bg-red-50 hover:text-red-700 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Salir</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}