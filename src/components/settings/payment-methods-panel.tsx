import { Plus } from "lucide-react";

import { PaymentMethodDialog } from "@/components/settings/payment-method-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Tables } from "@/lib/supabase/database.types";

export function PaymentMethodsPanel({ paymentMethods }: { paymentMethods: Tables<"payment_methods">[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Medios de pago</CardTitle>
        <PaymentMethodDialog
          trigger={
            <Button size="sm">
              <Plus /> Nuevo medio
            </Button>
          }
        />
      </CardHeader>
      <CardContent>
        {paymentMethods.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay medios de pago.</p>
        ) : (
          <div className="flex flex-col divide-y">
            {paymentMethods.map((method) => (
              <div key={method.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{method.name}</p>
                    {!method.active && <Badge variant="secondary">Inactivo</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {method.requires_account ? "Requiere cuenta" : "No requiere cuenta"}
                  </p>
                </div>
                <PaymentMethodDialog
                  paymentMethod={method}
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
