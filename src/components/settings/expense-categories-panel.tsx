import { Plus } from "lucide-react";

import { ExpenseCategoryDialog } from "@/components/settings/expense-category-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Tables } from "@/lib/supabase/database.types";

export function ExpenseCategoriesPanel({ categories }: { categories: Tables<"job_expense_categories">[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Categorías de gastos directos</CardTitle>
        <ExpenseCategoryDialog
          trigger={
            <Button size="sm">
              <Plus /> Nueva categoría
            </Button>
          }
        />
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-sm text-muted-foreground">
          Se usan al registrar gastos atribuibles a un trabajo (traslados, alquileres, subcontratación, etc.).
        </p>
        <div className="flex flex-col divide-y">
          {categories.map((category) => (
            <div key={category.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
              <div className="flex items-center gap-2">
                <p className="font-medium">{category.name}</p>
                {!category.active && <Badge variant="secondary">Inactiva</Badge>}
              </div>
              <ExpenseCategoryDialog
                category={category}
                trigger={
                  <Button size="sm" variant="outline">
                    Editar
                  </Button>
                }
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
