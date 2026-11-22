import { NextRequest } from "next/server";
import { readJsonBody, runProtected } from "@/lib/route-handler";
import {
  crearClienteService,
  listarClientesService,
} from "@/services/clientes.service";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  return runProtected((user) =>
    listarClientesService(user, {
      q: searchParams.get("q") || undefined,
      conDeuda: searchParams.get("conDeuda") === "true",
      orden: searchParams.get("orden") || undefined,
      activo: searchParams.get("activo") || undefined,
      page: Number(searchParams.get("page") || "1"),
      pageSize: Number(searchParams.get("pageSize") || "20"),
    })
  );
}

export async function POST(req: NextRequest) {
  const body = await readJsonBody(req);
  return runProtected((user) => crearClienteService(user, body), 201);
}
