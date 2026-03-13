# Guía: Generar APK de SpecialWash

## Pre-requisitos

- Java JDK 17+ instalado
- Android Studio o Android SDK instalado
- Variables de entorno configuradas (`ANDROID_HOME`, `JAVA_HOME`)

---

## Generar APK (sin dominio, usando IP)

### 1. Build del frontend para Android

```bash
cd frontend
npm run build:android
```

Esto:
- Construye React con backend `https://specialwash.studio`
- Sincroniza build con proyecto Android

### 2. Compilar APK debug

```bash
cd android
./gradlew assembleDebug
```

APK generado en:
```
android/app/build/outputs/apk/debug/app-debug.apk
```

### 3. Instalar en móvil

**Vía cable USB:**
```bash
adb install app/build/outputs/apk/debug/app-debug.apk
```

**O copiar APK al móvil y abrir desde gestor de archivos.**

---

## Cuando tengas dominio

### 1. Actualizar backend URL

Edita `frontend/.env.android`:
```bash
# Cambia la IP por tu dominio
REACT_APP_BACKEND_URL=https://tudominio.com
```

### 2. Actualizar network security config

Edita `frontend/android/app/src/main/res/xml/network_security_config.xml`:

Comenta el bloque de IP y descomenta el de dominio:
```xml
<!-- 
<domain-config cleartextTrafficPermitted="false">
    <domain includeSubdomains="false">specialwash.studio</domain>
    ...
</domain-config>
-->

<domain-config cleartextTrafficPermitted="false">
    <domain includeSubdomains="true">tudominio.com</domain>
    <trust-anchors>
        <certificates src="system" />
    </trust-anchors>
</domain-config>
```

### 3. Instalar Let's Encrypt en servidor

```bash
ssh root@specialwash.studio
apt install certbot python3-certbot-nginx
certbot --nginx -d tudominio.com
```

### 4. Rebuild y redistribuir APK

```bash
cd frontend
npm run build:android
cd android
./gradlew assembleDebug
```

---

## Primera instalación en móvil

1. **Instala el APK** en tu Android
2. **Abre la app** por primera vez
3. **Acepta permisos** de cámara cuando lo pida
4. **Login:** usa tus credenciales de producción

### Si aparece error de certificado:

Es normal con certificado autofirmado. La configuración de `network_security_config.xml` permite certificados de usuario, así que:

1. Abre Chrome en el móvil
2. Ve a `https://specialwash.studio`
3. Acepta la advertencia de certificado (hazlo manualmente una vez)
4. Vuelve a abrir la app

Después de aceptar el certificado en Chrome, la app debería funcionar.

---

## APK Release (para publicar)

```bash
cd frontend/android
./gradlew assembleRelease
```

APK en: `app/build/outputs/apk/release/app-release-unsigned.apk`

Para firmarlo y subirlo a Play Store, necesitas crear una keystore. Documentación oficial de Android.

---

## Troubleshooting

### Error: "Network request failed"
- Verifica que el backend esté corriendo en producción
- Comprueba que HTTPS esté activo: `curl -I https://specialwash.studio`

### Error: "Unable to verify certificate"
- Acepta el certificado manualmente en Chrome del móvil primero
- Verifica que `network_security_config.xml` esté en `res/xml/`

### La cámara no funciona
- Verifica permisos en: Ajustes → Apps → SpecialWash → Permisos
- Reinstala el APK si es necesario

---

## Comandos rápidos

```bash
# Build + sync Android
npm run build:android

# Compilar APK debug
cd android && ./gradlew assembleDebug

# Instalar en dispositivo conectado
adb install app/build/outputs/apk/debug/app-debug.apk

# Ver logs en tiempo real
adb logcat | grep -i capacitor
```
