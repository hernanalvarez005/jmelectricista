import { z } from "zod";

export const jobPriorities = ["low", "normal", "high", "urgent"] as const;

export const jobSchema = z.object({
  clientId: z.string().uuid("Seleccioná un cliente"),
  clientAddressId: z.string().uuid().optional().or(z.literal("")),
  title: z.string().trim().min(2, "Ingresá un título").max(200),
  jobTypeId: z.string().uuid().optional().or(z.literal("")),
  statusId: z.string().uuid("Seleccioná un estado"),
  priority: z.enum(jobPriorities),
  description: z.string().trim().max(4000).optional().or(z.literal("")),
  estimatedHours: z.number().int().min(0).max(999),
  estimatedMinutesPart: z.number().int().min(0).max(59),
  targetDate: z.string().optional().or(z.literal("")),
  assignedMemberId: z.string().uuid().optional().or(z.literal("")),
  notes: z.string().trim().max(4000).optional().or(z.literal("")),
});

export type JobInput = z.infer<typeof jobSchema>;

export const jobPriorityLabels: Record<(typeof jobPriorities)[number], string> = {
  low: "Baja",
  normal: "Normal",
  high: "Alta",
  urgent: "Urgente",
};

/** `priority` comes back from Supabase typed as `string` (Postgres CHECK, not an enum). */
export function jobPriorityLabel(priority: string): string {
  return jobPriorityLabels[priority as (typeof jobPriorities)[number]] ?? priority;
}
