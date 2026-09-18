"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { updateBusinessHoursDayAction } from "@/app/app/configuracion/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { weekdayLabel } from "@/lib/scheduling/timezone";
import type { Tables } from "@/lib/supabase/database.types";

type Row = {
  id: string;
  weekday: number;
  isWorkingDay: boolean;
  startTime: string;
  endTime: string;
  breakStart: string;
  breakEnd: string;
};

function toRow(bh: Tables<"business_hours">): Row {
  return {
    id: bh.id,
    weekday: bh.weekday,
    isWorkingDay: bh.is_working_day,
    startTime: bh.start_time?.slice(0, 5) ?? "",
    endTime: bh.end_time?.slice(0, 5) ?? "",
    breakStart: bh.break_start?.slice(0, 5) ?? "",
    breakEnd: bh.break_end?.slice(0, 5) ?? "",
  };
}

export function BusinessHoursPanel({
  businessHours,
}: {
  businessHours: Tables<"business_hours">[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(() =>
    [...businessHours].sort((a, b) => a.weekday - b.weekday).map(toRow)
  );
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});

  function updateRow(id: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function saveRow(row: Row) {
    setErrors((prev) => ({ ...prev, [row.id]: "" }));
    startTransition(async () => {
      const result = await updateBusinessHoursDayAction(row.id, {
        isWorkingDay: row.isWorkingDay,
        startTime: row.startTime,
        endTime: row.endTime,
        breakStart: row.breakStart,
        breakEnd: row.breakEnd,
      });
      if ("error" in result) {
        setErrors((prev) => ({ ...prev, [row.id]: result.error }));
        return;
      }
      toast.success(`${weekdayLabel(row.weekday)} actualizado`);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Horarios laborales</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col divide-y">
        {rows.map((row) => (
          <div key={row.id} className="flex flex-wrap items-center gap-4 py-4 first:pt-0 last:pb-0">
            <div className="flex w-32 items-center gap-2">
              <Switch
                checked={row.isWorkingDay}
                onCheckedChange={(checked) => updateRow(row.id, { isWorkingDay: checked })}
              />
              <span className="text-sm font-medium">{weekdayLabel(row.weekday)}</span>
            </div>

            {row.isWorkingDay && (
              <>
                <TimeField
                  label="Inicio"
                  value={row.startTime}
                  onChange={(v) => updateRow(row.id, { startTime: v })}
                />
                <TimeField
                  label="Fin"
                  value={row.endTime}
                  onChange={(v) => updateRow(row.id, { endTime: v })}
                />
                <TimeField
                  label="Descanso desde"
                  value={row.breakStart}
                  onChange={(v) => updateRow(row.id, { breakStart: v })}
                />
                <TimeField
                  label="Descanso hasta"
                  value={row.breakEnd}
                  onChange={(v) => updateRow(row.id, { breakEnd: v })}
                />
              </>
            )}

            <Button size="sm" variant="outline" disabled={isPending} onClick={() => saveRow(row)}>
              Guardar
            </Button>

            {errors[row.id] && (
              <p className="w-full text-sm text-destructive">{errors[row.id]}</p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function TimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="time"
        className="w-28"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
