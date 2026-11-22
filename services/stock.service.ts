import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db, DbClient } from "@/db";
import {
  facturas,
  movimientosStock,
  productos,
  usuarios,
} from "@/db/schema";
import { ApiError } from "@/lib/api-error";
import { assertAdmin, SessionUser } from "@/lib/auth";
import { formatNumeroFactura } from "@/lib/format";
import { parseWithSchema } from "@/lib/validation-helper";
import { createMovimientoStockSchema } from "@/lib/validators/productos.schema";

export type TipoMovimientoStock = "venta" | "anulacion" | "ingreso" | "egreso";

export interface MoverStockParams {
  productoId: number;
  tipo: TipoMovimientoStock;
  cantidadDelta: number;
  motivo: string;
  usuarioId: number;
  facturaId?: number | null;
  fecha?: string;
}

export async function moverStock(
  tx: Parameters<Parameters<DbClient["transaction"]>[0]>[0] | DbClient,
  params: MoverStockParams
) {
  if (!Number.isInteger(params.cantidadDelta) || params.cantidadDelta === 0) {
    throw new ApiError(
      422,
      "VALIDACION",
      "La cantidad del movimiento debe ser distinta de cero."
    );
  }

  const [prod] = await tx
    .select({
      id: productos.id,
      codigo: productos.codigo,
      existencia: productos.existencia,
    })
    .from(productos)
    .where(eq(productos.id, params.productoId))
    .limit(1);

  if (!prod) {
    throw new ApiError(404, "NO_ENCONTRADO", "Producto no encontrado.");
  }

  if (params.cantidadDelta < 0) {
    const requerido = Math.abs(params.cantidadDelta);
    const updatedRows = await tx
      .update(productos)
      .set({
        existencia: sql`${productos.existencia} - ${requerido}`,
      })
      .where(
        and(
          eq(productos.id, params.productoId),
          gte(productos.existencia, requerido)
        )
      )
      .returning({
        id: productos.id,
        codigo: productos.codigo,
        existencia: productos.existencia,
      });

    if (updatedRows.length === 0) {
      throw new ApiError(
        409,
        "STOCK_INSUFICIENTE",
        `Stock insuficiente para ${prod.codigo}.`,
        [
          {
            productoId: prod.id,
            solicitado: requerido,
            disponible: prod.existencia,
          },
        ]
      );
    }

    const existenciaResultante = updatedRows[0].existencia;
    const now = params.fecha || new Date().toISOString();

    const [mov] = await tx
      .insert(movimientosStock)
      .values({
        productoId: params.productoId,
        usuarioId: params.usuarioId,
        facturaId: params.facturaId ?? null,
        tipo: params.tipo,
        cantidad: params.cantidadDelta,
        existenciaResultante,
        motivo: params.motivo,
        fecha: now,
        createdAt: now,
      })
      .returning();

    return {
      movimiento: mov,
      producto: updatedRows[0],
      existenciaResultante,
    };
  } else {
    const updatedRows = await tx
      .update(productos)
      .set({
        existencia: sql`${productos.existencia} + ${params.cantidadDelta}`,
      })
      .where(eq(productos.id, params.productoId))
      .returning({
        id: productos.id,
        codigo: productos.codigo,
        existencia: productos.existencia,
      });

    const existenciaResultante = updatedRows[0].existencia;
    const now = params.fecha || new Date().toISOString();

    const [mov] = await tx
      .insert(movimientosStock)
      .values({
        productoId: params.productoId,
        usuarioId: params.usuarioId,
        facturaId: params.facturaId ?? null,
        tipo: params.tipo,
        cantidad: params.cantidadDelta,
        existenciaResultante,
        motivo: params.motivo,
        fecha: now,
        createdAt: now,
      })
      .returning();

    return {
      movimiento: mov,
      producto: updatedRows[0],
      existenciaResultante,
    };
  }
}

