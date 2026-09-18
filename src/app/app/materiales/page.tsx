import { MaterialsFilterBar } from "@/components/materials/materials-filter-bar";
import { MaterialsTable } from "@/components/materials/materials-table";
import { NewMaterialButton } from "@/components/materials/new-material-button";
import { requireCurrentOrg } from "@/lib/data/current-org";
import { listMaterialCategories, listMaterialUnits, listMaterials } from "@/lib/data/materials";

export default async function MaterialesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; active?: string; lowStock?: string }>;
}) {
  const params = await searchParams;
  const { organization } = await requireCurrentOrg();

  const [materials, categories, units] = await Promise.all([
    listMaterials(organization.id, {
      search: params.q,
      categoryId: params.category,
      activeOnly: params.active === "1",
      lowStockOnly: params.lowStock === "1",
    }),
    listMaterialCategories(organization.id),
    listMaterialUnits(organization.id, { activeOnly: true }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Materiales</h2>
          <p className="text-sm text-muted-foreground">
            {materials.length} material{materials.length === 1 ? "" : "es"} en total.
          </p>
        </div>
        <NewMaterialButton categories={categories} units={units} />
      </div>

      <MaterialsFilterBar categories={categories} />
      <MaterialsTable
        materials={materials}
        categories={categories}
        units={units}
        currency={organization.currency}
        timezone={organization.timezone}
      />
    </div>
  );
}
