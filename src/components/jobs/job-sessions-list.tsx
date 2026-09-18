"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { updateJobSessionStatusAction } from "@/app/app/trabajos/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatTime } from "@/lib/format/dates";
import { formatMinutes } from "@/lib/format/duration";
import { sessionDurationMinutes } from "@/lib/scheduling/capacity";
import type { Tables } from "@/lib/supabase/database.types";

const statusLabels: Record<string, string> = {
  scheduled: "Programada",
  completed: "Completada",
  cancelled: "Cancelada",
};

const statusVariant: Record<string, "default" | "secondary" | "outline"> = {
  scheduled: "default",
  completed: "secondary",
  cancelled: "outline",
};

export function JobSessionsList({
  jobId,
  sessions,
  membersById,
  timezone,
}: {
  jobId: string;
  sessions: Tables<"job_sessions">[];
  membersById: Record<string, string>;
  timezone: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function updateStatus(sessionId: string, status: "completed" | "cancelled") {
    startTransition(async () => {
      const result = await updateJobSessionStatusAction(jobId, sessionId, status);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  if (sessions.length === 0) {
    return <p className="text-sm text-muted-foreground">Todavía no hay sesiones programadas.</p>;
  }

  return (
    <div className="flex flex-col divide-y">
      {sessions.map((session) => (
        <div
          key={session.id}
          className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0"
        >
          <div>
            <p className="font-medium">
              {formatDateTime(session.planned_start_at, timezone)} –{" "}
              {formatTime(session.planned_end_at, timezone)}
            </p>
            <p className="text-sm text-muted-foreground">
              {formatMinutes(
                sessionDurationMinutes(session.planned_start_at, session.planned_end_at)
              )}
              {session.assigned_member_id && membersById[session.assigned_member_id]
                ? ` · ${membersById[session.assigned_member_id]}`
                : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={statusVariant[session.status] ?? "outline"}>
              {statusLabels[session.status] ?? session.status}
            </Badge>
            {session.status === "scheduled" && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => updateStatus(session.id, "completed")}
                >
                  Completar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={isPending}
                  onClick={() => updateStatus(session.id, "cancelled")}
                >
                  Cancelar
                </Button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
