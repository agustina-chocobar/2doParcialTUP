import { and, desc, eq, gte, inArray, like, lte, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  clientes,
  facturaItems,
  facturas,
  movimientosCuenta,
  productos,
  usuarios,
} from "@/db/schema";
import { ApiError } from "@/lib/api-error";
import { assertAdmin, SessionUser } from "@/lib/auth";
import { formatNumeroFactura } from "@/lib/format";
import { parseWithSchema } from "@/lib/validation-helper";
import {
  anularFacturaSchema,
  createFacturaSchema,
} from "@/lib/validators/facturas.schema";
import { calcularSaldoCliente } from "@/services/clientes.service";
import { moverStock } from "@/services/stock.service";

const PUNTO_VENTA = 1;

export async function obtenerProximoNumeroFacturaService(
  _currentUser: SessionUser
) {
  const [{ maxNum }] = await db
    .select({ maxNum: sql<number>`coalesce(max(${facturas.numero}), 0)` })
    .from(facturas)
    .where(eq(facturas.puntoVenta, PUNTO_VENTA));

  const siguiente = Number(maxNum || 0) + 1;
  return {
    numeroFormateado: formatNumeroFactura(PUNTO_VENTA, siguiente),
  };
}

export async function crearFacturaService(
  currentUser: SessionUser,
  input: unknown,
  fechaOverride?: string
) {
  const data = parseWithSchema(createFacturaSchema, input);

  const idsUnicos = new Set(data.items.map((i) => i.productoId));
  if (idsUnicos.size !== data.items.length) {
    throw new ApiError(
      422,
      "VALIDACION",
      "No se permiten productos repetidos en los renglones."
    );
  }

  return db.transaction(async (tx) => {
    const prodRows = await tx
      .select()
      .from(productos)
      .where(inArray(productos.id, Array.from(idsUnicos)));

    if (prodRows.length !== idsUnicos.size) {
      throw new ApiError(
        404,
        "NO_ENCONTRADO",
        "Uno o más productos no existen."
      );
    }

    const prodMap = new Map(prodRows.map((p) => [p.id, p]));
    const insuficientes: Array<{
      productoId: number;
      solicitado: number;
      disponible: number;
    }> = [];

    let total = 0;
    const renglonesPreparados = data.items.map((item) => {
      const prod = prodMap.get(item.productoId)!;
      if (!prod.activo) {
        throw new ApiError(
          422,
          "PRODUCTO_INACTIVO",
          `El producto ${prod.codigo} está dado de baja.`
        );
      }
      if (prod.existencia < item.cantidad) {
        insuficientes.push({
          productoId: prod.id,
          solicitado: item.cantidad,
          disponible: prod.existencia,
        });
      }
      const subtotal = prod.precio * item.cantidad;
      total += subtotal;
      return {
        productoId: prod.id,
        codigo: prod.codigo,
        descripcion: prod.descripcion,
        cantidad: item.cantidad,
        precioUnitario: prod.precio,
        subtotal,
      };
    });

    if (insuficientes.length > 0) {
      throw new ApiError(
        409,
        "STOCK_INSUFICIENTE",
        "Stock insuficiente para completar la venta.",
        insuficientes
      );
    }

    let clienteRow: typeof clientes.$inferSelect | null = null;
    if (data.clienteId !== null) {
      const [found] = await tx
        .select()
        .from(clientes)
        .where(eq(clientes.id, data.clienteId))
        .limit(1);

      if (!found || !found.activo) {
        throw new ApiError(
          404,
          "NO_ENCONTRADO",
          "El cliente seleccionado no existe o está inactivo."
        );
      }
      clienteRow = found;
    }

    let saldoNuevo: number | undefined;

    if (data.pago.forma === "cuenta_corriente") {
      if (!clienteRow || !clienteRow.cuentaCorriente) {
        throw new ApiError(
          422,
          "CUENTA_CORRIENTE_NO_HABILITADA",
          "El comprador debe ser un cliente registrado con cuenta corriente habilitada."
        );
      }

      const saldoActual = await calcularSaldoCliente(tx, clienteRow.id);
      saldoNuevo = saldoActual + total;
      if (
        clienteRow.limiteCredito !== null &&
        saldoNuevo > clienteRow.limiteCredito
      ) {
        throw new ApiError(
          422,
          "LIMITE_CREDITO_EXCEDIDO",
          "La venta supera el límite de crédito del cliente.",
          [
            {
              saldoActual,
              limite: clienteRow.limiteCredito,
              excedente: saldoNuevo - clienteRow.limiteCredito,
            },
          ]
        );
      }
    }

    let montoRecibido: number | null = null;
    if (data.pago.forma === "contado") {
      montoRecibido = data.pago.montoRecibido ?? total;
      if (montoRecibido < total) {
        throw new ApiError(
          422,
          "MONTO_INSUFICIENTE",
          "El monto recibido no cubre el total de la factura."
        );
      }
    }

    const [{ maxNum }] = await tx
      .select({ maxNum: sql<number>`coalesce(max(${facturas.numero}), 0)` })
      .from(facturas)
      .where(eq(facturas.puntoVenta, PUNTO_VENTA));
    const numero = Number(maxNum || 0) + 1;
    const numeroFormateado = formatNumeroFactura(PUNTO_VENTA, numero);
    const now = fechaOverride || new Date().toISOString();

    const [factura] = await tx
      .insert(facturas)
      .values({
        puntoVenta: PUNTO_VENTA,
        numero,
        fecha: now,
        total,
        formaPago: data.pago.forma,
        tarjetaTipo:
          data.pago.forma === "tarjeta" ? data.pago.tarjeta.tipo : null,
        tarjetaMarca:
          data.pago.forma === "tarjeta" ? data.pago.tarjeta.marca : null,
        tarjetaUltimos4:
          data.pago.forma === "tarjeta" ? data.pago.tarjeta.ultimos4 : null,
        montoRecibido,
        estado: "emitida",
        clienteId: clienteRow ? clienteRow.id : null,
        usuarioId: currentUser.id,
        createdAt: now,
      })
      .returning();

    for (const item of renglonesPreparados) {
      await tx.insert(facturaItems).values({
        facturaId: factura.id,
        productoId: item.productoId,
        cantidad: item.cantidad,
        precioUnitario: item.precioUnitario,
        subtotal: item.subtotal,
        descripcion: item.descripcion,
        createdAt: now,
      });

      await moverStock(tx, {
        productoId: item.productoId,
        tipo: "venta",
        cantidadDelta: -item.cantidad,
        motivo: `Venta ${numeroFormateado}`,
        usuarioId: currentUser.id,
        facturaId: factura.id,
        fecha: now,
      });
    }

    if (data.pago.forma === "cuenta_corriente" && clienteRow) {
      await tx.insert(movimientosCuenta).values({
        clienteId: clienteRow.id,
        facturaId: factura.id,
        pagoId: null,
        tipo: "debito",
        importe: total,
        fecha: now,
        descripcion: `Factura ${numeroFormateado}`,
        createdAt: now,
      });
    }

    return {
      id: factura.id,
      puntoVenta: PUNTO_VENTA,
      numero,
      numeroFormateado,
      fecha: now,
      estado: "emitida" as const,
      cliente: clienteRow
        ? {
            id: clienteRow.id,
            nombre: clienteRow.nombre,
            tipoDoc: clienteRow.tipoDoc,
            nroDoc: clienteRow.nroDoc,
            domicilio: clienteRow.domicilio,
          }
        : null,
      vendedor: { id: currentUser.id, nombre: currentUser.nombre },
      items: renglonesPreparados,
      total,
      pago:
        data.pago.forma === "contado"
          ? {
              forma: "contado" as const,
              montoRecibido: montoRecibido!,
              vuelto: montoRecibido! - total,
            }
          : data.pago.forma === "tarjeta"
          ? {
              forma: "tarjeta" as const,
              tarjeta: data.pago.tarjeta,
            }
          : {
              forma: "cuenta_corriente" as const,
            },
      ...(saldoNuevo !== undefined ? { saldoCliente: saldoNuevo } : {}),
    };
  });
}

