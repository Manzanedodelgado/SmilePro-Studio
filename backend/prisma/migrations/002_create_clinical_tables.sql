-- Migration: 002_create_clinical_tables
-- Crea las tablas nativas SmileStudio del módulo clínico

-- ── PATIENTS ──────────────────────────────────────────────────────────────
CREATE TABLE "patients" (
  "id"           UUID        NOT NULL DEFAULT gen_random_uuid(),
  "first_name"   TEXT        NOT NULL,
  "last_name"    TEXT        NOT NULL,
  "dni"          TEXT,
  "phone"        TEXT        NOT NULL,
  "email"        TEXT,
  "date_of_birth" DATE,
  "address"      TEXT,
  "city"         TEXT,
  "postal_code"  TEXT,
  "medical_notes" TEXT,
  "allergies"    TEXT,
  "medications"  TEXT,
  "blood_type"   TEXT,
  "active"       BOOLEAN     NOT NULL DEFAULT true,
  "created_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "patients_dni_key" ON "patients"("dni") WHERE "dni" IS NOT NULL;
CREATE INDEX "patients_last_name_idx" ON "patients"("last_name");

-- ── APPOINTMENTS ──────────────────────────────────────────────────────────
CREATE TABLE "appointments" (
  "id"         UUID        NOT NULL DEFAULT gen_random_uuid(),
  "patient_id" UUID        NOT NULL,
  "user_id"    UUID,
  "date"       DATE        NOT NULL,
  "time"       TEXT        NOT NULL,
  "duration"   INT         NOT NULL DEFAULT 30,
  "status"     TEXT        NOT NULL DEFAULT 'scheduled',
  "treatment"  TEXT,
  "notes"      TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "appointments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "appointments_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id")
);

CREATE INDEX "appointments_patient_id_idx" ON "appointments"("patient_id");
CREATE INDEX "appointments_date_idx" ON "appointments"("date");

-- ── CLINICAL RECORDS (Entradas médicas) ────────────────────────────────────
CREATE TABLE "clinical_records" (
  "id"          UUID        NOT NULL DEFAULT gen_random_uuid(),
  "patient_id"  UUID        NOT NULL,
  "user_id"     UUID,
  "date"        TIMESTAMPTZ NOT NULL DEFAULT now(),
  "type"        TEXT        NOT NULL DEFAULT 'visit',
  "title"       TEXT        NOT NULL,
  "content"     TEXT        NOT NULL,
  "treatments"  JSONB       NOT NULL DEFAULT '[]',
  "attachments" JSONB       NOT NULL DEFAULT '[]',
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "clinical_records_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "clinical_records_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id")
);

CREATE INDEX "clinical_records_patient_id_idx" ON "clinical_records"("patient_id");
CREATE INDEX "clinical_records_date_idx" ON "clinical_records"("date" DESC);

-- ── ODONTOGRAM ENTRIES ────────────────────────────────────────────────────
CREATE TABLE "odontogram_entries" (
  "id"           UUID        NOT NULL DEFAULT gen_random_uuid(),
  "patient_id"   UUID        NOT NULL,
  "tooth_number" INT         NOT NULL,
  "status"       TEXT        NOT NULL DEFAULT 'healthy',
  "faces"        JSONB       NOT NULL DEFAULT '{}',
  "notes"        TEXT,
  "user_id"      UUID,
  "updated_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "odontogram_entries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "odontogram_entries_patient_tooth_key" UNIQUE ("patient_id", "tooth_number"),
  CONSTRAINT "odontogram_entries_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id")
);

