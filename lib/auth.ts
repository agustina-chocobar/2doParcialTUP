import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { usuarios } from "@/db/schema";
import { ApiError } from "@/lib/api-error";

export const SESSION_COOKIE_NAME = "sgc_session";

export interface SessionUser {
  id: number;
  email: string;
  nombre: string;
  rol: "admin" | "vendedor";
  activo: boolean;
}

function getSecretKey(): Uint8Array {
  const secret =
    process.env.SESSION_SECRET ||
    "dev-secret-cambiar-en-produccion-min-32-chars";
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSessionToken(userId: number): Promise<string> {
  return new SignJWT({ sub: String(userId) })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecretKey());
}

export async function verifySessionToken(
  token: string
): Promise<number | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    const userId = Number(payload.sub);
    if (!Number.isInteger(userId) || userId <= 0) return null;
    return userId;
  } catch {
    return null;
  }
}

export async function getSessionUserOptional(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const userId = await verifySessionToken(token);
  if (!userId) return null;

  const [row] = await db
    .select({
      id: usuarios.id,
      email: usuarios.email,
      nombre: usuarios.nombre,
      rol: usuarios.rol,
      activo: usuarios.activo,
    })
    .from(usuarios)
    .where(eq(usuarios.id, userId))
    .limit(1);

  if (!row || !row.activo) return null;

  const rol: "admin" | "vendedor" = row.rol === "admin" ? "admin" : "vendedor";
  return {
    id: row.id,
    email: row.email,
    nombre: row.nombre,
    rol,
    activo: row.activo,
  };
}

export async function requireSessionUser(): Promise<SessionUser> {
  const user = await getSessionUserOptional();
  if (!user) {
    throw new ApiError(401, "NO_AUTENTICADO", "Debe iniciar sesión.");
  }
  return user;
}

export function assertAdmin(user: SessionUser): void {
  if (user.rol !== "admin") {
    throw new ApiError(
      403,
      "SIN_PERMISO",
      "No tiene permisos para realizar esta acción."
    );
  }
}