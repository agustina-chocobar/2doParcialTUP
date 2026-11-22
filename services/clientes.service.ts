import { and, asc, desc, eq, like, or, sql } from "drizzle-orm";
import { db, DbClient } from "@/db";
import { clientes, facturas, movimientosCuenta } from "@/db/schema";
import { ApiError } from "@/lib/api-error";
import { SessionUser } from "@/lib/auth";
import { formatNumeroFactura } from "@/lib/format";
import { parseWithSchema } from "@/lib/validation-helper";
import {
  createClienteSchema,
  updateClienteSchema,
} from "@/lib/validators/clientes.schema";

function normalizeDoc(nroDoc: string): string {
  return nroDoc.replace(/[.\-\s]/g, "");
}

export async function calcularSaldoCliente(
  tx: Parameters<Parameters<DbClient["transaction"]>[0]>[0] | DbClient,
  clienteId: number
): Promise<number> {
  const [row] = await tx
    .select({
      saldo: sql<number>`coalesce(sum(case when ${movimientosCuenta.tipo} = 'debito' then ${movimientosCuenta.importe} else -${movimientosCuenta.importe} end), 0)`,
    })
    .from(movimientosCuenta)
    .where(eq(movimientosCuenta.clienteId, clienteId));

  return Number(row?.saldo || 0);
}

export async function listarClientesService(
  _currentUser: SessionUser,
  params: {
    q?: string;
    conDeuda?: boolean;
    orden?: string;
    activo?: string;
    page?: number;
    pageSize?: number;
  }
) {
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize || 20));

  const filters = [];
  if (params.activo !== "todos") {
    filters.push(eq(clientes.activo, true));
  }
  if (params.q && params.q.trim()) {
    const term = `%${params.q.trim()}%`;
    const docNorm = `%${normalizeDoc(params.q.trim())}%`;
    filters.push(
      or(
        like(clientes.nombre, term),
        sql`replace(replace(replace(${clientes.nroDoc}, '.', ''), '-', ''), ' ', '') like ${docNorm}`
      )
    );
  }

  const whereClause = filters.length > 0 ? and(...filters) : undefined;
  const rows = await db
    .select()
    .from(clientes)
    .where(whereClause)
    .orderBy(asc(clientes.nombre));

  const enriched = await Promise.all(
    rows.map(async (c) => {
      const saldo = await calcularSaldoCliente(db, c.id);
      const disponible =
        c.cuentaCorriente && c.limiteCredito !== null
          ? c.limiteCredito - saldo
          : null;
      return {
        id: c.id,
        tipoDoc: c.tipoDoc,
        nroDoc: c.nroDoc,
        nombre: c.nombre,
        domicilio: c.domicilio,
        telefono: c.telefono,
        email: c.email,
        cuentaCorriente: c.cuentaCorriente,
        limiteCredito: c.limiteCredito,
        saldo,
        disponible,
        activo: c.activo,
      };
    })
  );

  let filtered = enriched;
  if (params.conDeuda) {
    filtered = filtered.filter((c) => c.saldo > 0);
  }

  if (params.orden === "saldo" || params.conDeuda) {
    filtered.sort((a, b) => b.saldo - a.saldo);
  }

  const totalAdeudado = filtered.reduce((acc, c) => acc + Math.max(0, c.saldo), 0);
  const total = filtered.length;
  const offset = (page - 1) * pageSize;
  const paginated = filtered.slice(offset, offset + pageSize);

  return {
    data: paginated,
    page,
    pageSize,
    total,
    ...(params.conDeuda ? { totalAdeudado } : {}),
  };
}

export async function obtenerClienteService(
  _currentUser: SessionUser,
  id: number
) {
  const [c] = await db
    .select()
    .from(clientes)
    .where(eq(clientes.id, id))
    .limit(1);

  if (!c) {
    throw new ApiError(404, "NO_ENCONTRADO", "Cliente no encontrado.");
  }

  const saldo = await calcularSaldoCliente(db, c.id);
  const disponible =
    c.cuentaCorriente && c.limiteCredito !== null
      ? c.limiteCredito - saldo
      : null;

  const ultimas = await db
    .select({
      id: facturas.id,
      puntoVenta: facturas.puntoVenta,
      numero: facturas.numero,
      fecha: facturas.fecha,
      total: facturas.total,
      formaPago: facturas.formaPago,
      estado: facturas.estado,
    })
    .from(facturas)
    .where(eq(facturas.clienteId, c.id))
    .orderBy(desc(facturas.fecha), desc(facturas.id))
    .limit(6);

  return {
    id: c.id,
    tipoDoc: c.tipoDoc,
    nroDoc: c.nroDoc,
    nombre: c.nombre,
    domicilio: c.domicilio,
    telefono: c.telefono,
    email: c.email,
    cuentaCorriente: c.cuentaCorriente,
    limiteCredito: c.limiteCredito,
    saldo,
    disponible,
    activo: c.activo,
    ultimasFacturas: ultimas.map((f) => ({
      id: f.id,
      numeroFormateado: formatNumeroFactura(f.puntoVenta, f.numero),
      fecha: f.fecha,
      total: f.total,
      formaPago: f.formaPago,
      estado: f.estado,
    })),
  };
}

