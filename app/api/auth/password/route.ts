import { NextRequest } from "next/server";
import { readJsonBody, runProtected } from "@/lib/route-handler";
import { cambiarPasswordService } from "@/services/usuarios.service";

export async function PUT(req: NextRequest) {
  const body = await readJsonBody(req);
  return runProtected((user) => cambiarPasswordService(user, body), 204);
}
