"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { formatMoneyFromCents, pesosToCents } from "@/lib/format";

interface ClienteRow {
  id: number;
  tipoDoc: "DNI" | "CUIT";
  nroDoc: string;
  nombre: string;
  domicilio: string;
  telefono: string;
  email: string;
  cuentaCorriente: boolean;
  limiteCredito: number | null;
  saldo: number;
  disponible: number | null;
  activo: boolean;
}

export default function ClientesPage() {
  const [clientes, setClientes] = useState<ClienteRow[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [tipoDoc, setTipoDoc] = useState<"DNI" | "CUIT">("DNI");
  const [nroDoc, setNroDoc] = useState("");
  const [nombre, setNombre] = useState("");
  const [domicilio, setDomicilio] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [cuentaCorriente, setCuentaCorriente] = useState(false);
  const [limitePesos, setLimitePesos] = useState("");
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const cargar = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("pageSize", "100");
    if (q.trim()) params.set("q", q.trim());

    fetch("/api/clientes?" + params.toString(), { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.data) setClientes(d.data);
      })
      .finally(() => setLoading(false));
  }, [q]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function openNuevo() {
    setEditingId(null);
    setTipoDoc("DNI");
    setNroDoc("");
    setNombre("");
    setDomicilio("");
    setTelefono("");
    setEmail("");
    setCuentaCorriente(false);
    setLimitePesos("");
    setMsg(null);
    setShowForm(true);
  }

  function openEditar(c: ClienteRow) {
    setEditingId(c.id);
    setTipoDoc(c.tipoDoc);
    setNroDoc(c.nroDoc);
    setNombre(c.nombre);
    setDomicilio(c.domicilio || "");
    setTelefono(c.telefono || "");
    setEmail(c.email || "");
    setCuentaCorriente(c.cuentaCorriente);
    setLimitePesos(c.limiteCredito !== null ? (c.limiteCredito / 100).toFixed(2) : "");
    setMsg(null);
    setShowForm(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    let limiteCents: number | null = null;
    if (cuentaCorriente && limitePesos.trim()) {
      const parsed = pesosToCents(limitePesos);
      if (parsed === null || parsed < 0) {
        setMsg({ type: "err", text: "El límite de crédito no es válido." });
        return;
      }
      limiteCents = parsed;
    }

    setSaving(true);
    try {
      const payload = {
        tipoDoc,
        nroDoc: nroDoc.trim(),
        nombre: nombre.trim(),
        domicilio: domicilio.trim(),
        telefono: telefono.trim(),
        email: email.trim(),
        cuentaCorriente,
        limiteCredito: cuentaCorriente ? limiteCents : null,
      };

      const url = editingId ? "/api/clientes/" + editingId : "/api/clientes";
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setMsg({ type: "err", text: data?.error?.message || "No se pudo guardar el cliente." });
      } else {
        setShowForm(false);
        setMsg({ type: "ok", text: "Cliente guardado correctamente." });
        cargar();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Clientes</h2>
            <p className="text-sm text-slate-500">Padrón de clientes y habilitación de cuenta corriente.</p>
          </div>
          <button
            type="button"
            onClick={openNuevo}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
          >
            Nuevo cliente
          </button>
        </div>

        {msg && !showForm && (
          <div
            className={
              msg.type === "ok"
                ? "p-3 rounded-lg text-sm border bg-emerald-50 border-emerald-200 text-emerald-800"
                : "p-3 rounded-lg text-sm border bg-red-50 border-red-200 text-red-700"
            }
          >
            {msg.text}
          </div>
        )}

        {showForm && (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-base font-semibold text-slate-900 mb-4">
              {editingId ? "Editar cliente" : "Nuevo cliente"}
            </h3>
            {msg && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                {msg.text}
              </div>
            )}
            <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Tipo doc.</label>
                <select
                  value={tipoDoc}
                  onChange={(e) => setTipoDoc(e.target.value as "DNI" | "CUIT")}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
                >
                  <option value="DNI">DNI</option>
                  <option value="CUIT">CUIT</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Número de documento</label>
                <input
                  type="text"
                  required
                  value={nroDoc}
                  onChange={(e) => setNroDoc(e.target.value)}
                  placeholder="30123456 o 20-30123456-7"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Nombre / Razón social</label>
                <input
                  type="text"
                  required
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Domicilio</label>
                <input
                  type="text"
                  value={domicilio}
                  onChange={(e) => setDomicilio(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Teléfono</label>
                <input
                  type="text"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-3 flex flex-wrap items-center gap-6 pt-1">
                <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={cuentaCorriente}
                    onChange={(e) => setCuentaCorriente(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  <span>Habilitar cuenta corriente</span>
                </label>

                {cuentaCorriente && (
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-slate-700">Límite de crédito ($):</label>
                    <input
                      type="text"
                      value={limitePesos}
                      onChange={(e) => setLimitePesos(e.target.value)}
                      placeholder="Sin límite"
                      className="w-40 px-3 py-1.5 rounded-lg border border-slate-300 text-sm"
                    />
                  </div>
                )}
              </div>

              <div className="sm:col-span-2 lg:col-span-3 flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
                >
                  {saving ? "Guardando..." : "Guardar"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-sm"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <input
            type="text"
            placeholder="Buscar por nombre o documento..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full sm:w-80 px-3 py-2 rounded-lg border border-slate-300 text-sm"
          />
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500 uppercase">
                  <th className="py-3 px-4">Nombre</th>
                  <th className="py-3 px-4">Documento</th>
                  <th className="py-3 px-4">Cta. Cte.</th>
                  <th className="py-3 px-4 text-right">Saldo</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-500">
                      Cargando clientes...
                    </td>
                  </tr>
                ) : clientes.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-500">
                      No se encontraron clientes.
                    </td>
                  </tr>
                ) : (
                  clientes.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-medium text-slate-900">{c.nombre}</td>
                      <td className="py-3 px-4 text-slate-600">
                        {c.tipoDoc + ": " + c.nroDoc}
                      </td>
                      <td className="py-3 px-4">
                        {c.cuentaCorriente ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            Habilitada
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">No</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-slate-900">
                        {formatMoneyFromCents(c.saldo)}
                      </td>
                      <td className="py-3 px-4 text-right space-x-3 whitespace-nowrap">
                        {c.cuentaCorriente && (
                          <Link
                            href={"/clientes/" + c.id + "/cuenta"}
                            className="text-blue-600 hover:underline font-medium"
                          >
                            Cuenta
                          </Link>
                        )}
                        <button
                          type="button"
                          onClick={() => openEditar(c)}
                          className="text-slate-700 hover:underline font-medium"
                        >
                          Editar
                        </button>
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