export async function crearClienteService(
  currentUser: SessionUser,
  input: unknown
) {
  const data = parseWithSchema(createClienteSchema, input);
  const docNorm = normalizeDoc(data.nroDoc);

  const existingAll = await db
    .select({ id: clientes.id, tipoDoc: clientes.tipoDoc, nroDoc: clientes.nroDoc })
    .from(clientes)
    .where(eq(clientes.tipoDoc, data.tipoDoc));

  if (existingAll.some((e) => normalizeDoc(e.nroDoc) === docNorm)) {
    throw new ApiError(
      409,
      "DOCUMENTO_DUPLICADO",
      "Ya existe un cliente registrado con ese documento."
    );
  }

  const [created] = await db
    .insert(clientes)
    .values({
      tipoDoc: data.tipoDoc,
      nroDoc: data.nroDoc.trim(),
      nombre: data.nombre,
      domicilio: data.domicilio || "",
      telefono: data.telefono || "",
      email: data.email || "",
      cuentaCorriente: data.cuentaCorriente ?? false,
      limiteCredito: data.cuentaCorriente ? data.limiteCredito ?? null : null,
      activo: true,
      createdAt: new Date().toISOString(),
    })
    .returning();

  return obtenerClienteService(currentUser, created.id);
}

export async function actualizarClienteService(
  currentUser: SessionUser,
  id: number,
  input: unknown
) {
  const data = parseWithSchema(updateClienteSchema, input);

  const [c] = await db
    .select()
    .from(clientes)
    .where(eq(clientes.id, id))
    .limit(1);

  if (!c) {
    throw new ApiError(404, "NO_ENCONTRADO", "Cliente no encontrado.");
  }

  const saldo = await calcularSaldoCliente(db, id);

  if ((data.activo === false || data.cuentaCorriente === false) && saldo !== 0) {
    throw new ApiError(
      422,
      "SALDO_PENDIENTE",
      "No se puede desactivar ni quitar la cuenta corriente de un cliente con saldo pendiente."
    );
  }

  const nextTipoDoc = data.tipoDoc ?? c.tipoDoc;
  const nextNroDoc = data.nroDoc ?? c.nroDoc;
  if (nextTipoDoc !== c.tipoDoc || normalizeDoc(nextNroDoc) !== normalizeDoc(c.nroDoc)) {
    const others = await db
      .select({ id: clientes.id, nroDoc: clientes.nroDoc })
      .from(clientes)
      .where(eq(clientes.tipoDoc, nextTipoDoc));
    if (others.some((o) => o.id !== id && normalizeDoc(o.nroDoc) === normalizeDoc(nextNroDoc))) {
      throw new ApiError(
        409,
        "DOCUMENTO_DUPLICADO",
        "Ya existe otro cliente con ese documento."
      );
    }
  }

  await db
    .update(clientes)
    .set({
      ...(data.tipoDoc !== undefined ? { tipoDoc: data.tipoDoc } : {}),
      ...(data.nroDoc !== undefined ? { nroDoc: data.nroDoc.trim() } : {}),
      ...(data.nombre !== undefined ? { nombre: data.nombre } : {}),
      ...(data.domicilio !== undefined ? { domicilio: data.domicilio } : {}),
      ...(data.telefono !== undefined ? { telefono: data.telefono } : {}),
      ...(data.email !== undefined ? { email: data.email } : {}),
      ...(data.cuentaCorriente !== undefined
        ? { cuentaCorriente: data.cuentaCorriente }
        : {}),
      ...(data.limiteCredito !== undefined
        ? { limiteCredito: data.limiteCredito }
        : {}),
      ...(data.activo !== undefined ? { activo: data.activo } : {}),
    })
    .where(eq(clientes.id, id));

  return obtenerClienteService(currentUser, id);
}

export async function obtenerCuentaClienteService(
  _currentUser: SessionUser,
  clienteId: number,
  params: { desde?: string; hasta?: string }
) {
  const [c] = await db
    .select({ id: clientes.id, nombre: clientes.nombre })
    .from(clientes)
    .where(eq(clientes.id, clienteId))
    .limit(1);

  if (!c) {
    throw new ApiError(404, "NO_ENCONTRADO", "Cliente no encontrado.");
  }

  const allMovs = await db
    .select()
    .from(movimientosCuenta)
    .where(eq(movimientosCuenta.clienteId, clienteId))
    .orderBy(asc(movimientosCuenta.fecha), asc(movimientosCuenta.id));

  let saldoAnterior = 0;
  let running = 0;
  const visibles = [];

  for (const m of allMovs) {
    const delta = m.tipo === "debito" ? m.importe : -m.importe;
    if (params.desde && m.fecha < `${params.desde}T00:00:00.000Z`) {
      saldoAnterior += delta;
      running = saldoAnterior;
      continue;
    }
    if (params.hasta && m.fecha > `${params.hasta}T23:59:59.999Z`) {
      continue;
    }
    running += delta;
    visibles.push({
      id: m.id,
      fecha: m.fecha,
      tipo: m.tipo,
      importe: m.importe,
      descripcion: m.descripcion,
      facturaId: m.facturaId,
      pagoId: m.pagoId,
      saldo: running,
    });
  }

  const saldoTotal = await calcularSaldoCliente(db, clienteId);

  return {
    cliente: c,
    saldoAnterior,
    movimientos: visibles,
    saldo: saldoTotal,
  };
}