export async function listarFacturasService(
  _currentUser: SessionUser,
  params: {
    q?: string;
    desde?: string;
    hasta?: string;
    clienteId?: number;
    vendedorId?: number;
    forma?: string;
    estado?: string;
    page?: number;
    pageSize?: number;
  }
) {
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize || 20));
  const offset = (page - 1) * pageSize;

  const filters = [];
  if (params.desde) {
    filters.push(gte(facturas.fecha, `${params.desde}T00:00:00.000Z`));
  }
  if (params.hasta) {
    filters.push(lte(facturas.fecha, `${params.hasta}T23:59:59.999Z`));
  }
  if (params.clienteId) {
    filters.push(eq(facturas.clienteId, params.clienteId));
  }
  if (params.vendedorId) {
    filters.push(eq(facturas.usuarioId, params.vendedorId));
  }
  if (params.forma) {
    filters.push(eq(facturas.formaPago, params.forma));
  }
  if (params.estado) {
    filters.push(eq(facturas.estado, params.estado));
  }
  if (params.q && params.q.trim()) {
    const term = `%${params.q.trim()}%`;
    const numSolo = Number(params.q.trim().replace(/^0001-0*/, ""));
    filters.push(
      or(
        like(clientes.nombre, term),
        ...(Number.isInteger(numSolo) && numSolo > 0
          ? [eq(facturas.numero, numSolo)]
          : [])
      )
    );
  }

  const whereClause = filters.length > 0 ? and(...filters) : undefined;

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(facturas)
    .leftJoin(clientes, eq(facturas.clienteId, clientes.id))
    .where(whereClause);

  const [{ totalEmitido }] = await db
    .select({
      totalEmitido: sql<number>`coalesce(sum(case when ${facturas.estado} = 'emitida' then ${facturas.total} else 0 end), 0)`,
    })
    .from(facturas)
    .leftJoin(clientes, eq(facturas.clienteId, clientes.id))
    .where(whereClause);

  const rows = await db
    .select({
      id: facturas.id,
      puntoVenta: facturas.puntoVenta,
      numero: facturas.numero,
      fecha: facturas.fecha,
      total: facturas.total,
      formaPago: facturas.formaPago,
      estado: facturas.estado,
      clienteId: clientes.id,
      clienteNombre: clientes.nombre,
      vendedorId: usuarios.id,
      vendedorNombre: usuarios.nombre,
    })
    .from(facturas)
    .leftJoin(clientes, eq(facturas.clienteId, clientes.id))
    .innerJoin(usuarios, eq(facturas.usuarioId, usuarios.id))
    .where(whereClause)
    .orderBy(desc(facturas.fecha), desc(facturas.id))
    .limit(pageSize)
    .offset(offset);

  return {
    data: rows.map((r) => ({
      id: r.id,
      numeroFormateado: formatNumeroFactura(r.puntoVenta, r.numero),
      fecha: r.fecha,
      cliente: r.clienteId
        ? { id: r.clienteId, nombre: r.clienteNombre }
        : null,
      vendedor: { id: r.vendedorId, nombre: r.vendedorNombre },
      formaPago: r.formaPago,
      total: r.total,
      estado: r.estado,
    })),
    page,
    pageSize,
    total: Number(count || 0),
    totalEmitido: Number(totalEmitido || 0),
  };
}

