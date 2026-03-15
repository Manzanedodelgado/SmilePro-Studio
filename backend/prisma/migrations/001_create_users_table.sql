-- Migration: 001_create_users_table
-- Crea la tabla de usuarios nativos de SmileStudio

-- Enum para roles
CREATE TYPE "UserRole" AS ENUM (
  'admin',
  'doctor',
  'hygienist',
  'reception',
  'accounting',
  'auxiliary'
);

-- Tabla de usuarios
CREATE TABLE "users" (
  "id"        UUID        NOT NULL DEFAULT gen_random_uuid(),
  "email"     TEXT        NOT NULL,
  "password"  TEXT        NOT NULL,
  "name"      TEXT        NOT NULL,
  "role"      "UserRole"  NOT NULL DEFAULT 'auxiliary',
  "avatar"    TEXT,
  "specialty" TEXT,
  "active"    BOOLEAN     NOT NULL DEFAULT true,
  "lastLogin" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON "users"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
