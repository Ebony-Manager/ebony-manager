-- Corrección de datos: pagos de contratistas cargados como "Préstamo".
--
-- La carga masiva desde Excel guardó como Préstamo los abonos semanales a
-- proyectos ("Abono a proyectos", "Proyectos Varios", "Avance a proyectos")
-- de Elkin Amado y Yomar Arias (que no tenían ni un solo Pago), y unos
-- pocos de Willian Rueda y Jesus Herrera marcados "Proyectos Varios". Son
-- pagos. Cambiar la categoría NO cambia ningún saldo (Préstamo y Pago
-- reducen igual); sí corrige los resúmenes (pagado vs. prestado).
--
-- También:
--  * Hemer Mora: "Descuento material coco" → Material; "Días de ayudante"
--    → Gasto operativo (ambos reducen igual).
--  * Elkin Amado: 6 "Abono a deuda" guardados como Pago a favor (Pago
--    siempre reduce en la app) → Ajuste a favor, mismo sentido y monto.
--  * Elkin Amado: el abono del 2026-12-03 es del 2025-12-03 (cae entre los
--    abonos de nov–dic 2025; sin descripción).
--
-- Se dejan como Préstamo los que sí parecen préstamos (el "prerstamo" de
-- Yomar del 2026-06-09, los de Jesus Herrera de ene-2025, Jhonattan Marcano,
-- Miguel Solaris).
--
-- Para revertir: los ids de cada grupo están abajo; la categoría anterior
-- era 'prestamo' en todos menos el grupo E ('pago').

