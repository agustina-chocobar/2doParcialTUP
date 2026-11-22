import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { usuarios } from "@/db/schema";
import { ApiError } from "@/lib/api-error";
import {
  createSessionToken,
  SESSION_COOKIE_NAME,
  verifyPassword,
} from "@/lib/auth";
import { readJsonBody, runProtected } from "@/lib/route-handler";

export async function POST(req: NextRequest) {
  try {
    const body = (await readJsonBody(req)) as {
      email?: string;
      password?: string;
    };

    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!email || !password) {
      return NextResponse.json(
        { error: { code: "VALIDACION", message: "Email o contraseña incorrectos." } },
        { status: 401 }
      );
    }

    const [user] = await db
      .select()
      .from(usuarios)
      .where(sql`lower(${usuarios.email}) = ${email}`)
      .limit(1);

    if (!user || !user.activo) {
      return NextResponse.json(
        { error: { code: "CREDENCIALES_INVALIDAS", message: "Email o contraseña incorrectos." } },
        { status: 401 }
      );
    }

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      return NextResponse.json(
        { error: { code: "CREDENCIALES_INVALIDAS", message: "Email o contraseña incorrectos." } },
        { status: 401 }
      );
    }

    const token = await createSessionToken(user.id);
    const res = NextResponse.json({
      id: user.id,
      email: user.email,
      nombre: user.nombre,
      rol: user.rol,
      activo: user.activo,
    });

    res.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return res;
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status: err.status }
      );
    }
    return NextResponse.json(
      { error: { code: "ERROR_INTERNO", message: "Error al iniciar sesión." } },
      { status: 500 }
    );
  }
}

export async function GET() {
  return runProtected(async (u) => u);
}
