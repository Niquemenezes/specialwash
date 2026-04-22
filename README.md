# SpecialWash — Sistema de Gestión de Taller

Sistema web interno para talleres de detailing y reparación de vehículos. Gestiona el flujo completo desde la recepción del coche hasta la entrega al cliente, incluyendo inventario, partes de trabajo, inspecciones, coches de sustitución y facturación.

**Producción:** [https://specialwash.studio](https://specialwash.studio)

---

## Funcionalidades

| Módulo | Descripción |
|--------|-------------|
| **Inspección de recepción** | Registro de estado del vehículo con fotos, vídeos y firma digital del cliente |
| **Partes de trabajo** | Asignación de tareas por empleado con control de tiempos y pausas |
| **Repaso de calidad** | Control de calidad obligatorio antes de la entrega al cliente |
| **Acta de entrega** | Documento de entrega firmado digitalmente; bloqueada si el repaso no está completado |
| **Hoja de intervención** | Documento imprimible opcional por coche para clientes especiales (sin firma ni cobro) |
| **Coches de sustitución** | Gestión de préstamos de vehículos con contrato RGPD, fotos de carnet y firma digital |
| **Inventario** | Productos con stock mínimo, alertas, entradas/salidas y códigos de barras |
| **Catálogo de servicios** | Servicios con precio base, tiempo estimado y rol responsable |
| **Clientes y vehículos** | Historial de servicios por cliente y matrícula |
| **Citas** | Calendario de citas con estados y notificaciones |
| **Control horario** | Fichaje de empleados con foto, registro de jornadas y horarios |
| **Salidas de material** | Registro de material consumido por trabajo con rol dedicado |
| **Finanzas** | Dashboard de ingresos, gastos y balance mensual |
| **Usuarios y roles** | 7 roles diferenciados con tokens JWT por duración según rol |
| **Notificaciones** | Sistema de alertas internas en tiempo real |

---

## Stack tecnológico

**Backend**
- Python 3.12 + Flask 3.0
- SQLAlchemy 2.0 + SQLite
- JWT con expiración por rol (flask-jwt-extended)
- Cloudinary (almacenamiento de fotos y vídeos)
- OpenAI gpt-4o-mini (redacción automática de actas)

**Frontend**
- React 18 + React Router 6
- Bootstrap 5.3 + tema oscuro/claro personalizado
- FontAwesome 6
- SignaturePad (firmas digitales en tablet)

**Servidor**
- Ubuntu 24.04 en VPS IONOS (194.164.164.78)
- Nginx (proxy inverso + archivos estáticos)
- Let's Encrypt (HTTPS)
- Python venv (`/root/specialwash/backend/venv`)

---

## Estructura del proyecto

```
specialwash/
├── backend/
│   ├── api/              # Blueprints API core (inspecciones, actas, entregas)
│   ├── models/           # Modelos SQLAlchemy
│   ├── routes/           # Blueprints por módulo (almacén, horario, citas, etc.)
│   ├── services/         # Lógica de negocio (auth, OpenAI, WhatsApp)
│   ├── utils/            # Decoradores de roles y helpers
│   ├── media/            # Archivos subidos (fotos carnet, coches sustitución)
│   ├── app.py            # Punto de entrada
│   └── config.py         # Configuración centralizada
└── frontend/
    ├── src/
    │   ├── pages/        # 35+ páginas React
    │   ├── components/   # Navbar, Sidebar, SignaturePad, modales
    │   ├── store/        # Context API + flux (estado global)
    │   ├── utils/        # apiFetch, authSession, apiBase
    │   └── styles/       # Tema premium dark/light + print CSS
    └── build/            # Build de producción
```

---

## Roles de usuario y tokens JWT

| Rol | Acceso | Token |
|-----|--------|-------|
| `administrador` | Acceso completo, puede saltarse bloqueos de entrega | 8 horas |
| `calidad` | Inspecciones, estado de coches, partes, coches sustitución | 8 horas |
| `salida` | Registro de salidas de material | 30 días |
| `detailing` | Flujo de entrega, partes propios, salida de productos | 10 minutos |
| `pintura` | Partes propios, salida de productos | 10 minutos |
| `tapicero` | Partes propios (flujo tapicería) | 10 minutos |
| `empleado` | Salidas, partes propios, inspección | 10 minutos |

> Los roles de empleado tienen token de 10 minutos porque comparten tablet — así cada uno hace login propio sin dejar la sesión abierta.

---

## Desarrollo local

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env              # Rellenar variables
python app.py
```

El backend arranca en `http://localhost:5000`.

### Frontend

```bash
cd frontend
npm install
npm start
```

El frontend arranca en `http://localhost:3000`.

### Variables de entorno (backend/.env)

```env
FLASK_ENV=development
SECRET_KEY=dev_secret_key
JWT_SECRET_KEY=jwt_secret_key
DATABASE_URL=sqlite:///instance/specialwash.db
FRONTEND_URLS=http://localhost:3000
OPENAI_API_KEY=          # Opcional — para redacción de actas con IA
CLOUDINARY_URL=          # Opcional — para subida de fotos/vídeos
WHATSAPP_TOKEN=          # Opcional — para notificaciones WhatsApp
```

---

## Deploy en producción (IONOS VPS)

El deploy es manual via SCP. El backend corre en `/root/specialwash/backend/` y el frontend en `/var/www/specialwash/public_html/`.

### 1. Compilar el frontend

```bash
cd frontend && npm run build
```

### 2. Subir archivos (desde PowerShell en Windows)

```powershell
# Backend (solo los archivos modificados)
scp backend/api/inspeccion_routes.py root@194.164.164.78:/root/specialwash/backend/api/
scp backend/routes/almacen_routes.py root@194.164.164.78:/root/specialwash/backend/routes/

# Frontend completo
scp -r frontend/build/* root@194.164.164.78:/var/www/specialwash/public_html/
```

### 3. En el servidor

```bash
ssh root@194.164.164.78

# Arreglar permisos del frontend
chmod -R 755 /var/www/specialwash/public_html
chown -R www-data:www-data /var/www/specialwash/public_html

# Reiniciar el backend
cd /root/specialwash/backend
pkill -f "app.py"
sleep 1
nohup venv/bin/python3 app.py >> /root/specialwash/logs/app.log 2>&1 &

# Verificar que arrancó
curl -s http://127.0.0.1:5000/api/auth/me
```

---

## Comandos útiles en producción

```bash
# Ver logs del backend
tail -f /root/specialwash/logs/app.log

# Verificar que el backend responde
curl -s http://127.0.0.1:5000/api/auth/me

# Backup manual de la base de datos
cp /root/specialwash/backend/instance/specialwash.db \
   /root/specialwash/backend/instance/specialwash_$(date +%Y%m%d).db

# Ver estado de nginx
systemctl status nginx
nginx -t && systemctl reload nginx
```

---

## Flujo de trabajo principal

```
1. Recepción del coche
   └── Inspección de entrada (fotos, firma cliente, servicios)
       └── Opcional: marcar "Requiere hoja de intervención"

2. Trabajo en taller
   └── Partes de trabajo por empleado (con tiempos y pausas)
       └── Opcional: imprimir hoja de intervención (sin firma ni cobro)

3. Repaso de calidad (obligatorio antes de entrega)

4. Entrega al cliente
   └── Trabajos realizados + firma cliente + cobro
       └── Bloqueada si: repaso no completado o partes abiertos (salvo admin)

```
