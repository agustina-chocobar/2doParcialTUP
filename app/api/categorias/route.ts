import { NextRequest } from "next/server";
import { readJsonBody, runProtected } from "@/lib/route-handler";
import { crearCategoriaService, listarCategoriasService } from "@/services/categorias.service";

export async function GET(req: NextRequest) {
  const incluir = req.nextUrl.searchParams.get("incluirInactivas") === "true";
  return runProtected((user) => listarCategoriasService(user, incluir));
}

export async function POST(req: NextRequest) {
  const body = await readJsonBody(req);
  return runProtected((user) => crearCategoriaService(user, body), 201);
}
