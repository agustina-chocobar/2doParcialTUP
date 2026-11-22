"use client";
import { Suspense } from "react";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Printer } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { formatDateTimeArg, formatMoneyFromCents } from "@/lib/format";

interface ReciboData {
  id: number;
  numeroRecibo: string;
  fecha: string;
  cliente: { id: number; nombre: string };
  importe: number;
  medio: string;
  observacion: string;
  usuario: { id: number; nombre: string };
  saldoCliente: number;
}

function ReciboPagoPageInner() {
  const params = useParams<{ id: string; pagoId: string }>();
  const [recibo, setRecibo] = useState<ReciboData | null>(null);

  useEffect(() => {
    if (!params?.id || !params?.pagoId) return;
    fetch("/api/clientes/" + params.id + "/pagos/" + params.pagoId, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setRecibo(d));
  }, [params?.id, params?.pagoId]);

  return (
    <AppShell>
      <div className="space-y-6 max-w-2xl">
        <div className="no-print flex items-center justify-between">
          <Link
            href={"/clientes/" + (params?.id || "") + "/cuenta"}
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            ← Volver a la cuenta
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-sm font-medium text-slate-800"
          >
            <Printer className="w-4 h-4" />
            Imprimir recibo
          </button>
        </div>

        {!recibo ? (
          <div className="bg-white rounded-xl border border-slate-200 p-6 text-sm text-slate-500">
            Cargando recibo...
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <div className="border-b border-slate-200 pb-4 flex items-start justify-between">
              <div>
                <p className="text-xs uppercase text-slate-500">Comprobante de cobranza</p>
                <h2 className="text-xl font-bold text-slate-900 mt-0.5">{recibo.numeroRecibo}</h2>
                <p className="text-sm text-slate-500 mt-1">
                  {"Fecha: " + formatDateTimeArg(recibo.fecha)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase text-slate-500">Importe cobrado</p>
                <p className="text-2xl font-bold text-emerald-700">
                  {formatMoneyFromCents(recibo.importe)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-slate-500">Cliente</p>
                <p className="font-medium text-slate-900">{recibo.cliente.nombre}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Medio de pago</p>
                <p className="font-medium text-slate-900 capitalize">
                  {recibo.medio.replace("_", " ")}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Registrado por</p>
                <p className="text-slate-800">{recibo.usuario.nombre}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Saldo restante en cuenta</p>
                <p className="font-semibold text-slate-900">
                  {formatMoneyFromCents(recibo.saldoCliente)}
                </p>
              </div>
            </div>

            {recibo.observacion && (
              <div className="pt-2 border-t border-slate-100 text-sm text-slate-600">
                <span className="font-medium text-slate-700">Observación:</span> {recibo.observacion}
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default function ReciboPagoPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">Cargando...</div>}>
      <ReciboPagoPageInner />
    </Suspense>
  );
}
