import { NextRequest } from "next/server";
import { ApiError } from "@/lib/api-error";
import { runProtected } from "@/lib/route-handler";
import { obtenerCuentaClienteService } from "@/services/clientes.service";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const sp = req.nextUrl.searchParams;
  return runProtected((user) => {
    const cid = Number(id);
    if (!Number.isInteger(cid) || cid <= 0) throw new ApiError(400, "VALIDACION", "ID inválido.");
    return obtenerCuentaClienteService(user, cid, {
      desde: sp.get("desde") || undefined,
      hasta: sp.get("hasta") || undefined,
    });
  });
}
