import { ZodSchema } from "zod";
import { ApiError } from "@/lib/api-error";

export function parseWithSchema<T>(schema: ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      campo: issue.path.join(".") || "general",
      mensaje: issue.message,
    }));
    throw new ApiError(422, "VALIDACION", "Hay campos con errores.", details);
  }
  return result.data;
}