-- ── TREATMENTS (Catálogo) ─────────────────────────────────────────────────
CREATE TABLE "treatments" (
  "id"          UUID        NOT NULL DEFAULT gen_random_uuid(),
  "name"        TEXT        NOT NULL,
  "code"        TEXT,
  "category"    TEXT        NOT NULL,
  "price"       NUMERIC(10,2) NOT NULL,
  "duration"    INT         NOT NULL DEFAULT 30,
  "description" TEXT,
  "active"      BOOLEAN     NOT NULL DEFAULT true,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "treatments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "treatments_code_key" ON "treatments"("code") WHERE "code" IS NOT NULL;

-- ── updated_at trigger para todas las tablas ──────────────────────────────
-- (reutiliza la función creada en 001_create_users_table.sql)

CREATE TRIGGER update_patients_updated_at
  BEFORE UPDATE ON "patients"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON "appointments"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clinical_records_updated_at
  BEFORE UPDATE ON "clinical_records"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_odontogram_entries_updated_at
  BEFORE UPDATE ON "odontogram_entries"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_treatments_updated_at
  BEFORE UPDATE ON "treatments"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Seed básico de tratamientos ──────────────────────────────────────────
INSERT INTO "treatments" ("name", "code", "category", "price", "duration", "description") VALUES
  ('Consulta / Revisión',          'REV',  'Preventiva',   0.00,   30, 'Revisión anual con exploración completa'),
  ('Limpieza dental (tartrectomía)','LIM',  'Preventiva',  80.00,   45, 'Higiene dental profesional'),
  ('Fluorización',                  'FLU',  'Preventiva',  25.00,   15, 'Aplicación tópica de flúor'),
  ('Selladores',                    'SEL',  'Preventiva',  40.00,   30, 'Selladores de fisuras'),
  ('Empaste composite (1 cara)',    'EMP1', 'Restauradora', 80.00,  30, 'Obturación composite 1 cara'),
  ('Empaste composite (2 caras)',   'EMP2', 'Restauradora', 110.00, 45, 'Obturación composite 2 caras'),
  ('Empaste composite (3+ caras)',  'EMP3', 'Restauradora', 140.00, 60, 'Obturación composite ≥3 caras'),
  ('Endodoncia unirradicular',      'END1', 'Endodoncia',  350.00,  90, 'Conductos diente 1 raíz'),
  ('Endodoncia birradicular',       'END2', 'Endodoncia',  450.00, 120, 'Conductos diente 2 raíces'),
  ('Endodoncia plurirradicular',    'END3', 'Endodoncia',  550.00, 150, 'Conductos molar'),
  ('Corona zirconio',               'COR1', 'Prótesis',    650.00,  60, 'Corona cerámica sobre zirconio'),
  ('Corona metal-porcelana',        'COR2', 'Prótesis',    450.00,  60, 'Corona metal-cerámica'),
  ('Implante (colocación)',         'IMP',  'Implantes',  1200.00,  90, 'Implante osteointegrado Klockner'),
  ('Corona sobre implante',         'CORP', 'Implantes',   900.00,  60, 'Prótesis sobre implante'),
  ('Blanqueamiento domiciliario',   'BLA1', 'Estética',   350.00,  30, 'Férulas + gel blanqueador'),
  ('Blanqueamiento en consulta',    'BLA2', 'Estética',   500.00,  60, 'Blanqueamiento LED en sillón'),
  ('Carilla composite',             'CAR1', 'Estética',   280.00,  60, 'Carilla directa composite'),
  ('Carilla porcelana',             'CAR2', 'Estética',   550.00,  90, 'Carilla cerámica feldespática'),
  ('Extracción simple',             'EXT1', 'Cirugía',    100.00,  30, 'Extracción diente erupcionado'),
  ('Extracción cordal',             'EXT2', 'Cirugía',    280.00,  60, 'Extracción muela del juicio'),
  ('Periodoncia (curetaje 1 sext)', 'PERI', 'Periodoncia', 150.00,  60, 'Curetaje y alisado radicular por sextante'),
  ('Ortodoncia (valoración)',        'ORT0', 'Ortodoncia',   0.00,  30, 'Estudio y plan de tratamiento ortodoncia'),
  ('Ortodoncia brackets metálicos', 'ORT1', 'Ortodoncia',3500.00,   0, 'Tratamiento completo con brackets metálicos'),
  ('Ortodoncia alineadores',        'ORT2', 'Ortodoncia',4500.00,   0, 'Tratamiento completo con alineadores');
