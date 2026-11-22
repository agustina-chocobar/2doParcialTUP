import { NextRequest, NextResponse } from "next/server";
import { getSessionUserOptional, SessionUser } from "@/lib/auth";
import { ApiError } from "@/lib/api-error";

export async function readJsonBody(req: NextRequest): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

export async function runProtected<T>(
  fn: (user: SessionUser) => Promise<T>,
  okStatus = 200
): Promise<NextResponse> {
  try {
    const user = await getSessionUserOptional();
    if (!user) {
      return NextResponse.json(
        { error: { code: "NO_AUTENTICADO", message: "Sesión no iniciada o expirada." } },
        { status: 401 }
      );
    }
    const result = await fn(user);
    if (okStatus === 204 || result === undefined) {
      return new NextResponse(null, { status: 204 });
    }
    return NextResponse.json(result, { status: okStatus });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status: err.status }
      );
    }
    const message = err instanceof Error ? err.message : "Error interno del servidor.";
    return NextResponse.json(
      { error: { code: "ERROR_INTERNO", message } },
      { status: 500 }
    );
  }
}
