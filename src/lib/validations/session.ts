import { z } from "zod";

export const jobSessionSchema = z
  .object({
    date: z.string().min(1, "Elegí una fecha"),
    startTime: z.string().min(1, "Elegí una hora de inicio"),
    endTime: z.string().min(1, "Elegí una hora de fin"),
    assignedMemberId: z.string().uuid().optional().or(z.literal("")),
    notes: z.string().trim().max(2000).optional().or(z.literal("")),
  })
  .refine((data) => data.endTime > data.startTime, {
    message: "La hora de fin debe ser posterior a la de inicio",
    path: ["endTime"],
  });

export type JobSessionInput = z.infer<typeof jobSessionSchema>;
