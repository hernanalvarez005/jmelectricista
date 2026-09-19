"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { updateOrganizationAction } from "@/app/app/configuracion/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  organizationSettingsSchema,
  type OrganizationSettingsInput,
} from "@/lib/validations/settings";
import type { Tables } from "@/lib/supabase/database.types";

export function OrganizationForm({ organization }: { organization: Tables<"organizations"> }) {
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OrganizationSettingsInput>({
    resolver: zodResolver(organizationSettingsSchema),
    defaultValues: {
      name: organization.name,
      timezone: organization.timezone,
      currency: organization.currency,
      defaultCountryCode: organization.default_country_code,
    },
  });

  function onSubmit(values: OrganizationSettingsInput) {
    setServerError(null);
    startTransition(async () => {
      const result = await updateOrganizationAction(values);
      if ("error" in result) {
        setServerError(result.error);
        return;
      }
      toast.success("Negocio actualizado");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Negocio</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="grid max-w-md gap-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" {...register("name")} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="timezone">Zona horaria</Label>
            <Input id="timezone" {...register("timezone")} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="currency">Moneda (código ISO)</Label>
            <Input id="currency" maxLength={3} {...register("currency")} />
            {errors.currency && (
              <p className="text-sm text-destructive">{errors.currency.message}</p>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="defaultCountryCode">País para teléfonos (código ISO)</Label>
            <Input id="defaultCountryCode" maxLength={2} className="uppercase" {...register("defaultCountryCode")} />
            <p className="text-xs text-muted-foreground">
              Se usa para interpretar los teléfonos sin código de país al armar enlaces de WhatsApp (por ejemplo AR, UY, CL).
            </p>
            {errors.defaultCountryCode && <p className="text-sm text-destructive">{errors.defaultCountryCode.message}</p>}
          </div>
          {serverError && <p className="text-sm text-destructive">{serverError}</p>}
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Guardando..." : "Guardar"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
