import {
  sqliteTable,
  integer,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

// Sección 7: todas las tablas llevan id, createdAt e importes en centavos

export const usuarios = sqliteTable("usuarios", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  nombre: text("nombre").notNull(),
  passwordHash: text("password_hash").notNull(),
  rol: text("rol").notNull().default("vendedor"), // 'admin' | 'vendedor'
  activo: integer("activo", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
});

export const categorias = sqliteTable("categorias", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nombre: text("nombre").notNull().unique(),
  activa: integer("activa", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
});

export const productos = sqliteTable("productos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  codigo: text("codigo").notNull().unique(),
  descripcion: text("descripcion").notNull(),
  categoriaId: integer("categoria_id")
    .notNull()
    .references(() => categorias.id),
  precio: integer("precio").notNull(), // centavos
  existencia: integer("existencia").notNull().default(0),
  stockMinimo: integer("stock_minimo").notNull().default(0),
  activo: integer("activo", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
});

export const clientes = sqliteTable(
  "clientes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tipoDoc: text("tipo_doc").notNull(), // 'DNI' | 'CUIT'
    nroDoc: text("nro_doc").notNull(),
    nombre: text("nombre").notNull(),
    domicilio: text("domicilio").notNull().default(""),
    telefono: text("telefono").notNull().default(""),
    email: text("email").notNull().default(""),
    cuentaCorriente: integer("cuenta_corriente", { mode: "boolean" })
      .notNull()
      .default(false),
    limiteCredito: integer("limite_credito"), // centavos o null
    activo: integer("activo", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("clientes_tipo_nro_doc_idx").on(table.tipoDoc, table.nroDoc),
  ]
);

export const facturas = sqliteTable("facturas", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  puntoVenta: integer("punto_venta").notNull().default(1),
  numero: integer("numero").notNull(),
  fecha: text("fecha").notNull(),
  total: integer("total").notNull(), // centavos
  formaPago: text("forma_pago").notNull(), // 'contado' | 'tarjeta' | 'cuenta_corriente'
  tarjetaTipo: text("tarjeta_tipo"), // 'debito' | 'credito' | null
  tarjetaMarca: text("tarjeta_marca"),
  tarjetaUltimos4: text("tarjeta_ultimos4"),
  montoRecibido: integer("monto_recibido"), // centavos o null
  estado: text("estado").notNull().default("emitida"), // 'emitida' | 'anulada'
  motivoAnulacion: text("motivo_anulacion"),
  anuladaAt: text("anulada_at"),
  anuladaPorId: integer("anulada_por_id").references(() => usuarios.id),
  clienteId: integer("cliente_id").references(() => clientes.id), // null = consumidor final
  usuarioId: integer("usuario_id")
    .notNull()
    .references(() => usuarios.id),
  createdAt: text("created_at").notNull(),
});

export const facturaItems = sqliteTable("factura_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  facturaId: integer("factura_id")
    .notNull()
    .references(() => facturas.id),
  productoId: integer("producto_id")
    .notNull()
    .references(() => productos.id),
  cantidad: integer("cantidad").notNull(),
  precioUnitario: integer("precio_unitario").notNull(), // centavos
  subtotal: integer("subtotal").notNull(), // centavos
  descripcion: text("descripcion").notNull(),
  createdAt: text("created_at").notNull(),
});

export const movimientosStock = sqliteTable("movimientos_stock", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  productoId: integer("producto_id")
    .notNull()
    .references(() => productos.id),
  usuarioId: integer("usuario_id")
    .notNull()
    .references(() => usuarios.id),
  facturaId: integer("factura_id").references(() => facturas.id),
  tipo: text("tipo").notNull(), // 'venta' | 'anulacion' | 'ingreso' | 'egreso'
  cantidad: integer("cantidad").notNull(), // con signo
  existenciaResultante: integer("existencia_resultante").notNull(),
  motivo: text("motivo").notNull(),
  fecha: text("fecha").notNull(),
  createdAt: text("created_at").notNull(),
});

export const pagos = sqliteTable("pagos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  numeroRecibo: text("numero_recibo").notNull().unique(),
  fecha: text("fecha").notNull(),
  importe: integer("importe").notNull(), // centavos
  medio: text("medio").notNull(), // 'efectivo' | 'transferencia' | 'tarjeta_debito'
  observacion: text("observacion").notNull().default(""),
  clienteId: integer("cliente_id")
    .notNull()
    .references(() => clientes.id),
  usuarioId: integer("usuario_id")
    .notNull()
    .references(() => usuarios.id),
  createdAt: text("created_at").notNull(),
});

export const movimientosCuenta = sqliteTable("movimientos_cuenta", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clienteId: integer("cliente_id")
    .notNull()
    .references(() => clientes.id),
  facturaId: integer("factura_id").references(() => facturas.id),
  pagoId: integer("pago_id").references(() => pagos.id),
  tipo: text("tipo").notNull(), // 'debito' | 'credito'
  importe: integer("importe").notNull(), // centavos
  fecha: text("fecha").notNull(),
  descripcion: text("descripcion").notNull(),
  createdAt: text("created_at").notNull(),
});
