import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatMinutes } from "@/lib/format/duration";
import { formatTime } from "@/lib/format/dates";
import type { AgendaDay } from "@/lib/data/agenda";

export function AgendaDayCard({ day, timezone }: { day: AgendaDay; timezone: string }) {
  return (
    <Card className={cn(day.isOverCapacity && "border-destructive/50")}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-sm font-medium">
          <span>{day.weekdayLabel}</span>
          {day.isOverCapacity && <AlertTriangle className="size-4 text-destructive" />}
        </CardTitle>
        <p
          className={cn(
            "text-sm font-semibold",
            day.isOverCapacity ? "text-destructive" : "text-muted-foreground"
          )}
        >
          {formatMinutes(day.scheduledMinutes)} / {formatMinutes(day.capacityMinutes)}
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {day.sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin sesiones.</p>
        ) : (
          day.sessions.map((session) => (
            <Link
              key={session.id}
              href={`/app/trabajos/${session.jobId}`}
              className={cn(
                "flex flex-col gap-0.5 rounded-md border p-2 text-sm hover:bg-muted/50",
                session.status === "completed" && "opacity-70"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">
                  {formatTime(session.startAt, timezone)}–{formatTime(session.endAt, timezone)}
                </span>
                {session.status === "completed" && (
                  <Badge variant="secondary" className="text-xs">
                    Completada
                  </Badge>
                )}
              </div>
              <span className="truncate">{session.jobTitle}</span>
              <span className="truncate text-muted-foreground">{session.clientName}</span>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}
