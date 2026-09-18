import { redirect } from "next/navigation";

import { PurchaseForm } from "@/components/purchases/purchase-form";
import { canOperate, requireCurrentOrg } from "@/lib/data/current-org";
import { getJobShortages, listPurchasableMaterials } from "@/lib/data/purchases";
import { listSuppliers } from "@/lib/data/suppliers";
import { todayKeyInTZ } from "@/lib/scheduling/timezone";

export default async function NuevaCompraPage({ searchParams }: { searchParams: Promise<{ job?: string }> }) {
  const params = await searchParams;
  const { organization, role } = await requireCurrentOrg();
  if (!canOperate(role)) redirect("/app/compras");

  const [suppliers, materials, shortages] = await Promise.all([
    listSuppliers(organization.id),
    listPurchasableMaterials(organization.id),
    params.job ? getJobShortages(organization.id, params.job) : Promise.resolve(null),
  ]);

  const materialIds = new Set(materials.map((m) => m.id));
  const prefillItems = (shortages?.items ?? [])
    .filter((i) => materialIds.has(i.materialId))
    .map((i) => ({ materialId: i.materialId, quantity: String(i.quantity).replace(".", ",") }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold">Nueva compra</h2>
        <p className="text-sm text-muted-foreground">Se guarda como borrador; no modifica el stock hasta que la recibas.</p>
      </div>
      {params.job && !shortages && (
        <p className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive">No se encontró el trabajo indicado.</p>
      )}
      {shortages && prefillItems.length === 0 && (
        <p className="rounded-lg border p-3 text-sm text-muted-foreground">Este trabajo no tiene materiales faltantes.</p>
      )}
      <PurchaseForm
        suppliers={suppliers.filter((s) => s.active).map((s) => ({ id: s.id, name: s.name }))}
        materials={materials}
        todayKey={todayKeyInTZ(organization.timezone)}
        currency={organization.currency}
        prefill={{
          sourceJobId: shortages ? params.job : undefined,
          sourceJobTitle: shortages?.jobTitle,
          items: prefillItems,
        }}
      />
    </div>
  );
}
