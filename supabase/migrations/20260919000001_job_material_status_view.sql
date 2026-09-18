-- Fase 2.1: corrige el cálculo de "faltante" de un job_material.
--
-- Antes, el faltante se calculaba en el frontend como:
--   estimated_quantity - current_stock
-- lo cual ignoraba el material ya consumido específicamente por ese trabajo.
-- Resultado: cuanto más se consumía correctamente en una obra, más alto
-- parecía el faltante (bug reportado: 200 estimados, 150 stock inicial,
-- se consumen 130 -> quedaban 20 de stock -> el frontend mostraba
-- "faltan 180" en lugar de "faltan 50").
--
-- Fuentes de verdad (ver README):
--   estimated_quantity  -> job_materials.estimated_quantity (necesidad total del trabajo)
--   consumed_quantity   -> job_materials.actual_quantity, mantenido en sync de forma
--                          transaccional por register_job_material_consumption (nunca se
--                          escribe desde ningún otro lugar): es un cache derivado, no una
--                          segunda fuente de verdad independiente. Semánticamente ya es
--                          consumo NETO (consumption - return), porque esa misma función
--                          es la única que genera movimientos 'consumption'/'return' con
--                          job_id, y siempre actualiza actual_quantity al mismo valor que
--                          se le pidió registrar.
--   current_stock       -> material_stock_balances (derivado de TODOS los movimientos
--                          del material, no solo los de este trabajo)
--
-- Fórmulas (única implementación en la base de datos; TS espeja esta misma
-- fórmula en src/lib/materials/requirement.ts para uso en UI/tests unitarios,
-- pero nunca la recalcula de otra forma):
--   remaining_quantity = max(estimated_quantity - consumed_quantity, 0)
--   missing_quantity   = max(remaining_quantity - current_stock, 0)
--   variance_quantity  = consumed_quantity - estimated_quantity   (sobreconsumo si > 0)
create view public.job_material_status
with (security_invoker = true) as
select
  jm.id as job_material_id,
  jm.organization_id,
  jm.job_id,
  jm.material_id,
  jm.estimated_quantity,
  coalesce(jm.actual_quantity, 0) as consumed_quantity,
  greatest(jm.estimated_quantity - coalesce(jm.actual_quantity, 0), 0) as remaining_quantity,
  coalesce(bal.current_stock, 0) as current_stock,
  greatest(
    greatest(jm.estimated_quantity - coalesce(jm.actual_quantity, 0), 0) - coalesce(bal.current_stock, 0),
    0
  ) as missing_quantity,
  coalesce(jm.actual_quantity, 0) - jm.estimated_quantity as variance_quantity
from public.job_materials jm
left join public.material_stock_balances bal
  on bal.material_id = jm.material_id and bal.organization_id = jm.organization_id;
