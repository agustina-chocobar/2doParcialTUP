"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { formatDateTimeArg, formatMoneyFromCents } from "@/lib/format";

interface FacturaRow {
  id: number;
  numeroFormateado: string;
  fecha: string;
  cliente: { id: number; nombre: string } | null;
  vendedor: { id: number; nombre: string };
  formaPago: string;
  total: number;
  estado: "emitida" | "anulada";
}

const FORMA_LABELS: Record<string, string> = {
  contado: "Contado",
  tarjeta: "Tarjeta",
  cuenta_corriente: "Cuenta corriente",
};

export default function VentasListadoPage() {
  const [facturas, setFacturas] = useState<FacturaRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalEmitido, setTotalEmitido] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const [q, setQ] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [forma, setForma] = useState("");
  const [estado, setEstado] = useState("");
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    if (q.trim()) params.set("q", q.trim());
    if (desde) params.set("desde", desde);
    if (hasta) params.set("hasta", hasta);
    if (forma) params.set("forma", forma);
    if (estado) params.set("estado", estado);

    fetch("/api/facturas?" + params.toString(), { cache: "no-store" })
      .then(async (r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setFacturas(d.data || []);
          setTotal(d.total || 0);
          setTotalEmitido(d.totalEmitido || 0);
        }
      })
      .finally(() => setLoading(false));
  }, [page, q, desde, hasta, forma, estado]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Facturas</h2>
            <p className="text-sm text-slate-500">
              Total emitido (filtro actual):{" "}
              <span className="font-semibold text-slate-800">
                {formatMoneyFromCents(totalEmitido)}
              </span>
            </p>
          </div>
          <Link
            href="/ventas/nueva"
            className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
          >
            Nueva venta
          </Link>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <input
            type="text"
            placeholder="Buscar por número o cliente..."
            value={q}
            onChange={(e) => {
              setPage(1);
              setQ(e.target.value);
            }}
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm"
          />
          <input
            type="date"
            value={desde}
            onChange={(e) => {
              setPage(1);
              setDesde(e.target.value);
            }}
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm"
          />
          <input
            type="date"
            value={hasta}
            onChange={(e) => {
              setPage(1);
              setHasta(e.target.value);
            }}
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm"
          />
          <select
            value={forma}
            onChange={(e) => {
              setPage(1);
              setForma(e.target.value);
            }}
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
          >
            <option value="">Todas las formas</option>
            <option value="contado">Contado</option>
            <option value="tarjeta">Tarjeta</option>
            <option value="cuenta_corriente">Cuenta corriente</option>
          </select>
          <select
            value={estado}
            onChange={(e) => {
              setPage(1);
              setEstado(e.target.value);
            }}
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
          >
            <option value="">Todos los estados</option>
            <option value="emitida">Emitida</option>
            <option value="anulada">Anulada</option>
          </select>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500 uppercase">
                  <th className="py-3 px-4">Número</th>
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4">Vendedor</th>
                  <th className="py-3 px-4">Pago</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4 text-right">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-slate-500">
                      Cargando facturas...
                    </td>
                  </tr>
                ) : facturas.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-slate-500">
                      No se encontraron facturas.
                    </td>
                  </tr>
                ) : (
                  facturas.map((f) => (
                    <tr key={f.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono font-medium text-slate-900">
                        {f.numeroFormateado}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {formatDateTimeArg(f.fecha)}
                      </td>
                      <td className="py-3 px-4 text-slate-800">
                        {f.cliente ? f.cliente.nombre : "Consumidor final"}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {f.vendedor.nombre}
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        {FORMA_LABELS[f.formaPago] || f.formaPago}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-slate-900">
                        {formatMoneyFromCents(f.total)}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={
                            f.estado === "emitida"
                              ? "px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800"
                              : "px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800"
                          }
                        >
                          {f.estado === "emitida" ? "Emitida" : "Anulada"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          href={"/ventas/" + f.id}
                          className="text-blue-600 hover:underline font-medium"
                        >
                          Ver
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <span>
              Página {page} de {totalPages} ({total} resultados)
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded border border-slate-300 disabled:opacity-40"
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 rounded border border-slate-300 disabled:opacity-40"
              >
                Siguiente
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
