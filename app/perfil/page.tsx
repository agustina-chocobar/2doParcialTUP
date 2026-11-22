"use client";

import React, { useState } from "react";
import { AppShell } from "@/components/AppShell";

export default function PerfilPage() {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [statusMsg, setStatusMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatusMsg(null);

    if (nueva !== confirmar) {
      setStatusMsg({ type: "err", text: "La nueva contraseña y su confirmación no coinciden." });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/auth/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actual, nueva }),
      });

      if (res.status === 204 || res.ok) {
        setActual("");
        setNueva("");
        setConfirmar("");
        setStatusMsg({ type: "ok", text: "Contraseña actualizada correctamente." });
      } else {
        const data = await res.json().catch(() => null);
        setStatusMsg({ type: "err", text: data?.error?.message || "No se pudo cambiar la contraseña." });
      }
    } catch {
      setStatusMsg({ type: "err", text: "Error de conexión con el servidor." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <div className="max-w-lg mx-auto bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-xl font-bold text-slate-900">Cambiar contraseña</h2>
        <p className="text-sm text-slate-500 mt-1">
          Actualizá tu contraseña de acceso (mínimo 8 caracteres).
        </p>

        {statusMsg && (
          <div
            className={
              statusMsg.type === "ok"
                ? "mt-4 p-3 rounded-lg text-sm border bg-emerald-50 border-emerald-200 text-emerald-800"
                : "mt-4 p-3 rounded-lg text-sm border bg-red-50 border-red-200 text-red-700"
            }
          >
            {statusMsg.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label htmlFor="actual" className="block text-sm font-medium text-slate-700 mb-1">
              Contraseña actual
            </label>
            <input
              id="actual"
              type="password"
              required
              value={actual}
              onChange={(e) => setActual(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
            />
          </div>

          <div>
            <label htmlFor="nueva" className="block text-sm font-medium text-slate-700 mb-1">
              Nueva contraseña
            </label>
            <input
              id="nueva"
              type="password"
              required
              minLength={8}
              value={nueva}
              onChange={(e) => setNueva(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
            />
          </div>

          <div>
            <label htmlFor="confirmar" className="block text-sm font-medium text-slate-700 mb-1">
              Confirmar nueva contraseña
            </label>
            <input
              id="confirmar"
              type="password"
              required
              minLength={8}
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium"
          >
            {saving ? "Guardando..." : "Guardar contraseña"}
          </button>
        </form>
      </div>
    </AppShell>
  );
}
