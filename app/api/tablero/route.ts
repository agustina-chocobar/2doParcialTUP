import { runProtected } from "@/lib/route-handler";
import { obtenerTableroService } from "@/services/tablero.service";

export async function GET() {
  return runProtected((user) => obtenerTableroService(user));
}
