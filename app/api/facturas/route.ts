import { NextRequest } from "next/server";
import { readJsonBody, runProtected } from "@/lib/route-handler";
import {
  crearFacturaService,
  listarFacturasService,
} from "@/services/facturas.service";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clienteIdRaw = searchParams.get("clienteId");
  const vendedorIdRaw = searchParams.get("vendedorId");
  return runProtected((user) =>
    listarFacturasService(user, {
      q: searchParams.get("q") || undefined,
      desde: searchParams.get("desde") || undefined,
      hasta: searchParams.get("hasta") || undefined,
      clienteId: clienteIdRaw ? Number(clienteIdRaw) : undefined,
      vendedorId: vendedorIdRaw ? Number(vendedorIdRaw) : undefined,
      forma: searchParams.get("forma") || undefined,
      estado: searchParams.get("estado") || undefined,
      page: Number(searchParams.get("page") || "1"),
      pageSize: Number(searchParams.get("pageSize") || "20"),
    })
  );
}

export async function POST(req: NextRequest) {
  const body = await readJsonBody(req);
  return runProtected((user) => crearFacturaService(user, body), 201);
}
