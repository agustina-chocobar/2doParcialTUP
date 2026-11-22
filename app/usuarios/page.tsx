"use client";

import React, { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";

interface UsuarioRow {
  id: number;
  nombre: string;
  email: string;
  rol: "admin" | "vendedor";
  activo: boolean;
}

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<UsuarioRow[]>([]);
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [rol, setRol] = useState<"admin" | "vendedor">("vendedor");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const cargar = useCallback(() => {
    fetch("/api/usuarios", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.data) setUsuarios(d.data);
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
      const res = await fetch("/api/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombre.trim(),
          email: email.trim(),
          rol,
          password,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setMsg({ type: "err", text: data?.error?.message || "No se pudo crear el usuario." });
      } else {
        setNombre("");
        setEmail("");
        setPassword("");
        setMsg({ type: "ok", text: "Usuario creado correctamente." });
        cargar();
      }
    } finally {
      setSaving(false);
    }
  }

  async function toggleActivo(u: UsuarioRow) {
    setMsg(null);
    const res = await fetch("/api/usuarios/" + u.id, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: !u.activo }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setMsg({ type: "err", text: data?.error?.message || "No se pudo actualizar el usuario." });
    } else {
      cargar();
    }
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Usuarios</h2>
          <p className="text-sm text-slate-500">Administración de cuentas y roles del sistema.</p>
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

        <form onSubmit={handleCreate} className="bg-white rounded-xl border border-slate-200 p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Nombre</label>
            <input
              type="text"
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Rol</label>
            <select
              value={rol}
              onChange={(e) => setRol(e.target.value as "admin" | "vendedor")}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
            >
              <option value="vendedor">Vendedor</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Contraseña (mín. 8)</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
          >
            {saving ? "Creando..." : "Crear usuario"}
          </button>
        </form>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500 uppercase">
                  <th className="py-3 px-4">Nombre</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Rol</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {usuarios.map((u) => (
                  <tr key={u.id}>
                    <td className="py-3 px-4 font-medium text-slate-900">{u.nombre}</td>
                    <td className="py-3 px-4 text-slate-600">{u.email}</td>
                    <td className="py-3 px-4 capitalize">{u.rol}</td>
                    <td className="py-3 px-4">
                      <span
                        className={
                          u.activo
                            ? "px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800"
                            : "px-2 py-0.5 rounded-full text-xs font-medium bg-slate-200 text-slate-700"
                        }
                      >
                        {u.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => toggleActivo(u)}
                        className="text-xs font-medium text-blue-600 hover:underline"
                      >
                        {u.activo ? "Desactivar" : "Activar"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
