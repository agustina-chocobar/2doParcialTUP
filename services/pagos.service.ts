import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { clientes, movimientosCuenta, pagos, usuarios } from "@/db/schema";
import { ApiError } from "@/lib/api-error";
import { SessionUser } from "@/lib/auth";
import { formatNumeroRecibo } from "@/lib/format";
import { parseWithSchema } from "@/lib/validation-helper";
import { createPagoSchema } from "@/lib/validators/clientes.schema";
import { calcularSaldoCliente } from "@/services/clientes.service";

export async function registrarPagoService(
  currentUser: SessionUser,
  clienteId: number,
  input: unknown,
  fechaOverride?: string
) {
  const data = parseWithSchema(createPagoSchema, input);

  return db.transaction(async (tx) => {
    const [cliente] = await tx
      .select()
      .from(clientes)
      .where(eq(clientes.id, clienteId))
      .limit(1);

    if (!cliente || !cliente.activo) {
      throw new ApiError(404, "NO_ENCONTRADO", "Cliente no encontrado.");
    }

    if (!cliente.cuentaCorriente) {
      throw new ApiError(
        422,
        "CUENTA_CORRIENTE_NO_HABILITADA",
        "El cliente no tiene cuenta corriente habilitada."
      );
    }

    const saldoActual = await calcularSaldoCliente(tx, clienteId);

    if (data.importe > saldoActual) {
      throw new ApiError(
        422,
        "PAGO_SUPERA_DEUDA",
        "El importe del pago supera la deuda actual del cliente."
      );
    }

    const [{ maxId }] = await tx
      .select({ maxId: sql<number>`coalesce(max(${pagos.id}), 0)` })
      .from(pagos);
    const numeroRecibo = formatNumeroRecibo(1, Number(maxId || 0) + 1);
    const now = fechaOverride || new Date().toISOString();

    const [pago] = await tx
      .insert(pagos)
      .values({
        numeroRecibo,
        fecha: now,
        importe: data.importe,
        medio: data.medio,
        observacion: data.observacion || "",
        clienteId,
        usuarioId: currentUser.id,
        createdAt: now,
      })
      .returning();

    await tx.insert(movimientosCuenta).values({
      clienteId,
      pagoId: pago.id,
      facturaId: null,
      tipo: "credito",
      importe: data.importe,
      fecha: now,
      descripcion: `Recibo ${numeroRecibo}`,
      createdAt: now,
    });

    const saldoCliente = saldoActual - data.importe;

    return {
      id: pago.id,
      numeroRecibo: pago.numeroRecibo,
      fecha: pago.fecha,
      cliente: { id: cliente.id, nombre: cliente.nombre },
      importe: pago.importe,
      medio: pago.medio,
      observacion: pago.observacion,
      usuario: { id: currentUser.id, nombre: currentUser.nombre },
      saldoCliente,
    };
  });
}

export async function obtenerPagoService(
  _currentUser: SessionUser,
  pagoId: number
) {
  const [row] = await db
    .select({
      id: pagos.id,
      numeroRecibo: pagos.numeroRecibo,
      fecha: pagos.fecha,
      importe: pagos.importe,
      medio: pagos.medio,
      observacion: pagos.observacion,
      clienteId: clientes.id,
      clienteNombre: clientes.nombre,
      usuarioId: usuarios.id,
      usuarioNombre: usuarios.nombre,
    })
    .from(pagos)
    .innerJoin(clientes, eq(pagos.clienteId, clientes.id))
    .innerJoin(usuarios, eq(pagos.usuarioId, usuarios.id))
    .where(eq(pagos.id, pagoId))
    .limit(1);

  if (!row) {
    throw new ApiError(404, "NO_ENCONTRADO", "Recibo de pago no encontrado.");
  }

  const saldoCliente = await calcularSaldoCliente(db, row.clienteId);

  return {
    id: row.id,
    numeroRecibo: row.numeroRecibo,
    fecha: row.fecha,
    cliente: { id: row.clienteId, nombre: row.clienteNombre },
    importe: row.importe,
    medio: row.medio,
    observacion: row.observacion,
    usuario: { id: row.usuarioId, nombre: row.usuarioNombre },
    saldoCliente,
  };
}