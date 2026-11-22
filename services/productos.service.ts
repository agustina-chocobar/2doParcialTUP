import { and, asc, eq, like, lte, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { categorias, productos } from "@/db/schema";
import { ApiError } from "@/lib/api-error";
import { assertAdmin, SessionUser } from "@/lib/auth";
import { parseWithSchema } from "@/lib/validation-helper";
import {
  createProductoSchema,
  updateProductoSchema,
} from "@/lib/validators/productos.schema";
import { moverStock } from "@/services/stock.service";

export async function listarProductosService(
  currentUser: SessionUser,
  params: {
    q?: string;
    categoriaId?: number;
    bajoMinimo?: boolean;
    activo?: string;
    page?: number;
    pageSize?: number;
  }
) {
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize || 20));
  const offset = (page - 1) * pageSize;

  const filters = [];

  if (params.activo === "todos" && currentUser.rol === "admin") {
    // sin filtro de activo
  } else if (params.activo === "false" && currentUser.rol === "admin") {
    filters.push(eq(productos.activo, false));
  } else {
    filters.push(eq(productos.activo, true));
  }

  if (params.q && params.q.trim()) {
    const term = `%${params.q.trim()}%`;
    filters.push(
      or(like(productos.codigo, term), like(productos.descripcion, term))
    );
  }

  if (params.categoriaId) {
    filters.push(eq(productos.categoriaId, params.categoriaId));
  }

  if (params.bajoMinimo) {
    filters.push(lte(productos.existencia, productos.stockMinimo));
  }

  const whereClause = filters.length > 0 ? and(...filters) : undefined;

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(productos)
    .where(whereClause);

  const rows = await db
    .select({
      id: productos.id,
      codigo: productos.codigo,
      descripcion: productos.descripcion,
      precio: productos.precio,
      existencia: productos.existencia,
      stockMinimo: productos.stockMinimo,
      activo: productos.activo,
      categoriaId: categorias.id,
      categoriaNombre: categorias.nombre,
    })
    .from(productos)
    .innerJoin(categorias, eq(productos.categoriaId, categorias.id))
    .where(whereClause)
    .orderBy(asc(productos.descripcion))
    .limit(pageSize)
    .offset(offset);

  return {
    data: rows.map((r) => ({
      id: r.id,
      codigo: r.codigo,
      descripcion: r.descripcion,
      categoria: { id: r.categoriaId, nombre: r.categoriaNombre },
      precio: r.precio,
      existencia: r.existencia,
      stockMinimo: r.stockMinimo,
      bajoMinimo: r.existencia <= r.stockMinimo,
      activo: r.activo,
    })),
    page,
    pageSize,
    total: Number(count || 0),
  };
}

export async function obtenerProductoService(
  _currentUser: SessionUser,
  id: number
) {
  const [r] = await db
    .select({
      id: productos.id,
      codigo: productos.codigo,
      descripcion: productos.descripcion,
      precio: productos.precio,
      existencia: productos.existencia,
      stockMinimo: productos.stockMinimo,
      activo: productos.activo,
      categoriaId: categorias.id,
      categoriaNombre: categorias.nombre,
    })
    .from(productos)
    .innerJoin(categorias, eq(productos.categoriaId, categorias.id))
    .where(eq(productos.id, id))
    .limit(1);

  if (!r) {
    throw new ApiError(404, "NO_ENCONTRADO", "Producto no encontrado.");
  }

  return {
    id: r.id,
    codigo: r.codigo,
    descripcion: r.descripcion,
    categoria: { id: r.categoriaId, nombre: r.categoriaNombre },
    precio: r.precio,
    existencia: r.existencia,
    stockMinimo: r.stockMinimo,
    bajoMinimo: r.existencia <= r.stockMinimo,
    activo: r.activo,
  };
}

export async function crearProductoService(
  currentUser: SessionUser,
  input: unknown
) {
  assertAdmin(currentUser);
  const data = parseWithSchema(createProductoSchema, input);
  const codigoNorm = data.codigo.toUpperCase();

  const [dup] = await db
    .select({ id: productos.id })
    .from(productos)
    .where(sql`upper(${productos.codigo}) = ${codigoNorm}`)
    .limit(1);

  if (dup) {
    throw new ApiError(
      409,
      "CODIGO_DUPLICADO",
      "Ya existe un producto con ese código."
    );
  }

  const [cat] = await db
    .select()
    .from(categorias)
    .where(eq(categorias.id, data.categoriaId))
    .limit(1);

  if (!cat || !cat.activa) {
    throw new ApiError(
      422,
      "VALIDACION",
      "La categoría seleccionada no existe o está inactiva."
    );
  }

  const createdId = await db.transaction(async (tx) => {
    const now = new Date().toISOString();
    const [inserted] = await tx
      .insert(productos)
      .values({
        codigo: codigoNorm,
        descripcion: data.descripcion,
        categoriaId: data.categoriaId,
        precio: data.precio,
        existencia: 0,
        stockMinimo: data.stockMinimo,
        activo: true,
        createdAt: now,
      })
      .returning({ id: productos.id });

    if (data.stockInicial && data.stockInicial > 0) {
      await moverStock(tx, {
        productoId: inserted.id,
        tipo: "ingreso",
        cantidadDelta: data.stockInicial,
        motivo: "Stock inicial",
        usuarioId: currentUser.id,
        fecha: now,
      });
    }

    return inserted.id;
  });

  return obtenerProductoService(currentUser, createdId);
}

export async function actualizarProductoService(
  currentUser: SessionUser,
  id: number,
  input: unknown
) {
  assertAdmin(currentUser);
  const data = parseWithSchema(updateProductoSchema, input);

  const [existing] = await db
    .select()
    .from(productos)
    .where(eq(productos.id, id))
    .limit(1);

  if (!existing) {
    throw new ApiError(404, "NO_ENCONTRADO", "Producto no encontrado.");
  }

  if (data.codigo && data.codigo.toUpperCase() !== existing.codigo) {
    const [dup] = await db
      .select({ id: productos.id })
      .from(productos)
      .where(sql`upper(${productos.codigo}) = ${data.codigo.toUpperCase()}`)
      .limit(1);
    if (dup) {
      throw new ApiError(
        409,
        "CODIGO_DUPLICADO",
        "Ya existe un producto con ese código."
      );
    }
  }

  await db
    .update(productos)
    .set({
      ...(data.codigo !== undefined
        ? { codigo: data.codigo.toUpperCase() }
        : {}),
      ...(data.descripcion !== undefined
        ? { descripcion: data.descripcion }
        : {}),
      ...(data.categoriaId !== undefined
        ? { categoriaId: data.categoriaId }
        : {}),
      ...(data.precio !== undefined ? { precio: data.precio } : {}),
      ...(data.stockMinimo !== undefined
        ? { stockMinimo: data.stockMinimo }
        : {}),
      ...(data.activo !== undefined ? { activo: data.activo } : {}),
    })
    .where(eq(productos.id, id));

  return obtenerProductoService(currentUser, id);
}