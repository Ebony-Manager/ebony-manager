-- Corrección de datos (confirmada por Ebony): los "préstamos" que quedaron de
-- la carga del Excel para Jesus Herrera (4, 16-ene-2025), Jhonattan Marcano
-- (17-jul-2026), Miguel Solaris (9-jul-2026) y Yomar Arias (9-jun-2026) no
-- son préstamos sino abonos a su cuenta. Préstamo y Pago reducen igual: el
-- saldo no cambia, solo los resúmenes (pagado vs. prestado).
-- Para revertir: category = 'prestamo' en estos mismos ids.
update public.contractor_ledger_entries set category = 'pago'
where category = 'prestamo' and loan_id is null and id in (
  '299d37de-4245-49e8-803e-09b6a8a84818', 'e4ccdc79-d702-4202-b82d-bc18578ff227',
  '594bea9e-98ab-4dff-945e-298f0d5704a3', '819a0eca-3010-423a-955e-5496629d0b0a',
  '75d05486-7767-4c30-92d8-abb5f1eb81f8', '75911baf-9024-477d-b42f-bca846a72229',
  '35a24800-a29e-464c-aff6-4f1b0b2cdf59'
);
