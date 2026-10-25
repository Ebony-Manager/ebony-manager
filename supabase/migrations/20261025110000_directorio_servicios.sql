-- Directorio: rubro "Vidrios y espejos" (materiales) y los primeros 13
-- proveedores de servicios (lista del 25-oct-2026). Se puede correr dos
-- veces: no duplica (salta los nombres que ya existen).

alter table public.suppliers drop constraint if exists suppliers_rubros_check;
alter table public.suppliers add constraint suppliers_rubros_check
  check (rubros <@ array['ferreteria', 'herrajes', 'madera_laminas', 'iluminacion', 'pintura', 'vidrios',
                         'tecnico_maquinaria', 'mecanico', 'transporte', 'mantenimiento', 'subcontrato']::text[]);

insert into public.suppliers (name, kind, rubros, specialty, contact_name, phone, whatsapp, email)
select v.name, v.kind, v.rubros, v.specialty, v.contact_name, v.phone, v.whatsapp, v.email
from (values
  ('Aldemar', 'servicio', array['mantenimiento'], 'Plomero', null, '+507 6318-3664', '6318-3664', null),
  ('Esteban', 'servicio', array['mantenimiento'], 'Plomero', null, '+507 6521-5926', '6521-5926', null),
  ('Leandro', 'servicio', array['transporte'], 'Acarreos', null, '+507 6099-4079', '6099-4079', null),
  ('Delfin Valdes', 'servicio', array['transporte'], 'Acarreos (camión grande)', null, '+507 6090-5749', '6090-5749', null),
  ('Walter Marquez', 'servicio', array['tecnico_maquinaria'], 'Técnico de montacargas', null, '+507 6205-2179', '6205-2179', null),
  ('William Barreto', 'servicio', array['tecnico_maquinaria'], 'Técnico de compresores', null, '+507 6797-4114', '6797-4114', null),
  ('Galileo Salazar', 'servicio', array['tecnico_maquinaria'], 'Técnico de canteadora y escuadradora', null, '+507 6217-2873', '6217-2873', null),
  ('Felipe Velez', 'servicio', array['subcontrato'], 'Herrero', null, '+507 6556-6680', '6556-6680', null),
  ('Fredy Ramirez', 'servicio', array['subcontrato'], 'Tapicero', null, '+507 6758-0442', '6758-0442', null),
  ('Ernesto', 'servicio', array['mecanico'], 'Mecánico de camiones', null, '+507 6679-1463', '6679-1463', null),
  ('Clover', 'materiales', array['vidrios','subcontrato'], 'Vidrios y espejos (a veces instala)', null, '+507 6278-3007', '6278-3007', 'ventas@clover-design.com'),
  ('Vidtec', 'materiales', array['vidrios','subcontrato'], 'Vidrios y espejos (a veces instala)', 'Victor', '+507 6936-5251', '6936-5251', 'contabilidad@vidteccompany.com'),
  ('Mercado del Vidrio', 'materiales', array['vidrios','subcontrato'], 'Vidrios y espejos (a veces instala)', null, '+507 6764-1893', '6764-1893', null)
) as v(name, kind, rubros, specialty, contact_name, phone, whatsapp, email)
where not exists (select 1 from public.suppliers s where lower(s.name) = lower(v.name));
