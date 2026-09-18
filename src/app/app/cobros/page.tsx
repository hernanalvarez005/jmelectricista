import { Landmark, ListChecks, TrendingUp, Wallet } from "lucide-react";

import { OutstandingBalancesTable } from "@/components/payments/outstanding-balances-table";
import { PaymentsFilterBar } from "@/components/payments/payments-filter-bar";
import { RecentPaymentsList } from "@/components/payments/recent-payments-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireCurrentOrg } from "@/lib/data/current-org";
import {
  getJobsWithOutstandingBalance,
  getPaymentsDashboardStats,
  getRecentPayments,
  listPaymentAccounts,
  listPaymentMethods,
} from "@/lib/data/payments";
import { listClients } from "@/lib/data/clients";
import { addDaysToKey, todayKeyInTZ } from "@/lib/scheduling/timezone";
import { formatMoney } from "@/lib/format/money";

export default async function CobrosPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; method?: string; account?: string; period?: string }>;
}) {
  const params = await searchParams;
  const { organization } = await requireCurrentOrg();

  const todayKey = todayKeyInTZ(organization.timezone);
  const sinceDate =
    params.period === "30" ? addDaysToKey(todayKey, -30) : params.period === "90" ? addDaysToKey(todayKey, -90) : undefined;

  const [stats, balances, recentPayments, clients, paymentMethods, paymentAccounts] = await Promise.all([
    getPaymentsDashboardStats(organization.id, organization.timezone),
    getJobsWithOutstandingBalance(organization.id),
    getRecentPayments(organization.id, {
      clientId: params.client,
      paymentMethodId: params.method,
      paymentAccountId: params.account,
      sinceDate,
    }),
    listClients(organization.id),
    listPaymentMethods(organization.id, { activeOnly: true }),
    listPaymentAccounts(organization.id, { activeOnly: true }),
  ]);

  const kpis = [
    { label: "Cobrado este mes", value: formatMoney(stats.collectedThisMonth, organization.currency), icon: TrendingUp },
    { label: "Saldo pendiente", value: formatMoney(stats.outstandingTotal, organization.currency), icon: Wallet },
    { label: "Trabajos con saldo", value: String(stats.jobsWithBalanceCount), icon: ListChecks },
    { label: "Finalizados con saldo", value: String(stats.closedJobsWithBalanceCount), icon: Landmark },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold">Cobros</h2>
        <p className="text-sm text-muted-foreground">Quién te debe, cuánto y qué cobraste últimamente.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.label}</CardTitle>
              <kpi.icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Saldos pendientes</CardTitle>
        </CardHeader>
        <CardContent>
          {balances.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ningún trabajo tiene saldo pendiente.</p>
          ) : (
            <OutstandingBalancesTable balances={balances} currency={organization.currency} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cobros recientes</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <PaymentsFilterBar clients={clients} paymentMethods={paymentMethods} paymentAccounts={paymentAccounts} />
          {recentPayments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no registraste cobros.</p>
          ) : (
            <RecentPaymentsList payments={recentPayments} currency={organization.currency} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
