# SmilePro · Workflows n8n
## Configuración previa (OBLIGATORIO antes de importar)

### 1. Credencial PostgreSQL
En n8n → Settings → Credentials → New → Postgres
- Name: **SmilePro PostgreSQL**
- Host: `192.168.1.46`
- Port: `5432`
- Database: `smilestudio-db`
- User / Password: los de tu Docker PostgreSQL

### 2. Variables de entorno n8n
En n8n → Settings → Variables:
| Variable | Valor ejemplo |
|---|---|
| `EVOLUTION_URL` | `http://192.168.1.46:8080` |
| `EVOLUTION_INSTANCE` | `clinica` |
| `EVOLUTION_API_KEY` | `tu-api-key` |
| `CLINICA_NOMBRE` | `Rubio García Dental` |
| `CLINICA_TELEFONO` | `+34 9XX XXX XXX` |
| `CLINICA_TELEFONO_URGENCIAS` | `+34 6XX XXX XXX` |
| `CLINICA_GOOGLE_REVIEW_URL` | `https://g.page/r/...` |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_USER` | `clinica@email.com` |
| `SMTP_PASSWORD` | `app-password` |
| `GESTORIA_EMAIL` | `gestoria@email.com` |
| `CUESTIONARIO_BASE_URL` | `http://tu-noip.ddns.net/formulario` |

### 3. Webhook de Evolution API → n8n
En Evolution API, configura el webhook de mensajes entrantes apuntando a:
`http://192.168.1.46:5678/webhook/evolution-incoming`

### 4. Formato fechas GELITE
- `Fecha` en DCitas = Int YYYYMMDD (ej: 20260325)
- `Hora` en DCitas = Int HHMM (ej: 0930 = 09:30h)

### 5. IdSitC — Códigos de estado de cita (verificar en tu BD)
- `1` = Pendiente
- `2` = Confirmada
- `3` = Anulada
- `4` = No presentado
- `5` = Atendida

### Orden de importación recomendado
1. `00-subworkflow-enviar-whatsapp.json` (subworkflow compartido)
2. El resto en cualquier orden
