-- ─────────────────────────────────────────────────────────────────────────────
-- Las bajas de antes de ADR 0013 pasan a Estado Extraviada.
--
-- Desde ADR 0013 la baja de una Peregrina es «marcarla como extraviada», y la
-- misma escritura pone el Estado en `extraviada`. Las bajas anteriores quedaron
-- con el Estado que tenían — en producción, veintiuna imágenes «Activa» fuera
-- del inventario —, así que su ficha decía «Activa» al lado de «Fuera del
-- inventario». Recuperarlas las vuelve a `activa`, como a cualquier otra.
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE "peregrina" SET "estado" = 'extraviada', "updated_at" = now() WHERE "baja_at" IS NOT NULL AND "estado" <> 'extraviada';
