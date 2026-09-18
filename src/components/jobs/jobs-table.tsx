import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatDateTime } from "@/lib/format/dates";
import { formatMinutesCompact } from "@/lib/format/duration";
import { jobPriorityLabel } from "@/lib/validations/job";
import type { JobListItem } from "@/lib/data/jobs";

const priorityVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  low: "secondary",
  normal: "outline",
  high: "default",
  urgent: "destructive",
};

export function JobsTable({ jobs, timezone }: { jobs: JobListItem[]; timezone: string }) {
  const todayKey = new Date().toISOString().slice(0, 10);

  if (jobs.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
        No hay trabajos que coincidan con los filtros.
      </div>
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Título</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Prioridad</TableHead>
            <TableHead>Duración est.</TableHead>
            <TableHead>Fecha objetivo</TableHead>
            <TableHead>Próxima sesión</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.map((job) => {
            const isOverdue =
              !job.statusIsClosed && job.targetDate != null && job.targetDate < todayKey;
            return (
              <TableRow key={job.id}>
                <TableCell className="font-medium">
                  <Link href={`/app/trabajos/${job.id}`} className="hover:underline">
                    {job.title}
                  </Link>
                </TableCell>
                <TableCell>{job.clientName}</TableCell>
                <TableCell>
                  <Badge variant={job.statusIsClosed ? "secondary" : "outline"}>
                    {job.statusName}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={priorityVariant[job.priority] ?? "outline"}>
                    {jobPriorityLabel(job.priority)}
                  </Badge>
                </TableCell>
                <TableCell>{formatMinutesCompact(job.estimatedMinutes)}</TableCell>
                <TableCell>
                  <span className={isOverdue ? "flex items-center gap-1 text-destructive" : ""}>
                    {isOverdue && <AlertTriangle className="size-3.5" />}
                    {job.targetDate ? formatDate(`${job.targetDate}T00:00:00Z`, timezone) : "-"}
                  </span>
                </TableCell>
                <TableCell>
                  {job.nextSessionAt ? formatDateTime(job.nextSessionAt, timezone) : "-"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
