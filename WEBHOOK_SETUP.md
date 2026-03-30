# 🔗 Configuración de Webhooks — Guía Práctica

## 📋 Resumen

Para que los mensajes WhatsApp lleguen desde Evolution API y Chatwoot al backend, necesitas registrar **dos webhooks**:

1. **Evolution API webhook** → Notifica al backend cuando llegan mensajes
2. **Chatwoot webhook** → Notifica al backend cuando hay actualizaciones de conversaciones

---

## ✅ Opción 1: Configuración Manual (Recomendado)

### Evolution API — Configurar por Dashboard

1. Abre: `http://192.168.1.46:8080` (Evolution API Dashboard)
2. Accede con tu API Key: `429683C4C977415CAAFCCE10F7D57E11`
3. Ve a: **Webhooks** o **Settings**
4. **Agrega un webhook nuevo:**
   - **URL:** `http://192.168.1.46:3000/api/communication/webhook/evolution`
   - **Eventos:** `messages.upsert`, `messages.update`
   - **Activo:** ✅ Sí
   - **Headers:** (Dejar vacío o agregar `Authorization: Bearer {token}` si es necesario)

5. **Prueba la conexión:** Debería mostrar ✅ Success

---

### Chatwoot — Configurar por Dashboard

1. Abre: `http://192.168.1.46:3000` (Chatwoot)
2. Accede con tu usuario
3. Ve a: **Settings → Integrations → Webhooks** (o similar según tu versión)
4. **Agrega un webhook nuevo:**
   - **URL:** `http://192.168.1.46:3000/api/communication/webhook/chatwoot`
   - **Eventos:** `message.created`, `conversation.updated`, `conversation.status_changed`
   - **Activo:** ✅ Sí

5. **Prueba la conexión:** Debería mostrar ✅ Success

---

## 🔧 Opción 2: Configuración por Script (Si Prefieres Automatizar)

Si tienes acceso SSH al servidor, ejecuta este script desde el servidor (no desde aquí):

```bash
#!/bin/bash
# webhook-setup.sh

EVOLUTION_API="http://localhost:8080"
EVOLUTION_KEY="429683C4C977415CAAFCCE10F7D57E11"
BACKEND_URL="http://192.168.1.46:3000"

# Instalar herramientas necesarias si no existen
if ! command -v curl &> /dev/null; then
    apt-get update && apt-get install -y curl
fi

echo "🔗 Registrando webhook en Evolution API..."

# Webhook para Evolution API
curl -X POST "$EVOLUTION_API/api/webhooks" \
  -H "Content-Type: application/json" \
  -H "apikey: $EVOLUTION_KEY" \
  -d '{
    "url": "'$BACKEND_URL'/api/communication/webhook/evolution",
    "events": ["messages.upsert", "messages.update"],
    "active": true
  }' && echo "✅ Evolution API webhook registrado" || echo "❌ Error en Evolution API"

echo ""
echo "🔗 Registrando webhook en Chatwoot..."

# Para Chatwoot, necesitas el access token
CHATWOOT_TOKEN="YOUR_CHATWOOT_API_TOKEN"  # Actualizar con tu token
CHATWOOT_ACCOUNT_ID=1  # Por defecto

curl -X POST "http://localhost:3000/api/v1/accounts/$CHATWOOT_ACCOUNT_ID/webhooks" \
  -H "Content-Type: application/json" \
  -H "api_access_token: $CHATWOOT_TOKEN" \
  -d '{
    "url": "'$BACKEND_URL'/api/communication/webhook/chatwoot",
    "events": ["message.created", "conversation.updated", "conversation.status_changed"],
    "active": true
  }' && echo "✅ Chatwoot webhook registrado" || echo "❌ Error en Chatwoot"

echo ""
echo "✅ Webhooks configurados. Ahora prueba enviando un mensaje en WhatsApp..."
```

**Para ejecutar el script:**

```bash
# En el servidor (192.168.1.46)
nano webhook-setup.sh
# Pega el contenido del script
# Ctrl+O, Enter, Ctrl+X

chmod +x webhook-setup.sh
./webhook-setup.sh
```

---

## 🧪 Verificar que Funciona

### 1️⃣ Backend recibiendo webhooks

En la terminal del backend (`npm run dev`), deberías ver:

