"use client";
import { Suspense } from "react";

import React, { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AppShell, CurrentUser } from "@/components/AppShell";
import { formatDateTimeArg } from "@/lib/format";

interface ProductoInfo {
  id: number;
  codigo: string;
  descripcion: string;
  existencia: number;
  stockMinimo: number;
}

interface MovimientoRow {
  id: number;
  tipo: string;
  cantidad: number;
  existenciaResultante: number;
  motivo: string;
  referencia: { facturaId: number; numero: string } | null;
  usuario: { id: number; nombre: string };
  fecha: string;
}

const MOTIVOS_INGRESO = ["Reposición", "Stock inicial", "Devolución de cliente"];
const MOTIVOS_EGRESO = ["Rotura", "Vencimiento", "Ajuste de inventario", "Uso interno"];

function MovimientosProductoPageInner() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [me, setMe] = useState<CurrentUser | null>(null);
  const [producto, setProducto] = useState<ProductoInfo | null>(null);
  const [movimientos, setMovimientos] = useState<MovimientoRow[]>([]);
  const [tipo, setTipo] = useState<"ingreso" | "egreso">("ingreso");
  const [cantidad, setCantidad] = useState("1");
  const [motivo, setMotivo] = useState("Reposición");
  const [observacion, setObservacion] = useState("");
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const cargar = useCallback(() => {
    if (!id) return;
    fetch("/api/productos/" + id, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setProducto(d));

    fetch("/api/stock/movimientos?productoId=" + id + "&pageSize=50", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setMovimientos(d?.data || []));
  }, [id]);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((u) => setMe(u))
      .catch(() => {});
    cargar();
  }, [cargar]);

  function handleChangeTipo(nextTipo: "ingreso" | "egreso") {
    setTipo(nextTipo);
    setMotivo(nextTipo === "ingreso" ? MOTIVOS_INGRESO[0] : MOTIVOS_EGRESO[0]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    setMsg(null);
    setSaving(true);
    try {
      const res = await fetch("/api/productos/" + id + "/movimientos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo,
          cantidad: Number(cantidad),
          motivo,
          observacion: observacion.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setMsg({ type: "err", text: data?.error?.message || "No se pudo registrar el movimiento." });
      } else {
        setCantidad("1");
        setObservacion("");
        setMsg({ type: "ok", text: "Movimiento registrado correctamente." });
        cargar();
      }
    } finally {
      setSaving(false);
    }
  }

  const motivosDisponibles = tipo === "ingreso" ? MOTIVOS_INGRESO : MOTIVOS_EGRESO;

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/productos" className="text-sm font-medium text-blue-600 hover:underline">
            ← Volver a productos
          </Link>
        </div>

        {producto && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-xs font-mono text-slate-500">{producto.codigo}</p>
              <h2 className="text-xl font-bold text-slate-900">{producto.descripcion}</h2>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-xs uppercase text-slate-500">Existencia actual</p>
              <p className="text-2xl font-bold text-slate-900">{producto.existencia}</p>
              <p className="text-xs text-slate-500">{"Mínimo: " + producto.stockMinimo}</p>
            </div>
          </div>
        )}

        {me?.rol === "admin" && (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-base font-semibold text-slate-900 mb-3">Registrar movimiento manual</h3>
            {msg && (
              <div
                className={
                  msg.type === "ok"
                    ? "mb-3 p-3 rounded-lg text-sm border bg-emerald-50 border-emerald-200 text-emerald-800"
                    : "mb-3 p-3 rounded-lg text-sm border bg-red-50 border-red-200 text-red-700"
                }
              >
                {msg.text}
              </div>
            )}
            <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Tipo</label>
                <select
                  value={tipo}
                  onChange={(e) => handleChangeTipo(e.target.value as "ingreso" | "egreso")}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
                >
                  <option value="ingreso">Ingreso (+)</option>
                  <option value="egreso">Egreso (-)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Cantidad</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Motivo</label>
                <select
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
                >
                  {motivosDisponibles.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Observación</label>
                <input
                  type="text"
                  value={observacion}
                  onChange={(e) => setObservacion(e.target.value)}
                  placeholder="Opcional"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
              >
                {saving ? "Registrando..." : "Registrar"}
              </button>
            </form>
          </div>
        )}

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500 uppercase">
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4 text-right">Cantidad</th>
                  <th className="py-3 px-4 text-right">Existencia</th>
                  <th className="py-3 px-4">Motivo</th>
                  <th className="py-3 px-4">Usuario</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {movimientos.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-500">
                      Sin movimientos registrados.
                    </td>
                  </tr>
                ) : (
                  movimientos.map((m) => (
                    <tr key={m.id}>
                      <td className="py-3 px-4 text-slate-600">{formatDateTimeArg(m.fecha)}</td>
                      <td className="py-3 px-4 capitalize font-medium">{m.tipo}</td>
                      <td
                        className={
                          m.cantidad >= 0
                            ? "py-3 px-4 text-right font-semibold text-emerald-700"
                            : "py-3 px-4 text-right font-semibold text-red-700"
                        }
                      >
                        {m.cantidad >= 0 ? "+" + m.cantidad : String(m.cantidad)}
                      </td>
                      <td className="py-3 px-4 text-right font-medium">{m.existenciaResultante}</td>
                      <td className="py-3 px-4 text-slate-700">
                        {m.motivo}
                        {m.referencia && (
                          <Link
                            href={"/ventas/" + m.referencia.facturaId}
                            className="ml-2 text-xs text-blue-600 hover:underline"
                          >
                            {"(" + m.referencia.numero + ")"}
                          </Link>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600">{m.usuario.nombre}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export default function MovimientosProductoPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">Cargando...</div>}>
      <MovimientosProductoPageInner />
    </Suspense>
  );
}
