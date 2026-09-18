import { Plus } from "lucide-react";

import { JobTypeDialog } from "@/components/settings/job-type-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMinutesCompact } from "@/lib/format/duration";
import type { Tables } from "@/lib/supabase/database.types";

export function JobTypesPanel({ jobTypes }: { jobTypes: Tables<"job_types">[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Tipos de trabajo</CardTitle>
        <JobTypeDialog
          trigger={
            <Button size="sm">
              <Plus /> Nuevo tipo
            </Button>
          }
        />
      </CardHeader>
      <CardContent>
        {jobTypes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay tipos de trabajo.</p>
        ) : (
          <div className="flex flex-col divide-y">
            {jobTypes.map((type) => (
              <div key={type.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{type.name}</p>
                    {!type.active && <Badge variant="secondary">Inactivo</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Duración sugerida: {formatMinutesCompact(type.default_estimated_minutes)}
                  </p>
                </div>
                <JobTypeDialog
                  jobType={type}
                  trigger={
                    <Button size="sm" variant="outline">
                      Editar
                    </Button>
                  }
                />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
