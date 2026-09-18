import { Plus } from "lucide-react";

import { JobStatusDialog } from "@/components/settings/job-status-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Tables } from "@/lib/supabase/database.types";

export function JobStatusesPanel({ jobStatuses }: { jobStatuses: Tables<"job_statuses">[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Estados de trabajo</CardTitle>
        <JobStatusDialog
          trigger={
            <Button size="sm">
              <Plus /> Nuevo estado
            </Button>
          }
        />
      </CardHeader>
      <CardContent>
        <div className="flex flex-col divide-y">
          {jobStatuses.map((status) => (
            <div key={status.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
              <div className="flex items-center gap-2">
                <p className="font-medium">{status.name}</p>
                {status.is_closed && <Badge variant="outline">Cierre</Badge>}
                {!status.active && <Badge variant="secondary">Inactivo</Badge>}
              </div>
              <JobStatusDialog
                jobStatus={status}
                trigger={
                  <Button size="sm" variant="outline">
                    Editar
                  </Button>
                }
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
