import { NextRequest } from "next/server";
import { ApiError } from "@/lib/api-error";
import { readJsonBody, runProtected } from "@/lib/route-handler";
import { actualizarUsuarioService } from "@/services/usuarios.service";

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await readJsonBody(req);
  return runProtected((user) => {
    const uid = Number(id);
    if (!Number.isInteger(uid) || uid <= 0) throw new ApiError(400, "VALIDACION", "ID inválido.");
    return actualizarUsuarioService(user, uid, body);
  });
}
