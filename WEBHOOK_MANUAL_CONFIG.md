# 🔧 Configuración Manual de Webhooks — Paso a Paso

## 🎯 Objetivo

Registrar dos webhooks para que los mensajes de WhatsApp lleguen al backend:
- **Evolution API** → Backend
- **Chatwoot** → Backend

---

## 📋 Requisitos Previos

- Acceso al servidor: `http://192.168.1.46`
- Usuario Chatwoot: (tu usuario actual)
- API Key de Evolution: `429683C4C977415CAAFCCE10F7D57E11`

---

## ✅ Paso 1: Configurar Webhook en Chatwoot

**Chatwoot es más accesible y donde empezar.**

### 1.1 Abre el Dashboard de Chatwoot

```
URL: http://192.168.1.46:3000
```

### 1.2 Ve a Configuración de Webhooks

```
Menu → Settings
→ Integrations
→ Webhooks (o "Custom Attributes")
```

### 1.3 Agrega un Webhook Nuevo

**Haz clic en "Add Webhook" o "New Webhook"**

Completa los campos:

| Campo | Valor |
|-------|-------|
| **Name** | `SmilePro Backend` |
| **URL** | `http://192.168.1.46:3000/api/communication/webhook/chatwoot` |
| **Events** | Selecciona: `message.created`, `conversation.updated`, `conversation.status_changed` |
| **Active** | ✅ Activado |

### 1.4 Guarda y Prueba

- Haz clic en **Save**
- Debería mostrar ✅ **Success** o estado verde
- Si falla, verifica que la URL es exacta: `http://192.168.1.46:3000/api/communication/webhook/chatwoot`

---

## 📱 Paso 2: Configurar Webhook en Evolution API

Evolution API se configura por **instancia**. Necesitamos actualizar la instancia `chatwoot_link`.

### 2.1 Abre el Manager de Evolution

```
URL: http://192.168.1.46:8080/manager
```

### 2.2 Busca la Instancia "chatwoot_link"

- Debería estar en la lista de instancias
- Hace clic en el nombre para editar

### 2.3 Configura los Webhooks

En la sección de webhooks (o propiedades avanzadas):

```
URL: http://192.168.1.46:3000/api/communication/webhook/evolution
Eventos: messages.upsert, messages.update
Activo: ✅ Sí
```

### 2.4 Guarda los Cambios

- Haz clic en **Save** o **Update**
- Reinicia la instancia si es necesario

---

## 🧪 Paso 3: Verifica que Funciona

### 3.1 Abre la Consola del Navegador (DevTools)

```
Presiona: F12
Ve a: Console
```

### 3.2 Envía un Mensaje de Prueba

1. En la aplicación SmilePro, abre el módulo WhatsApp
2. Selecciona una conversación
3. Escribe y envía un mensaje

### 3.3 Mira los Logs

Deberías ver en la consola (DevTools → Console):

```
[WhatsApp] Socket.io connecting... true
[WhatsApp:Socket] Mensaje recibido: {...}
[WhatsApp:Socket] Comparando: 666778638 vs 666778638
[WhatsApp:Socket] Añadiendo mensaje: {...}
```

✅ Si ves estos logs → **¡FUNCIONA!**

---

## 🔍 Si No Funciona

### ❌ Mensaje: "404 Not Found" al intentar guardar webhook

**Solución:**
- Verifica que la URL es exacta: `http://192.168.1.46:3000/api/communication/webhook/chatwoot`
- Revisa que no haya espacios al principio o final
- Intenta con `https://` si `http://` no funciona

### ❌ Logs no aparecen en la consola

**Solución:**
1. Verifica que el backend está corriendo:
   ```bash
   curl http://192.168.1.46:3000/api/health
   ```
   Debería devolver: `{"success":true,...}`

2. Verifica que Socket.io está conectado:
   ```javascript
   // En DevTools Console:
   console.log(io?.connected)
   // Debería devolver: true
   ```

3. Si el backend no responde:
   ```bash
   docker ps | grep backend
   docker logs smilepro-studio-backend-1 | tail -20
   ```

### ❌ El webhook se configura pero no envía eventos

**Solución:**
- Envía un mensaje en WhatsApp desde el contacto
- Espera 2-3 segundos
- Revisa si el mensaje aparece en Chatwoot
- Si aparece en Chatwoot pero no en SmilePro, el problema es en el listener de Socket.io (ya lo arreglamos)

---

## 📊 Verificación Completa

### Checklist de Configuración

```
☐ Webhook Chatwoot configurado y activo
☐ Webhook Evolution configurado y activo
☐ Backend corriendo en puerto 3000 (curl /api/health)
☐ Socket.io conectado en frontend (io?.connected === true)
☐ DevTools Console mostrando logs [WhatsApp:Socket]
☐ Mensajes aparecen en conversación
```

### Checklist de Funcionamiento End-to-End

```
Paso 1: Usuario envía mensaje
  ☐ Mensaje aparece en SmilePro (enviado)
  ☐ Backend logs: [WhatsApp:OUT] 666778638: "mensaje"

Paso 2: Respuesta desde WhatsApp
  ☐ Mensaje aparece en Chatwoot
  ☐ Chatwoot envía webhook al backend
  ☐ Backend logs: [Chatwoot:Webhook] event=message.created
  ☐ Backend emite via Socket.io: whatsapp:message

Paso 3: Frontend recibe evento
  ☐ Frontend logs: [WhatsApp:Socket] Mensaje recibido
  ☐ Mensaje aparece en SmilePro ✅
  ☐ Conversación se marca como actualizada
```

---

## 🆘 Última Opción: Reinicia Todo

Si nada funciona, reinicia los servicios:

```bash
# En el servidor (via SSH):
docker-compose restart backend evolution-api chatwoot

# O simplemente reinicia el backend:
docker restart smilepro-studio-backend-1
```

Luego vuelve a intentar.

---

**Última actualización:** 2026-03-30
**Estado:** Esperando configuración manual de webhooks
**Próximo paso:** Configura en Chatwoot (más fácil) y Evolution (si es necesario)