export async function obtenerFacturaService(
  _currentUser: SessionUser,
  id: number
) {
  const [f] = await db
    .select({
      id: facturas.id,
      puntoVenta: facturas.puntoVenta,
      numero: facturas.numero,
      fecha: facturas.fecha,
      total: facturas.total,
      formaPago: facturas.formaPago,
      tarjetaTipo: facturas.tarjetaTipo,
      tarjetaMarca: facturas.tarjetaMarca,
      tarjetaUltimos4: facturas.tarjetaUltimos4,
      montoRecibido: facturas.montoRecibido,
      estado: facturas.estado,
      motivoAnulacion: facturas.motivoAnulacion,
      anuladaAt: facturas.anuladaAt,
      anuladaPorId: facturas.anuladaPorId,
      clienteId: clientes.id,
      clienteNombre: clientes.nombre,
      clienteTipoDoc: clientes.tipoDoc,
      clienteNroDoc: clientes.nroDoc,
      clienteDomicilio: clientes.domicilio,
      vendedorId: usuarios.id,
      vendedorNombre: usuarios.nombre,
    })
    .from(facturas)
    .leftJoin(clientes, eq(facturas.clienteId, clientes.id))
    .innerJoin(usuarios, eq(facturas.usuarioId, usuarios.id))
    .where(eq(facturas.id, id))
    .limit(1);

  if (!f) {
    throw new ApiError(404, "NO_ENCONTRADO", "Factura no encontrada.");
  }

  const itemsRows = await db
    .select({
      productoId: facturaItems.productoId,
      codigo: productos.codigo,
      descripcion: facturaItems.descripcion,
      cantidad: facturaItems.cantidad,
      precioUnitario: facturaItems.precioUnitario,
      subtotal: facturaItems.subtotal,
    })
    .from(facturaItems)
    .innerJoin(productos, eq(facturaItems.productoId, productos.id))
    .where(eq(facturaItems.facturaId, id));

  let anulacionUsuario: { id: number; nombre: string } | null = null;
  if (f.estado === "anulada" && f.anuladaPorId) {
    const [uAnul] = await db
      .select({ id: usuarios.id, nombre: usuarios.nombre })
      .from(usuarios)
      .where(eq(usuarios.id, f.anuladaPorId))
      .limit(1);
    if (uAnul) anulacionUsuario = uAnul;
  }

  return {
    id: f.id,
    puntoVenta: f.puntoVenta,
    numero: f.numero,
    numeroFormateado: formatNumeroFactura(f.puntoVenta, f.numero),
    fecha: f.fecha,
    estado: f.estado,
    cliente: f.clienteId
      ? {
          id: f.clienteId,
          nombre: f.clienteNombre!,
          tipoDoc: f.clienteTipoDoc!,
          nroDoc: f.clienteNroDoc!,
          domicilio: f.clienteDomicilio || "",
        }
      : null,
    vendedor: { id: f.vendedorId, nombre: f.vendedorNombre },
    items: itemsRows,
    total: f.total,
    pago:
      f.formaPago === "contado"
        ? {
            forma: "contado",
            montoRecibido: f.montoRecibido ?? f.total,
            vuelto: (f.montoRecibido ?? f.total) - f.total,
          }
        : f.formaPago === "tarjeta"
        ? {
            forma: "tarjeta",
            tarjeta: {
              tipo: f.tarjetaTipo,
              marca: f.tarjetaMarca,
              ultimos4: f.tarjetaUltimos4,
            },
          }
        : { forma: "cuenta_corriente" },
    ...(f.estado === "anulada"
      ? {
          anulacion: {
            fecha: f.anuladaAt,
            usuario: anulacionUsuario,
            motivo: f.motivoAnulacion,
          },
        }
      : {}),
  };
}

