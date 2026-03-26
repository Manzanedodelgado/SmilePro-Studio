#!/usr/bin/env bash
# ─── SmilePro Studio · Script de despliegue ──────────────────────────────────
set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'

info()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }

echo ""
echo "═══════════════════════════════════════════════════"
echo "     🦷  SmilePro Studio — Despliegue Producción   "
echo "═══════════════════════════════════════════════════"
echo ""

# ── Comprobaciones previas ────────────────────────────────────────────────────
[ -f .env ]          || error "Falta .env — ejecuta: cp .env.example .env y rellena los valores"
[ -f backend/.env ]  || error "Falta backend/.env con las claves de APIs"

command -v docker &>/dev/null  || error "Docker no está instalado"

# Verificar que .env tiene los campos obligatorios
source .env
[ -z "${POSTGRES_PASSWORD:-}" ] && error "POSTGRES_PASSWORD no definida en .env"
[ -z "${FRONTEND_URL:-}" ]      && error "FRONTEND_URL no definida en .env"

# ── Pull de imágenes base ─────────────────────────────────────────────────────
info "Actualizando imágenes base..."
docker pull node:20-alpine     --quiet
docker pull postgres:15-alpine --quiet
docker pull nginx:alpine       --quiet
docker pull orthancteam/orthanc:24.11.3 --quiet

# ── Build ─────────────────────────────────────────────────────────────────────
info "Construyendo imágenes de SmilePro..."
docker compose build --no-cache --parallel

# ── Backup rápido de la base de datos (si ya existe) ─────────────────────────
if docker compose ps db 2>/dev/null | grep -q "running"; then
    warn "Base de datos existente detectada — creando backup previo..."
    BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"
    docker compose exec -T db pg_dump -U "${POSTGRES_USER}" "${POSTGRES_DB}" \
        > "/tmp/${BACKUP_FILE}" 2>/dev/null && \
        info "Backup guardado en /tmp/${BACKUP_FILE}" || \
        warn "No se pudo crear backup (¿primera instalación?)"
fi

# ── Despliegue ────────────────────────────────────────────────────────────────
info "Iniciando servicios..."
docker compose up -d

# ── Espera healthchecks ───────────────────────────────────────────────────────
info "Esperando que los servicios estén listos..."
sleep 5

MAX_WAIT=120
ELAPSED=0
while ! docker compose ps | grep -q "backend.*healthy"; do
    sleep 5
    ELAPSED=$((ELAPSED + 5))
    [ $ELAPSED -ge $MAX_WAIT ] && error "Timeout: el backend no arrancó en ${MAX_WAIT}s — revisa: docker compose logs backend"
    echo -n "."
done
echo ""

# ── Estado final ──────────────────────────────────────────────────────────────
echo ""
info "Estado de los servicios:"
docker compose ps

echo ""
echo "═══════════════════════════════════════════════════"
echo -e " ${GREEN}✓ SmilePro Studio desplegado correctamente${NC}"
echo ""
echo "   🌐 Web:     ${FRONTEND_URL}"
echo "   🔬 DICOM:   orthanc:8042 (interno) / puerto 4242 (red DICOM)"
echo ""
echo "   Logs en tiempo real:  docker compose logs -f"
echo "   Parar servicios:      docker compose down"
echo "═══════════════════════════════════════════════════"
echo ""
