import { z } from "zod";

export const createClienteSchema = z.object({
  tipoDoc: z.enum(["DNI", "CUIT"]),
  nroDoc: z.string().trim().min(6, "El número de documento es obligatorio."),
  nombre: z.string().trim().min(2, "El nombre o razón social es obligatorio."),
  domicilio: z.string().trim().optional().default(""),
  telefono: z.string().trim().optional().default(""),
  email: z
    .string()
    .trim()
    .email("Ingrese un email válido.")
    .or(z.literal(""))
    .optional()
    .default(""),
  cuentaCorriente: z.boolean().optional().default(false),
  limiteCredito: z.coerce
    .number()
    .int()
    .min(0, "El límite de crédito no puede ser negativo.")
    .nullable()
    .optional()
    .default(null),
});

export const updateClienteSchema = z
  .object({
    tipoDoc: z.enum(["DNI", "CUIT"]).optional(),
    nroDoc: z.string().trim().min(6).optional(),
    nombre: z.string().trim().min(2).optional(),
    domicilio: z.string().trim().optional(),
    telefono: z.string().trim().optional(),
    email: z.string().trim().email().or(z.literal("")).optional(),
    cuentaCorriente: z.boolean().optional(),
    limiteCredito: z.coerce.number().int().min(0).nullable().optional(),
    activo: z.boolean().optional(),
  })
  .strict();

export const createPagoSchema = z.object({
  importe: z.coerce
    .number()
    .int()
    .positive("El importe debe ser mayor a cero."),
  medio: z.enum(["efectivo", "transferencia", "tarjeta_debito"]),
  observacion: z.string().trim().optional().default(""),
});