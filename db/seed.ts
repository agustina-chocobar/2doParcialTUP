import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "./index";
import { usuarios } from "./schema";
import { hashPassword, SessionUser } from "../lib/auth";
import { crearCategoriaService } from "../services/categorias.service";
import { crearProductoService } from "../services/productos.service";
import { crearClienteService } from "../services/clientes.service";
import { crearFacturaService } from "../services/facturas.service";
import { registrarPagoService } from "../services/pagos.service";

async function seed() {
  const [{ count: existingUsers }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(usuarios);

  if (Number(existingUsers || 0) > 0) {
    console.log("La base de datos ya contiene datos iniciales. Seed omitido.");
    return;
  }

  const now = new Date().toISOString();
  const adminHash = await hashPassword("Admin1234!");
  const vendHash = await hashPassword("Vendedor1234!");

  const [adminRow] = await db
    .insert(usuarios)
    .values({
      nombre: "Laura Méndez",
      email: "admin@comercio.test",
      passwordHash: adminHash,
      rol: "admin",
      activo: true,
      createdAt: now,
    })
    .returning();

  const [vendRow] = await db
    .insert(usuarios)
    .values({
      nombre: "Pablo Ruiz",
      email: "vendedor@comercio.test",
      passwordHash: vendHash,
      rol: "vendedor",
      activo: true,
      createdAt: now,
    })
    .returning();

  const adminUser: SessionUser = {
    id: adminRow.id,
    email: adminRow.email,
    nombre: adminRow.nombre,
    rol: "admin",
    activo: true,
  };

  const vendUser: SessionUser = {
    id: vendRow.id,
    email: vendRow.email,
    nombre: vendRow.nombre,
    rol: "vendedor",
    activo: true,
  };

  const nombresCategorias = [
    "Herramientas",
    "Electricidad",
    "Bulonería",
    "Pinturería",
    "Plomería",
  ];
  const categoriasCreadas = [];
  for (const nombre of nombresCategorias) {
    const cat = await crearCategoriaService(adminUser, { nombre });
    categoriasCreadas.push(cat);
  }

  const productosCreados = [];
  for (let i = 1; i <= 30; i++) {
    const cat = categoriasCreadas[(i - 1) % categoriasCreadas.length];
    const codigo = `PR-${String(i).padStart(3, "0")}`;
    const precio = (1500 + i * 350) * 100;
    const stockInicial = i === 18 ? 3 : 60 + i;
    const stockMinimo = i === 18 ? 6 : 5;
    const prod = await crearProductoService(adminUser, {
      codigo,
      descripcion: `Artículo comercial #${i} (${cat.nombre})`,
      categoriaId: cat.id,
      precio,
      stockMinimo,
      stockInicial,
    });
    productosCreados.push(prod);
  }

  const clientesCreados = [];
  for (let i = 1; i <= 10; i++) {
    const esCc = i <= 6;
    const cli = await crearClienteService(adminUser, {
      tipoDoc: i % 3 === 0 ? "CUIT" : "DNI",
      nroDoc:
        i % 3 === 0
          ? `20-${30000000 + i * 111111}-7`
          : `${28000000 + i * 456789}`,
      nombre: `Cliente Demo ${i}`,
      domicilio: `Av. Aconquija ${100 + i * 25}, Tucumán`,
      telefono: `381 500-${1000 + i}`,
      email: `cliente${i}@comercio.test`,
      cuentaCorriente: esCc,
      limiteCredito: esCc ? 50000000 : null,
    });
    clientesCreados.push(cli);
  }

  const formas = ["contado", "tarjeta", "cuenta_corriente"] as const;
  for (let i = 0; i < 50; i++) {
    const diasAtras = 29 - Math.floor((i * 29) / 49);
    const fecha = new Date(
      Date.now() - diasAtras * 24 * 60 * 60 * 1000 - (i % 6) * 3600 * 1000
    ).toISOString();

    const prodA = productosCreados[i % 15];
    const prodB = productosCreados[(i + 1) % 15];
    const items = [
      { productoId: prodA.id, cantidad: 1 },
      ...(i % 2 === 0 ? [{ productoId: prodB.id, cantidad: 1 }] : []),
    ];

    const forma = formas[i % 3];
    const clienteCc = clientesCreados[i % 5];

    if (forma === "cuenta_corriente") {
      await crearFacturaService(
        vendUser,
        {
          clienteId: clienteCc.id,
          items,
          pago: { forma: "cuenta_corriente" },
        },
        fecha
      );
    } else if (forma === "tarjeta") {
      await crearFacturaService(
        vendUser,
        {
          clienteId: i % 4 === 0 ? clientesCreados[7].id : null,
          items,
          pago: {
            forma: "tarjeta",
            tarjeta: {
              tipo: i % 2 === 0 ? "debito" : "credito",
              marca: i % 2 === 0 ? "Visa" : "Mastercard",
              ultimos4: String(1000 + i).slice(-4),
            },
          },
        },
        fecha
      );
    } else {
      await crearFacturaService(
        vendUser,
        {
          clienteId: null,
          items,
          pago: { forma: "contado" },
        },
        fecha
      );
    }
  }

  await registrarPagoService(
    adminUser,
    clientesCreados[0].id,
    {
      importe: 100000,
      medio: "transferencia",
      observacion: "Pago a cuenta inicial",
    },
    now
  );

  console.log("Seed completado: 2 usuarios, 5 categorías, 30 productos, 10 clientes y 50 facturas.");
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error en seed:", err);
    process.exit(1);
  });