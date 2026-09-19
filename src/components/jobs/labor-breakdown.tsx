import { ReassignSessionMemberDialog } from "@/components/jobs/reassign-session-member-dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { LaborSessionItem } from "@/lib/data/job-economics";
import { formatDateOnly } from "@/lib/format/dates";
import { formatMinutes } from "@/lib/format/duration";
import { formatMoney } from "@/lib/format/money";

const issueLabels = {
  no_time: "Sin tiempo real",
  no_member: "Sin responsable asignado",
  no_rate: "Costo laboral no configurado",
} as const;

function IssueBadge({ issue }: { issue: LaborSessionItem["issue"] }) {
  if (issue === "ok") return null;
  return <Badge variant="outline" className="border-warning/60 text-warning">{issueLabels[issue]}</Badge>;
}

export function LaborBreakdown({
  jobId,
  sessions,
  currency,
  members,
  canReassign,
}: {
  jobId: string;
  sessions: LaborSessionItem[];
  currency: string;
  members: { id: string; fullName: string }[];
  canReassign: boolean;
}) {
  if (sessions.length === 0) {
    return <p className="text-sm text-muted-foreground">Todavía no hay sesiones con tiempo real en este trabajo.</p>;
  }

  const reassign = (s: LaborSessionItem) =>
    canReassign && s.issue !== "no_time" ? (
      <ReassignSessionMemberDialog jobId={jobId} sessionId={s.id} currentMemberId={s.memberId} members={members} hasCost={s.hourlyCost !== null} />
    ) : null;

  return (
    <>
      <div className="flex flex-col gap-3 sm:hidden">
        {sessions.map((s) => (
          <div key={s.id} className="rounded-lg border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm text-muted-foreground">{formatDateOnly(s.dateKey)}</p>
                <p className="font-medium">{s.memberName ?? "Sin responsable asignado"}</p>
              </div>
              <p className="text-lg font-semibold">{s.cost !== null ? formatMoney(s.cost, currency) : "-"}</p>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {s.minutes !== null ? formatMinutes(s.minutes) : "Sin tiempo real"}
              {s.hourlyCost !== null ? ` × ${formatMoney(s.hourlyCost, currency)}/h` : ""}
            </p>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <IssueBadge issue={s.issue} />
              {reassign(s)}
            </div>
          </div>
        ))}
      </div>

      <div className="hidden rounded-lg border sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Responsable</TableHead>
              <TableHead className="text-right">Tiempo real</TableHead>
              <TableHead className="text-right">Tarifa congelada</TableHead>
              <TableHead className="text-right">Costo</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-40" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sessions.map((s) => (
              <TableRow key={s.id}>
                <TableCell>{formatDateOnly(s.dateKey)}</TableCell>
                <TableCell>{s.memberName ?? <span className="text-warning">Sin responsable asignado</span>}</TableCell>
                <TableCell className="text-right">{s.minutes !== null ? formatMinutes(s.minutes) : "-"}</TableCell>
                <TableCell className="text-right">{s.hourlyCost !== null ? `${formatMoney(s.hourlyCost, currency)}/h` : "-"}</TableCell>
                <TableCell className="text-right font-medium">{s.cost !== null ? formatMoney(s.cost, currency) : "-"}</TableCell>
                <TableCell>
                  <IssueBadge issue={s.issue} />
                </TableCell>
                <TableCell>{reassign(s)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
