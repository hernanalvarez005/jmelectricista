import { Plus } from "lucide-react";

import { BackfillLaborButton, LaborRateHistory } from "@/components/settings/labor-member-actions";
import { LaborRateDialog } from "@/components/settings/labor-rate-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MemberLaborInfo } from "@/lib/data/labor";
import { formatDateOnly } from "@/lib/format/dates";
import { formatMoney } from "@/lib/format/money";

const roleLabels: Record<string, string> = { owner: "Owner", admin: "Admin", worker: "Operario", viewer: "Solo lectura" };

export function LaborRatesPanel({ members, currency, todayKey }: { members: MemberLaborInfo[]; currency: string; todayKey: string }) {
  const totalPending = members.reduce((sum, m) => sum + m.sessionsWithoutCost, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Costos de mano de obra</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Costo interno por hora de cada persona, con vigencia. Se congela en cada sesión al cargar su tiempo real: cambiar una tarifa nunca
          modifica trabajos ya realizados. Solo lo ven owner y admin.
        </p>
        {totalPending > 0 && (
          <div className="flex flex-col gap-2 rounded-lg border border-warning/50 bg-warning/5 p-3 text-sm">
            <p>
              Hay {totalPending} sesión{totalPending === 1 ? "" : "es"} con tiempo real y responsable sin costo laboral. Cargá una tarifa con la
              vigencia correspondiente y luego asignales costo de forma explícita.
            </p>
            <BackfillLaborButton pending={totalPending} />
          </div>
        )}
        <div className="flex flex-col divide-y">
          {members.map((member) => (
            <div key={member.memberId} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{member.fullName}</p>
                    <Badge variant="outline">{roleLabels[member.role] ?? member.role}</Badge>
                  </div>
                  {member.currentRate ? (
                    <p className="text-sm">
                      Tarifa actual <span className="font-medium">{formatMoney(member.currentRate.hourlyCost, currency)} / hora</span>
                      <span className="text-muted-foreground"> · vigente desde {formatDateOnly(member.currentRate.validFrom)}</span>
                    </p>
                  ) : (
                    <p className="text-sm text-warning">Tarifa no configurada</p>
                  )}
                </div>
                <LaborRateDialog
                  memberId={member.memberId}
                  memberName={member.fullName}
                  todayKey={todayKey}
                  trigger={
                    <Button size="sm" variant="outline">
                      <Plus /> Nueva tarifa
                    </Button>
                  }
                />
              </div>
              <LaborRateHistory rates={member.rates} currency={currency} />
              {member.sessionsWithoutCost > 0 && (
                <p className="text-sm text-muted-foreground">
                  {member.sessionsWithoutCost} sesión{member.sessionsWithoutCost === 1 ? "" : "es"} de {member.fullName} sin valorizar.
                </p>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
