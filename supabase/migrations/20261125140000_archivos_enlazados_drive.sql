-- Diseño y orden de producción: un archivo se puede escoger del Drive del proyecto en vez de subirlo otra vez.
-- `linked` = se escogió de Drive (es de la diseñadora): al quitarlo de un ítem o de una orden solo se desvincula,
-- nunca se manda a la papelera.
alter table public.project_item_files add column if not exists linked boolean not null default false;
alter table public.production_order_files add column if not exists linked boolean not null default false;
comment on column public.project_item_files.linked is 'Escogido de Drive (no subido por la app): al quitarlo no se borra de Drive.';
comment on column public.production_order_files.linked is 'Escogido de Drive (no subido por la app): al quitarlo no se borra de Drive.';
