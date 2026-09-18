import { Plus } from "lucide-react";

import { PaymentAccountDialog } from "@/components/settings/payment-account-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { accountTypeLabels, type AccountType } from "@/lib/validations/payment";
import type { Tables } from "@/lib/supabase/database.types";

export function PaymentAccountsPanel({ paymentAccounts }: { paymentAccounts: Tables<"payment_accounts">[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Cuentas de cobro</CardTitle>
        <PaymentAccountDialog
          trigger={
            <Button size="sm">
              <Plus /> Nueva cuenta
            </Button>
          }
        />
      </CardHeader>
      <CardContent>
        {paymentAccounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay cuentas cargadas.</p>
        ) : (
          <div className="flex flex-col divide-y">
            {paymentAccounts.map((account) => (
              <div key={account.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{account.name}</p>
                    {!account.active && <Badge variant="secondary">Inactiva</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {accountTypeLabels[account.account_type as AccountType]}
                    {account.bank_name ? ` · ${account.bank_name}` : ""}
                    {account.alias ? ` · ${account.alias}` : ""}
                  </p>
                </div>
                <PaymentAccountDialog
                  paymentAccount={account}
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
