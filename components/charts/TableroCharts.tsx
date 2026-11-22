"use client";

import React from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";
import { formatDateArg, formatMoneyFromCents } from "@/lib/format";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

export function VentasDiariasChart({ data }: { data: Array<{ fecha: string; importe: number }> }) {
  const labels = data.map((d) => formatDateArg(d.fecha + "T12:00:00Z").slice(0, 5));
  const values = data.map((d) => d.importe / 100);

  return (
    <div className="h-64">
      <Bar
        data={{
          labels,
          datasets: [{ label: "Ventas ($)", data: values, backgroundColor: "#2563eb", borderRadius: 4 }],
        }}
        options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }}
      />
    </div>
  );
}

const FORMA_LABELS: Record<string, string> = {
  contado: "Contado",
  tarjeta: "Tarjeta",
  cuenta_corriente: "Cuenta corriente",
};

export function VentasPorFormaChart({ data }: { data: Array<{ forma: string; importe: number }> }) {
  const labels = data.map((d) => FORMA_LABELS[d.forma] || d.forma);
  const values = data.map((d) => d.importe / 100);

  return (
    <div className="h-64">
      <Doughnut
        data={{
          labels,
          datasets: [{ data: values, backgroundColor: ["#10b981", "#3b82f6", "#f59e0b"], borderWidth: 1 }],
        }}
        options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } }}
      />
    </div>
  );
}

export function TopProductosChart({
  data,
}: {
  data: Array<{ productoId: number; codigo: string; descripcion: string; unidades: number; importe: number }>;
}) {
  const labels = data.map((d) => d.codigo);
  const values = data.map((d) => d.unidades);

  return (
    <div className="h-64">
      <Bar
        data={{
          labels,
          datasets: [{ label: "Unidades vendidas", data: values, backgroundColor: "#0f172a", borderRadius: 4 }],
        }}
        options={{
          indexAxis: "y",
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { x: { beginAtZero: true, ticks: { precision: 0 } } },
        }}
      />
    </div>
  );
}

export function TopProductosTabla({
  data,
}: {
  data: Array<{ productoId: number; codigo: string; descripcion: string; unidades: number; importe: number }>;
}) {
  if (data.length === 0) {
    return <p className="text-sm text-slate-500 mt-3">Sin ventas registradas en el mes en curso.</p>;
  }

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead>
          <tr className="border-b border-slate-200 text-xs text-slate-500 uppercase">
            <th className="py-2 pr-3">Producto</th>
            <th className="py-2 px-3 text-right">Unidades</th>
            <th className="py-2 pl-3 text-right">Importe</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.map((item) => (
            <tr key={item.productoId}>
              <td className="py-2 pr-3">
                <span className="font-mono text-xs text-slate-500 mr-2">{item.codigo}</span>
                <span className="text-slate-800">{item.descripcion}</span>
              </td>
              <td className="py-2 px-3 text-right font-medium">{item.unidades}</td>
              <td className="py-2 pl-3 text-right font-medium">{formatMoneyFromCents(item.importe)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
