# Rotacion De Claves (Guia Rapida)

Esta guia sirve para rotar secretos sin cambiar codigo.

## 1) Generar nuevas claves de Flask/JWT

En el servidor, genera valores nuevos:

```bash
openssl rand -hex 32
openssl rand -hex 32
```

Usa el primer valor para `SECRET_KEY` y el segundo para `JWT_SECRET_KEY`.

## 2) Actualizar variables en produccion

En tu `.env` de produccion define/actualiza:

```env
SECRET_KEY=<nuevo_valor>
JWT_SECRET_KEY=<nuevo_valor>
OPENAI_API_KEY=<nueva_clave_openai>
CLOUDINARY_CLOUD_NAME=<cloud_name>
CLOUDINARY_API_KEY=<api_key>
CLOUDINARY_API_SECRET=<api_secret>
WHATSAPP_TOKEN=<nuevo_token_meta>
```

Opcional (rate-limit login):

```env
LOGIN_MAX_ATTEMPTS=5
LOGIN_WINDOW_SECONDS=300
LOGIN_BLOCK_SECONDS=900
```

## 3) Reiniciar backend

Tras cambiar secretos, reinicia Flask/Gunicorn.

Efecto esperado:
- Se invalidan JWT emitidos antes del cambio de `JWT_SECRET_KEY`.
- Nuevos logins emitirán tokens firmados con la clave nueva.

## 4) Higiene del repositorio

- No subir archivos `.env`.
- No versionar bases de datos con datos reales.
- Si una clave estuvo expuesta, rotarla aunque el archivo sea privado.
