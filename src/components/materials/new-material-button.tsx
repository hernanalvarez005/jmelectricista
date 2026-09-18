"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { MaterialFormSheet } from "@/components/materials/material-form-sheet";
import { Button } from "@/components/ui/button";
import type { Tables } from "@/lib/supabase/database.types";

export function NewMaterialButton({
  categories,
  units,
}: {
  categories: Tables<"material_categories">[];
  units: Tables<"material_units">[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus /> Nuevo material
      </Button>
      <MaterialFormSheet open={open} onOpenChange={setOpen} categories={categories} units={units} />
    </>
  );
}
