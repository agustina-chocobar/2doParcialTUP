import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  clientes,
  facturaItems,
  facturas,
  movimientosCuenta,
  productos,
} from "@/db/schema";
import { SessionUser } from "@/lib/auth";
import { toArgDateKey } from "@/lib/format";

function getLast30ArgDateKeys(): string[] {
  const keys: string[] = [];
  const now = Date.now();
  for (let i = 29; i >= 0; i--) {
    keys.push(toArgDateKey(new Date(now - i * 24 * 60 * 60 * 1000)));
  }
  return keys;
}

export async function obtenerTableroService(_currentUser: SessionUser) {
  const hoyKey = toArgDateKey(new Date());
  const mesPrefix = hoyKey.slice(0, 7);
  const diasKeys = getLast30ArgDateKeys();
  const inicio30Dias = diasKeys[0] + "T00:00:00.000Z";

  const emitidasRows = await db
    .select({
      id: facturas.id,
      fecha: facturas.fecha,
      total: facturas.total,
      formaPago: facturas.formaPago,
    })
    .from(facturas)
    .where(and(eq(facturas.estado, "emitida"), gte(facturas.fecha, inicio30Dias)));

  let hoyCantidad = 0;
  let hoyImporte = 0;
  let mesCantidad = 0;
  let mesImporte = 0;

  const ventasPorDiaMap = new Map<string, number>();
  for (const k of diasKeys) {
    ventasPorDiaMap.set(k, 0);
  }

  const porFormaMap = new Map<string, number>([
    ["contado", 0],
    ["tarjeta", 0],
    ["cuenta_corriente", 0],
  ]);

  const idsMesEmitidas: number[] = [];

  for (const f of emitidasRows) {
    const dayKey = toArgDateKey(f.fecha);
    if (ventasPorDiaMap.has(dayKey)) {
      ventasPorDiaMap.set(dayKey, (ventasPorDiaMap.get(dayKey) || 0) + f.total);
    }
    if (dayKey === hoyKey) {
      hoyCantidad += 1;
      hoyImporte += f.total;
    }
    if (dayKey.startsWith(mesPrefix)) {
      mesCantidad += 1;
      mesImporte += f.total;
      idsMesEmitidas.push(f.id);
      porFormaMap.set(f.formaPago, (porFormaMap.get(f.formaPago) || 0) + f.total);
    }
  }

  const clientesActivos = await db
    .select({ id: clientes.id })
    .from(clientes)
    .where(eq(clientes.activo, true));

  let totalAdeudado = 0;
  let clientesConSaldo = 0;

  for (const c of clientesActivos) {
    const [row] = await db
      .select({
        saldo: sql<number>`coalesce(sum(case when ${movimientosCuenta.tipo} = 'debito' then ${movimientosCuenta.importe} else -${movimientosCuenta.importe} end), 0)`,
      })
      .from(movimientosCuenta)
      .where(eq(movimientosCuenta.clienteId, c.id));
    const saldo = Number(row?.saldo || 0);
    if (saldo > 0) {
      totalAdeudado += saldo;
      clientesConSaldo += 1;
    }
  }

  const [{ bajoMinimoCount }] = await db
    .select({ bajoMinimoCount: sql<number>`count(*)` })
    .from(productos)
    .where(
      and(
        eq(productos.activo, true),
        lte(productos.existencia, productos.stockMinimo)
      )
    );

  const ticketPromedio =
    mesCantidad > 0 ? Math.round(mesImporte / mesCantidad) : 0;

  const inicioMesIso = mesPrefix + "-01T00:00:00.000Z";
  const masVendidosRaw = await db
    .select({
      productoId: productos.id,
      codigo: productos.codigo,
      descripcion: productos.descripcion,
      unidades: sql<number>`coalesce(sum(${facturaItems.cantidad}), 0)`,
      importe: sql<number>`coalesce(sum(${facturaItems.subtotal}), 0)`,
    })
    .from(facturaItems)
    .innerJoin(facturas, eq(facturaItems.facturaId, facturas.id))
    .innerJoin(productos, eq(facturaItems.productoId, productos.id))
    .where(and(eq(facturas.estado, "emitida"), gte(facturas.fecha, inicioMesIso)))
    .groupBy(productos.id, productos.codigo, productos.descripcion)
    .orderBy(desc(sql`sum(${facturaItems.cantidad})`))
    .limit(5);

  return {
    hoy: { cantidad: hoyCantidad, importe: hoyImporte },
    mes: { cantidad: mesCantidad, importe: mesImporte, ticketPromedio },
    cuentasCorrientes: { totalAdeudado, clientesConSaldo },
    bajoMinimo: { cantidad: Number(bajoMinimoCount || 0) },
    ventasDiarias: diasKeys.map((fecha) => ({
      fecha,
      importe: ventasPorDiaMap.get(fecha) || 0,
    })),
    porFormaDePago: Array.from(porFormaMap.entries()).map(([forma, importe]) => ({
      forma,
      importe,
    })),
    masVendidos: masVendidosRaw.map((m) => ({
      productoId: m.productoId,
      codigo: m.codigo,
      descripcion: m.descripcion,
      unidades: Number(m.unidades || 0),
      importe: Number(m.importe || 0),
    })),
  };
}
