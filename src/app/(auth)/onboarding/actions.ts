"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { onboardingSchema, type OnboardingInput } from "@/lib/validations/onboarding";

export async function bootstrapOrganization(
  input: OnboardingInput
): Promise<{ error: string } | never> {
  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Ingresá el nombre del negocio." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase.rpc("bootstrap_organization", {
    org_name: parsed.data.orgName,
  });

  if (error) {
    return { error: "No se pudo crear la organización. Intentá de nuevo." };
  }

  redirect("/app");
}
