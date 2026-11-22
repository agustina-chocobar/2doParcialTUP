import { NextRequest } from "next/server";
import { readJsonBody, runProtected } from "@/lib/route-handler";
import { crearUsuarioService, listarUsuariosService } from "@/services/usuarios.service";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  return runProtected((user) =>
    listarUsuariosService(user, {
      q: sp.get("q") || undefined,
      rol: sp.get("rol") || undefined,
      activo: sp.get("activo") || undefined,
    })
  );
}

export async function POST(req: NextRequest) {
  const body = await readJsonBody(req);
  return runProtected((user) => crearUsuarioService(user, body), 201);
}
