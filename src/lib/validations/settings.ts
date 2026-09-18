import { z } from "zod";

export const jobTypeSchema = z.object({
  name: z.string().trim().min(2, "Ingresá un nombre").max(120),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  defaultEstimatedMinutes: z.coerce.number().int().min(0).max(100000).optional(),
  active: z.boolean(),
});

export type JobTypeInput = z.infer<typeof jobTypeSchema>;

export const jobStatusSchema = z.object({
  name: z.string().trim().min(2, "Ingresá un nombre").max(120),
  isClosed: z.boolean(),
  active: z.boolean(),
});

export type JobStatusInput = z.infer<typeof jobStatusSchema>;

export const businessHoursDaySchema = z
  .object({
    isWorkingDay: z.boolean(),
    startTime: z.string().optional().or(z.literal("")),
    endTime: z.string().optional().or(z.literal("")),
    breakStart: z.string().optional().or(z.literal("")),
    breakEnd: z.string().optional().or(z.literal("")),
  })
  .refine(
    (data) =>
      !data.isWorkingDay || (!!data.startTime && !!data.endTime && data.endTime > data.startTime),
    { message: "Definí un horario de inicio y fin válido", path: ["endTime"] }
  )
  .refine(
    (data) =>
      !data.breakStart ||
      (!!data.breakEnd && data.breakEnd > data.breakStart && data.breakStart >= (data.startTime ?? "") && data.breakEnd <= (data.endTime ?? "")),
    { message: "El descanso debe estar dentro del horario laboral", path: ["breakEnd"] }
  );

export type BusinessHoursDayInput = z.infer<typeof businessHoursDaySchema>;

export const organizationSettingsSchema = z.object({
  name: z.string().trim().min(2, "Ingresá el nombre del negocio").max(120),
  timezone: z.string().trim().min(1),
  currency: z.string().trim().length(3, "Usá un código de moneda ISO (ej. ARS)"),
});

export type OrganizationSettingsInput = z.infer<typeof organizationSettingsSchema>;
