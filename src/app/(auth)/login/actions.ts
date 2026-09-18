"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";

export async function login(input: LoginInput): Promise<{ error: string } | never> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Revisá los datos ingresados." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { error: "Email o contraseña incorrectos." };
  }

  redirect("/app");
}
