"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { formatMoneyFromCents } from "@/lib/format";

interface ClienteSaldoRow {
  id: number;
  nombre: string;
  tipoDoc: string;
  nroDoc: string;
  saldo: number;
  limiteCredito: number | null;
}

export default function SaldosClientesPage() {
  const [clientes, setClientes] = useState<ClienteSaldoRow[]>([]);
  const [totalAdeudado, setTotalAdeudado] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/clientes?conDeuda=true&pageSize=100", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setClientes(d.data || []);
          setTotalAdeudado(d.totalAdeudado || 0);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Cuentas corrientes con saldo</h2>
            <p className="text-sm text-slate-500">
              {"Total adeudado: "}
              <span className="font-semibold text-slate-900">
                {formatMoneyFromCents(totalAdeudado)}
              </span>
            </p>
          </div>
          <Link href="/clientes" className="text-sm font-medium text-blue-600 hover:underline">
            Ver todos los clientes
          </Link>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500 uppercase">
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4">Documento</th>
                  <th className="py-3 px-4 text-right">Límite</th>
                  <th className="py-3 px-4 text-right">Saldo adeudado</th>
                  <th className="py-3 px-4 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-500">
                      Cargando saldos...
                    </td>
                  </tr>
                ) : clientes.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-500">
                      No hay clientes con saldo pendiente.
                    </td>
                  </tr>
                ) : (
                  clientes.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-medium text-slate-900">{c.nombre}</td>
                      <td className="py-3 px-4 text-slate-600">
                        {c.tipoDoc + ": " + c.nroDoc}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-600">
                        {c.limiteCredito !== null
                          ? formatMoneyFromCents(c.limiteCredito)
                          : "Sin límite"}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        {formatMoneyFromCents(c.saldo)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          href={"/clientes/" + c.id + "/cuenta"}
                          className="text-blue-600 hover:underline font-medium"
                        >
                          Ver cuenta / Cobrar
                        </Link>
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
