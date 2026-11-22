"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AppShell, CurrentUser } from "@/components/AppShell";
import { formatMoneyFromCents, pesosToCents } from "@/lib/format";

interface CategoriaItem {
  id: number;
  nombre: string;
  activa: boolean;
}

interface ProductoRow {
  id: number;
  codigo: string;
  descripcion: string;
  categoria: { id: number; nombre: string };
  precio: number;
  existencia: number;
  stockMinimo: number;
  bajoMinimo: boolean;
  activo: boolean;
}

export default function ProductosPage() {
  const [me, setMe] = useState<CurrentUser | null>(null);
  const [productos, setProductos] = useState<ProductoRow[]>([]);
  const [categorias, setCategorias] = useState<CategoriaItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const [q, setQ] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [bajoMinimo, setBajoMinimo] = useState(false);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [codigo, setCodigo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [formCatId, setFormCatId] = useState<string>("");
  const [precioPesos, setPrecioPesos] = useState("");
  const [stockMinimo, setStockMinimo] = useState("5");
  const [stockInicial, setStockInicial] = useState("0");
  const [formMsg, setFormMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const cargarProductos = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    if (q.trim()) params.set("q", q.trim());
    if (categoriaId) params.set("categoriaId", categoriaId);
    if (bajoMinimo) params.set("bajoMinimo", "true");

    fetch("/api/productos?" + params.toString(), { cache: "no-store" })
      .then(async (r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setProductos(d.data || []);
          setTotal(d.total || 0);
        }
      })
      .finally(() => setLoading(false));
  }, [page, q, categoriaId, bajoMinimo]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      if (sp.get("bajoMinimo") === "true") {
        setBajoMinimo(true);
      }
    }
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((u) => setMe(u))
      .catch(() => {});
    fetch("/api/categorias", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const list: CategoriaItem[] = d?.data || [];
        setCategorias(list);
        if (list.length > 0) {
          setFormCatId(String(list[0].id));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    cargarProductos();
  }, [cargarProductos]);

  function openNuevo() {
    setEditingId(null);
    setCodigo("");
    setDescripcion("");
    if (categorias.length > 0) setFormCatId(String(categorias[0].id));
    setPrecioPesos("");
    setStockMinimo("5");
    setStockInicial("0");
    setFormMsg(null);
    setShowForm(true);
  }

  function openEditar(p: ProductoRow) {
    setEditingId(p.id);
    setCodigo(p.codigo);
    setDescripcion(p.descripcion);
    setFormCatId(String(p.categoria.id));
    setPrecioPesos((p.precio / 100).toFixed(2));
    setStockMinimo(String(p.stockMinimo));
    setStockInicial("0");
    setFormMsg(null);
    setShowForm(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setFormMsg(null);

    const precioCents = pesosToCents(precioPesos);
    if (precioCents === null || precioCents <= 0) {
      setFormMsg({ type: "err", text: "Ingrese un precio válido mayor a cero." });
      return;
    }

    setSaving(true);
    try {
      if (editingId === null) {
        const res = await fetch("/api/productos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            codigo: codigo.trim(),
            descripcion: descripcion.trim(),
            categoriaId: Number(formCatId),
            precio: precioCents,
            stockMinimo: Number(stockMinimo),
            stockInicial: Number(stockInicial),
          }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          setFormMsg({ type: "err", text: data?.error?.message || "No se pudo crear el producto." });
          setSaving(false);
          return;
        }
      } else {
        const res = await fetch("/api/productos/" + editingId, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            codigo: codigo.trim(),
            descripcion: descripcion.trim(),
            categoriaId: Number(formCatId),
            precio: precioCents,
            stockMinimo: Number(stockMinimo),
          }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          setFormMsg({ type: "err", text: data?.error?.message || "No se pudo actualizar el producto." });
          setSaving(false);
          return;
        }
      }

      setShowForm(false);
      setFormMsg({ type: "ok", text: "Producto guardado correctamente." });
      cargarProductos();
    } catch {
      setFormMsg({ type: "err", text: "Error de conexión con el servidor." });
    } finally {
      setSaving(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Productos y stock</h2>
            <p className="text-sm text-slate-500">Catálogo de artículos, precios y existencias.</p>
          </div>
          {me?.rol === "admin" && (
            <button
              type="button"
              onClick={openNuevo}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
            >
              Nuevo producto
            </button>
          )}
        </div>

        {formMsg && !showForm && (
          <div
            className={
              formMsg.type === "ok"
                ? "p-3 rounded-lg text-sm border bg-emerald-50 border-emerald-200 text-emerald-800"
                : "p-3 rounded-lg text-sm border bg-red-50 border-red-200 text-red-700"
            }
          >
            {formMsg.text}
          </div>
        )}

        {showForm && (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-base font-semibold text-slate-900 mb-4">
              {editingId ? "Editar producto" : "Nuevo producto"}
            </h3>
            {formMsg && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                {formMsg.text}
              </div>
            )}
            <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Código</label>
                <input
                  type="text"
                  required
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  placeholder="PR-031"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">Descripción</label>
                <input
                  type="text"
                  required
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Nombre o descripción del artículo"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Categoría</label>
                <select
                  value={formCatId}
                  onChange={(e) => setFormCatId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
                >
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Precio ($)</label>
                <input
                  type="text"
                  required
                  value={precioPesos}
                  onChange={(e) => setPrecioPesos(e.target.value)}
                  placeholder="4500.00"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Stock mínimo</label>
                <input
                  type="number"
                  min={0}
                  required
                  value={stockMinimo}
                  onChange={(e) => setStockMinimo(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>

              {editingId === null && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Stock inicial</label>
                  <input
                    type="number"
                    min={0}
                    value={stockInicial}
                    onChange={(e) => setStockInicial(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                  />
                </div>
              )}

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

        <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row flex-wrap gap-3 items-stretch sm:items-center">
          <input
            type="text"
            placeholder="Buscar por código o descripción..."
            value={q}
            onChange={(e) => {
              setPage(1);
              setQ(e.target.value);
            }}
            className="flex-1 min-w-52 px-3 py-2 rounded-lg border border-slate-300 text-sm"
          />

          <select
            value={categoriaId}
            onChange={(e) => {
              setPage(1);
              setCategoriaId(e.target.value);
            }}
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
          >
            <option value="">Todas las categorías</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>

          <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={bajoMinimo}
              onChange={(e) => {
                setPage(1);
                setBajoMinimo(e.target.checked);
              }}
              className="rounded border-slate-300"
            />
            <span>Solo bajo mínimo</span>
          </label>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500 uppercase">
                  <th className="py-3 px-4">Código</th>
                  <th className="py-3 px-4">Descripción</th>
                  <th className="py-3 px-4">Categoría</th>
                  <th className="py-3 px-4 text-right">Precio</th>
                  <th className="py-3 px-4 text-right">Existencia</th>
                  <th className="py-3 px-4">Estado stock</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-slate-500">
                      Cargando productos...
                    </td>
                  </tr>
                ) : productos.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-slate-500">
                      No hay productos que coincidan con el filtro.
                    </td>
                  </tr>
                ) : (
                  productos.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono text-xs text-slate-700">{p.codigo}</td>
                      <td className="py-3 px-4 font-medium text-slate-900">{p.descripcion}</td>
                      <td className="py-3 px-4 text-slate-600">{p.categoria.nombre}</td>
                      <td className="py-3 px-4 text-right font-medium">
                        {formatMoneyFromCents(p.precio)}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-slate-900">
                        {p.existencia}
                      </td>
                      <td className="py-3 px-4">
                        {p.bajoMinimo ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                            {"Bajo mínimo (mín. " + p.stockMinimo + ")"}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                            Normal
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right space-x-3 whitespace-nowrap">
                        <Link
                          href={"/productos/" + p.id + "/movimientos"}
                          className="text-blue-600 hover:underline font-medium"
                        >
                          Movimientos
                        </Link>
                        {me?.rol === "admin" && (
                          <button
                            type="button"
                            onClick={() => openEditar(p)}
                            className="text-slate-700 hover:underline font-medium"
                          >
                            Editar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <span>
              {"Página " + page + " de " + totalPages + " (" + total + " productos)"}
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