export async function registrarMovimientoManualService(
  currentUser: SessionUser,
  productoId: number,
  input: unknown
) {
  assertAdmin(currentUser);
  const data = parseWithSchema(createMovimientoStockSchema, input);

  const motivoCompleto = data.observacion
    ? `${data.motivo} - ${data.observacion}`
    : data.motivo;

  const delta = data.tipo === "ingreso" ? data.cantidad : -data.cantidad;

  return db.transaction(async (tx) => {
    const res = await moverStock(tx, {
      productoId,
      tipo: data.tipo,
      cantidadDelta: delta,
      motivo: motivoCompleto,
      usuarioId: currentUser.id,
    });

    return {
      id: res.movimiento.id,
      producto: { id: res.producto.id, codigo: res.producto.codigo },
      tipo: res.movimiento.tipo,
      cantidad: res.movimiento.cantidad,
      existenciaResultante: res.existenciaResultante,
      motivo: res.movimiento.motivo,
      referencia: null,
      usuario: { id: currentUser.id, nombre: currentUser.nombre },
      fecha: res.movimiento.fecha,
    };
  });
}

export async function listarMovimientosStockService(
  _currentUser: SessionUser,
  params: {
    productoId?: number;
    tipo?: string;
    desde?: string;
    hasta?: string;
    page?: number;
    pageSize?: number;
  }
) {
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize || 20));
  const offset = (page - 1) * pageSize;

  const filters = [];
  if (params.productoId) {
    filters.push(eq(movimientosStock.productoId, params.productoId));
  }
  if (params.tipo) {
    filters.push(eq(movimientosStock.tipo, params.tipo));
  }
  if (params.desde) {
    filters.push(
      gte(movimientosStock.fecha, `${params.desde}T00:00:00.000Z`)
    );
  }
  if (params.hasta) {
    filters.push(
      lte(movimientosStock.fecha, `${params.hasta}T23:59:59.999Z`)
    );
  }

  const whereClause = filters.length > 0 ? and(...filters) : undefined;

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(movimientosStock)
    .where(whereClause);

  const rows = await db
    .select({
      id: movimientosStock.id,
      tipo: movimientosStock.tipo,
      cantidad: movimientosStock.cantidad,
      existenciaResultante: movimientosStock.existenciaResultante,
      motivo: movimientosStock.motivo,
      fecha: movimientosStock.fecha,
      productoId: productos.id,
      productoCodigo: productos.codigo,
      productoDescripcion: productos.descripcion,
      usuarioId: usuarios.id,
      usuarioNombre: usuarios.nombre,
      facturaId: facturas.id,
      facturaPuntoVenta: facturas.puntoVenta,
      facturaNumero: facturas.numero,
    })
    .from(movimientosStock)
    .innerJoin(productos, eq(movimientosStock.productoId, productos.id))
    .innerJoin(usuarios, eq(movimientosStock.usuarioId, usuarios.id))
    .leftJoin(facturas, eq(movimientosStock.facturaId, facturas.id))
    .where(whereClause)
    .orderBy(desc(movimientosStock.fecha), desc(movimientosStock.id))
    .limit(pageSize)
    .offset(offset);

  return {
    data: rows.map((r) => ({
      id: r.id,
      producto: {
        id: r.productoId,
        codigo: r.productoCodigo,
        descripcion: r.productoDescripcion,
      },
      tipo: r.tipo,
      cantidad: r.cantidad,
      existenciaResultante: r.existenciaResultante,
      motivo: r.motivo,
      referencia:
        r.facturaId && r.facturaPuntoVenta && r.facturaNumero
          ? {
              facturaId: r.facturaId,
              numero: formatNumeroFactura(
                r.facturaPuntoVenta,
                r.facturaNumero
              ),
            }
          : null,
      usuario: { id: r.usuarioId, nombre: r.usuarioNombre },
      fecha: r.fecha,
    })),
    page,
    pageSize,
    total: Number(count || 0),
  };
}