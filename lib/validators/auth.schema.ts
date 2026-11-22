import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email("Ingrese un email válido."),
  password: z.string().min(1, "La contraseña es obligatoria."),
});

export const changePasswordSchema = z.object({
  actual: z.string().min(1, "Ingrese su contraseña actual."),
  nueva: z
    .string()
    .min(8, "La nueva contraseña debe tener al menos 8 caracteres."),
});

export const createUsuarioSchema = z.object({
  nombre: z.string().trim().min(2, "El nombre es obligatorio."),
  email: z.string().trim().email("Ingrese un email válido."),
  rol: z.enum(["admin", "vendedor"]),
  password: z
    .string()
    .min(8, "La contraseña temporal debe tener al menos 8 caracteres."),
});

export const updateUsuarioSchema = z
  .object({
    nombre: z.string().trim().min(2, "El nombre es obligatorio.").optional(),
    email: z.string().trim().email("Ingrese un email válido.").optional(),
    rol: z.enum(["admin", "vendedor"]).optional(),
    activo: z.boolean().optional(),
  })
  .strict();