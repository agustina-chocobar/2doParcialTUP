import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { categorias, productos } from "@/db/schema";
import { ApiError } from "@/lib/api-error";
import { assertAdmin, SessionUser } from "@/lib/auth";
import { parseWithSchema } from "@/lib/validation-helper";
import {
  createCategoriaSchema,
  updateCategoriaSchema,
} from "@/lib/validators/productos.schema";

export async function listarCategoriasService(
  _currentUser: SessionUser,
  incluirInactivas = false
) {
  const rows = await db
    .select({
      id: categorias.id,
      nombre: categorias.nombre,
      activa: categorias.activa,
    })
    .from(categorias)
    .where(incluirInactivas ? undefined : eq(categorias.activa, true))
    .orderBy(asc(categorias.nombre));

  return rows;
}

export async function crearCategoriaService(
  currentUser: SessionUser,
  input: unknown
) {
  assertAdmin(currentUser);
  const data = parseWithSchema(createCategoriaSchema, input);

  const [dup] = await db
    .select({ id: categorias.id })
    .from(categorias)
    .where(sql`lower(${categorias.nombre}) = lower(${data.nombre})`)
    .limit(1);

  if (dup) {
    throw new ApiError(
      409,
      "NOMBRE_DUPLICADO",
      "Ya existe una categoría con ese nombre."
    );
  }

  const [created] = await db
    .insert(categorias)
    .values({
      nombre: data.nombre,
      activa: true,
      createdAt: new Date().toISOString(),
    })
    .returning({
      id: categorias.id,
      nombre: categorias.nombre,
      activa: categorias.activa,
    });

  return created;
}

export async function actualizarCategoriaService(
  currentUser: SessionUser,
  id: number,
  input: unknown
) {
  assertAdmin(currentUser);
  const data = parseWithSchema(updateCategoriaSchema, input);

  const [cat] = await db
    .select()
    .from(categorias)
    .where(eq(categorias.id, id))
    .limit(1);

  if (!cat) {
    throw new ApiError(404, "NO_ENCONTRADO", "Categoría no encontrada.");
  }

  if (data.nombre && data.nombre.toLowerCase() !== cat.nombre.toLowerCase()) {
    const [dup] = await db
      .select({ id: categorias.id })
      .from(categorias)
      .where(sql`lower(${categorias.nombre}) = lower(${data.nombre})`)
      .limit(1);
    if (dup) {
      throw new ApiError(
        409,
        "NOMBRE_DUPLICADO",
        "Ya existe una categoría con ese nombre."
      );
    }
  }

  if (data.activa === false && cat.activa) {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(productos)
      .where(and(eq(productos.categoriaId, id), eq(productos.activo, true)));

    if (Number(count || 0) > 0) {
      throw new ApiError(
        409,
        "CATEGORIA_EN_USO",
        "No se puede desactivar una categoría con productos activos."
      );
    }
  }

  const [updated] = await db
    .update(categorias)
    .set({
      ...(data.nombre !== undefined ? { nombre: data.nombre } : {}),
      ...(data.activa !== undefined ? { activa: data.activa } : {}),
    })
    .where(eq(categorias.id, id))
    .returning({
      id: categorias.id,
      nombre: categorias.nombre,
      activa: categorias.activa,
    });

  return updated;
}