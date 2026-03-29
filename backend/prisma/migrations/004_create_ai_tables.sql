-- Migration: 004_create_ai_tables
-- Tablas para el módulo de IA & Automatizaciones

-- ── AUTOMATIONS ──────────────────────────────────────────────────────────────
CREATE TABLE "automations" (
  "id"            UUID          NOT NULL DEFAULT gen_random_uuid(),
  "name"          TEXT          NOT NULL,
  "enabled"       BOOLEAN       NOT NULL DEFAULT true,
  "trigger"       TEXT          NOT NULL,
  "canal"         TEXT          NOT NULL DEFAULT 'whatsapp',
  "steps"         JSONB         NOT NULL DEFAULT '[]',
  "success_rate"  INTEGER       NOT NULL DEFAULT 0,
  "executions"    INTEGER       NOT NULL DEFAULT 0,
  "created_at"    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  "updated_at"    TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT "automations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "automations_enabled_idx" ON "automations"("enabled");
CREATE INDEX "automations_trigger_idx" ON "automations"("trigger");

-- Trigger para updated_at automático
CREATE TRIGGER "automations_updated_at"
  BEFORE UPDATE ON "automations"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── AI_CONFIG ─────────────────────────────────────────────────────────────────
CREATE TABLE "ai_config" (
  "id"                UUID          NOT NULL DEFAULT gen_random_uuid(),
  "agent_name"        TEXT          NOT NULL DEFAULT 'IA Dental',
  "language"          TEXT          NOT NULL DEFAULT 'es',
  "welcome_msg"       TEXT          NOT NULL DEFAULT '¡Hola! Soy el asistente virtual de Rubio García Dental. ¿En qué puedo ayudarte?',
  "tone"              JSONB         NOT NULL DEFAULT '{"empathy":4,"proactivity":3,"formality":"semiformal"}',
  "knowledge"         TEXT[]        NOT NULL DEFAULT '{}',
  "escalation_rules"  JSONB         NOT NULL DEFAULT '[]',
  "created_at"        TIMESTAMPTZ   NOT NULL DEFAULT now(),
  "updated_at"        TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT "ai_config_pkey" PRIMARY KEY ("id")
);

-- ── CONVERSATION_HISTORY ──────────────────────────────────────────────────────
CREATE TABLE "conversation_history" (
  "id"            UUID          NOT NULL DEFAULT gen_random_uuid(),
  "phone"         TEXT          NOT NULL,
  "patient_id"    UUID,
  "messages"      JSONB         NOT NULL DEFAULT '[]',
  "created_at"    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  "expires_at"    TIMESTAMPTZ   NOT NULL DEFAULT (now() + INTERVAL '24 hours'),

  CONSTRAINT "conversation_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "conversation_history_phone_idx" ON "conversation_history"("phone");
CREATE INDEX "conversation_history_expires_idx" ON "conversation_history"("expires_at");

-- ── SEED: Automatizaciones por defecto ────────────────────────────────────────
INSERT INTO "automations" ("name", "enabled", "trigger", "canal", "steps", "success_rate", "executions") VALUES
  ('Recordatorio 24h antes de cita', true, 'appointment.reminder_24h', 'whatsapp', '[{"delay":0,"action":"send_whatsapp","template":"Hola {{nombre}}, te recordamos tu cita mañana {{fecha}} a las {{hora}}. ¿Confirmas? Responde SÍ o NO 👇"}]', 94, 0),
  ('Recordatorio 2h (no confirmados)', true, 'appointment.reminder_2h', 'whatsapp', '[{"delay":0,"action":"send_whatsapp","template":"⏰ {{nombre}}, tu cita es HOY a las {{hora}}. ¡Te esperamos en Rubio García Dental!"}]', 81, 0),
  ('Confirmación al crear cita', true, 'appointment.created', 'whatsapp', '[{"delay":0,"action":"send_whatsapp","template":"✅ {{nombre}}, hemos registrado tu cita para el {{fecha}} a las {{hora}}. ¡Hasta pronto!"}]', 99, 0),
  ('Seguimiento post-visita', true, 'appointment.completed', 'whatsapp', '[{"delay":120,"action":"send_whatsapp","template":"Hola {{nombre}} 😊 Esperamos que la visita con {{doctor}} haya ido bien. ¿Cómo te encuentras?"}]', 88, 0),
  ('Seguimiento post-quirúrgico', true, 'appointment.surgery_completed', 'whatsapp', '[{"delay":1440,"action":"send_whatsapp","template":"{{nombre}}, ¿cómo te encuentras tras la intervención de ayer? Sigue las instrucciones enviadas y recuerda que puedes llamarnos si tienes dudas. 💙"}]', 97, 0),
  ('Consentimiento tras confirmar cita', true, 'appointment.confirmed', 'email', '[{"delay":0,"action":"send_email","template":"consentimiento_general","params":{"subject":"Consentimiento informado — Rubio García Dental"}}]', 91, 0),
  ('Factura tras pago', true, 'payment.completed', 'email', '[{"delay":0,"action":"send_email","template":"factura_pdf"}]', 100, 0),
  ('Gestión No Presentado', true, 'appointment.no_show', 'whatsapp', '[{"delay":15,"action":"send_whatsapp","template":"Hola {{nombre}}, hemos notado que no has podido venir a tu cita de hoy. ¿Todo bien? Escríbenos para reagendar 😊"}]', 54, 0),
  ('Respuesta automática urgencias', true, 'message.urgency_detected', 'whatsapp', '[{"delay":0,"action":"send_whatsapp","template":"Entendemos que tienes una urgencia. Nuestro equipo te contactará en los próximos minutos. Si el dolor es muy intenso, llama directamente: [número]"}]', 100, 0),
  ('Revisión ortodoncia 2 meses', true, 'treatment.orthodontics_2m', 'whatsapp', '[{"delay":0,"action":"send_whatsapp","template":"{{nombre}}, ¡ya han pasado 2 meses desde tu revisión de ortodoncia! Es momento de valorar tu progreso. ¿Agendamos?"}]', 86, 0);

-- ── SEED: Configuración por defecto del agente ───────────────────────────────
INSERT INTO "ai_config" ("agent_name", "language", "welcome_msg", "knowledge") VALUES
  ('IA Dental',
   'es',
   '¡Hola! Soy el asistente virtual de Rubio García Dental. ¿En qué puedo ayudarte? 😊',
   ARRAY[
     'Servicios: implantes dentales, ortodoncia (brackets y alineadores invisibles), estética dental, blanqueamiento, endodoncia, periodoncia, odontopediatría',
     'Horario: Lunes a Viernes de 9:00 a 20:00. Sábados de 9:00 a 14:00',
     'Para solicitar cita: indicar nombre, servicio deseado y preferencia de horario',
     'Urgencias: llamar directamente a la clínica en horario de atención',
     'Seguros: trabajamos con los principales seguros dentales. Consultar disponibilidad',
     'Primera visita gratuita para nuevos pacientes (revisión + diagnóstico)'
   ]);
