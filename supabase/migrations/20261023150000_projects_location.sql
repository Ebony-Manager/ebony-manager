-- Proyectos: ubicación de la obra (se ve como subtítulo en la lista).
alter table public.projects add column if not exists location text;
