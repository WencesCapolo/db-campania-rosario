-- The dropping half of ADR 0013: 0010 copied every year into
-- `fecha_consagracion`, so the integer column has nothing left to say.
ALTER TABLE "misionero" DROP COLUMN "anio_consagracion";
