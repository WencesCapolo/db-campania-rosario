-- Los dos índices del tablero — issue #5.
--
-- Ambos son parciales y ambos fueron medidos antes de existir: los planes de las
-- consultas reales están en `src/modules/tablero/tablero.planes.test.ts`, contra
-- doce mil imágenes y treinta mil Asignaciones. Tres candidatos más se
-- escribieron y se descartaron en la misma medición, porque el planner no los
-- eligió nunca: un índice sobre las imágenes que no tiene nadie, uno sobre los
-- Misioneros de un territorio por apellido, y uno sobre los períodos abiertos por
-- Misionero. Un índice que nadie usa se paga en cada escritura.
--
-- `CREATE INDEX` toma un lock de escritura sobre la tabla mientras construye. Con
-- el volumen actual de la Campaña — cero — eso es instantáneo; si algún día hay
-- que rehacerlos con datos, la variante es `CREATE INDEX CONCURRENTLY`, que no
-- puede correr dentro de la transacción en la que Drizzle envuelve cada archivo.
CREATE INDEX "peregrina_activas_por_territorio_idx" ON "peregrina" USING btree ("diocesis_localidad_id","estado","modalidad","tipo") WHERE "peregrina"."baja_at" is null;--> statement-breakpoint
CREATE INDEX "asignacion_abiertas_por_fecha_idx" ON "asignacion" USING btree ("abierta_at") WHERE "asignacion"."cerrada_at" is null;