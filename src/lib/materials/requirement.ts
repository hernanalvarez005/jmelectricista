/**
 * Espejo en TypeScript de la fórmula de public.job_material_status
 * (ver supabase/migrations/20260919000001_job_material_status_view.sql).
 * La base de datos es la fuente de verdad para las pantallas; este helper
 * existe para poder testear la fórmula sin depender de una conexión a
 * Postgres y para cualquier cálculo puramente en el cliente.
 */
export type MaterialRequirementInput = {
  estimatedQuantity: number;
  consumedQuantity: number;
  currentStock: number;
};

export type MaterialRequirement = {
  estimatedQuantity: number;
  consumedQuantity: number;
  remainingQuantity: number;
  currentStock: number;
  missingQuantity: number;
  varianceQuantity: number;
};

export function calculateMaterialRequirement(input: MaterialRequirementInput): MaterialRequirement {
  const remainingQuantity = Math.max(input.estimatedQuantity - input.consumedQuantity, 0);
  const missingQuantity = Math.max(remainingQuantity - input.currentStock, 0);
  const varianceQuantity = input.consumedQuantity - input.estimatedQuantity;

  return {
    estimatedQuantity: input.estimatedQuantity,
    consumedQuantity: input.consumedQuantity,
    remainingQuantity,
    currentStock: input.currentStock,
    missingQuantity,
    varianceQuantity,
  };
}
