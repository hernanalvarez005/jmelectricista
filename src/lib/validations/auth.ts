import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().min(1, "Ingresá tu email").email("Email inválido"),
  password: z.string().min(1, "Ingresá tu contraseña"),
});

export const signupSchema = z.object({
  fullName: z.string().trim().min(2, "Ingresá tu nombre").max(120),
  email: z.string().trim().min(1, "Ingresá tu email").email("Email inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
