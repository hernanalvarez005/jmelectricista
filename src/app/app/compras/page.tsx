import { Plus } from "lucide-react";
import Link from "next/link";

import { PurchasesFilterBar } from "@/components/purchases/purchases-filter-bar";
import { PurchasesTable } from "@/components/purchases/purchases-table";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { canOperate, requireCurrentOrg } from "@/lib/data/current-org";
import { getPurchasesDashboardStats, listPurchases } from "@/lib/data/purchases";
import { listSuppliers } from "@/lib/data/suppliers";
import { formatMoney } from "@/lib/format/money";

export default async function ComprasPage({
  searchParams,
}: {
  searchParams: Promise<{ supplier?: string; status?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const { organization, role } = await requireCurrentOrg();

  const [purchases, suppliers, stats] = await Promise.all([
    listPurchases(organization.id, {
      supplierId: params.supplier,
      status: params.status,
      from: params.from,
      to: params.to,
    }),
    listSuppliers(organization.id),
    getPurchasesDashboardStats(organization.id, organization.timezone),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Compras</h2>
          <p className="text-sm text-muted-foreground">Compras a proveedores: al recibirlas ingresan stock valorizado.</p>
        </div>
        {canOperate(role) && (
          <Link href="/app/compras/nueva" className={buttonVariants()}>
            <Plus /> Nueva compra
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Compras del mes (recibidas)</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{formatMoney(stats.purchasedThisMonth, organization.currency)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Materiales sin valoración</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{stats.materialsWithoutValuation}</CardContent>
        </Card>
      </div>

      <PurchasesFilterBar suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))} />
      <PurchasesTable purchases={purchases} currency={organization.currency} />
    </div>
  );
}
