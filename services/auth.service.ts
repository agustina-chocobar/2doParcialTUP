import { eq } from "drizzle-orm";
import { db } from "@/db";
import { usuarios } from "@/db/schema";
import { ApiError } from "@/lib/api-error";
import {
  createSessionToken,
  hashPassword,
  SessionUser,
  verifyPassword,
} from "@/lib/auth";
import { parseWithSchema } from "@/lib/validation-helper";
import { changePasswordSchema, loginSchema } from "@/lib/validators/auth.schema";

// RF-U1: Inicio de sesión
export async function loginService(input: unknown) {
  const data = parseWithSchema(loginSchema, input);
  const emailNorm = data.email.toLowerCase();

  const [user] = await db
    .select()
    .from(usuarios)
    .where(eq(usuarios.email, emailNorm))
    .limit(1);

  if (!user || !user.activo) {
    throw new ApiError(
      401,
      "CREDENCIALES_INVALIDAS",
      "Email o contraseña incorrectos."
    );
  }

  const ok = await verifyPassword(data.password, user.passwordHash);
  if (!ok) {
    throw new ApiError(
      401,
      "CREDENCIALES_INVALIDAS",
      "Email o contraseña incorrectos."
    );
  }

  const token = await createSessionToken(user.id);
  const rol: "admin" | "vendedor" = user.rol === "admin" ? "admin" : "vendedor";

  return {
    token,
    user: {
      id: user.id,
      nombre: user.nombre,
      email: user.email,
      rol,
    },
  };
}

// RF-U5: Cambio de contraseña del propio usuario
export async function changePasswordService(
  currentUser: SessionUser,
  input: unknown
) {
  const data = parseWithSchema(changePasswordSchema, input);

  const [user] = await db
    .select()
    .from(usuarios)
    .where(eq(usuarios.id, currentUser.id))
    .limit(1);

  if (!user) {
    throw new ApiError(404, "NO_ENCONTRADO", "Usuario no encontrado.");
  }

  const ok = await verifyPassword(data.actual, user.passwordHash);
  if (!ok) {
    throw new ApiError(
      422,
      "CONTRASENA_ACTUAL_INCORRECTA",
      "La contraseña actual es incorrecta."
    );
  }

  const passwordHash = await hashPassword(data.nueva);
  await db
    .update(usuarios)
    .set({ passwordHash })
    .where(eq(usuarios.id, currentUser.id));
}
