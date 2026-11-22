"use client";

import React, { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";

interface CategoriaRow {
  id: number;
  nombre: string;
  activa: boolean;
}

export default function CategoriasPage() {
  const [categorias, setCategorias] = useState<CategoriaRow[]>([]);
  const [nombre, setNombre] = useState("");
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const cargar = useCallback(() => {
    fetch("/api/categorias?incluirInactivas=true", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.data) setCategorias(d.data);
      });
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setSaving(true);
    try {
      const res = await fetch("/api/categorias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nombre.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setMsg({ type: "err", text: data?.error?.message || "No se pudo crear la categoría." });
      } else {
        setNombre("");
        setMsg({ type: "ok", text: "Categoría creada." });
        cargar();
      }
    } finally {
      setSaving(false);
    }
  }

  async function toggleActiva(cat: CategoriaRow) {
    setMsg(null);
    const res = await fetch("/api/categorias/" + cat.id, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activa: !cat.activa }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setMsg({ type: "err", text: data?.error?.message || "No se pudo actualizar la categoría." });
    } else {
      cargar();
    }
  }

  return (
    <AppShell>
      <div className="space-y-6 max-w-3xl">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Categorías</h2>
          <p className="text-sm text-slate-500">Clasificación de productos del catálogo.</p>
        </div>

        {msg && (
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

        <form onSubmit={handleCreate} className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            required
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nueva categoría..."
            className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-sm"
          />
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
          >
            {saving ? "Agregando..." : "Agregar categoría"}
          </button>
        </form>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500 uppercase">
                <th className="py-3 px-4">Nombre</th>
                <th className="py-3 px-4">Estado</th>
                <th className="py-3 px-4 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {categorias.map((c) => (
                <tr key={c.id}>
                  <td className="py-3 px-4 font-medium text-slate-900">{c.nombre}</td>
                  <td className="py-3 px-4">
                    <span
                      className={
                        c.activa
                          ? "px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800"
                          : "px-2 py-0.5 rounded-full text-xs font-medium bg-slate-200 text-slate-700"
                      }
                    >
                      {c.activa ? "Activa" : "Inactiva"}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => toggleActiva(c)}
                      className="text-xs font-medium text-blue-600 hover:underline"
                    >
                      {c.activa ? "Desactivar" : "Activar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
