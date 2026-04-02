# SmilePro Studio

**Plataforma SaaS de gestión integral para clínicas dentales — Rubio García Dental, Madrid.**
Construida con React 19 · TypeScript 5.8 · Vite 6 · Tailwind CSS, conectada a un backend Node.js/Express con PostgreSQL y acceso directo a datos reales del sistema GELITE (47.712 citas · 15.000+ pacientes).

> **App en producción:** `https://gestion.rubiogarciadental.com`

---

## Índice

1. [Módulos](#módulos)
2. [Stack tecnológico](#stack-tecnológico)
3. [Requisitos](#requisitos)
4. [Instalación & Guía de Desarrollo](#instalación--guía-de-desarrollo)
5. [Variables de entorno](#variables-de-entorno)
6. [Comandos](#comandos)
7. [Arquitectura](#arquitectura)
8. [API Endpoints](#api-endpoints)
9. [Base de Datos](#base-de-datos)
10. [Motor de IA](#motor-de-ia)
11. [Módulo de Comunicación](#módulo-de-comunicación)
12. [Estructura del proyecto](#estructura-del-proyecto)
13. [Módulos en detalle](#módulos-en-detalle)
14. [Control de acceso (RBAC)](#control-de-acceso-rbac)
15. [IA & Automatizaciones](#ia--automatizaciones)
16. [Radiología clínica](#radiología-clínica)
17. [Flujos de negocio](#flujos-de-negocio)
18. [Seguridad](#seguridad)
19. [Deployment & Infra](#deployment--infra)
20. [Troubleshooting](#troubleshooting)
21. [Performance & Monitoring](#performance--monitoring)
22. [Known Issues & Roadmap](#known-issues--roadmap)
23. [Contributing](#contributing)
24. [FAQs](#faqs)

---

## ⛔ Reglas y Prohibiciones

> **ESTA SECCIÓN ES OBLIGATORIA. Si eres un asistente IA o un desarrollador nuevo, LEE ESTO PRIMERO.**

### 🔴 NUNCA hacer (infraestructura)

- **NO ejecutar `DROP`, `DELETE`, `TRUNCATE` ni `UPDATE` en producción** sin autorización explícita del usuario. La BBDD `smilestudio` contiene datos reales de 15.000+ pacientes y 47.000+ citas.
- **NO reiniciar contenedores Docker** (`docker restart`, `docker stop`, `docker rm`) sin permiso del usuario. Hay 11 contenedores en producción serviendo a la clínica.
- **NO modificar las tablas de GELITE** (`TtosMed`, `Pacientes`, `AgCitas`, `Facturas`, etc.) directamente. Todo cambio debe ir a través del backend Node.js.
- **NO exponer credenciales de BBDD en el frontend**. Las API keys (Groq, Evolution, Chatwoot, SMTP) van **exclusivamente** en el backend.
- **NO hacer `apt upgrade` ni `reboot` del servidor** sin autorización. El servidor tiene clientes en producción.
- **NO modificar la configuración de Traefik** sin entender la cadena de proxying. Traefik gestiona SSL automático (LetsEncrypt) para todos los dominios.
- **NO crear bases de datos nuevas** en PostgreSQL sin permiso. Hay 4 DBs consolidadas (smilestudio, chatwoot, evolution_api, n8n).

### 🟡 NUNCA hacer (código)

- **NO borrar archivos fuente** sin confirmar con el usuario. Preguntar siempre antes de eliminar.
- **NO cambiar la estructura de navegación** (`App.tsx`, `navigation.ts`) sin aprobación del usuario. Afecta a toda la aplicación.
- **NO modificar `AuthContext.tsx` ni `auth.service.ts`** sin revisión. Un error rompe el login de toda la clínica.
- **NO alterar los services que conectan con el backend** (`citas.service`, `pacientes.service`, `soap.service`) sin entender el contrato API. Verificar siempre los endpoints con el backend real.
- **NO instalar dependencias nuevas** (`npm install`) sin aprobación del usuario. Cada dependencia incrementa el bundle y puede romper builds.
- **NO cambiar `vite.config.ts`, `tsconfig.json` ni `tailwind.config.js`** sin motivo justificado. Son configuraciones estables.
- **NO hacer refactors masivos** sin plan aprobado por el usuario. Los cambios deben ser incrementales y revisables.
- **NO tocar el sistema de permisos RBAC** (`usePermission.ts`) sin entender las implicaciones para todos los roles (admin, dentista, recepcion, higienista).

### 🟢 SÍ hacer siempre

- **SÍ leer este README completo** antes de empezar a trabajar — especialmente la sección de infraestructura.
- **SÍ verificar la BBDD** si el usuario pregunta algo sobre datos. La BBDD está en `smilestudio-db`, no en el PostgreSQL del host.
- **SÍ usar `SELECT` (solo lectura)** para explorar datos antes de proponer cambios.
- **SÍ preguntar** si no estás seguro de una acción destructiva.
- **SÍ documentar** cualquier cambio de infraestructura o configuración en este README.
- **SÍ mantener el estilo visual** existente: Tailwind + Lucide + paleta `#051650`/`#0056b3`/`#FF4B68`/`#FFC0CB`.
- **SÍ usar los servicios existentes** (`services/`) en lugar de hacer `fetch()` directo desde componentes.
- **SÍ respetar el patrón de fallback** — la app debe funcionar en modo demo sin backend activo.

---

## Módulos

| Módulo | Descripción |
|---|---|
| **Dashboard** | KPIs operativos del día: citas totales, en curso, finalizadas, canceladas. Gráfico de rendimiento semanal, registro de esterilización. |
| **Agenda** | Calendario semana/día por gabinetes (G1–G6). Drag & drop, creación/edición de citas, bloqueos bioseguridad, alertas HUD (médicas/legales/financieras), sala de espera en tiempo real. |
| **Pacientes** | Ficha integral con 8 pestañas: Historia Clínica (SOAP), Anamnesis, Odontograma, Sondaje Periodontal, Radiología, Documentos, Cuenta Corriente, Presupuestos. |
| **Radiología** | Visor DICOM nativo (Cornerstone3D), herramientas de medición y anotación, Window/Level (Hounsfield), 8 mapas de color, integración Planmeca Romexis. |
| **WhatsApp** | Centro de mensajería Evolution API + Chatwoot. Historial de conversaciones, plantillas dentales, emojis, control chatbot IA Dental. |
| **IA & Automatización** | 30+ flujos automáticos multi-canal, agente IA Dental (LLaMA 3.3 70B via Groq), editor de flujos conversacionales YAML/visual, gestor de plantillas y documentos clínicos. |
| **Gestoría** | Facturación TBAI, movimientos bancarios, conciliación automática, importación de facturas desde Gmail (OAuth2), informes exportables. |
| **Inventario** | Stock físico y virtual (reservado en agenda), trazabilidad FEFO por lote/QR, caducidades, ubicaciones, reposición sugerida por IA. |

---

## Stack tecnológico

| Capa | Tecnología | Versión / Detalle |
|---|---|---|
| Framework UI | React | 19.0.0 |
| Lenguaje | TypeScript | 5.8.2 |
| Bundler | Vite | 6.2.0 |
| Estilos | Tailwind CSS | 3.4.17 |
| Iconos | Lucide React | 0.564 |
| Validación | Zod | 4.3.6 |
| Radiología | Cornerstone3D core/tools/loader | 4.19.4 |
| Visor médico alternativo | DWV | 0.33.0 |
| Parser DICOM | dicom-parser | 1.8.21 |
| Backend | Node.js 20 + Express 4 + TypeScript | ESM nativo, `tsx` en dev |
| ORM | Prisma | 6.4.0 → PostgreSQL 16 |
| Schema DB | 3.249 líneas, 168 modelos | Herencia Gesden/GELITE + modelos nuevos |
| IA — WhatsApp | Groq `llama-3.3-70b-versatile` | Fallback: OpenRouter |
| IA — Copiloto clínico | Gemini `gemini-2.5-flash-lite` | Fallback: OpenRouter |
| IA — Visión (Rx) | Gemini `gemini-2.5-flash` | Análisis de radiografías |
| Fallback IA universal | OpenRouter | `meta-llama` / `deepseek-r1` (free) |
| WhatsApp | Evolution API v2.3.7 + Chatwoot v4.11.0 | Instancia `chatwoot_link` |
| Email | Gmail OAuth2 | `info@rubiogarciandental.com` |
| Storage fotos | Google Drive (Service Account) | Carpeta por paciente |
| PACS legacy | Romexis SQL Server | `bbddsql.servemp3.com:1433` |
| Imagen médica DICOM | Orthanc (`orthancteam/orthanc`) | Puerto 4242 DICOM C-STORE |
| Tiempo real | Socket.io | 4.8.3 — backend ↔ frontend |
| Automatización | n8n | 30 workflows JSON |
| Infra | Docker Compose + Traefik v3 | Producción en `192.168.1.46` (LAN clínica) |
| Facturación | TBAI (Ticket BAI Vasco) | — |

---

## Requisitos

- Node.js ≥ 18
- npm ≥ 9
- Docker & Docker Compose (producción — stack consolidado de 11 containers)
- PostgreSQL 16+ con pgvector (con FDW configurado hacia GELITE en producción)
- (Opcional) Instancia Evolution API, cuenta Chatwoot, Supabase project

---

## Instalación & Guía de Desarrollo

### Setup local (desarrollo)

```bash
# Clonar repositorio
git clone https://github.com/Manzanedodelgado/SmilePro-Studio.git
cd SmilePro-Studio

# Instalar dependencias
npm install
cd backend && npm install && cd ..

# Copiar y rellenar variables de entorno
cp .env.example .env
cp backend/.env.example backend/.env

# Compilar backend (TypeScript → JavaScript)
cd backend && npm run build && cd ..

# Iniciar servidor de desarrollo
npm run dev          # Frontend en http://localhost:5176
# En otra terminal:
cd backend && npm run dev  # Backend en http://localhost:3000
```

### Desarrollo sin backend (fallback mode)

Si no tienes el backend activo, la app funciona en modo demo:
- Login automático con usuario dummy
- Datos de demostración cargados en memoria
- Perfectas para UI/UX y testing frontend

```bash
# Desactivar proxy de API
# En vite.config.ts, comentar la sección de proxy
npm run dev
```

### Database setup (local)

```bash
# Crear contenedor PostgreSQL para desarrollo
docker run --name smilepro-dev \
  -e POSTGRES_USER=smilepro \
  -e POSTGRES_PASSWORD=dev123 \
  -e POSTGRES_DB=smilestudio \
  -p 5432:5432 \
  -d postgres:15-alpine

# Aplicar migraciones Prisma
cd backend
DATABASE_URL="postgresql://smilepro:dev123@localhost:5432/smilestudio" \
  npx prisma migrate deploy

# (Opcional) Seed de datos de demo
npx ts-node prisma/seed.ts
```

### Tests (⚠️ Actualmente 0% coverage, ver Roadmap)

```bash
# Tests unitarios (sin correr actualmente — planned)
npm run test

# Tests e2e (Playwright)
npm run test:e2e

# Cobertura
npm run test:coverage
```

### Build para producción

```bash
# Frontend
npm run build           # dist/ ready para Nginx
npm run preview         # previsualizar build

# Backend (en Docker, automático — pero manual si necesario)
cd backend
npm run build           # dist/
npm run db:migrate      # Prisma migrations
```

---

## Requisitos

- Node.js ≥ 18
- npm ≥ 9
- Backend Node.js corriendo en `localhost:3000`
- PostgreSQL con FDW configurado hacia GELITE
- (Opcional) Instancia Evolution API, cuenta Chatwoot, Supabase project

---

## Instalación

```bash
git clone https://github.com/Manzanedodelgado/SmilePro-Studio.git
cd SmilePro-Studio
npm install
```

---

## Variables de entorno

### Frontend (`.env` raíz — Docker)

```env
VITE_API_URL=http://backend:3000    # URL interna Docker (producción)
# Para desarrollo local:
# VITE_API_URL=http://localhost:3000
FRONTEND_PORT=8080
FRONTEND_URL=https://gestion.rubiogarciadental.com
POSTGRES_USER=smilepro
POSTGRES_PASSWORD=...
POSTGRES_DB=smilepro
```

### Backend (`backend/.env`)

```env
# Base de datos
DATABASE_URL="postgresql://smilestudio:...@127.0.0.1:5434/smilestudio?schema=public"
CORS_ORIGIN=http://localhost:5176
JWT_SECRET=...
PORT=3000

# IA
GROQ_API_KEY=...          # LLaMA 3.3 70B → agente WhatsApp
GEMINI_API_KEY=...        # Gemini Flash → copiloto clínico + análisis Rx
OPENROUTER_API_KEY=...    # Fallback universal si Groq/Gemini fallan

# WhatsApp
EVOLUTION_API_URL=...
EVOLUTION_API_KEY=...
EVOLUTION_INSTANCE=chatwoot_link
EVOLUTION_INSTANCE_TOKEN=...

# Chatwoot
CHATWOOT_URL=...
CHATWOOT_TOKEN=...
CHATWOOT_ACCOUNT_ID=1
CHATWOOT_INBOX_ID=1

# Email
GMAIL_CLIENT_ID=...
GMAIL_CLIENT_SECRET=...
GMAIL_USER_EMAIL=info@rubiogarciandental.com

# Storage
GDRIVE_FOLDER_ID=...      # Fotos de pacientes
GDRIVE_SA_KEY_JSON=...    # Base64 de service account JSON

# PACS legacy
ROMEXIS_HOST=bbddsql.servemp3.com
ROMEXIS_PORT=1433
ROMEXIS_DB=romexis
```

> ⚠️ Las claves sensibles van **exclusivamente en el backend**. Nunca se exponen al cliente.

---

## Comandos

```bash
npm run dev       # Servidor de desarrollo → http://localhost:5176
npm run build     # Build de producción (TypeScript + Vite)
npm run preview   # Previsualizar build producción
npm run lint      # ESLint + TypeScript (0 warnings tolerados)
```

---

## Arquitectura

### Comunicación frontend ↔ backend

```
Frontend React (localhost:5176 / :8080 en Docker)
│
├── /api/*  ──────────────────────────────► Backend Node.js (:3000)
│   ├── POST /api/auth/login                     JWT login
│   ├── GET|POST /api/patients                   CRUD pacientes
│   ├── GET|POST /api/patients/leads             Leads y captación
│   ├── GET|POST /api/appointments               Citas (47k GELITE)
│   ├── GET|POST /api/clinical                   Historia clínica, SOAP
│   ├── GET|POST /api/clinical/questionnaires    Cuestionarios
│   ├── GET|POST /api/treatments                 Tratamientos y presupuestos
│   ├── GET|POST /api/accounting                 Facturación, gestoría
│   ├── GET|POST /api/communication              WhatsApp + Chatwoot
│   ├── GET|POST /api/ai                         Copiloto IA, automatizaciones
│   ├── GET|POST /api/imaging                    DICOM (Orthanc proxy)
│   ├── GET|POST /api/admin                      Administración
│   ├── GET|POST /api/catalogs                   Catálogos clínicos
│   ├── GET|POST /api/proxy                      Proxy seguro de API keys externas
│   ├── GET|POST /api/gdrive                     Fotos de pacientes (Google Drive)
│   └── GET|POST /rest/v1                        Compatibilidad Gesden legado
│
├── Socket.io ──────────────────────────────► Tiempo real (notificaciones)
├── Evolution API ──────────────────────────► WhatsApp Business
├── Chatwoot ───────────────────────────────► CRM de conversaciones
└── Google Drive API ───────────────────────► Fotos clínicas por paciente
```

### Docker (producción)

```
Internet → Traefik (:80/:443 SSL LetsEncrypt)
             ├── gestion.rubiogarciadental.com → Frontend Nginx (:80)
             │                                    └── /api/* → Backend Node.js (:3000)
             │                                                  ├── PostgreSQL 16 pgvector (:5432)
             │                                                  │   ├── smilestudio (6,117 pacientes)
             │                                                  │   ├── chatwoot
             │                                                  │   ├── evolution_api
             │                                                  │   └── n8n
             │                                                  ├── Redis 7 (:6379, DB 0-3)
             │                                                  ├── Orthanc DICOM (:4242)
             │                                                  ├── Volumen uploads
             │                                                  └── Volumen ia-data
             ├── chatwoot.easypanel.host → Chatwoot (:3000)
             └── evolution.easypanel.host → Evolution API (:8080)
```

El backend aplica migraciones SQL manualmente antes de arrancar (`prisma db execute`).

### Flujo de navegación

`App.tsx` gestiona la navegación con estado React (`activeArea`, `activeSubArea`, `requestedNumPac`). El componente `Pacientes` **permanece siempre montado** (`display: none` cuando inactivo) para preservar el estado del paciente sin desmontarlo. Las vistas cruzadas funcionan con refs (`pendingWhatsappRef`, `pendingCita`).

**Rutas públicas** (sin login):
- `?token=XXX` → `QuestionnairePublicPage` (anamnesis via WhatsApp)
- `#sign/XXX` → `SignPage` (firma remota de documentos)

**Atajo global**: `⌘K` / `Ctrl+K` abre la `CommandPalette`.

### Flujo de autenticación

1. `Login.tsx` → `POST /api/auth/login`
2. Respuesta: `{accessToken, refreshToken, user: {id, name, role}}`
3. `AuthContext` → JWT en `sessionStorage`
4. `usePermission(role)` controla acceso por componente
5. Fallback: si el backend no responde, se usa token dummy para desarrollo

---

## Estructura del proyecto

```
src/
├── App.tsx                          # Enrutador principal, gestión de estado global
├── main.tsx / index.tsx             # Entry point React
├── types.ts                         # Tipos globales: Cita, Paciente, SOAPNote...
├── navigation.ts                    # Definición de menú, áreas y sub-áreas
│
├── views/
│   ├── Dashboard.tsx                # KPIs diarios, gráficos, esterilización
│   ├── Agenda.tsx                   # Calendario semana/día, drag & drop
│   ├── Pacientes.tsx                # Ficha integral del paciente (8 tabs)
│   ├── Radiologia.tsx               # Gestor de estudios + visor DICOM
│   ├── Whatsapp.tsx                 # Centro de mensajería
│   ├── IAAutomatizacion.tsx         # Hub IA — delega en sub-vistas
│   ├── Gestoria.tsx                 # Facturación, banco, impuestos, informes
│   ├── Inventario.tsx               # Stock, trazabilidad, reposición
│   ├── Login.tsx                    # Autenticación
│   ├── ConfiguracionAgenda.tsx      # Ajustes gabinetes, doctores, tratamientos
│   ├── QuestionnairePublicPage.tsx  # Anamnesis pública (token sin login)
│   └── SignPage.tsx                 # Firma remota de documentos (token)
│
├── views/ia/
│   ├── IADashboard.tsx              # KPIs: motor activo, tasa éxito, privacidad
│   ├── IAConfig.tsx                 # Config agente IA Dental (tono, idioma, KB, test)
│   ├── AutomationRules.tsx          # Gestor 30+ automatizaciones multi-canal
│   ├── FlowsView.tsx                # Secuencias conversacionales
│   ├── AutomationEditor.tsx         # Editor YAML/visual de flujos
│   ├── Plantillas.tsx               # Plantillas WhatsApp, Email, SMS
│   ├── DocumentosClinica.tsx        # Consentimientos y cuestionarios digitales
│   ├── IAChatbot.tsx                # Chat de prueba en tiempo real
│   ├── CentinelaPanel.tsx           # Panel de monitorización Centinela
│   └── MetricasComunicacion.tsx     # Métricas de comunicación y canales
│
├── components/
│   ├── Sidebar.tsx                  # Menú lateral expandible + widgets operativa
│   ├── Header.tsx                   # Navegación global, búsqueda, notificaciones
│   ├── ErrorBoundary.tsx            # Captura global de errores
│   ├── UI.tsx                       # Componentes base: StatCard, Badge, etc.
│   ├── CommandPalette.tsx           # Paleta de comandos (⌘K / Ctrl+K)
│   └── BudgetModal.tsx              # Modal de presupuestos rápido
│
├── components/pacientes/
│   ├── SOAPEditor.tsx               # Editor SOAP + EVA + análisis automático
│   ├── Odontograma.tsx              # Mapa dental FDI (32 piezas, 5 caras)
│   ├── Periodontograma.tsx          # Sondaje 6 localizaciones por diente
│   ├── RadiologyTab.tsx             # Galería radiológica en ficha de paciente
│   ├── Economica.tsx                # Cargos, abonos, saldo, historial pagos
│   ├── Documentos.tsx               # Consentimientos y PDFs clínicos
│   ├── EntradasMedicas.tsx          # Medicamentos + alergias (Supabase/Vademecum)
│   ├── AlertasPanel.tsx             # Alertas médicas, legales y financieras
│   ├── AnamnesisPanel.tsx           # Anamnesis interactiva (formulario completo)
│   ├── ContactosPanel.tsx           # Contactos de emergencia
│   ├── QuestionnairePanel.tsx       # Cuestionario de salud embebido
│   ├── PatientSearchModal.tsx       # Búsqueda de pacientes + crear nuevo
│   ├── PostSOAPActions.tsx          # Acciones post-consulta (receta, seguimiento)
│   ├── PresupuestoModal.tsx         # Modal de presupuestos en ficha paciente
│   ├── RecetasTab.tsx               # Pestaña de recetas médicas
│   ├── RomexisGallery.tsx           # Galería de imágenes Romexis
│   ├── RomexisLaunchButton.tsx      # Botón para abrir Planmeca Romexis
│   ├── hallazgos.ts                 # Catálogo de hallazgos clínicos
│   └── toothPaths.ts                # Paths SVG de piezas dentales
│
├── components/radiologia/
│   ├── DicomViewer.tsx              # Visor DICOM Cornerstone3D (lazy)
│   ├── RadiologiaViewer.tsx         # Canvas 2D — mediciones y anotaciones
│   ├── CbctViewer.tsx               # Visor CBCT 3D volumétrico
│   └── PlanmecaLauncher.tsx         # Lanzador Planmeca Romexis
│
├── services/
│   ├── auth.service.ts              # Login, token, fallback indestructible
│   ├── citas.service.ts             # CRUD citas (FDW GELITE)
│   ├── pacientes.service.ts         # Búsqueda y creación de pacientes
│   ├── soap.service.ts              # Notas SOAP / historial clínico
│   ├── odontograma.service.ts       # Persistencia odontograma
│   ├── periodontograma.service.ts   # Persistencia sondaje periodontal
│   ├── agenda-config.service.ts     # Catálogos dinámicos FDW
│   ├── config-agenda.service.ts     # Configuración adicional de agenda
│   ├── tratamientos.service.ts      # Catálogo con caché
│   ├── tratamientos-pendientes.service.ts # Tratamientos pendientes por paciente
│   ├── imagen.service.ts            # Gestión estudios radiológicos
│   ├── dicom.service.ts             # Parser DICOM binario puro
│   ├── romexis.service.ts           # Integración Planmeca Romexis
│   ├── romexis-config.service.ts    # Configuración conexión Romexis
│   ├── evolution.service.ts         # WhatsApp (Evolution API + Chatwoot)
│   ├── whatsapp.service.ts          # Helpers de WhatsApp
│   ├── ia-dental.service.ts         # Chat Groq LLaMA 3.3 vía proxy
│   ├── ia-control.service.ts        # Pausa / reanuda chatbot IA Dental
│   ├── automations.service.ts       # CRUD automatizaciones
│   ├── workflow-engine.service.ts   # Motor de flujos conversacionales (64KB)
│   ├── pre-cita-workflow.service.ts # Flujos automáticos pre-cita
│   ├── recordatorios.service.ts     # Sistema de recordatorios programados
│   ├── facturacion.service.ts       # Facturas, movimientos bancarios
│   ├── invoice-parser.service.ts    # Parser de facturas con IA
│   ├── inventario.service.ts        # Stock, lotes, trazabilidad
│   ├── presupuestos.service.ts      # CRUD presupuestos (backend + localStorage)
│   ├── recetas.service.ts           # Recetas médicas
│   ├── supabase.service.ts          # Medicaciones y alergias (RLS)
│   ├── gdrive.service.ts            # Fotos clínicas en Google Drive
│   ├── gmail.service.ts             # OAuth Gmail, parsing facturas
│   ├── notificaciones.service.ts    # Alertas operativas en tiempo real
│   ├── audit.service.ts             # Logging de acciones de usuario
│   ├── busqueda-unificada.service.ts # Búsqueda global cross-módulos
│   ├── catalogs.service.ts          # Catálogos clínicos
│   ├── clinical.service.ts          # Servicio clínico genérico
│   ├── clinical-memory.service.ts   # Memoria contextual clínica
│   ├── contactos.service.ts         # Gestión de contactos
│   ├── documentos.service.ts        # Gestión de documentos clínicos
│   ├── documentos-firmados.service.ts # Documentos con firma digital
│   ├── firma-digital.service.ts     # Servicio de firma digital
│   ├── questionnaire.service.ts     # Cuestionarios de salud
│   ├── paciente-activo.ts           # Estado del paciente activo en sesión
│   ├── logger.ts                    # Sistema de logs centralizado
│   └── db.ts                        # authFetch + helpers PostgREST
│
├── centinela/
│   ├── engine.ts                    # Motor de monitorización Centinela
│   ├── simulator.ts                 # Simulador de alertas Centinela
│   └── types.ts                     # Tipos del sistema Centinela
│
├── workers/
│   └── dicom.worker.ts              # Web Worker para procesamiento DICOM
│
├── context/
│   └── AuthContext.tsx              # Proveedor de autenticación (JWT sessionStorage)
│
├── hooks/
│   └── usePermission.ts             # RBAC: valida permisos por rol
│
└── data/
    └── vademecum.ts                 # Base de conocimiento: 1000+ medicamentos
```

---

## Módulos en detalle

### Dashboard
- KPIs diarios actualizados cada 60s con refresh manual
- Gráfico de barras — rendimiento últimos 7 días
- Registro de ciclos de esterilización (OK / FALLO / PENDIENTE)
- Tabla de citas con estado visual (colores semánticos)
- Click en cita → abre ficha del paciente directamente

### Agenda
- Cuadrícula hora × gabinete con solapamiento visual real
- Drag & drop para reprogramar (hora y gabinete)
- Menú contextual (click derecho): editar, cancelar, justificante, finalizar, marcar estado
- Estados con colores y animaciones: `planificada`, `confirmada`, `espera`, `gabinete`, `finalizada`, `fallada`, `anulada`, `bloqueo_bio`
- **Alertas HUD en cita:**
  - Glow rojo pulsante: alertas médicas (alergia crítica, medicación incompatible)
  - Interlock amarillo: alertas legales (menor sin tutor, consentimiento pendiente)
  - Borde naranja: deuda activa
- **Bloqueo bioseguridad:** tras tratamientos invasivos, el siguiente slot se bloquea automáticamente para desinfección (visualización con raya diagonal)
- Generación de justificante de asistencia (modal editable + exportable)
- Primera Visita: checkbox dedicado con captura de datos tutor
- Sidebar en tiempo real: sala de espera y gabinetes activos (actualización cada 90s)

### Ficha de paciente (Pacientes)

| Pestaña | Contenido |
|---|---|
| **Historia Clínica** | Notas SOAP con análisis IA, escala EVA (0–10), firma digital, alertas detectadas automáticamente |
| **Anamnesis** | Cuestionario interactivo editable (medicación, alergias, antecedentes, hábitos) |
| **Odontograma** | Mapa FDI completo — 32 piezas adulto, 5 caras por diente, estados por color (sano, caries, obturación, corona, endodoncia, implante, ausente) |
| **Sondaje Periodontal** | 6 localizaciones × diente, valores 0–12mm, cálculo automático de índices |
| **Radiología** | Galería de estudios del paciente + visor embebido Cornerstone3D |
| **Documentos** | Consentimientos informados con firma digital, timestamp, almacenamiento cloud |
| **Cuenta Corriente** | Cargos, abonos, saldo, historial de pagos |
| **Presupuestos** | Listado de presupuestos: estado, aceptación, vencimiento |

**Búsqueda de pacientes:** modal con búsqueda por nombre, numPac o DNI, resultados scrollables, acceso directo a crear nuevo paciente.

### Radiología
- **Tipos soportados:** panorámica, periapical, CBCT, intraoral, cefalométrica, extraoral
- **Herramientas de visor:**
  - Pan, Zoom (rueda)
  - Window/Level (click derecho + arrastrar) — ajuste Hounsfield
  - Regla: distancia entre 2 puntos
  - Ángulo: 3 puntos → grados
  - ROI rectangular y elíptica
  - Flecha + texto: anotaciones libres
  - Invertir, Flip H/V, Rotar 90°
- **Ajustes de imagen:** brillo (-100..+100), contraste (-100..+100), nitidez (0–100)
- **Mapas de color:** `grayscale`, `hot`, `cool`, `bone`, `rainbow`, `viridis`, `dental_soft`, `dental_warm`
- **Presets DICOM clínicos:** hueso, cortical, endodoncia, implante, tejido blando
- Upload drag & drop — detección automática de tipo (DICOM por magic bytes o imagen estándar)
- Almacenamiento automático en Google Drive (carpeta por paciente)

### WhatsApp
- Conversaciones desde Evolution API con lectura de historial vía Chatwoot
- Filtros por estado: `open`, `pending`, `resolved`
- Búsqueda por nombre o teléfono
- Selector de emojis (8 categorías)
- **7 plantillas dentales predefinidas:** cita confirmada, recordatorio 24h, post-tratamiento, presupuesto, solicitud de reseña, etc.
- Panel de etiquetas y resolución de conversaciones
- Estado de instancia en tiempo real (conectado / desconectado)
- QR de vinculación si la instancia no está conectada
- Control del chatbot IA Dental: pausa / reanuda desde la interfaz

### Gestoría

| Sección | Funcionalidad |
|---|---|
| **Visión General** | GMV, ingresos, pendiente de cobro, ticket medio, proyección mensual |
| **Facturación** | Tabla con estado (borrador, emitida, pagada, impagada), validación TBAI |
| **Gmail** | OAuth2, sincronización de facturas recibidas, parsing con IA, deduplicación |
| **Banco** | Movimientos, conciliación automática factura ↔ transacción |
| **Impuestos** | Declaraciones trimestrales, resumen IVA |
| **Informes** | Ingresos por categoría de tratamiento, deuda >30 días, nuevos vs. recurrentes — export PDF/CSV |

### Inventario
- Grid de productos: SKU, stock físico, stock virtual (reservado en agenda), punto de reorden
- Alerta visual automática cuando el stock cae por debajo del mínimo
- Tabla FEFO: lotes, fechas de caducidad, ubicaciones físicas (estantería), cuarentena sanitaria
- Historial de movimientos: entrada, consumo, devolución
- **IA Dental Order Engine:** sugerencias de pedido automáticas para ítems críticos
- Datos reales desde `TArticulo` + `StckMov` (FDW GELITE)

---

## Motor de IA

El backend gestiona **tres proveedores con fallback automático**. Nunca se exponen las API keys al cliente — todo pasa por `/api/ai` y `/api/proxy`.

| Caso de uso | Proveedor primario | Modelo | Fallback |
|---|---|---|---|
| **Agente WhatsApp** | Groq | `llama-3.3-70b-versatile` | OpenRouter `meta-llama/llama-3.3-70b-instruct:free` |
| **Copiloto clínico** | Gemini | `gemini-2.5-flash-lite-preview` | OpenRouter `deepseek/deepseek-r1:free` |
| **Análisis radiografías** | Gemini | `gemini-2.5-flash` (multimodal) | OpenRouter |

### Funciones disponibles (`AIService`)

| Función | Descripción |
|---|---|
| `whatsappAgent(phone, msg, history)` | Responde automáticamente en WA. Detecta intent de cita (keywords: `cita`, `hora`, `turno`...) e inyecta huecos disponibles. Historial de 10 turnos con TTL 24h en DB. Máx. 150 palabras, sin markdown. |
| `copilotChat(prompt, context, patientId)` | Copiloto con contexto del paciente: alergias, medicación, últimas 5 visitas, odontograma. Markdown permitido. |
| `completeNote(patientId, partialNote)` | Completa y mejora notas SOAP con terminología FDI. |
| `suggestTreatment(patientId, symptoms)` | Devuelve JSON de tratamientos prioritarios basado en odontograma e historial. |
| `analyzeImage(imageUrl, 'radiograph')` | Gemini Vision: identifica caries, patologías periapicales, pérdida ósea, fracturas. |
| `chatStream(messages, onChunk, ...)` | Streaming SSE para chat en tiempo real. |
| `getAIMetrics()` | Tokens, latencia media, tasa de éxito/fallback en ventana 24h. |

---

## Módulo de Comunicación

### Evolution API (WhatsApp)

- `sendText(phone, text)` — delay artificial 1.2s para naturalidad
- `sendTemplate(phone, templateName, variables)` — plantillas WhatsApp Business
- `sendMedia(phone, url, caption, type)` — imágenes y documentos
- `getInstanceStatus()` / `getQRCode()` — estado de conexión
- **Normalización de teléfono ES**: 9 dígitos (`6/7/9XX`) → `34XXXXXXXXX`

### Chatwoot (bandeja unificada)

- `getConversations(page)` — lista paginada desde `CHATWOOT_INBOX_ID`
- `getMessages(conversationId)` — historial ordenado cronológicamente
- `sendMessage / setStatus / addLabels / markRead / deleteConversation`
- Los mensajes de tipo `actividad interna` (type 2) se filtran automáticamente

---

## Control de acceso (RBAC)

Gestionado con el hook `usePermission` — cada componente verifica permisos en render.

| Rol | Acceso |
|---|---|
| `admin` | Acceso completo a todos los módulos |
| `dentista` | Clínica, IA, odontograma, historial clínico |
| `recepcion` | Agenda, pacientes (vista básica), WhatsApp, gestoría |
| `higienista` | Historia clínica y odontograma (solo lectura) |

---

## IA & Automatizaciones

### Motor
- **Agente:** IA Dental — asistente virtual especializado en odontología
- **Modelo:** Groq LLaMA 3.3 70B
- **Acceso:** exclusivamente vía proxy seguro en el backend (la API key nunca llega al cliente)
- **Cumplimiento:** RGPD — datos encriptados en tránsito

### Configuración del agente IA Dental (IAConfig)
- Nombre del agente configurable desde la interfaz
- Tono: cálida / formal / cercana / eficiente
- Idioma: neutro / peninsular / bilingüe
- Knowledge Base editable: servicios, horarios, dirección, teléfono urgencias, formas de pago
- Reglas de escalada configurables: dolor severo / sangrado → doctor
- Panel de prueba en tiempo real (IAChatbot)

### Automatizaciones (30+ flujos)

| Categoría | Flujos |
|---|---|
| **Recordatorios** | 24h antes, 2h antes, ortodoncia (2m/6m), pediatría revisión |
| **Primera Visita** | Cuestionario 72h antes, formularios 24h antes |
| **Seguimiento** | Post-visita mismo día, post-cirugía día 2 y día 7, implante 75 días |
| **Recaptación** | Recall 6m y anual, solicitud de reseña, felicitación de cumpleaños |
| **Cobros** | Factura post-pago, recibo efectivo, recordatorio deuda amable |
| **Gestión** | No-show (reprogramar), confirmación de cita (SÍ/NO actualiza agenda) |
| **Urgencias** | Respuesta automática fuera de horario, escalada por palabras clave |

**Canales:** WhatsApp · SMS · Email · Interno
**Variables disponibles:** `{{nombre}}`, `{{fecha}}`, `{{hora}}`, `{{doctor}}`, `{{tratamiento}}`

---

## Radiología clínica

### Parser DICOM
El servicio `dicom.service.ts` implementa un parser binario puro:
1. Detección por magic bytes (`DICM` en offset 128)
2. Parseo del diccionario DICOM (VR implícito/explícito)
3. Extracción de pixel data con soporte multiframe
4. Aplicación de rescale slope/intercept (Hounsfield)
5. VOI LUT (Window/Level mapping) con presets clínicos
6. Renderizado en canvas con mapa de color configurable

### Cornerstone3D
`cornerstone.init.ts` inicializa las librerías de forma lazy:
- `@cornerstonejs/core` — motor de renderizado
- `@cornerstonejs/tools` — herramientas interactivas
- `@cornerstonejs/dicom-image-loader` — carga de ficheros DICOM
- Workers en formato ES Module (compatibilidad con Vite)

---

## Flujos de negocio

### Primera visita
1. Crear cita "Primera Visita" en Agenda
2. Auto: enviar cuestionario de anamnesis vía WhatsApp (token público, expira en 1h tras cita)
3. Paciente completa formulario sin login + acepta LOPD
4. Auto: generar `numPac` (SP-NNNN) y volcar datos en ficha
5. Auto: recordatorio 24h antes si no ha completado el cuestionario
6. Recepción marca "confirmada" al llegar
7. Post-visita: solicitar consentimiento con firma digital remota

### Seguimiento post-quirúrgico
1. Doctor cierra sesión con categoría Cirugía/Implante
2. Auto inmediato: instrucciones post-op por WhatsApp
3. Día 2: "¿Tienes dolor intenso?" — si SÍ, alerta interna al doctor
4. Día 7: recordatorio de revisión
5. Día 75 (implante): control de osteointegración

### Urgencias fuera de horario
1. Paciente escribe con palabras clave: "dolor severo", "sangrado", "traumatismo"
2. IA Dental responde automáticamente con teléfono de urgencias + consejos
3. El doctor recibe notificación interna en la app

### Facturación
1. Doctor cierra cita
2. Recepción registra cobro (efectivo / tarjeta / Bizum)
3. Auto: recibo WhatsApp inmediato (efectivo) o factura por email (tarjeta)
4. Si pendiente >30 días: recordatorio automático amable
5. Export mensual automático a gestoría

---

## Tipos de datos globales

```typescript
// src/types.ts

type Area = 'CLÍNICA' | 'Agenda' | 'Pacientes' | 'Radiología' |
            'IA & Automatización' | 'Gestoría' | 'Inventario' | 'Whatsapp';

type TratamientoCategoria =
  'Cirugía' | 'Implante' | 'Endodoncia' | 'Higiene' | 'Ortodoncia' |
  'Diagnostico' | 'Urgencia' | 'Protesis' | 'Conservadora' | 'Periodoncia';

type EstadoCita =
  'planificada' | 'confirmada' | 'espera' | 'gabinete' | 'finalizada' |
  'fallada' | 'anulada' | 'cancelada' | 'desconocido' | 'bloqueo_bio';

interface Cita {
  id: string;
  gabinete: string;               // G1–G6
  pacienteNumPac: string;
  nombrePaciente: string;
  horaInicio: string;             // HH:MM
  duracionMinutos: number;
  tratamiento: string;
  categoria: TratamientoCategoria;
  estado: EstadoCita;
  doctor: string;
  fecha?: string;
  alertasMedicas: string[];       // Prioridad roja
  alertasLegales: string[];       // Prioridad amarilla
  alertasFinancieras: boolean;
  esPadreDesinfeccion?: boolean;
}

interface SOAPNote {
  id: string;
  fecha: string;
  doctor: string;
  especialidad: string;
  subjetivo: string;
  objetivo: string;
  analisis: string;
  plan: string;
  firmada: boolean;
  eva: number;                    // 0–10 escala dolor
  alertasDetectadas: string[];
  tratamiento_id?: string | number;
}

interface Paciente {
  numPac: string;
  idPac?: number;
  nombre: string;
  apellidos: string;
  dni: string;
  telefono: string;
  fechaNacimiento: string;
  tutor?: string;
  alergias: string[];
  medicacionActual?: string;
  deuda: boolean;
  historial: SOAPNote[];
  consentimientosFirmados: boolean;
}

type EstadoLote = 'OK' | 'Caducidad_Proxima' | 'Caducado' | 'Cuarentena_Sanitaria';

interface Lote {
  batchId: string;
  loteFabricante: string;
  fechaCaducidad: string;
  cantidad: number;
  estado: EstadoLote;
  ubicacion: string;
}

interface ItemInventario {
  id: string;
  nombre: string;
  sku: string;
  categoria: 'Implante' | 'Desechable' | 'Instrumental';
  stockFisico: number;
  stockVirtual: number;
  minimoReorden: number;
  lotes: Lote[];
}
```

---

## Infraestructura de producción

> **Arquitectura consolidada (2 abril 2026):** Toda la infraestructura corre en un único `docker-compose.yml` con proyecto `-p smilepro`. Se eliminaron Docker Swarm, EasyPanel y Paperless-ngx.

### Servidor

**Ubicación:** Servidor local en la clínica Rubio García Dental (Madrid)

| Campo | Valor |
|---|---|
| **IP (LAN local)** | `192.168.1.46` |
| **Dominio dinámico** | `smileprostudio.ddns.net` (NoIP) |
| **IP pública** | `213.99.219.104` |
| **URL producción** | `https://gestion.rubiogarciadental.com` |
| **OS** | Ubuntu 24.04.4 LTS |
| **Puertos** | 80/443 (Traefik), 8080 (frontend directo), 4242 (DICOM) |
| **Acceso SSH** | `ssh jmd@192.168.1.46` |
| **Proyecto Docker** | `docker compose -p smilepro` |
| **Compose file** | `/home/jmd/SmilePro-Studio/docker-compose.yml` |

### Contenedores Docker (Docker Compose unificado)

| Container | Imagen | Puerto | Función |
|---|---|---|---|
| `smilepro-db-1` | `pgvector/pgvector:pg16` | 5432 (interno) | **PostgreSQL 16 + pgvector** — 4 DBs consolidadas |
| `smilepro-redis-1` | `redis:7` | 6379 (interno) | **Redis 7** — 4 DBs lógicas (0-3) con password |
| `smilepro-backend-1` | `smilepro-studio-backend:local` | 3000 (interno) | Backend Node.js (healthcheck activo) |
| `smilepro-frontend-1` | `smilepro-studio-frontend:local` | 8080 → host | Frontend React (Nginx) + Traefik SSL |
| `smilepro-evolution-api-1` | `evoapicloud/evolution-api:v2.3.7` | 8080 (interno) | Evolution API (WhatsApp Business) |
| `smilepro-chatwoot-1` | `chatwoot/chatwoot:v4.11.0` | 3000 (interno) | Chatwoot (bandeja WhatsApp) |
| `smilepro-chatwoot-sidekiq-1` | `chatwoot/chatwoot:v4.11.0` | — | Workers Sidekiq de Chatwoot |
| `smilepro-n8n-1` | `n8nio/n8n:1.123.21` | 5678 (interno) | n8n (30+ workflows) |
| `smilepro-traefik-1` | `traefik:3.6.7` | 80, 443 → host | Reverse proxy + SSL LetsEncrypt automático |
| `smilepro-orthanc-1` | `orthancteam/orthanc:latest` | 4242 (localhost) | PACS DICOM |
| `smilepro-pgbackup-1` | `prodrigestivill/postgres-backup-local` | — | Backups automáticos diarios |

### PostgreSQL consolidado (1 instancia, 4 bases de datos)

```
Imagen:    pgvector/pgvector:pg16
Volumen:   docker_pgdata (externo, 457 MB)
User:      smilestudio
Password:  751ec9815be7bbc02e027c3e1bbe2078
```

| Base de datos | Tamaño | Contenido |
|---|---|---|
| `smilestudio` | 180 MB | **DB principal** — 6,117 pacientes, 154 tablas GELITE |
| `chatwoot` | 16 MB | Chatwoot — 4,823 mensajes, 23 conversaciones, 17 contactos |
| `evolution_api` | 9.6 MB | Evolution API — sesiones WhatsApp, 46 mensajes, 33 contactos |
| `n8n` | — | n8n workflows |

**Extensiones habilitadas (chatwoot):** plpgsql, pg_stat_statements, pg_trgm, pgcrypto, **vector 0.8.2**

**Tablas principales (smilestudio):**

| Tabla | Tamaño | Contenido |
|---|---|---|
| `TtosMed` | 17 MB | Tratamientos médicos realizados |
| `TtosMedFases` | 6.2 MB | Fases de los tratamientos |
| `TICD9` | 2.5 MB | Códigos CIE-9 (diagnósticos) |
| `Pacientes` | — | 6,117 pacientes |
| `AgCitas` / `AgCit` | — | Citas de agenda (47k+) |
| `Facturas` / `FacturasLineas` | — | Facturación |

**Acceso rápido:**

```bash
# Listar tablas
docker compose -p smilepro exec -T db psql -U smilestudio -d smilestudio -c "\dt+"

# Contar pacientes
docker compose -p smilepro exec -T db psql -U smilestudio -d smilestudio -c 'SELECT count(*) FROM "Pacientes"'

# Acceder a Chatwoot DB
docker compose -p smilepro exec -T db psql -U smilestudio -d chatwoot -c 'SELECT count(*) FROM messages'
```

**Conexión desde local:**

| Escenario | Host a usar |
|---|---|
| **En la red local** (WiFi/LAN de la clínica) | `192.168.1.46` |
| **Fuera de la red** (casa, móvil, VPN) | `smileprostudio.ddns.net` |

> ⚠️ El puerto 5432 no está expuesto al exterior por defecto. Acceder vía SSH tunnel o VPN.

### Redis consolidado (1 instancia, 4 DBs lógicas)

| DB | Servicio | Uso |
|---|---|---|
| DB 0 | Backend | Caché de sesiones, tokens, estado IA |
| DB 1 | Chatwoot | Sidekiq + caché conversaciones |
| DB 2 | Evolution API | Sesiones WhatsApp |
| DB 3 | n8n | Ejecución de workflows |

**Password:** `smilepro2026redis`

### Backups automáticos

```
Servicio:   pgbackup (prodrigestivill/postgres-backup-local)
Schedule:   @daily
Retención:  7 días + 4 semanas + 6 meses
Ubicación:  /home/jmd/SmilePro-Studio/backups/
DBs:        smilestudio, chatwoot, evolution_api, n8n
```

### SSL / HTTPS

Traefik gestiona los certificados SSL automáticamente vía LetsEncrypt HTTP Challenge.

| Dominio | Servicio |
|---|---|
| `gestion.rubiogarciadental.com` | Frontend |
| `smileprostudio-chatwoot.9idlgv.easypanel.host` | Chatwoot |
| `smileprostudio-evolution-api.9idlgv.easypanel.host` | Evolution API |

---

## Notas del desarrollador

### Dualidad de identificadores de paciente

El sistema tiene **dos identificadores coexistiendo** por la herencia de Gesden/GELITE:

| Identificador | Tipo | Dónde se usa |
|---|---|---|
| `NUMPAC` | `String` (ej: `SP-0042`) | Tablas heredadas: `DCitas.NUMPAC`, `Pacientes.NUMPAC`, agenda, citas |
| `id` / `patientId` | UUID | Modelos nuevos de Prisma: `Patient`, `ClinicalRecord`, `OdontogramEntry` |

Al navegar entre módulos, `requestedNumPac` en `App.tsx` puede ser cualquiera de los dos. Los servicios modernos normalizan internamente.

### Módulos legacy vs. modernos en el backend

- `backend/src/modules/patients/` — módulo moderno (modelo `Patient` Prisma con UUID)
- `backend/src/modules/legacy/` — rutas `/rest/v1/*` para compatibilidad Gesden (tablas Gesden directas)

> **Nota:** No existe un módulo `pacientes/` separado. Las rutas legado se gestionan íntegramente desde `legacy/legacy.routes.ts`.

### Acceso a base de datos en desarrollo

El servidor PostgreSQL está en `192.168.1.46` (servidor de red local de la clínica). Dependiendo de dónde trabajes:

- **Red local (LAN/WiFi clínica):** conecta directamente a `192.168.1.46:5432`
- **Fuera de la red:** usa el dominio NO-IP `smileprostudio.ddns.net:5432` (requiere que el puerto esté abierto en el router)

```env
# backend/.env
DATABASE_URL="postgresql://smilestudio:...@192.168.1.46:5432/smilestudio?schema=public"
# o desde fuera:
DATABASE_URL="postgresql://smilestudio:...@smileprostudio.ddns.net:5432/smilestudio?schema=public"
```

### Motor de automatización

`startAutomationEngine()` se invoca al arrancar el servidor. Ejecuta tareas programadas con `node-cron`. El estado de pausa/reanudación se persiste en el volumen `ia-data`.

### Radiología — sub-sección temporalmente oculta

En `navigation.ts`, la pestaña **Radiología** de Pacientes está comentada (`// oculto temporalmente`). El visor sigue disponible en el módulo `Radiología` independiente.

---

## Modo demo

Sin backend activo, la aplicación funciona con datos de muestra:

| Feature | Comportamiento demo |
|---|---|
| Login | Acepta cualquier credencial (token dummy) |
| Citas | 5 pacientes con 10 citas precargadas |
| Radiología | Panorámicas desde URLs públicas, estudios DICOM simulados |
| Romexis | Mock de panorámicas si no hay API configurada |
| IA Dental | Respuestas de fallback si no hay API key |
| WhatsApp | Empty state si Evolution no está configurado |
| Gmail | Facturas de ejemplo si no hay OAuth autorizado |

---

## API Endpoints

### Authentication
- `POST /api/auth/login` — Login con email/contraseña, devuelve {accessToken, refreshToken, user}
- `POST /api/auth/refresh` — Refresh token (rotación automática)
- `POST /api/auth/logout` — Logout (agrega token a blacklist)

### Patients
- `GET /api/patients` — Lista de pacientes (paginada, searchable)
- `GET /api/patients/:id` — Ficha individual del paciente
- `POST /api/patients` — Crear nuevo paciente (admin/recepcion)
- `PUT /api/patients/:id` — Actualizar datos paciente
- `GET /api/patients/:id/medications` — Medicaciones y alergias

### Appointments
- `GET /api/appointments` — Lista de citas (filtros: fecha, gabinete, estado)
- `POST /api/appointments` — Crear cita
- `PUT /api/appointments/:id` — Editar cita
- `POST /api/appointments/:id/confirm` — Confirmar cita
- `POST /api/appointments/:id/cancel` — Cancelar cita

### Clinical
- `GET /api/clinical/soap/:patientId` — Historial SOAP
- `POST /api/clinical/soap` — Crear nota SOAP
- `GET /api/clinical/odontograma/:patientId` — Estado odontograma

### IA
- `POST /api/ai/chat` — Chat copiloto clínico
- `POST /api/ai/whatsapp-agent` — IA agente WhatsApp
- `POST /api/ai/analyze-image` — Análisis radiografías (Gemini Vision)
- `GET /api/ai/metrics` — Métricas de uso IA (tokens, latencia, éxito)

### Communication
- `POST /api/communication/sendWhatsapp` — Enviar mensaje WhatsApp
- `GET /api/communication/conversations` — Listar conversaciones
- `GET /api/communication/messages/:conversationId` — Historial de mensajes
- `POST /api/communication/webhook/evolution` — Webhook incoming Evolution API (sin auth)

### Admin
- `GET /api/admin/users` — Listar usuarios (admin only)
- `POST /api/admin/users` — Crear usuario
- `PUT /api/admin/users/:id` — Actualizar usuario

### Health
- `GET /api/health` — Health check (endpoint para Docker healthcheck)

---

## Base de Datos

### Schema Prisma (100+ modelos)

**Usuarios:** users, roles, permissions, audit_logs
**Clínica:** centros, gabinetes, doctores, horarios_atencion
**Pacientes:** pacientes, contactos_emergencia, medicaciones, alergias, alertas_pac
**Citas:** citas, tratamientos_cita, documentos_cita
**Radiología:** estudios_radiologicos, imagenes_dicom, anotaciones
**Facturación:** facturas, movimientos_banco, deudas
**Comunicación:** conversaciones_whatsapp, plantillas_mensajes
**IA:** automatizaciones, flujos_conversacionales, plantillas_ia
**Inventario:** articulos, lotes, movimientos_stock

**Relaciones principales:**
```
pacientes (15.000+)
  ├── citas (47.000+)
  ├── notas_soap
  ├── documentos
  ├── medicaciones
  ├── estudios_radiologicos
  └── facturas

doctores
  ├── citas (asignado_a)
  └── gabinetes
```

### Migraciones Prisma
```bash
# Ver estado
npm run db:status

# Crear nueva
npm run db:migrate -- --name describe_change

# Aplicar
npm run db:migrate:deploy
```

---

## Seguridad

### Auditoría & Compliance

✅ **Implementado:**
- JWT con expiración 15 minutos + 7 días (refresh)
- Bcrypt 12-round para passwords
- RBAC 6 roles con granularidad
- Helmet.js (CSP, HSTS, X-Frame-Options)
- CORS configurado (env variable)
- Rate limiting express-rate-limit
- Validaciones Zod en todas las rutas
- Logging centralizado Winston
- Proxy centralizado para credenciales

⚠️ **Mejoras críticas (Roadmap P0):**
1. **Token blacklist → Redis** (actualmente en memoria)
2. **Auditoría de deletions** (soft deletes + audit_log)
3. **CSRF token validation**
4. **Rate limiter por usuario**
5. **HSTS preload** en producción

### Manejo de secrets

**Variables sensibles (NUNCA en git):**
- JWT_SECRET (min 32 bytes aleatorios)
- GROQ_API_KEY, GEMINI_API_KEY
- GMAIL_CLIENT_SECRET
- POSTGRES_PASSWORD

**Gestión:** `.env` en .gitignore, variables en `docker-compose.yml` y `backend/.env`

### SQL Injection Prevention

Todo usa Prisma ORM o prepared statements:
```typescript
// ✅ Seguro
const user = await prisma.users.findUnique({ where: { id } });

// ❌ NUNCA
const user = await db.query(`SELECT * FROM users WHERE id = ${id}`);
```

---

## Deployment & Infra

### Producción (Docker Compose consolidado)

**Stack (11 containers, proyecto `smilepro`):**
- Traefik 3.6.7 (reverse proxy + HTTPS LetsEncrypt)
- Backend Node.js + Frontend React (Nginx)
- PostgreSQL 16 / pgvector (4 DBs consolidadas)
- Evolution API v2.3.7 (WhatsApp)
- Chatwoot v4.11.0 (bandeja unificada)
- n8n v1.123.21 (30+ workflows)
- Redis 7 (caché consolidada, 4 DBs lógicas)
- Orthanc (DICOM PACS)
- pgbackup (backups automáticos diarios)

**URLs:**
- Frontend: https://gestion.rubiogarciadental.com
- Chatwoot: https://smileprostudio-chatwoot.9idlgv.easypanel.host
- Evolution: https://smileprostudio-evolution-api.9idlgv.easypanel.host

### Deploy

```bash
# SSH al servidor
ssh jmd@192.168.1.46
cd /home/jmd/SmilePro-Studio

# Opción A: deploy manual
git pull
cd backend && npm install && npm run build && cd ..
npm install && npm run build
docker compose -p smilepro build --no-cache --parallel
docker compose -p smilepro up -d
# Esperar healthchecks (30-120 seg)

# Opción B: solo reiniciar (sin rebuild)
docker compose -p smilepro restart

# Opción C: reiniciar un servicio
docker compose -p smilepro restart backend
```

### Comandos útiles

```bash
# Estado de todos los containers
docker compose -p smilepro ps

# Logs de un servicio
docker compose -p smilepro logs backend --tail 50 -f

# Health del backend
curl -sf http://localhost:3000/api/health

# DB: contar pacientes
docker compose -p smilepro exec -T db psql -U smilestudio -d smilestudio -c 'SELECT count(*) FROM "Pacientes"'
```

### Healthchecks

```
backend:     GET /api/health → 200 OK (interval 15s)
db:          pg_isready -U smilestudio (interval 10s)
redis:       redis-cli ping (interval 10s)
orthanc:     wget http://localhost:8042/system (interval 20s)
```

### Backups

```bash
# Automáticos (pgbackup container)
# Schedule: @daily | Retención: 7d + 4w + 6m
# Ubicación: /home/jmd/SmilePro-Studio/backups/
# DBs: smilestudio, chatwoot, evolution_api, n8n

# Backup manual
docker compose -p smilepro exec -T db pg_dump -U smilestudio smilestudio > backup_manual.sql

# Google Drive: automático (Service Account)
# n8n workflows: JSON en n8n-workflows/ + export UI
```

---

## Troubleshooting

### Auth issues

**"Unauthorized — JWT expired"**
- Sin auth refresh, token vencido
- Verificar JWT_SECRET en backend/.env
- `docker compose logs backend | grep jwt`
- sessionStorage.clear() en DevTools

**"CORS error — response blocked"**
- FRONTEND_URL ≠ URL real del frontend
- Backend .env: `CORS_ORIGIN=<url_correcta>`
- Reiniciar backend

### Database issues

**"Connection refused — PostgreSQL:5432"**
- Contenedor DB no inicia
- `docker compose logs db`
- `docker compose down && docker compose up -d db`

**"FDW error — cannot connect to GELITE"**
- Verificar conectividad: `ping bbddsql.servemp3.com`
- backend/.env: ROMEXIS_HOST, ROMEXIS_PORT
- Test: `psql -h bbddsql.servemp3.com -l`

### WhatsApp issues

**"Mensajes no aparecen en UI"**
- Socket.io listener desincronizado
- `docker compose logs backend | grep socket`
- Reiniciar: `docker compose restart backend`

**"Evolution API disconnected"**
- QR vencido o sesión perdida
- Escanear QR nuevo en WhatsApp UI
- O reiniciar: `docker compose restart evolution-api`

### IA issues

**"Groq API error 401"**
- GROQ_API_KEY inválida
- Generar nueva en https://console.groq.com
- Actualizar backend/.env

**"Gemini quota exceeded"**
- Fallback automático a OpenRouter
- Esperar 24h para reset
- Monitorear `/api/ai/metrics`

### Performance issues

**"Agenda lenta con muchas citas"**
- Falta virtual scrolling
- Usar React.memo() en citas
- Filtrar en BD: `?from=YYYYMMDD&to=YYYYMMDD`

**"Images DICOM lentas"**
- Bundle size alto (600KB)
- Pre-cargar Cornerstone en background
- Comprimir radiografías a JPG

---

## Performance & Monitoring

### Métricas clave

| Métrica | Ideal | Actual | Status |
|---------|-------|--------|--------|
| **Bundle size (gzip)** | <400 KB | ~600 KB | ⚠️ Alto |
| **Test coverage** | >80% | 0% | 🔴 Crítico |
| **Uptime SLA** | 99.9% | ? | ❓ |

### Monitoring

**Logs:**
```bash
docker compose logs -f backend
docker compose logs backend | grep "ERROR"
```

**Métricas IA:**
```bash
curl http://localhost:3000/api/ai/metrics
# { "groq_tokens": 4521, "latency_avg_ms": 456, "success_rate": 98.3% }
```

**Future:** Sentry, Datadog, Prometheus + Grafana, ELK

---

## Known Issues & Roadmap

### 🔴 CRÍTICO (Q2 2026)

1. **Token blacklist en memoria** — No escala multi-instancia → Redis
2. **Sin auditoría de deletions** — GDPR: soft deletes + audit_log
3. **API keys en logs** — Audit completed, redactar credenciales

### 🟡 ALTO (Q3 2026)

4. **0% test coverage** — Target 80% unit + 20% e2e
5. **Sin CSRF tokens** — Validación CSRF
6. **Componentes sin memoization** — Renders innecesarios
7. **Zod version mismatch** — Frontend 4.3.6 vs Backend 3.22.4

### 🟢 MEDIANO (Q4 2026)

8. **Sin virtual scrolling** — Listas >1000 items lentas
9. **Bundle oversized** — 600 KB → 400 KB
10. **Sin Swagger/OpenAPI** — API documentation
11. **Socket.io sin throttling** — Potencial saturación

### Ideas futuras

- [ ] Multi-clínica (multi-tenancy)
- [ ] Mobile app (React Native)
- [ ] Offline mode (Service Worker)
- [ ] Two-factor auth (2FA)
- [ ] SSO (Active Directory)

---

## Contributing

### Workflow

1. Fork repository
2. Create feature branch: `git checkout -b feature/description`
3. Commit claro: `feat: add X` / `fix: Y` / `docs: Z`
4. Push: `git push origin feature/description`
5. Pull Request → review → merge

### Código

- ESLint + Prettier enforced
- Prisma migrations para schema changes
- NUNCA commit .env, API keys, datos sensibles
- Tests unitarios para lógica crítica
- Actualizar README si añades features

---

## FAQs

### "¿Cómo cambio el logo?"
Edita `public/brand/`, se referencia en App.tsx e index.html.

### "¿Cómo agrego un nuevo módulo?"
1. Crear vista en `src/views/`
2. Agregar en `navigation.ts`
3. Crear rutas backend `backend/src/modules/`
4. Agregar ícono Lucide + estilos Tailwind

### "¿Se sincronizan datos GELITE automáticamente?"
Sí, FDW (Foreign Data Wrapper) crea vistas en tiempo real. Sin intermediarios.

### "¿Sin Evolution API?"
Sí funciona, módulo WhatsApp se deshabilita pero resto OK.

### "¿Export de datos?"
Dashboard y Gestoría permiten CSV/PDF. Datos también en Google Drive.

### "¿Modo oscuro?"
No actualmente. Planned con Tailwind `dark:` classes.

### "¿Personalizar colores?"
Sí, en `tailwind.config.js` — sección tema colors.

---

## Changelog

### v2.1.0 (2 abr 2026) — Current
- ✅ **Infraestructura consolidada** — 11 containers en 1 docker-compose (eliminados Swarm, EasyPanel, Paperless)
- ✅ **PostgreSQL 16 + pgvector** — 4 DBs consolidadas (smilestudio, chatwoot, evolution_api, n8n)
- ✅ **Redis 7 consolidado** — 4 DBs lógicas con password
- ✅ **Traefik propio** — SSL LetsEncrypt automático (sin EasyPanel)
- ✅ **Backups automáticos** — diarios, retención 7d+4w+6m
- ✅ **6,117 pacientes** recuperados del volumen huérfano
- ✅ **Chatwoot migrado** — 4,823 mensajes, 23 conversaciones
- ✅ **Evolution API migrada** — 46 mensajes, 33 contactos

### v2.0.0 (mar 2026)
- ✅ Arquitectura completa frontend + backend
- ✅ 100+ modelos Prisma
- ✅ 30+ workflows n8n
- ✅ IA (Groq, Gemini, OpenRouter)
- ✅ Evolution API + Chatwoot
- ✅ DICOM Cornerstone3D
- ⚠️ 0 tests, deuda técnica moderada

### v1.0.0 (referencia histórica)
- MVP con features básicos

---

## Licencia

Privado © 2026 Rubio García Dental. Derechos reservados.

---

## Soporte & Contacto

- 🐛 **Bugs:** jmd@192.168.1.46 o GitLab issues
- 📚 **Docs:** WEBHOOK_*.md, WHATSAPP_DEBUG.md
- 🚀 **Deploy:** administrador servidor
- 🤖 **IA Dental:** contactar dentista responsable

---

**Última actualización:** 2 de abril de 2026  
**Versión README:** 3.0  
**Estado:** Production-ready — Infraestructura consolidada (11 containers, 1 PostgreSQL, 1 Redis)  
**Migración:** Completada Swarm+EasyPanel → Docker Compose unificado (2 abr 2026)
