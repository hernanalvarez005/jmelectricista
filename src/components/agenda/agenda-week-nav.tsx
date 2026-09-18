import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { addDaysToKey } from "@/lib/scheduling/timezone";
import { formatDate } from "@/lib/format/dates";

export function AgendaWeekNav({ mondayKey, timezone }: { mondayKey: string; timezone: string }) {
  const sundayKey = addDaysToKey(mondayKey, 6);
  const prevWeek = addDaysToKey(mondayKey, -7);
  const nextWeek = addDaysToKey(mondayKey, 7);

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" asChild>
          <Link href={`/app/agenda?week=${prevWeek}`} aria-label="Semana anterior">
            <ChevronLeft />
          </Link>
        </Button>
        <Button variant="outline" size="icon" asChild>
          <Link href={`/app/agenda?week=${nextWeek}`} aria-label="Semana siguiente">
            <ChevronRight />
          </Link>
        </Button>
        <Button variant="ghost" asChild>
          <Link href="/app/agenda">Hoy</Link>
        </Button>
      </div>
      <p className="text-sm font-medium">
        {formatDate(`${mondayKey}T00:00:00Z`, timezone)} – {formatDate(`${sundayKey}T00:00:00Z`, timezone)}
      </p>
    </div>
  );
}
