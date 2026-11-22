import { z } from "zod";

const pagoContadoSchema = z.object({
  forma: z.literal("contado"),
  montoRecibido: z.coerce.number().int().positive().optional(),
});

const pagoTarjetaSchema = z.object({
  forma: z.literal("tarjeta"),
  tarjeta: z
    .object({
      tipo: z.enum(["debito", "credito"]),
      marca: z.string().trim().min(2, "Indique la marca de la tarjeta."),
      ultimos4: z
        .string()
        .trim()
        .regex(/^\d{4}$/, "Ingrese exactamente los últimos 4 dígitos."),
    })
    .strict(),
});

const pagoCuentaCorrienteSchema = z.object({
  forma: z.literal("cuenta_corriente"),
});

export const createFacturaSchema = z.object({
  clienteId: z.coerce.number().int().positive().nullable().default(null),
  items: z
    .array(
      z.object({
        productoId: z.coerce.number().int().positive(),
        cantidad: z.coerce.number().int().positive("Cantidad mínima: 1."),
      })
    )
    .min(1, "Debe agregar al menos un producto."),
  pago: z.discriminatedUnion("forma", [
    pagoContadoSchema,
    pagoTarjetaSchema,
    pagoCuentaCorrienteSchema,
  ]),
});

export const anularFacturaSchema = z.object({
  motivo: z.string().trim().min(3, "Debe indicar el motivo de anulación."),
});