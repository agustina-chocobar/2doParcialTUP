import { runProtected } from "@/lib/route-handler";
import { obtenerProximoNumeroFacturaService } from "@/services/facturas.service";

export async function GET() {
  return runProtected((user) => obtenerProximoNumeroFacturaService(user));
}
