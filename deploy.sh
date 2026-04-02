#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# SmilePro Studio — Deploy Script
# Uso: bash deploy.sh [--full|--frontend|--backend|--restart]
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

COMPOSE_FILE="docker-compose.production.yml"
PROJECT_DIR="/home/jmd/SmilePro-Studio"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $1"; }
ok()   { echo -e "${GREEN}✅ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }
err()  { echo -e "${RED}❌ $1${NC}"; }

cd "$PROJECT_DIR"

MODE="${1:-full}"

# ── Pre-checks ──────────────────────────────────────────────────────────────
log "SmilePro Studio Deploy — modo: ${MODE}"

if [ ! -f "$COMPOSE_FILE" ]; then
    err "No se encuentra $COMPOSE_FILE"
    exit 1
fi

# ── Backup rápido antes de deploy ────────────────────────────────────────────
backup() {
    log "Backup rápido de PostgreSQL..."
    docker exec smilepro-postgres pg_dumpall -U postgres 2>/dev/null \
        | gzip > "backups/pre-deploy-$(date +%Y%m%d_%H%M%S).sql.gz" \
        && ok "Backup guardado en backups/" \
        || warn "Backup fallido (continuando sin backup)"
}

# ── Healthcheck ──────────────────────────────────────────────────────────────
healthcheck() {
    log "Verificando healthchecks..."
    local retries=30
    for i in $(seq 1 $retries); do
        if curl -sf http://localhost:3000/api/health > /dev/null 2>&1; then
            ok "Backend respondiendo correctamente"
            return 0
        fi
        echo -n "."
        sleep 2
    done
    err "Backend no respondió tras ${retries} intentos"
    return 1
}

# ── Deploy modes ─────────────────────────────────────────────────────────────

case "$MODE" in
    --full|full)
        log "🔄 Deploy completo"
        # 1. Pull código
        if [ -d .git ]; then
            log "Git pull..."
            git pull origin main 2>/dev/null || warn "Git pull fallido (usando código local)"
        fi

        # 2. Backup
        mkdir -p backups
        backup

        # 3. Build todos los servicios
        log "Construyendo imágenes Docker..."
        docker compose -f "$COMPOSE_FILE" build --parallel 2>&1 | tail -5
        ok "Build completado"

        # 4. Recrear containers
        log "Levantando servicios..."
        docker compose -f "$COMPOSE_FILE" up -d --remove-orphans 2>&1 | tail -5

        # 5. Healthcheck
        healthcheck

        # 6. Limpiar imágenes antiguas
        log "Limpiando imágenes huérfanas..."
        docker image prune -f > /dev/null 2>&1
        ok "Deploy completo finalizado"
        ;;

    --frontend|frontend)
        log "🎨 Deploy solo frontend"
        docker compose -f "$COMPOSE_FILE" build frontend 2>&1 | tail -3
        docker compose -f "$COMPOSE_FILE" up -d --no-deps frontend
        ok "Frontend desplegado"
        ;;

    --backend|backend)
        log "⚙️  Deploy solo backend"
        mkdir -p backups && backup
        docker compose -f "$COMPOSE_FILE" build backend 2>&1 | tail -3
        docker compose -f "$COMPOSE_FILE" up -d --no-deps backend
        healthcheck
        ok "Backend desplegado"
        ;;

    --restart|restart)
        log "🔁 Restart sin rebuild"
        docker compose -f "$COMPOSE_FILE" restart backend frontend
        healthcheck
        ok "Servicios reiniciados"
        ;;

    --status|status)
        docker compose -f "$COMPOSE_FILE" ps
        echo ""
        echo "── Espacio en disco ──"
        df -h / | tail -1
        echo ""
        echo "── RAM ──"
        free -h | head -2
        echo ""
        echo "── Docker ──"
        docker system df
        ;;

    *)
        echo "Uso: bash deploy.sh [--full|--frontend|--backend|--restart|--status]"
        exit 1
        ;;
esac

echo ""
log "🏁 Fin del deploy"
