import { NextRequest } from "next/server";
import { ApiError } from "@/lib/api-error";
import { runProtected } from "@/lib/route-handler";
import { obtenerFacturaService } from "@/services/facturas.service";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return runProtected((user) => {
    const fid = Number(id);
    if (!Number.isInteger(fid) || fid <= 0) throw new ApiError(400, "VALIDACION", "ID inválido.");
    return obtenerFacturaService(user, fid);
  });
}
