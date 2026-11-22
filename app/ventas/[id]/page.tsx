"use client";
import { Suspense } from "react";

import React, { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Printer } from "lucide-react";
import { AppShell, CurrentUser } from "@/components/AppShell";
import { formatDateTimeArg, formatMoneyFromCents } from "@/lib/format";

interface FacturaDetalle {
  id: number;
  numeroFormateado: string;
  fecha: string;
  estado: "emitida" | "anulada";
  cliente: {
    id: number;
    nombre: string;
    tipoDoc: string;
    nroDoc: string;
    domicilio: string;
  } | null;
  vendedor: { id: number; nombre: string };
  items: Array<{
    productoId: number;
    codigo: string;
    descripcion: string;
    cantidad: number;
    precioUnitario: number;
    subtotal: number;
  }>;
  total: number;
  pago: {
    forma: "contado" | "tarjeta" | "cuenta_corriente";
    montoRecibido?: number;
    vuelto?: number;
    tarjeta?: { tipo: string; marca: string; ultimos4: string };
  };
  anulacion?: {
    fecha: string | null;
    usuario: { id: number; nombre: string } | null;
    motivo: string | null;
  };
}

function FacturaDetallePageInner() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [factura, setFactura] = useState<FacturaDetalle | null>(null);
  const [me, setMe] = useState<CurrentUser | null>(null);
  const [motivo, setMotivo] = useState("");
  const [anularOpen, setAnularOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [anulando, setAnulando] = useState(false);

  const cargar = useCallback(() => {
    if (!id) return;
    fetch("/api/facturas/" + id, { cache: "no-store" })
      .then(async (r) => (r.ok ? r.json() : null))
      .then((d) => setFactura(d));
  }, [id]);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((u) => setMe(u))
      .catch(() => {});
    cargar();
  }, [cargar]);

  async function handleAnular(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    setErrorMsg(null);
    setAnulando(true);
    try {
      const res = await fetch("/api/facturas/" + id + "/anular", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setErrorMsg(data?.error?.message || "No se pudo anular la factura.");
        setAnulando(false);
        return;
      }
      setAnularOpen(false);
      setMotivo("");
      cargar();
    } catch {
      setErrorMsg("Error de conexión al anular la factura.");
    } finally {
      setAnulando(false);
    }
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="no-print flex flex-wrap items-center justify-between gap-3">
          <Link href="/ventas" className="text-sm font-medium text-blue-600 hover:underline">
            ← Volver a facturas
          </Link>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-sm font-medium text-slate-800"
            >
              <Printer className="w-4 h-4" />
              Imprimir
            </button>

            {me?.rol === "admin" && factura?.estado === "emitida" && (
              <button
                type="button"
                onClick={() => setAnularOpen(true)}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium"
              >
                Anular factura
              </button>
            )}
          </div>
        </div>

        {errorMsg && (
          <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            {errorMsg}
          </div>
        )}

        {anularOpen && (
          <div className="no-print bg-white rounded-xl border border-red-200 p-5 max-w-lg">
            <h3 className="text-base font-semibold text-red-800">Confirmar anulación de factura</h3>
            <p className="text-xs text-slate-600 mt-1">
              Se repondrá el stock de los artículos y, si fue en cuenta corriente, se registrará el crédito correspondiente.
            </p>
            <form onSubmit={handleAnular} className="mt-3 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Motivo de anulación
                </label>
                <input
                  type="text"
                  required
                  minLength={3}
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Ej: Error de facturación"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={anulando}
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium"
                >
                  {anulando ? "Anulando..." : "Confirmar anulación"}
                </button>
                <button
                  type="button"
                  onClick={() => setAnularOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-sm"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {!factura ? (
          <div className="bg-white rounded-xl border border-slate-200 p-6 text-sm text-slate-500">
            Cargando comprobante...
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-slate-900">
                    Factura {factura.numeroFormateado}
                  </h2>
                  <span
                    className={
                      factura.estado === "emitida"
                        ? "px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800"
                        : "px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800"
                    }
                  >
                    {factura.estado === "emitida" ? "Emitida" : "Anulada"}
                  </span>
                </div>
                <p className="text-sm text-slate-500 mt-1">
                  Fecha: {formatDateTimeArg(factura.fecha)} · Vendedor: {factura.vendedor.nombre}
                </p>
              </div>

              <div className="text-sm text-slate-700">
                <p className="font-semibold text-slate-900">Comprador</p>
                {factura.cliente ? (
                  <>
                    <p>{factura.cliente.nombre}</p>
                    <p className="text-xs text-slate-500">
                      {factura.cliente.tipoDoc}: {factura.cliente.nroDoc}
                    </p>
                  </>
                ) : (
                  <p>Consumidor final</p>
                )}
              </div>
            </div>

            {factura.estado === "anulada" && factura.anulacion && (
              <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 space-y-0.5">
                <p className="font-semibold">Comprobante anulado</p>
                <p>Motivo: {factura.anulacion.motivo || "—"}</p>
                <p>
                  {"Por " +
                    (factura.anulacion.usuario?.nombre || "Admin") +
                    (factura.anulacion.fecha
                      ? " el " + formatDateTimeArg(factura.anulacion.fecha)
                      : "")}
                </p>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-slate-200 text-xs text-slate-500 uppercase">
                    <th className="py-2 pr-3">Código</th>
                    <th className="py-2 px-3">Descripción</th>
                    <th className="py-2 px-3 text-right">Cant.</th>
                    <th className="py-2 px-3 text-right">P. Unit.</th>
                    <th className="py-2 pl-3 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {factura.items.map((it) => (
                    <tr key={it.productoId}>
                      <td className="py-2.5 pr-3 font-mono text-xs">{it.codigo}</td>
                      <td className="py-2.5 px-3">{it.descripcion}</td>
                      <td className="py-2.5 px-3 text-right">{it.cantidad}</td>
                      <td className="py-2.5 px-3 text-right">
                        {formatMoneyFromCents(it.precioUnitario)}
                      </td>
                      <td className="py-2.5 pl-3 text-right font-medium">
                        {formatMoneyFromCents(it.subtotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border-t border-slate-200 pt-4 flex flex-col sm:flex-row sm:justify-between gap-4 text-sm">
              <div className="space-y-1 text-slate-600">
                <p className="font-medium text-slate-800">Pago</p>
                {factura.pago.forma === "contado" && (
                  <>
                    <p>Forma: Contado</p>
                    <p>
                      Recibido:{" "}
                      {formatMoneyFromCents(factura.pago.montoRecibido ?? factura.total)}
                    </p>
                    <p>Vuelto: {formatMoneyFromCents(factura.pago.vuelto ?? 0)}</p>
                  </>
                )}
                {factura.pago.forma === "tarjeta" && (
                  <p>
                    {"Tarjeta " +
                      (factura.pago.tarjeta?.tipo || "") +
                      " — " +
                      (factura.pago.tarjeta?.marca || "") +
                      " terminada en " +
                      (factura.pago.tarjeta?.ultimos4 || "")}
                  </p>
                )}
                {factura.pago.forma === "cuenta_corriente" && <p>Forma: Cuenta corriente</p>}
              </div>

              <div className="text-right">
                <p className="text-xs uppercase text-slate-500">Total</p>
                <p className="text-2xl font-bold text-slate-900">
                  {formatMoneyFromCents(factura.total)}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default function FacturaDetallePage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">Cargando...</div>}>
      <FacturaDetallePageInner />
    </Suspense>
  );
}
