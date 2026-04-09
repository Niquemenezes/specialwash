# SpecialWash — Sistema de Gestión de Taller

Sistema web interno para talleres de detailing y reparación de vehículos. Gestiona el flujo completo desde la recepción del coche hasta la entrega al cliente, incluyendo inventario, partes de trabajo, inspecciones y facturación.

**Producción:** [https://specialwash.studio](https://specialwash.studio)

---

## Funcionalidades

| Módulo | Descripción |
|--------|-------------|
| **Inspección de recepción** | Registro de estado del vehículo con fotos, vídeos y firma digital del cliente |
| **Partes de trabajo** | Asignación de tareas por empleado con control de tiempos y pausas |
| **Acta de entrega** | Documento de entrega firmado digitalmente por cliente y empleado |
| **Inventario** | Productos con stock mínimo, alertas, entradas/salidas y códigos de barras |
| **Clientes y vehículos** | Historial de servicios por cliente y matrícula |
| **Maquinaria** | Inventario de equipos con facturas almacenadas en Cloudinary |
| **Citas** | Calendario de citas con estados y notificaciones |
| **Finanzas** | Dashboard de ingresos, gastos y balance mensual |
| **Usuarios y roles** | 8 roles diferenciados (administrador, detailing, pintura, tapicero, etc.) |
| **Notificaciones** | Sistema de alertas internas en tiempo real |

---

## Stack tecnológico

**Backend**
- Python 3.12 + Flask 3.0
- SQLAlchemy 2.0 + SQLite
- Gunicorn (producción)
- JWT (autenticación), Flask-Admin (panel interno)
- Cloudinary (almacenamiento de fotos y vídeos)
- OpenAI gpt-4o-mini (redacción automática de actas)

**Frontend**
- React 19 + React Router 7
- Bootstrap 5.3 + tema oscuro/claro personalizado
- FontAwesome 7

**Servidor**
- Ubuntu 24.04 en VPS IONOS
- Nginx (proxy + archivos estáticos)
- Let's Encrypt (HTTPS)
- Systemd (gestión del proceso)

---

## Estructura del proyecto

```
specialwash/
├── backend/
│   ├── api/              # Blueprints API (inspecciones, rutas core)
│   ├── models/           # Modelos SQLAlchemy (22 modelos)
│   ├── routes/           # Blueprints por módulo
│   ├── services/         # Lógica de negocio (auth, OpenAI, WhatsApp)
│   ├── utils/            # Decoradores y helpers
│   ├── prompts/          # Prompts para generación de actas con IA
│   ├── app.py            # Punto de entrada
│   └── config.py         # Configuración centralizada
└── frontend/
    ├── src/
    │   ├── pages/        # 30+ páginas React
    │   ├── component/    # Navbar, Footer, modales, SignaturePad
    │   ├── store/        # Context API + flux (estado global)
    │   ├── utils/        # authSession, apiBase, barcode
    │   └── styles/       # Tema premium dark/light
    └── build/            # Build de producción
```

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

## Deploy en producción

El servidor de producción es un VPS Ubuntu en IONOS (`YOUR_SERVER_IP`) con Nginx + Gunicorn + systemd.

```bash
# 1. Compilar frontend
cd frontend && npm run build

# 2. Crear paquete de deploy
tar --exclude='./backend/venv' --exclude='./backend/instance' \
    --exclude='./backend/.env' --exclude='./frontend/node_modules' \
    --exclude='./frontend/src' -czf deploy.tar.gz ./backend ./frontend/build ./deploy

# 3. Subir al servidor
scp deploy.tar.gz root@YOUR_SERVER_IP:/tmp/

# 4. En el servidor
ssh root@YOUR_SERVER_IP
cd /var/www/specialwash/app
tar --strip-components=1 -xzf /tmp/deploy.tar.gz
source backend/venv/bin/activate
pip install -r backend/requirements.txt -q
cp -r frontend/build/* /var/www/specialwash-frontend/
systemctl restart specialwash-backend && systemctl reload nginx
```

Ver `deploy/` para scripts completos y configuración de Nginx/systemd.

---

## Roles de usuario

| Rol | Acceso |
|-----|--------|
| `administrador` | Acceso completo |
| `detailing` | Flujo de entrega, salidas, partes propios, salida de productos |
| `calidad` | Inspecciones, estado de coches, partes, salida de productos |
| `pintura` | Partes propios, salida de productos |
| `tapicero` | Partes propios (flujo tapicería) |
| `empleado` | Salidas, partes propios, inspección |

---

## Comandos útiles en producción

```bash
# Estado de los servicios
systemctl status specialwash-backend
systemctl status nginx

# Logs en tiempo real
journalctl -u specialwash-backend -f

# Reiniciar tras actualización
systemctl restart specialwash-backend && systemctl reload nginx

# Backup manual de la BD
cp /var/www/specialwash/data/specialwash.db \
   /var/www/specialwash/backup/specialwash_$(date +%Y%m%d).db
```
