# 🐛 Debugging WhatsApp — Guía Completa

## ✅ Pasos para Verificar que Funciona

### 1️⃣ **Verifica que los Webhooks están Configurados**

**Evolution API Webhook:**
```bash
# Accede a Evolution API panel y verifica:
# POST http://192.168.1.46:3000/api/communication/webhook/evolution

# Comprueba que está activo con:
curl -X GET https://tu-evolution-api/api/webhooks \
  -H "apikey: TU_API_KEY"
```

**Chatwoot Webhook:**
```bash
# En Chatwoot Dashboard → Settings → Integrations → Webhooks
# URL: http://192.168.1.46:3000/api/communication/webhook/chatwoot
# Events: message.created, conversation.updated
```

---

### 2️⃣ **Abre la Consola del Navegador (DevTools)**

Presiona `F12` en Firefox/Chrome y ve a **Console**

---

### 3️⃣ **Envía un Mensaje de Prueba**

1. Abre el módulo WhatsApp
2. Selecciona una conversación
3. Escribe un mensaje y envía
4. **Busca estos logs en la consola:**

```
[WhatsApp] Socket.io connecting... true
[WhatsApp:Socket] Mensaje recibido: {...}
[WhatsApp:Socket] Comparando: 666778638 vs 666778638
[WhatsApp:Socket] Añadiendo mensaje: {...}
```

---

## 🔍 Posibles Errores y Soluciones

### ❌ Error: "No hay conversación activa"

```
[WhatsApp:Socket] No hay conversación activa
```

**Solución:**
- Asegúrate de **seleccionar una conversación** antes de enviar un mensaje
- La variable `active` debe tener un valor

---

### ❌ Error: "Mensaje para otra conversación"

```
[WhatsApp:Socket] Comparando: 666778638 vs 777889949
[WhatsApp:Socket] Mensaje para otra conversación, ignorando
```

**Solución:**
- El teléfono del mensaje NO coincide con la conversación actual
- Verifica que `payload.phone` viene correctamente del webhook
- Comprueba que la normalización de teléfono es consistente

---

### ❌ Error: "Socket.io connecting... false"

```
[WhatsApp] Socket.io connecting... false
```

**Solución:**
- El Socket.io NO se conectó
- Verificar que el backend está corriendo en `http://localhost:3000`
- Verificar que `VITE_API_URL` en frontend es correcto
- Abrir DevTools → Network → WS (WebSocket) y buscar conexiones

---

### ❌ Error: "Webhook nunca se ejecuta"

Si envías un mensaje pero **NO ves logs de `[WhatsApp:Socket]`**, el problema es:

1. **Evolution API no envía webhook** → Configúralo en Evolution Dashboard
2. **Chatwoot no envía webhook** → Configúralo en Chatwoot Dashboard
3. **Backend no recibe webhook** → Verifica:
   ```bash
   # En terminal del backend, busca:
   # [Chatwoot:Webhook] Sincronizando socket para...
   # [WhatsApp:OUT/IN] ...
   ```

---

## 📊 Flujo Correcto (con logs)

```
Frontend envía POST /api/communication/whatsapp/send
    ↓
Backend: sendText() → Evolution API
    ↓
Evolution API envía webhook → Backend
    ↓
Backend logs: [WhatsApp:IN] 666778638: "Hola"
    ↓
Backend: emitWA('whatsapp:message', {...})
    ↓
Socket.io emite a todos los clientes conectados
    ↓
Frontend recibe: onWhatsAppMessage(payload)
    ↓
Frontend logs: [WhatsApp:Socket] Mensaje recibido: {...}
    ↓
Frontend: setMsgs(p => [...p, msg])
    ↓
UI actualiza, aparece el mensaje en la conversación ✅
```

---

## 🔧 Cómo Verificar cada Paso

### Paso 1: ¿Se envía el mensaje a Evolution?

**Backend logs:**
```
[WhatsApp:OUT] 666778638: "Tu mensaje aquí"
```

Si NO ves esto → El problema es en `sendTextMessage()`

---

### Paso 2: ¿Evolution envía webhook de vuelta?

**Backend logs:**
```
[Chatwoot:Webhook] Sincronizando socket para 666778638 -> Tu mensaje aquí
```

Si NO ves esto → Evolution API webhook no configurado

---

### Paso 3: ¿Socket.io emite el evento?

**Backend logs:**
```
[Socket.io] Emitiendo: whatsapp:message
```

Si NO ves esto → El servidor no emitió el evento

---

### Paso 4: ¿Frontend recibe el evento?

**Frontend logs (DevTools Console):**
```
[WhatsApp:Socket] Mensaje recibido: {phone, text, fromMe, time, id}
```

Si NO ves esto:
- Socket.io no está conectado
- El servidor no emitió el evento
- Hay error CORS

---

## 🚨 Comandos de Verificación Rápida

### Verificar que el backend está corriendo:
```bash
curl http://localhost:3000/api/health
# Debería devolver: {"success":true,"data":{"status":"ok",...}}
```

### Verificar Socket.io:
```bash
# En DevTools Console:
console.log(io?.connected)  # Debería devolver: true
```

### Verificar Evolution API:
```bash
curl -X GET https://tu-evolution-api/api/instance/connectionState/chatwoot_link \
  -H "apikey: TU_API_KEY"
```

### Verificar Chatwoot:
```bash
curl -X GET https://tu-chatwoot/api/v1/accounts/1/conversations \
  -H "api_access_token: TU_TOKEN"
```

---

## 📝 Checklist Final

```
✅ Backend corriendo en puerto 3000
✅ Frontend conectado a WebSocket (io?.connected === true)
✅ Evolution API webhook configurado
✅ Chatwoot webhook configurado
✅ CORS habilitado en backend (CORS_ORIGIN = http://localhost:5176)
✅ Variables de entorno correctas (.env)
✅ Consola del navegador mostrando logs [WhatsApp:Socket]
✅ Mensaje aparece en la conversación
```

---

## 🆘 Si Aún No Funciona

1. Abre **DevTools → Console** y copia todos los logs `[WhatsApp:Socket]`
2. Ve al **Network tab** y busca:
   - `ws://` o `wss://` (WebSocket connection)
   - POST requests a `/api/communication/webhook/*`
3. Verifica que NO hay errores HTTP 502/503/504
4. Reinicia el backend: `npm run dev` en `/backend`

---

**Última actualización:** 2026-03-30
**Cambios:**
- ✅ Agregados logs de debug extensivos en Whatsapp.tsx
- ✅ Corregida lógica de Socket.io listener (línea 369-438)
- ✅ Actualización de conversaciones en tiempo real
