import { z } from "zod";

export const onboardingSchema = z.object({
  orgName: z.string().trim().min(2, "Ingresá el nombre del negocio").max(120),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