```
[Chatwoot:Webhook] Webhook recibido: event=message.created
[WhatsApp:IN] 666778638: "Hola, ¿cómo estás?"
[Socket.io] Emitiendo: whatsapp:message
```

### 2️⃣ Frontend recibiendo eventos

Abre DevTools (F12) → Console, y envía un mensaje. Deberías ver:

```
[WhatsApp] Socket.io connecting... true
[WhatsApp:Socket] Mensaje recibido: {phone, text, fromMe, time, id}
[WhatsApp:Socket] Comparando: 666778638 vs 666778638
[WhatsApp:Socket] Añadiendo mensaje: {...}
```

### 3️⃣ Verificar webhooks registrados

En la terminal del servidor:

```bash
# Evolution API
curl -X GET http://localhost:8080/api/webhooks \
  -H "apikey: 429683C4C977415CAAFCCE10F7D57E11"

# Chatwoot
curl -X GET http://localhost:3000/api/v1/accounts/1/webhooks \
  -H "api_access_token: YOUR_TOKEN"
```

---

## 📊 Flujo Completo (con Webhooks Configurados)

```
Frontend: Usuario escribe mensaje y envía
    ↓
Backend recibe: POST /api/communication/whatsapp/send
    ↓
Backend envía a Evolution API
    ↓
Evolution API recibe, procesa, guarda en Chatwoot
    ↓
Evolution API envía WEBHOOK al backend → /api/communication/webhook/evolution
    ↓
Backend logs: [WhatsApp:OUT] 666778638: "Tu respuesta"
    ↓
Chatwoot envía WEBHOOK al backend → /api/communication/webhook/chatwoot
    ↓
Backend logs: [Chatwoot:Webhook] event=message.created
    ↓
Backend emitWA('whatsapp:message', {...}) → Socket.io
    ↓
Frontend recibe: onWhatsAppMessage(payload)
    ↓
Frontend logs: [WhatsApp:Socket] Mensaje recibido
    ↓
setMsgs([...msgs, newMsg]) → UI actualiza ✅
```

---

## 🆘 Solucionar Problemas

### ❌ "No veo los logs [WhatsApp:Socket]"

**Posibles causas:**
1. Webhooks no configurados → Siguen los pasos 1-2 arriba ✅
2. Webhooks desactivados → Revisar en dashboard y activar
3. Backend no está escuchando → Reinicia: `npm run dev`

**Solución rápida:**

```bash
# En servidor - reinicia servicios
docker-compose restart backend evolution-api chatwoot
```

### ❌ "Veo [WhatsApp:OUT] pero no [WhatsApp:Socket]"

**Posible causa:** El webhook se envía pero el backend no lo procesa

**Solución:**
1. Verifica que `/api/communication/webhook/evolution` y `/api/communication/webhook/chatwoot` existen:
   ```bash
   curl -X GET http://localhost:3000/api/health
   ```
2. Revisa los logs del backend para errores de webhook
3. Verifica CORS: `CORS_ORIGIN=http://localhost:5176`

### ❌ "Recibo POST a /webhook pero no procesa"

Revisa que el backend tiene acceso a la BD para guardar conversaciones:

```bash
docker logs smileprostudio_backend-1 | grep -E "(error|Error|ERROR|Webhook)" | tail -20
```

---

## 🔐 Tokens y Credenciales Necesarias

| Servicio | Credencial | Dónde Obtener |
|----------|-----------|---------------|
| Evolution API | API Key: `429683C4C977415CAAFCCE10F7D57E11` | Dashboard → Settings → API |
| Chatwoot | Access Token | Dashboard → Settings → API → Personal Access Token |
| Chatwoot | Account ID | Usualmente `1` (default) |

**Para obtener el token de Chatwoot:**
1. Ve a Settings → API
2. Crea un "Personal Access Token"
3. Cópialo (aparece solo una vez)

---

## ✅ Checklist Final

```
☐ Evolution API webhook registrado y activo
☐ Chatwoot webhook registrado y activo
☐ Backend recibiendo logs [Chatwoot:Webhook]
☐ Backend recibiendo logs [WhatsApp:IN/OUT]
☐ Frontend viendo logs [WhatsApp:Socket]
☐ Los mensajes aparecen en la conversación
☐ El contador de mensajes se actualiza
```

---

**Última actualización:** 2026-03-30
**Estado:** Código compilado y listo ✅ — Webhooks pendientes de configurar 🔗
