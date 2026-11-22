"use client";
import { Suspense } from "react";

import React, { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { formatDateTimeArg, formatMoneyFromCents, pesosToCents } from "@/lib/format";

interface ClienteDetalle {
  id: number;
  nombre: string;
  tipoDoc: string;
  nroDoc: string;
  cuentaCorriente: boolean;
  limiteCredito: number | null;
  saldo: number;
  disponible: number | null;
}

interface MovCuenta {
  id: number;
  fecha: string;
  tipo: "debito" | "credito";
  importe: number;
  descripcion: string;
  facturaId: number | null;
  pagoId: number | null;
  saldo: number;
}

function CuentaClientePageInner() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;

  const [cliente, setCliente] = useState<ClienteDetalle | null>(null);
  const [movimientos, setMovimientos] = useState<MovCuenta[]>([]);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  const [importePesos, setImportePesos] = useState("");
  const [medio, setMedio] = useState<"efectivo" | "transferencia" | "tarjeta_debito">("efectivo");
  const [observacion, setObservacion] = useState("");
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const cargar = useCallback(() => {
    if (!id) return;
    fetch("/api/clientes/" + id, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setCliente(d));

    const qp = new URLSearchParams();
    if (desde) qp.set("desde", desde);
    if (hasta) qp.set("hasta", hasta);
    fetch("/api/clientes/" + id + "/cuenta?" + qp.toString(), { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.movimientos) setMovimientos(d.movimientos);
      });
  }, [id, desde, hasta]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function handlePago(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    setMsg(null);

    const cents = pesosToCents(importePesos);
    if (cents === null || cents <= 0) {
      setMsg({ type: "err", text: "Ingrese un importe válido mayor a cero." });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/clientes/" + id + "/pagos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          importe: cents,
          medio,
          observacion: observacion.trim(),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setMsg({ type: "err", text: data?.error?.message || "No se pudo registrar el pago." });
        setSaving(false);
        return;
      }

      router.push("/clientes/" + id + "/pagos/" + data.id);
    } catch {
      setMsg({ type: "err", text: "Error de conexión al registrar el pago." });
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/clientes" className="text-sm font-medium text-blue-600 hover:underline">
            ← Volver a clientes
          </Link>
        </div>

        {cliente && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">{cliente.nombre}</h2>
              <p className="text-sm text-slate-500">
                {cliente.tipoDoc + ": " + cliente.nroDoc}
              </p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-xs uppercase text-slate-500">Saldo actual</p>
              <p className="text-2xl font-bold text-slate-900">
                {formatMoneyFromCents(cliente.saldo)}
              </p>
              <p className="text-xs text-slate-500">
                {cliente.limiteCredito !== null
                  ? "Límite: " +
                    formatMoneyFromCents(cliente.limiteCredito) +
                    " · Disponible: " +
                    formatMoneyFromCents(cliente.disponible ?? 0)
                  : "Sin límite de crédito"}
              </p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-base font-semibold text-slate-900 mb-3">Registrar cobro / pago</h3>
          {msg && (
            <div className="mb-3 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              {msg.text}
            </div>
          )}
          <form onSubmit={handlePago} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Importe ($)</label>
              <input
                type="text"
                required
                value={importePesos}
                onChange={(e) => setImportePesos(e.target.value)}
                placeholder="1000.00"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Medio de pago</label>
              <select
                value={medio}
                onChange={(e) =>
                  setMedio(e.target.value as "efectivo" | "transferencia" | "tarjeta_debito")
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
              >
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
                <option value="tarjeta_debito">Tarjeta de débito</option>
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
              {saving ? "Registrando..." : "Registrar pago"}
            </button>
          </form>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap gap-3 items-center">
          <span className="text-xs font-medium text-slate-600">Filtrar período:</span>
          <input
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm"
          />
          <input
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm"
          />
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500 uppercase">
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4">Descripción</th>
                  <th className="py-3 px-4 text-right">Débito</th>
                  <th className="py-3 px-4 text-right">Crédito</th>
                  <th className="py-3 px-4 text-right">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {movimientos.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-500">
                      Sin movimientos en el período seleccionado.
                    </td>
                  </tr>
                ) : (
                  movimientos.map((m) => (
                    <tr key={m.id}>
                      <td className="py-3 px-4 text-slate-600">{formatDateTimeArg(m.fecha)}</td>
                      <td className="py-3 px-4 text-slate-800">
                        {m.descripcion}
                        {m.facturaId && (
                          <Link
                            href={"/ventas/" + m.facturaId}
                            className="ml-2 text-xs text-blue-600 hover:underline"
                          >
                            Ver factura
                          </Link>
                        )}
                        {m.pagoId && id && (
                          <Link
                            href={"/clientes/" + id + "/pagos/" + m.pagoId}
                            className="ml-2 text-xs text-blue-600 hover:underline"
                          >
                            Ver recibo
                          </Link>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-800">
                        {m.tipo === "debito" ? formatMoneyFromCents(m.importe) : "—"}
                      </td>
                      <td className="py-3 px-4 text-right text-emerald-700 font-medium">
                        {m.tipo === "credito" ? formatMoneyFromCents(m.importe) : "—"}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-slate-900">
                        {formatMoneyFromCents(m.saldo)}
                      </td>
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

export default function CuentaClientePage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">Cargando...</div>}>
      <CuentaClientePageInner />
    </Suspense>
  );
}
