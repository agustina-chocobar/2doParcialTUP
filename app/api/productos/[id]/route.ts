import { NextRequest } from "next/server";
import { ApiError } from "@/lib/api-error";
import { readJsonBody, runProtected } from "@/lib/route-handler";
import { actualizarProductoService, obtenerProductoService } from "@/services/productos.service";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return runProtected((user) => {
    const pid = Number(id);
    if (!Number.isInteger(pid) || pid <= 0) throw new ApiError(400, "VALIDACION", "ID inválido.");
    return obtenerProductoService(user, pid);
  });
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await readJsonBody(req);
  return runProtected((user) => {
    const pid = Number(id);
    if (!Number.isInteger(pid) || pid <= 0) throw new ApiError(400, "VALIDACION", "ID inválido.");
    return actualizarProductoService(user, pid, body);
  });
}
