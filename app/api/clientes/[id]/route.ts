import { NextRequest } from "next/server";
import { ApiError } from "@/lib/api-error";
import { readJsonBody, runProtected } from "@/lib/route-handler";
import { actualizarClienteService, obtenerClienteService } from "@/services/clientes.service";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return runProtected((user) => {
    const cid = Number(id);
    if (!Number.isInteger(cid) || cid <= 0) throw new ApiError(400, "VALIDACION", "ID inválido.");
    return obtenerClienteService(user, cid);
  });
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await readJsonBody(req);
  return runProtected((user) => {
    const cid = Number(id);
    if (!Number.isInteger(cid) || cid <= 0) throw new ApiError(400, "VALIDACION", "ID inválido.");
    return actualizarClienteService(user, cid, body);
  });
}
