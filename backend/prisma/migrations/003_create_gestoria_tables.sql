-- Migration: 003_create_gestoria_tables
-- Crea las tablas nativas SmileStudio del módulo Gestoría

-- ── GEST_PROVEEDORES ────────────────────────────────────────────────────────
CREATE TABLE "gest_proveedores" (
  "id"                UUID        NOT NULL DEFAULT gen_random_uuid(),
  "nombre_fiscal"     TEXT        NOT NULL,
  "cif_nif"           TEXT        UNIQUE,
  "email_contacto"    TEXT,
  "categoria_defecto" TEXT,
  "iban"              TEXT,
  "created_at"        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "gest_proveedores_pkey" PRIMARY KEY ("id")
);

-- ── GEST_FACTURAS_EMAIL ─────────────────────────────────────────────────────
CREATE TABLE "gest_facturas_email" (
  "gmail_message_id"  TEXT        NOT NULL,
  "proveedor_extraido" TEXT,
  "proveedor_id"      UUID        REFERENCES "gest_proveedores"("id") ON DELETE SET NULL,
  "numero_factura"    TEXT,
  "fecha_factura"     DATE,
  "base_imponible"    DECIMAL(10,2),
  "iva_pct"           DECIMAL(5,2),
  "total"             DECIMAL(10,2),
  "archivo_pdf_url"   TEXT,
  "estado"            TEXT        NOT NULL DEFAULT 'pendiente',
  "created_at"        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "gest_facturas_email_pkey" PRIMARY KEY ("gmail_message_id")
);

CREATE INDEX "gest_facturas_email_proveedor_id_idx" ON "gest_facturas_email"("proveedor_id");
CREATE INDEX "gest_facturas_email_estado_idx" ON "gest_facturas_email"("estado");

-- ── GEST_FACTURAS_EMITIDAS ──────────────────────────────────────────────────
CREATE TABLE "gest_facturas_emitidas" (
  "id"              UUID        NOT NULL DEFAULT gen_random_uuid(),
  "numero_serie"    TEXT        NOT NULL UNIQUE,
  "num_pac"         TEXT,
  "nif_cliente"     TEXT        NOT NULL,
  "nombre_cliente"  TEXT        NOT NULL,
  "concepto"        TEXT        NOT NULL,
  "base_imponible"  DECIMAL(10,2) NOT NULL,
  "iva_pct"         DECIMAL(5,2)  NOT NULL DEFAULT 0,
  "total"           DECIMAL(10,2) NOT NULL,
  "fecha_emision"   DATE        NOT NULL,
  "estado_pago"     TEXT        NOT NULL DEFAULT 'pendiente',
  "verifactu_estado" TEXT       NOT NULL DEFAULT 'no_enviado',
  "verifactu_hash"  TEXT,

  CONSTRAINT "gest_facturas_emitidas_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "gest_facturas_emitidas_fecha_emision_idx" ON "gest_facturas_emitidas"("fecha_emision");
CREATE INDEX "gest_facturas_emitidas_estado_pago_idx" ON "gest_facturas_emitidas"("estado_pago");

-- ── GEST_MOVIMIENTOS_BANCARIOS ──────────────────────────────────────────────
CREATE TABLE "gest_movimientos_bancarios" (
  "id"              UUID        NOT NULL DEFAULT gen_random_uuid(),
  "iban_cuenta"     TEXT        NOT NULL,
  "fecha_operacion" DATE        NOT NULL,
  "concepto_banco"  TEXT        NOT NULL,
  "importe"         DECIMAL(10,2) NOT NULL,
  "saldo_posterior" DECIMAL(10,2),
  "estado_concil"   TEXT        NOT NULL DEFAULT 'abierto',
  "f_emitida_id"    UUID        REFERENCES "gest_facturas_emitidas"("id") ON DELETE SET NULL,
  "f_recibida_id"   TEXT        REFERENCES "gest_facturas_email"("gmail_message_id") ON DELETE SET NULL,

  CONSTRAINT "gest_movimientos_bancarios_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "gest_movimientos_bancarios_fecha_idx" ON "gest_movimientos_bancarios"("fecha_operacion");
CREATE INDEX "gest_movimientos_bancarios_estado_idx" ON "gest_movimientos_bancarios"("estado_concil");

-- ── GEST_MODELOS_FISCALES ───────────────────────────────────────────────────
CREATE TABLE "gest_modelos_fiscales" (
  "id"               UUID        NOT NULL DEFAULT gen_random_uuid(),
  "modelo"           TEXT        NOT NULL,
  "ejercicio"        INTEGER     NOT NULL,
  "periodo"          TEXT        NOT NULL,
  "estado"           TEXT        NOT NULL DEFAULT 'borrador',
  "fecha_limite"     DATE        NOT NULL,
  "cuota_resultante" DECIMAL(10,2),
  "archivo_justif"   TEXT,

  CONSTRAINT "gest_modelos_fiscales_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "gest_modelos_fiscales_modelo_ejercicio_periodo_key" UNIQUE ("modelo", "ejercicio", "periodo")
);
