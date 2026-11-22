import crypto from "node:crypto";
import { and, asc, eq, like, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { usuarios } from "@/db/schema";
import { ApiError } from "@/lib/api-error";
import {
  assertAdmin,
  hashPassword,
  SessionUser,
  verifyPassword,
} from "@/lib/auth";
import { parseWithSchema } from "@/lib/validation-helper";
import {
  changePasswordSchema,
  createUsuarioSchema,
  updateUsuarioSchema,
} from "@/lib/validators/auth.schema";

export async function listarUsuariosService(
  currentUser: SessionUser,
  params: { q?: string; rol?: string; activo?: string }
) {
  assertAdmin(currentUser);

  const filters = [];
  if (params.q && params.q.trim()) {
    const term = "%" + params.q.trim() + "%";
    filters.push(or(like(usuarios.nombre, term), like(usuarios.email, term)));
  }
  if (params.rol === "admin" || params.rol === "vendedor") {
    filters.push(eq(usuarios.rol, params.rol));
  }
  if (params.activo === "true") {
    filters.push(eq(usuarios.activo, true));
  } else if (params.activo === "false") {
    filters.push(eq(usuarios.activo, false));
  }

  const whereClause = filters.length > 0 ? and(...filters) : undefined;
  const rows = await db
    .select({
      id: usuarios.id,
      nombre: usuarios.nombre,
      email: usuarios.email,
      rol: usuarios.rol,
      activo: usuarios.activo,
    })
    .from(usuarios)
    .where(whereClause)
    .orderBy(asc(usuarios.nombre));

  return { data: rows };
}

export async function crearUsuarioService(
  currentUser: SessionUser,
  input: unknown
) {
  assertAdmin(currentUser);
  const data = parseWithSchema(createUsuarioSchema, input);
  const emailNorm = data.email.toLowerCase();

  const [existing] = await db
    .select({ id: usuarios.id })
    .from(usuarios)
    .where(sql`lower(${usuarios.email}) = ${emailNorm}`)
    .limit(1);

  if (existing) {
    throw new ApiError(
      409,
      "EMAIL_DUPLICADO",
      "Ya existe un usuario con ese correo electrónico."
    );
  }

  const passwordHash = await hashPassword(data.password);
  const now = new Date().toISOString();

  const [created] = await db
    .insert(usuarios)
    .values({
      nombre: data.nombre,
      email: emailNorm,
      passwordHash,
      rol: data.rol,
      activo: true,
      createdAt: now,
    })
    .returning({
      id: usuarios.id,
      nombre: usuarios.nombre,
      email: usuarios.email,
      rol: usuarios.rol,
      activo: usuarios.activo,
    });

  return created;
}

export async function actualizarUsuarioService(
  currentUser: SessionUser,
  id: number,
  input: unknown
) {
  assertAdmin(currentUser);
  const data = parseWithSchema(updateUsuarioSchema, input);

  const [target] = await db
    .select()
    .from(usuarios)
    .where(eq(usuarios.id, id))
    .limit(1);

  if (!target) {
    throw new ApiError(404, "NO_ENCONTRADO", "Usuario no encontrado.");
  }

  if (data.activo === false && target.id === currentUser.id) {
    throw new ApiError(
      422,
      "VALIDACION",
      "No puede desactivar su propio usuario."
    );
  }

  if (
    data.activo === false &&
    target.rol === "admin" &&
    target.activo === true
  ) {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(usuarios)
      .where(and(eq(usuarios.rol, "admin"), eq(usuarios.activo, true)));

    if (Number(count || 0) <= 1) {
      throw new ApiError(
        409,
        "VALIDACION",
        "Debe quedar al menos un administrador activo."
      );
    }
  }

  if (data.email && data.email.toLowerCase() !== target.email.toLowerCase()) {
    const emailNorm = data.email.toLowerCase();
    const [dup] = await db
      .select({ id: usuarios.id })
      .from(usuarios)
      .where(sql`lower(${usuarios.email}) = ${emailNorm}`)
      .limit(1);
    if (dup) {
      throw new ApiError(
        409,
        "EMAIL_DUPLICADO",
        "Ya existe un usuario con ese correo electrónico."
      );
    }
  }

  const [updated] = await db
    .update(usuarios)
    .set({
      ...(data.nombre !== undefined ? { nombre: data.nombre } : {}),
      ...(data.email !== undefined
        ? { email: data.email.toLowerCase() }
        : {}),
      ...(data.rol !== undefined ? { rol: data.rol } : {}),
      ...(data.activo !== undefined ? { activo: data.activo } : {}),
    })
    .where(eq(usuarios.id, id))
    .returning({
      id: usuarios.id,
      nombre: usuarios.nombre,
      email: usuarios.email,
      rol: usuarios.rol,
      activo: usuarios.activo,
    });

  return updated;
}

export async function cambiarPasswordService(
  currentUser: SessionUser,
  input: unknown
) {
  const data = parseWithSchema(changePasswordSchema, input);

  const [userRow] = await db
    .select()
    .from(usuarios)
    .where(eq(usuarios.id, currentUser.id))
    .limit(1);

  if (!userRow) {
    throw new ApiError(404, "NO_ENCONTRADO", "Usuario no encontrado.");
  }

  const valid = await verifyPassword(data.actual, userRow.passwordHash);
  if (!valid) {
    throw new ApiError(
      422,
      "VALIDACION",
      "La contraseña actual es incorrecta."
    );
  }

  const passwordHash = await hashPassword(data.nueva);
  await db
    .update(usuarios)
    .set({ passwordHash })
    .where(eq(usuarios.id, currentUser.id));
}

export async function resetPasswordAdminService(
  currentUser: SessionUser,
  id: number
) {
  assertAdmin(currentUser);

  const [target] = await db
    .select()
    .from(usuarios)
    .where(eq(usuarios.id, id))
    .limit(1);

  if (!target) {
    throw new ApiError(404, "NO_ENCONTRADO", "Usuario no encontrado.");
  }

  const passwordTemporal = "Tup-" + crypto.randomBytes(4).toString("hex") + "!1";
  const passwordHash = await hashPassword(passwordTemporal);

  await db
    .update(usuarios)
    .set({ passwordHash })
    .where(eq(usuarios.id, id));

  return { passwordTemporal };
}
