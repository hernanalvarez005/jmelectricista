"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { bootstrapOrganization } from "@/app/(auth)/onboarding/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { onboardingSchema, type OnboardingInput } from "@/lib/validations/onboarding";

export function OnboardingForm() {
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OnboardingInput>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: { orgName: "" },
  });

  function onSubmit(values: OnboardingInput) {
    setServerError(null);
    startTransition(async () => {
      const result = await bootstrapOrganization(values);
      if (result?.error) setServerError(result.error);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Creá tu organización</CardTitle>
        <CardDescription>
          Vas a poder invitar más personas y ajustar la configuración después.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="orgName">Nombre del negocio</Label>
            <Input
              id="orgName"
              placeholder="Ej: Electricidad Pérez"
              {...register("orgName")}
            />
            {errors.orgName && (
              <p className="text-sm text-destructive">{errors.orgName.message}</p>
            )}
          </div>
          {serverError && <p className="text-sm text-destructive">{serverError}</p>}
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Creando..." : "Crear organización"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
