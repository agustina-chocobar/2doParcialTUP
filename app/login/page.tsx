"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Mail } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submitCredentials(targetEmail: string, targetPassword: string) {
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail, password: targetPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error?.message || "Email o contraseña incorrectos.");
        setSubmitting(false);
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Error de conexión al iniciar sesión.");
      setSubmitting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await submitCredentials(email, password);
  }

  async function handleQuickLogin(demoEmail: string, demoPassword: string) {
    setEmail(demoEmail);
    setPassword(demoPassword);
    await submitCredentials(demoEmail, demoPassword);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-slate-900">Sistema de Gestión Comercial</h1>
          <p className="text-sm text-slate-500 mt-1">Ingresá con tu cuenta para continuar.</p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
              Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@comercio.test"
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
              Contraseña
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium text-sm transition-colors"
          >
            {submitting ? "Ingresando..." : "Ingresar"}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-100 space-y-3">
          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-600">Acceso rápido (modo demo):</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleQuickLogin("admin@comercio.test", "Admin1234!")}
                className="w-full py-2 px-3 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 disabled:opacity-60 text-blue-800 text-xs font-medium transition-colors"
              >
                Demo Administrador
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleQuickLogin("vendedor@comercio.test", "Vendedor1234!")}
                className="w-full py-2 px-3 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 disabled:opacity-60 text-slate-800 text-xs font-medium transition-colors"
              >
                Demo Vendedor
              </button>
            </div>
          </div>

          <div className="text-xs text-slate-500 space-y-1">
            <p className="font-medium text-slate-600">Usuarios de prueba:</p>
            <p>Admin: admin@comercio.test / Admin1234!</p>
            <p>Vendedor: vendedor@comercio.test / Vendedor1234!</p>
          </div>
        </div>
      </div>
    </div>
  );
}
