import { z } from "zod";

export const createCategoriaSchema = z.object({
  nombre: z.string().trim().min(2, "El nombre es obligatorio."),
});

export const updateCategoriaSchema = z
  .object({
    nombre: z.string().trim().min(2, "El nombre es obligatorio.").optional(),
    activa: z.boolean().optional(),
  })
  .strict();

export const createProductoSchema = z.object({
  codigo: z.string().trim().min(1, "El código es obligatorio."),
  descripcion: z.string().trim().min(2, "La descripción es obligatoria."),
  categoriaId: z.coerce.number().int().positive("Seleccione una categoría."),
  precio: z.coerce
    .number()
    .int()
    .positive("El precio debe ser mayor a cero (en centavos)."),
  stockMinimo: z.coerce
    .number()
    .int()
    .min(0, "El stock mínimo no puede ser negativo."),
  stockInicial: z.coerce
    .number()
    .int()
    .min(0, "El stock inicial no puede ser negativo.")
    .optional(),
});

export const updateProductoSchema = z
  .object({
    codigo: z.string().trim().min(1, "El código es obligatorio.").optional(),
    descripcion: z
      .string()
      .trim()
      .min(2, "La descripción es obligatoria.")
      .optional(),
    categoriaId: z.coerce
      .number()
      .int()
      .positive("Seleccione una categoría.")
      .optional(),
    precio: z.coerce
      .number()
      .int()
      .positive("El precio debe ser mayor a cero.")
      .optional(),
    stockMinimo: z.coerce
      .number()
      .int()
      .min(0, "El stock mínimo no puede ser negativo.")
      .optional(),
    activo: z.boolean().optional(),
  })
  .strict();

export const MOTIVOS_INGRESO = [
  "Reposición",
  "Stock inicial",
  "Devolución de cliente",
] as const;

export const MOTIVOS_EGRESO = [
  "Rotura",
  "Vencimiento",
  "Ajuste de inventario",
  "Uso interno",
] as const;

export const createMovimientoStockSchema = z.object({
  tipo: z.enum(["ingreso", "egreso"]),
  cantidad: z.coerce
    .number()
    .int()
    .positive("La cantidad debe ser mayor a cero."),
  motivo: z.string().trim().min(2, "El motivo es obligatorio."),
  observacion: z.string().trim().optional(),
});