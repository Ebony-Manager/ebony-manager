-- Directorio: varios contactos por proveedor y los proveedores de materiales
-- de la revisión del inventario.
--
-- 1) suppliers.contacts: lista de personas [{name, role, whatsapp}] (hoy
--    casi todo es WhatsApp; ej. Dimosa: oficina y dueña; FDC: vendedora y
--    gerente). El primero es el principal: la app copia su nombre y WhatsApp
--    a contact_name / whatsapp (lo usan el mensaje del pedido y la lista).
--    Se llena con el contacto que ya tenía cada proveedor.
-- 2) Los 17 proveedores de materiales del Excel "Inventario General" que
--    faltaban (Dimosa, COXO e IISDOO ya estaban). Rubro y especialidad salen
--    de lo que se les compra según la revisión.

alter table public.suppliers add column if not exists contacts jsonb not null default '[]'::jsonb;
alter table public.suppliers drop constraint if exists suppliers_contacts_check;
alter table public.suppliers add constraint suppliers_contacts_check check (jsonb_typeof(contacts) = 'array');

update public.suppliers
   set contacts = jsonb_build_array(jsonb_build_object(
         'name', coalesce(contact_name, ''),
         'role', '',
         'whatsapp', coalesce(whatsapp, phone, '')))
 where contacts = '[]'::jsonb and (coalesce(contact_name, '') <> '' or coalesce(whatsapp, phone, '') <> '');

insert into public.suppliers (name, kind, rubros, specialty, contact_name, whatsapp, phone, email, notes, contacts, active)
select v.name, 'materiales', v.rubros, v.specialty, nullif(v.contact, ''), nullif(v.wa, ''),
       case when v.wa = '' then null when v.wa like '+%' then v.wa else '+507 ' || v.wa end,
       v.email, v.notes,
       case when v.contact = '' and v.wa = '' then '[]'::jsonb
            else jsonb_build_array(jsonb_build_object('name', v.contact, 'role', '', 'whatsapp', v.wa)) end,
       true
  from (values
    ('Multicomercial', array['ferreteria'], 'Ferretería: ángulos, soportes, alcayatas, celulón', '', '6496-2300', null, null),
    ('Centro de Ofertas', array['ferreteria', 'mantenimiento'], 'Ferretería: tornillos y brocas. También mantenimiento de herramientas', '', '6324-6690', null, null),
    ('Novey', array['ferreteria'], 'Ferretería', '', '', null, 'Se compra directo en la sede.'),
    ('Imeca', array['herrajes'], 'Rieles', '', '6063-9411', null, null),
    ('Carbone', array['ferreteria'], 'Ferretería y suministros: discos, lijas, brocas, tape, químicos, eléctricos', '', '', null, 'Tienda en línea: carbonestore.com'),
    ('Moby', array['herrajes', 'madera_laminas'], 'Herrajes (bisagras, rieles, soportes, gola) y lámina MDF', 'Klaudia', '6849-3183', null, null),
    ('FDC', array['herrajes'], 'Herrajes: brazos mecánicos, perfil para cinta LED, burlete', 'Sara', '6823-8406', null, null),
    ('Enxamble', array['ferreteria', 'herrajes'], 'Pegamentos (PU, Carpincol, contacto, canteadora) y push open', 'Daniela', '6814-2401', null, null),
    ('Auto Repuestos y Ferretería Villalobos', array['ferreteria'], 'Auto repuestos y ferretería', '', '6967-6398', null, null),
    ('Ferretería Euroferr', array['ferreteria'], 'Avellanadores y fresas para router', '', '+57 312 540 4477', 'ferreteriaeuroferr@gmail.com', 'En Colombia.'),
    ('Hopsa', array['herrajes'], 'Rieles cierre suave', 'Ana Velásquez', '6840-3874', null, null),
    ('Lumicentro', array['iluminacion'], 'Cinta LED', '', '', null, null),
    ('Mr. Led', array['iluminacion'], 'Interruptores, conectores y transformadores LED', '', '6201-2268', null, null),
    ('Gigatech', array['iluminacion'], 'Cables eléctricos, cable RGB y termoencogible', '', '6205-9485', null, null),
    ('Abernathy', array['pintura'], 'Epóxica (Duo)', '', '6830-8134', null, null),
    ('Amazon', array['ferreteria'], 'Compras en línea', '', '', null, null),
    ('Madex', array['madera_laminas'], 'Láminas y tableros', '', '', null, null)
  ) as v(name, rubros, specialty, contact, wa, email, notes)
 where not exists (select 1 from public.suppliers s where lower(s.name) = lower(v.name));
