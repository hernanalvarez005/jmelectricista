-- Fase 3: un trabajo puede tener múltiples cotizaciones históricas, pero
-- solo una puede estar "accepted" a la vez (es la base comercial vigente
-- que determina contracted_amount). Verificado antes de aplicar esta
-- migration que no existían trabajos con más de una cotización aceptada en
-- ningún ambiente (dev local): 2 cotizaciones accepted en total, cada una en
-- un trabajo distinto — sin conflictos que resolver manualmente.
create unique index quotes_one_accepted_per_job
  on public.quotes (job_id)
  where status = 'accepted';
