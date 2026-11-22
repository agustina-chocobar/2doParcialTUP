"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { formatMoneyFromCents, pesosToCents } from "@/lib/format";

interface ProductoItem {
  id: number;
  codigo: string;
  descripcion: string;
  precio: number;
  existencia: number;
  activo: boolean;
}

interface ClienteItem {
  id: number;
  nombre: string;
  tipoDoc: string;
  nroDoc: string;
  cuentaCorriente: boolean;
  limiteCredito: number | null;
  saldo: number;
  disponible: number | null;
}

interface Renglon {
  productoId: number;
  cantidad: number;
}

export default function NuevaVentaPage() {
  const router = useRouter();
  const [proximoNumero, setProximoNumero] = useState<string>("0001-00000001");
  const [productos, setProductos] = useState<ProductoItem[]>([]);
  const [clientes, setClientes] = useState<ClienteItem[]>([]);
  const [clienteId, setClienteId] = useState<string>("");
  const [renglones, setRenglones] = useState<Renglon[]>([
    { productoId: 0, cantidad: 1 },
  ]);
  const [formaPago, setFormaPago] = useState<"contado" | "tarjeta" | "cuenta_corriente">("contado");
  const [montoRecibidoPesos, setMontoRecibidoPesos] = useState<string>("");
  const [tarjetaTipo, setTarjetaTipo] = useState<"debito" | "credito">("debito");
  const [tarjetaMarca, setTarjetaMarca] = useState<string>("Visa");
  const [tarjetaUltimos4, setTarjetaUltimos4] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/facturas/proximo-numero", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.numeroFormateado) setProximoNumero(d.numeroFormateado);
      })
      .catch(() => {});

    fetch("/api/productos?pageSize=100", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const list: ProductoItem[] = d?.data || [];
        setProductos(list);
        if (list.length > 0) {
          setRenglones([{ productoId: list[0].id, cantidad: 1 }]);
        }
      })
      .catch(() => {});

    fetch("/api/clientes?pageSize=100", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setClientes(d?.data || []))
      .catch(() => {});
  }, []);

  const productoMap = new Map(productos.map((p) => [p.id, p]));
  const selectedCliente = clienteId
    ? clientes.find((c) => c.id === Number(clienteId)) || null
    : null;

  const totalCents = renglones.reduce((acc, r) => {
    const prod = productoMap.get(r.productoId);
    if (!prod || !Number.isFinite(r.cantidad) || r.cantidad <= 0) return acc;
    return acc + prod.precio * r.cantidad;
  }, 0);

  const recibidoCents =
    formaPago === "contado"
      ? montoRecibidoPesos.trim()
        ? pesosToCents(montoRecibidoPesos)
        : totalCents
      : null;

  const vueltoCents =
    formaPago === "contado" && recibidoCents !== null
      ? recibidoCents - totalCents
      : null;

  function addRenglon() {
    const firstId = productos[0]?.id || 0;
    setRenglones((prev) => [...prev, { productoId: firstId, cantidad: 1 }]);
  }

  function removeRenglon(index: number) {
    setRenglones((prev) =>
      prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== index)
    );
  }

  function updateRenglon(index: number, patch: Partial<Renglon>) {
    setRenglones((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, ...patch } : item))
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    if (formaPago === "cuenta_corriente") {
      if (!selectedCliente || !selectedCliente.cuentaCorriente) {
        setErrorMsg(
          "Para venta en cuenta corriente debe seleccionar un cliente con cuenta corriente habilitada."
        );
        return;
      }
    }

    if (formaPago === "contado") {
      if (recibidoCents === null || recibidoCents < totalCents) {
        setErrorMsg("El monto recibido es inválido o menor al total.");
        return;
      }
    }

    const payload = {
      clienteId: clienteId ? Number(clienteId) : null,
      items: renglones.map((r) => ({
        productoId: Number(r.productoId),
        cantidad: Number(r.cantidad),
      })),
      pago:
        formaPago === "contado"
          ? { forma: "contado", montoRecibido: recibidoCents }
          : formaPago === "tarjeta"
          ? {
              forma: "tarjeta",
              tarjeta: {
                tipo: tarjetaTipo,
                marca: tarjetaMarca.trim(),
                ultimos4: tarjetaUltimos4.trim(),
              },
            }
          : { forma: "cuenta_corriente" },
    };

    setSubmitting(true);
    try {
      const res = await fetch("/api/facturas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setErrorMsg(data?.error?.message || "No se pudo emitir la factura.");
        setSubmitting(false);
        return;
      }

      router.push("/ventas/" + data.id);
    } catch {
      setErrorMsg("Error de conexión al emitir la factura.");
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Nueva venta</h2>
            <p className="text-sm text-slate-500">
              Próximo número correlativo:{" "}
              <span className="font-mono font-semibold text-slate-800">
                {proximoNumero}
              </span>
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <h3 className="text-base font-semibold text-slate-800">Comprador</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="cliente" className="block text-sm font-medium text-slate-700 mb-1">
                  Cliente (opcional para contado/tarjeta)
                </label>
                <select
                  id="cliente"
                  value={clienteId}
                  onChange={(e) => setClienteId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
                >
                  <option value="">Consumidor final / Sin seleccionar</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre} ({c.tipoDoc} {c.nroDoc})
                    </option>
                  ))}
                </select>
              </div>

              {selectedCliente && (
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1">
                  <p className="font-semibold text-slate-800">{selectedCliente.nombre}</p>
                  <p className="text-slate-600">
                    Cuenta corriente:{" "}
                    {selectedCliente.cuentaCorriente ? "Habilitada" : "No habilitada"}
                  </p>
                  <p className="text-slate-600">
                    {"Saldo actual: " +
                      formatMoneyFromCents(selectedCliente.saldo) +
                      (selectedCliente.disponible !== null
                        ? " · Disponible: " + formatMoneyFromCents(selectedCliente.disponible)
                        : "")}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-800">Detalle de artículos</h3>
              <button
                type="button"
                onClick={addRenglon}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium"
              >
                <Plus className="w-4 h-4" />
                Agregar renglón
              </button>
            </div>

            <div className="space-y-3">
              {renglones.map((r, idx) => {
                const prod = productoMap.get(r.productoId);
                const subtotal = prod ? prod.precio * (r.cantidad || 0) : 0;
                return (
                  <div
                    key={idx}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center p-3 rounded-lg bg-slate-50 border border-slate-200"
                  >
                    <div className="sm:col-span-6">
                      <select
                        value={r.productoId}
                        onChange={(e) =>
                          updateRenglon(idx, { productoId: Number(e.target.value) })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
                      >
                        {productos.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.codigo} — {p.descripcion} (Stock: {p.existencia})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <input
                        type="number"
                        min={1}
                        required
                        value={r.cantidad}
                        onChange={(e) =>
                          updateRenglon(idx, { cantidad: Math.max(1, Number(e.target.value)) })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
                      />
                    </div>

                    <div className="sm:col-span-3 text-left sm:text-right text-sm font-medium text-slate-800">
                      {formatMoneyFromCents(subtotal)}
                    </div>

                    <div className="sm:col-span-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => removeRenglon(idx)}
                        disabled={renglones.length <= 1}
                        className="p-2 text-slate-500 hover:text-red-600 disabled:opacity-30"
                        aria-label="Eliminar renglón"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-3 border-t border-slate-200 flex justify-end">
              <div className="text-right">
                <p className="text-xs uppercase text-slate-500">Total a pagar</p>
                <p className="text-2xl font-bold text-slate-900">
                  {formatMoneyFromCents(totalCents)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <h3 className="text-base font-semibold text-slate-800">Forma de pago</h3>

            <div className="flex flex-wrap gap-3">
              {[
                ["contado", "Contado"],
                ["tarjeta", "Tarjeta"],
                ["cuenta_corriente", "Cuenta corriente"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    setFormaPago(value as "contado" | "tarjeta" | "cuenta_corriente")
                  }
                  className={
                    formaPago === value
                      ? "px-4 py-2 rounded-lg text-sm font-medium border transition-colors bg-blue-600 text-white border-blue-600"
                      : "px-4 py-2 rounded-lg text-sm font-medium border transition-colors bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                  }
                >
                  {label}
                </button>
              ))}
            </div>

            {formaPago === "contado" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label htmlFor="recibido" className="block text-sm font-medium text-slate-700 mb-1">
                    Monto recibido ($)
                  </label>
                  <input
                    id="recibido"
                    type="text"
                    placeholder={(totalCents / 100).toFixed(2)}
                    value={montoRecibidoPesos}
                    onChange={(e) => setMontoRecibidoPesos(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                  />
                </div>
                <div className="flex flex-col justify-end">
                  <p className="text-xs text-slate-500">Vuelto calculado</p>
                  <p className="text-lg font-bold text-slate-900">
                    {vueltoCents !== null && vueltoCents >= 0
                      ? formatMoneyFromCents(vueltoCents)
                      : "—"}
                  </p>
                </div>
              </div>
            )}

            {formaPago === "tarjeta" && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
                  <select
                    value={tarjetaTipo}
                    onChange={(e) => setTarjetaTipo(e.target.value as "debito" | "credito")}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
                  >
                    <option value="debito">Débito</option>
                    <option value="credito">Crédito</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Marca</label>
                  <input
                    type="text"
                    required
                    value={tarjetaMarca}
                    onChange={(e) => setTarjetaMarca(e.target.value)}
                    placeholder="Visa, Mastercard..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Últimos 4 dígitos
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={4}
                    pattern="d{4}"
                    value={tarjetaUltimos4}
                    onChange={(e) => setTarjetaUltimos4(e.target.value)}
                    placeholder="1234"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                  />
                </div>
              </div>
            )}

            {formaPago === "cuenta_corriente" && (
              <p className="text-xs text-slate-600 pt-1">
                Se debitará el total en la cuenta corriente del cliente seleccionado.
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="submit"
              disabled={submitting || totalCents <= 0}
              className="px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold"
            >
              {submitting ? "Emitiendo factura..." : "Emitir factura"}
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
