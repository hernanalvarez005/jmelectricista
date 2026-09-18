import { Plus } from "lucide-react";

import { SupplierFormSheet } from "@/components/suppliers/supplier-form-sheet";
import { SuppliersTable } from "@/components/suppliers/suppliers-table";
import { Button } from "@/components/ui/button";
import { requireCurrentOrg } from "@/lib/data/current-org";
import { listSuppliers } from "@/lib/data/suppliers";

export default async function ProveedoresPage() {
  const { organization } = await requireCurrentOrg();
  const suppliers = await listSuppliers(organization.id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Proveedores</h2>
          <p className="text-sm text-muted-foreground">
            {suppliers.length} proveedor{suppliers.length === 1 ? "" : "es"} en total.
          </p>
        </div>
        <SupplierFormSheet
          trigger={
            <Button>
              <Plus /> Nuevo proveedor
            </Button>
          }
        />
      </div>
      <SuppliersTable suppliers={suppliers} timezone={organization.timezone} />
    </div>
  );
}