-- A + B + C: préstamo → pago
update public.contractor_ledger_entries set category = 'pago'
where category = 'prestamo' and id in (
  -- A: Elkin Amado (61)
  '2346a84f-7b9d-4744-a111-f68bd0624dbd','2bf018de-431a-43dc-96a8-4ffad5aa84b1','f5e781aa-6c74-4a1c-ae59-4b86eb036c16','881f4764-47e2-4dc8-8a50-5434c97d151a',
  '52bc2f65-1988-42e7-a83c-f1486b6b1ca1','342001cf-374a-419a-9516-78ce947d5d75','54227cee-1262-4866-b41d-54654b745395','a7645cdf-d5da-47c0-a217-77f5deec6262',
  '93541fa0-f251-4bb0-90a8-287577a664b5','eec08a36-ba77-4cbe-aac8-c3e6493e7db4','1026f15c-49ef-46c2-a873-53c521a51de1','db56c31b-8db7-49e4-bcff-8eb0f8ce95ee',
  '5f9b8096-3bf8-4795-a98b-973e9442f11e','9ea1f166-d102-469e-affc-d40eaeb6dae6','7f65e26d-0c83-436e-9a03-4aedbbf949a5','d352e649-bb7b-4748-b61f-df6dc170a01e',
  '4932b9d5-1fae-41cf-899c-5a834368de01','d599643c-8425-4a3e-a0f7-e41b2074733e','29077419-8220-4728-9dc0-6ecb53fc0416','73ca6a91-dddc-4ab7-bb85-323d0b7ba05a',
  '0dc1ea12-2b02-4439-af6c-e51b12bd275f','657e800a-6f4b-493a-aed5-a8e0da2503fa','8f2d5eaf-1acb-4484-89c3-4b46c3642678','4a8ade4f-62fc-45df-9e9a-3cf32b263d2a',
  '063beaaa-1813-4238-9910-52efe95417df','30e4e32f-cbbf-4a9a-844e-0f5362aa5734','c76a0c17-0a60-44fa-be71-51d4254abd96','6df69240-ec05-491f-84ea-be4892da466f',
  '37e5efae-f10b-4539-b3fc-6c0b1ac47a61','02564e20-1a29-454d-8f0c-b66e5f34b3a6','5cb6b414-40de-4d9d-838b-b22f65b537bf','f9e82f25-6249-4403-9dd0-bed8ea89d576',
  '4df7b2e6-fc03-419f-b45e-118ae9c8619b','24595d60-cd85-41ba-8eb7-adfdfdae1cfc','27dd16a3-2d31-4898-a60a-be8217640d9e','b997b5ed-2c74-4301-92d1-e88a9187c1d1',
  'd1c21531-fe87-4971-9690-fe06010f9053','9983704b-8a2d-458e-9766-adb8f93f9f1c','26415d8a-2345-4877-ab68-1f33c901f49c','b79c9c7b-d2a2-4756-a979-42e423167c18',
  '6cc64ea8-3a63-400c-819e-d7b412d8319f','617bc76b-7ddc-4e57-bcde-2278c2f92e49','0aca6d48-6606-489a-8b01-54ee3566341e','9c4ab614-70c7-4b31-9ce4-a21b84d27903',
  '32730150-e472-4a89-8d04-6a83b51f050f','0d52847e-fc54-4df2-9085-9845f8aa60e9','5cd7a769-64c9-494d-b968-b88a11936389','7958f3b8-f221-4c9b-9a92-0ea813737e37',
  '7d9a1be9-44f1-4995-a06e-61edeb0df974','6db2b680-3e97-4091-9bc8-fd0fb0101bff','9e940556-32ed-4110-b33f-44012c34c5cd','15f80b9d-e6b5-4f73-bd47-7672e219f8e5',
  '8e7f89bf-f545-4c26-9bbd-14a39286dc88','dafd2c8d-24bb-47f9-8389-13dda64d6eb2','a9e92960-fb36-4134-a82d-9c0ef49134eb','09a01e7f-0f48-4d07-9c31-4bc7034a4a15',
  '1beef53d-8594-42ff-a085-eedf3b0e10b6','00413569-8dbc-463c-ba10-ccc2fd3b6c24','df54ec06-ac62-4cb9-9a51-1c65585b635c','3ba9da0f-9fdd-482c-858a-969fb10942ce',
  'cc298803-1421-4240-9c3e-55250eeec365',
  -- B: Yomar Arias (19)
  '7beac40e-9313-48b9-acad-91d95999398b','6495fd90-fc38-49ec-9621-64a24ee2e6f7','1482afb2-fbf8-4441-a42a-4b6cc34b9808','90ae9689-79b9-4eb1-884c-51b5a2c42b5c',
  '09190fe9-c1a3-4afa-b8f7-e9bde0aa91f9','3e6c6657-e13e-4366-8350-c50cc1cd609a','fa1c80a6-db9a-4379-9d7a-4a9761121185','44e40454-c1ae-4cf8-8f90-8297fa5a002e',
  'cdade6ab-8f85-44bd-976a-e88fa75959d4','248f9ffb-2980-4986-879d-43b35c8f9282','1a5fbd2d-28cb-4e22-9796-b9e2a03ab036','c4d37150-1ec6-41aa-8b79-48de3fc67cc0',
  '51860bf7-792d-4cf5-844c-a0f2495e414b','805eb558-4d80-4b18-beb0-48842da709db','49e27f26-94e9-4ec1-b23e-4cd5273aa01b','bece6c8e-ca8d-49e1-955c-627a96fee411',
  '923d1075-8941-4384-a01b-16c03e6ef4c9','1d6fc50d-35dc-4a6e-b236-696445454cc9','83a72031-4f50-41ae-be81-c46128e28d87',
  -- C: Willian Rueda (2) y Jesus Herrera (1), "Proyectos Varios"
  '541ea1e2-a9a0-4dfc-8807-a3951b088344','859d2d26-e823-4753-9261-567570ad7dcd','118210fe-40be-42ec-9b8f-c86700845016'
);

-- Fecha del abono de Elkin (2026-12-03 → 2025-12-03)
update public.contractor_ledger_entries set entry_date = '2025-12-03'
where id = '1beef53d-8594-42ff-a085-eedf3b0e10b6' and entry_date = '2026-12-03';

-- D: Hemer Mora
update public.contractor_ledger_entries set category = 'material'
where id = '592bccc9-bb74-42fb-a96f-fca6266e412c' and category = 'prestamo';
update public.contractor_ledger_entries set category = 'gasto_operativo'
where id = '281b8833-bb65-48e7-92d4-2adb1c47573d' and category = 'prestamo';

-- E: Elkin Amado, "Abono a deuda" (pago a favor → ajuste a favor)
update public.contractor_ledger_entries set category = 'ajuste'
where category = 'pago' and direction = 'a_favor' and id in (
  'd516dc2e-f3f8-4e3f-b7cb-cffc406f415a','12054551-28d8-425c-8887-c4fd4b0080c9','005252ac-465b-43fe-8011-c0fdb3b05d15',
  '55d8f2d0-5a51-4f81-92fc-928b3b9c1b5e','991b0365-9cb8-4b1a-b71a-31088a9fea16','731c99a4-b5e8-4aeb-a885-c98c2fdae44c'
);
