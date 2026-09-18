import { AlertTriangle } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatMinutes } from "@/lib/format/duration";
import type { WeeklyLoadDay } from "@/lib/data/weekly-load";

export function WeeklyLoadBars({ days }: { days: WeeklyLoadDay[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-7">
      {days.map((day) => {
        const ratio =
          day.capacityMinutes > 0
            ? Math.min(1, day.scheduledMinutes / day.capacityMinutes)
            : day.scheduledMinutes > 0
              ? 1
              : 0;

        return (
          <div
            key={day.dateKey}
            className={cn(
              "flex flex-col gap-2 rounded-lg border p-3",
              day.isOverCapacity && "border-destructive/50 bg-destructive/5"
            )}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs font-medium text-muted-foreground">
                {day.weekdayLabel.slice(0, 3)}
              </span>
              {day.isOverCapacity && (
                <AlertTriangle className="size-3.5 text-destructive" aria-label="Sobrecarga" />
              )}
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full bg-primary",
                  day.isOverCapacity && "bg-destructive"
                )}
                style={{ width: `${Math.round(ratio * 100)}%` }}
              />
            </div>
            <span
              className={cn(
                "text-sm font-medium",
                day.isOverCapacity && "text-destructive"
              )}
            >
              {formatMinutes(day.scheduledMinutes)} / {formatMinutes(day.capacityMinutes)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
