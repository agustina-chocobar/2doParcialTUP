import { NextRequest } from "next/server";
import { readJsonBody, runProtected } from "@/lib/route-handler";
import { crearProductoService, listarProductosService } from "@/services/productos.service";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  return runProtected((user) =>
    listarProductosService(user, {
      q: sp.get("q") || undefined,
      categoriaId: sp.get("categoriaId") ? Number(sp.get("categoriaId")) : undefined,
      bajoMinimo: sp.get("bajoMinimo") === "true" || sp.get("bajoMinimo") === "1" ? true : undefined,
      page: sp.get("page") ? Number(sp.get("page")) : undefined,
      pageSize: sp.get("pageSize") ? Number(sp.get("pageSize")) : undefined,
    })
  );
}

export async function POST(req: NextRequest) {
  const body = await readJsonBody(req);
  return runProtected((user) => crearProductoService(user, body), 201);
}
