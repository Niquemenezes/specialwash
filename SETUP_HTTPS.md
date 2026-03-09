# Guía de Configuración HTTPS para SpecialWash

## 📋 Problema

Los navegadores móviles (Chrome, Safari) **requieren HTTPS** para acceder a la cámara y micrófono por razones de seguridad. Si accedes con HTTP (puerto 80), los botones de "Tomar Foto" y "Grabar Video" no funcionarán.

## ✅ Solución

Configurar HTTPS en tu servidor Ionos usando un certificado SSL autofirmado.

---

## 🚀 Instalación (Una sola vez)

Desde tu máquina local (Codespaces o tu PC), ejecuta:

```bash
./deploy-https-setup.sh
```

Este script hará:
1. ✅ Subir archivos de configuración al servidor
2. ✅ Generar certificado SSL autofirmado (válido 1 año)
3. ✅ Configurar Nginx para HTTPS (puerto 443)
4. ✅ Redirigir automáticamente HTTP → HTTPS

**Tiempo estimado:** 30-60 segundos

---

## 📱 Cómo acceder desde el móvil

### 1. Abre el navegador de tu móvil

Usa Chrome o Safari y ve a:
```
https://194.164.164.78
```

### 2. Primera vez: Aceptar certificado

Verás una advertencia de seguridad (esto es **normal** con certificados autofirmados):

**En Chrome:**
```
Tu conexión no es privada
▼ Avanzado
→ Continuar a 194.164.164.78 (sitio no seguro)
```

**En Safari:**
```
Este sitio web no es seguro
→ Mostrar detalles
→ Visitar este sitio web
→ Visitar sitio web
```

### 3. ¡Listo!

Después de aceptar:
- ✅ La app cargará normalmente
- ✅ Los botones de cámara funcionarán
- ✅ Podrás tomar fotos y videos
- ✅ El navegador recordará tu decisión

---

## 🔄 Deploys posteriores

Después de la configuración inicial, los deploys normales funcionan igual:

```bash
./deploy.sh frontend   # Solo frontend
./deploy.sh backend    # Solo backend
./deploy.sh all        # Ambos
```

El script de deploy detectará automáticamente que HTTPS está configurado.

---

## 📊 Verificar que HTTPS funciona

### Desde tu máquina:

```bash
# Verificar certificado
ssh root@194.164.164.78 "ls -lh /etc/nginx/ssl/"

# Ver configuración Nginx activa
ssh root@194.164.164.78 "cat /etc/nginx/sites-available/default | head -20"

# Ver logs de Nginx
ssh root@194.164.164.78 "tail -30 /var/log/nginx/error.log"
```

### Desde el navegador:

1. Abre `https://194.164.164.78`
2. Haz clic en el candado 🔒 en la barra de direcciones
3. Deberías ver: "Conexión no segura" o "Certificado autofirmado"

---

## 🔧 Troubleshooting

### ❌ El navegador dice "No se puede establecer una conexión segura"

**Causa:** El certificado no se generó o Nginx no está escuchando en puerto 443.

**Solución:**
```bash
ssh root@194.164.164.78
cd /root/specialwash
bash setup-https.sh
```

### ❌ "502 Bad Gateway" al acceder a la API

**Causa:** El backend (Flask) no está corriendo.

**Solución:**
```bash
./deploy.sh backend
```

### ❌ Los cambios del frontend no se ven

**Causa:** Cache del navegador.

**Solución:**
- En el móvil: Forzar recarga (menú → Recargar)
- O borra caché del navegador
- O abre en modo incógnito

---

## 🎯 Próximos pasos (cuando tengas dominio)

Cuando Marketing termine con la web y puedas usar tu dominio:

1. **Configurar DNS** para apuntar tu dominio a `194.164.164.78`
2. **Instalar Let's Encrypt** (certificado SSL válido gratis):
   ```bash
   ssh root@194.164.164.78
   apt install certbot python3-certbot-nginx
   certbot --nginx -d tudominio.com
   ```
3. El certificado se renovará automáticamente cada 90 días

---

## 📁 Archivos creados

```
/workspaces/specialwash/
├── setup-https.sh              # Script que se ejecuta en el servidor
├── deploy-https-setup.sh       # Script de instalación (ejecutar localmente)
├── nginx-default-https.conf    # Configuración Nginx con HTTPS
└── SETUP_HTTPS.md             # Esta guía
```

### En el servidor (después de instalar):

```
/etc/nginx/ssl/
├── specialwash.key            # Clave privada SSL
└── specialwash.crt            # Certificado SSL

/etc/nginx/sites-available/
└── default                     # Configuración Nginx activa
```

---

## ⚠️ Importante

- El certificado autofirmado es **válido por 1 año**
- Después de 1 año, ejecuta `./deploy-https-setup.sh` otra vez
- Con un dominio real + Let's Encrypt no tendrás este problema
- El certificado autofirmado es **suficientemente seguro** para uso interno/testing

---

## 💡 Dudas frecuentes

**P: ¿Por qué dice "No seguro" si uso HTTPS?**  
R: Porque el certificado está autofirmado. Es seguro, pero el navegador no puede verificar la identidad. Con un dominio + Let's Encrypt esto desaparece.

**P: ¿Mis usuarios verán la advertencia?**  
R: Sí, cada usuario la verá la primera vez. Por eso se recomienda usar un dominio real en producción.

**P: ¿Funciona en iOS/Safari?**  
R: Sí, pero Safari es más estricto. Puede que necesites aceptar el certificado dos veces.

**P: ¿Puedo usar HTTP mientras tanto?**  
R: Solo en PC. Los navegadores móviles bloquean cámara/micrófono en HTTP por seguridad (política de Google/Apple, no podemos cambiarla).

---

**¿Problemas?** Revisa los logs:
```bash
ssh root@194.164.164.78 "tail -50 /var/log/nginx/error.log"
```