export async function anularFacturaService(
  currentUser: SessionUser,
  id: number,
  input: unknown
) {
  assertAdmin(currentUser);
  const data = parseWithSchema(anularFacturaSchema, input);

  await db.transaction(async (tx) => {
    const [factura] = await tx
      .select()
      .from(facturas)
      .where(eq(facturas.id, id))
      .limit(1);

    if (!factura) {
      throw new ApiError(404, "NO_ENCONTRADO", "Factura no encontrada.");
    }

    if (factura.estado === "anulada") {
      throw new ApiError(
        409,
        "FACTURA_ANULADA",
        "La factura ya se encuentra anulada."
      );
    }

    const numeroFormateado = formatNumeroFactura(
      factura.puntoVenta,
      factura.numero
    );
    const now = new Date().toISOString();

    await tx
      .update(facturas)
      .set({
        estado: "anulada",
        motivoAnulacion: data.motivo,
        anuladaAt: now,
        anuladaPorId: currentUser.id,
      })
      .where(eq(facturas.id, id));

    const items = await tx
      .select()
      .from(facturaItems)
      .where(eq(facturaItems.facturaId, id));

    for (const item of items) {
      await moverStock(tx, {
        productoId: item.productoId,
        tipo: "anulacion",
        cantidadDelta: item.cantidad,
        motivo: `Anulación ${numeroFormateado}`,
        usuarioId: currentUser.id,
        facturaId: factura.id,
        fecha: now,
      });
    }

    if (factura.formaPago === "cuenta_corriente" && factura.clienteId) {
      await tx.insert(movimientosCuenta).values({
        clienteId: factura.clienteId,
        facturaId: factura.id,
        pagoId: null,
        tipo: "credito",
        importe: factura.total,
        fecha: now,
        descripcion: `Anulación factura ${numeroFormateado}`,
        createdAt: now,
      });
    }
  });

  return obtenerFacturaService(currentUser, id);
}