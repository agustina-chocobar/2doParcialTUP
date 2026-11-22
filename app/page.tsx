"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import {
  TopProductosChart,
  TopProductosTabla,
  VentasDiariasChart,
  VentasPorFormaChart,
} from "@/components/charts/TableroCharts";
import { formatMoneyFromCents } from "@/lib/format";

interface TableroData {
  hoy: { cantidad: number; importe: number };
  mes: { cantidad: number; importe: number; ticketPromedio: number };
  cuentasCorrientes: { totalAdeudado: number; clientesConSaldo: number };
  bajoMinimo: { cantidad: number };
  ventasDiarias: Array<{ fecha: string; importe: number }>;
  porFormaDePago: Array<{ forma: string; importe: number }>;
  masVendidos: Array<{ productoId: number; codigo: string; descripcion: string; unidades: number; importe: number }>;
}

export default function HomePage() {
  const [data, setData] = useState<TableroData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/tablero", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("No se pudo cargar el tablero.");
        return res.json();
      })
      .then((json) => setData(json))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Tablero</h2>
            <p className="text-sm text-slate-500">Resumen de facturación, cobranzas y existencias.</p>
          </div>
          <Link
            href="/ventas/nueva"
            className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
          >
            Nueva venta
          </Link>
        </div>

        {error && (
          <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
        )}

        {!data && !error ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-28 rounded-xl bg-white border border-slate-200 animate-pulse" />
            ))}
          </div>
        ) : null}

        {data && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <p className="text-xs font-medium text-slate-500 uppercase">Ventas de hoy</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{formatMoneyFromCents(data.hoy.importe)}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {data.hoy.cantidad} {data.hoy.cantidad === 1 ? "factura emitida" : "facturas emitidas"}
                </p>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <p className="text-xs font-medium text-slate-500 uppercase">Ventas del mes</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{formatMoneyFromCents(data.mes.importe)}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {data.mes.cantidad} facturas · Ticket {formatMoneyFromCents(data.mes.ticketPromedio)}
                </p>
              </div>

              <Link href="/clientes/saldos" className="bg-white rounded-xl border border-slate-200 hover:border-blue-300 p-5 transition-colors">
                <p className="text-xs font-medium text-slate-500 uppercase">Cuentas corrientes</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {formatMoneyFromCents(data.cuentasCorrientes.totalAdeudado)}
                </p>
                <p className="text-xs text-blue-600 mt-1">{data.cuentasCorrientes.clientesConSaldo} clientes con saldo</p>
              </Link>

              <Link href="/productos?bajoMinimo=true" className="bg-white rounded-xl border border-slate-200 hover:border-amber-300 p-5 transition-colors">
                <p className="text-xs font-medium text-slate-500 uppercase">Stock bajo mínimo</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{data.bajoMinimo.cantidad}</p>
                <p className="text-xs text-amber-700 mt-1">
                  {data.bajoMinimo.cantidad === 1 ? "producto a reponer" : "productos a reponer"}
                </p>
              </Link>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="text-base font-semibold text-slate-800 mb-3">Ventas diarias (últimos 30 días)</h3>
                <VentasDiariasChart data={data.ventasDiarias} />
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="text-base font-semibold text-slate-800 mb-3">Ventas del mes por forma de pago</h3>
                <VentasPorFormaChart data={data.porFormaDePago} />
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="text-base font-semibold text-slate-800 mb-3">Productos más vendidos del mes (unidades)</h3>
              <TopProductosChart data={data.masVendidos} />
              <TopProductosTabla data={data.masVendidos} />
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}