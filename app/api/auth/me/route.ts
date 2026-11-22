import { runProtected } from "@/lib/route-handler";

export async function GET() {
  return runProtected(async (user) => ({
    id: user.id,
    email: user.email,
    nombre: user.nombre,
    rol: user.rol,
    activo: user.activo,
  }));
}
