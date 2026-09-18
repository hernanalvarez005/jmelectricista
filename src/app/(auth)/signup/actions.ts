"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { signupSchema, type SignupInput } from "@/lib/validations/auth";

export async function signup(
  input: SignupInput
): Promise<{ error: string } | { checkEmail: true } | never> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Revisá los datos ingresados." };
  }

  const origin = (await headers()).get("origin");
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: origin ? `${origin}/auth/confirm` : undefined,
    },
  });

  if (error) {
    if (error.message.toLowerCase().includes("already registered")) {
      return { error: "Ya existe una cuenta con ese email." };
    }
    return { error: "No se pudo crear la cuenta. Intentá de nuevo." };
  }

  // Con confirmación de email deshabilitada (desarrollo local) la sesión
  // llega directo; en producción hay que confirmar el email primero.
  if (data.session) {
    redirect("/onboarding");
  }

  return { checkEmail: true };
}
