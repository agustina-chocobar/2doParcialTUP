import { NextRequest } from "next/server";
import { ApiError } from "@/lib/api-error";
import { readJsonBody, runProtected } from "@/lib/route-handler";
import { anularFacturaService } from "@/services/facturas.service";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await readJsonBody(req);
  return runProtected((user) => {
    const fid = Number(id);
    if (!Number.isInteger(fid) || fid <= 0) throw new ApiError(400, "VALIDACION", "ID inválido.");
    return anularFacturaService(user, fid, body);
  });
}
