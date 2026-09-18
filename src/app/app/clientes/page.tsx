import { Plus } from "lucide-react";

import { ClientFormSheet } from "@/components/clients/client-form-sheet";
import { ClientsTable } from "@/components/clients/clients-table";
import { Button } from "@/components/ui/button";
import { requireCurrentOrg } from "@/lib/data/current-org";
import { listClients } from "@/lib/data/clients";

export default async function ClientesPage() {
  const { organization } = await requireCurrentOrg();
  const clients = await listClients(organization.id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Clientes</h2>
          <p className="text-sm text-muted-foreground">
            {clients.length} cliente{clients.length === 1 ? "" : "s"} en total.
          </p>
        </div>
        <ClientFormSheet
          trigger={
            <Button>
              <Plus /> Nuevo cliente
            </Button>
          }
        />
      </div>
      <ClientsTable clients={clients} />
    </div>
  );
}
