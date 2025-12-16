# 🚗 SpecialWash - Sistema de Gestión Interna

Sistema completo de gestión de inventario, entradas, salidas, proveedores y maquinaria para SpecialWash. Diseño premium con tema negro y dorado.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-Private-red)

## 📸 Características Principales

- 🎨 **Diseño Premium** - Tema negro/dorado con interfaz moderna
- 📦 **Gestión de Productos** - Control de stock con alertas de mínimo
- 📥 **Registro de Entradas** - Con cálculo automático de IVA
- 📤 **Registro de Salidas** - Historial completo de movimientos
- 👥 **Gestión de Usuarios** - Sistema de roles (Admin/Empleado)
- 🏭 **Control de Maquinaria** - Seguimiento de equipos
- 🖨️ **Impresión Optimizada** - Reportes listos para imprimir
- 📱 **Responsive Design** - Funciona en móvil y desktop

## 🛠️ Stack Tecnológico

### Frontend
- **React 19.2.3** - Framework principal
- **React Router 7.10.1** - Navegación
- **Bootstrap 5.3.8** - Diseño responsive
- **Font Awesome 7.1.0** - Iconos
- **Context API** - Gestión de estado

### Backend
- **Flask 3.0.0** - Framework Python
- **Flask-JWT-Extended 4.6.0** - Autenticación
- **SQLAlchemy 2.0.45** - ORM
- **SQLite** - Base de datos (desarrollo)
- **Flask-CORS 4.0.0** - Manejo de CORS

## 🚀 Inicio Rápido

### Prerequisitos

```bash
Node.js 16+ y npm
Python 3.8+
```

### Instalación

1. **Clona el repositorio:**
```bash
git clone <tu-repositorio>
cd specialwash-clean
```

2. **Backend:**
```bash
cd backend
pip install -r requirements.txt
python app.py
```
Backend disponible en: `http://localhost:5000`

3. **Frontend:**
```bash
cd frontend
npm install
npm start
```
Frontend disponible en: `http://localhost:3000`

### Usuarios de Prueba

**Administrador:**
```
Email: admin@specialwash.com
Password: admin123
```

**Empleado:**
```
Email: empleado@specialwash.com
Password: empleado123
```

## 📁 Estructura del Proyecto

```
specialwash-clean/
│
├── frontend/                  # Aplicación React
│   ├── public/
│   ├── src/
│   │   ├── component/        # Componentes reutilizables
│   │   ├── pages/            # Páginas de la aplicación
│   │   ├── store/            # Estado global (Context)
│   │   └── styles/           # CSS
│   ├── .env                  # Config desarrollo
│   ├── .env.production       # Config producción
│   └── package.json
│
├── backend/                   # API Flask
│   ├── api/
│   │   └── routes.py         # Endpoints
│   ├── models/               # Modelos BD
│   │   ├── user.py
│   │   ├── producto.py
│   │   ├── entrada.py
│   │   ├── salida.py
│   │   ├── proveedor.py
│   │   └── maquinaria.py
│   ├── app.py                # App principal
│   ├── config.py             # Configuración
│   └── requirements.txt
│
├── INSTRUCCIONES_DEPLOYMENT.md   # Guía de deployment
├── DEPLOYMENT_IP.md              # Deployment con IP
├── rebuild.bat                   # Script de rebuild
└── README.md                     # Este archivo
```

## 🎯 Módulos del Sistema

### 1. Productos
- Listado con filtros y búsqueda
- Control de stock actual vs. mínimo
- Alertas de bajo stock
- Generación automática de pedidos

### 2. Entradas
- Registro de compras
- Cálculo automático de IVA (21%)
- Vinculación con proveedores
- Histórico de entradas

### 3. Salidas
- Registro de consumo/salidas
- Control por usuario
- Cálculo de costos
- Observaciones detalladas

### 4. Proveedores
- Gestión de contactos
- Historial de compras
- Información de contacto

### 5. Maquinaria
- Inventario de equipos
- Estado y ubicación
- Observaciones de mantenimiento

### 6. Usuarios
- Roles: Administrador y Empleado
- Permisos diferenciados
- Gestión de accesos

## 🌐 Deployment en Ionos

### IP Configurada: `194.164.164.78`

### Opción 1: Build y Subir (Manual)

```bash
# 1. Genera el build
cd frontend
npm run build

# 2. Conecta por FTP a Ionos
# Host: 194.164.164.78
# Sube contenido de frontend/build/ a raíz web

# 3. Sube backend
# Sube carpeta backend/ completa

# 4. En servidor Ionos:
cd backend
pip install -r requirements.txt
gunicorn --bind 0.0.0.0:5000 wsgi:app
```

### Opción 2: Script Automático

```bash
# Windows
rebuild.bat

# El script:
# - Limpia build anterior
# - Genera nuevo build
# - Abre carpeta para subir por FTP
```

### Documentación Completa

📖 Ver guías detalladas:
- [INSTRUCCIONES_DEPLOYMENT.md](INSTRUCCIONES_DEPLOYMENT.md) - Paso a paso completo
- [DEPLOYMENT_IP.md](DEPLOYMENT_IP.md) - Deployment con IP
- [DEPLOYMENT.md](DEPLOYMENT.md) - Deployment con dominio

## 🔧 Configuración

### Variables de Entorno

**Frontend - Desarrollo** (`frontend/.env`):
```env
REACT_APP_BACKEND_URL=http://localhost:5000
```

**Frontend - Producción** (`frontend/.env.production`):
```env
REACT_APP_BACKEND_URL=http://194.164.164.78:5000
```

**Backend** (`backend/config.py` o `.env` en raíz):
```env
SECRET_KEY=tu-clave-super-secreta
JWT_SECRET_KEY=tu-jwt-super-secreto
FLASK_ENV=production
```

### CORS

El backend está configurado para aceptar peticiones desde cualquier origen:

```python
# backend/app.py
CORS(app)  # Permite todos los orígenes
```

Para producción, restringe orígenes:
```python
CORS(app, origins=["http://194.164.164.78"])
```

## 📡 API Documentation

### Endpoints Principales

#### Autenticación
```
POST   /api/auth/login_json     # Login con JWT
POST   /api/signup               # Registro
GET    /api/auth/me              # Usuario actual
POST   /api/auth/logout          # Logout
```

#### Productos
```
GET    /api/productos            # Listar
POST   /api/productos            # Crear
PUT    /api/productos/:id        # Actualizar
DELETE /api/productos/:id        # Eliminar
```

#### Entradas/Salidas
```
GET    /api/registro-entrada     # Listar entradas
POST   /api/registro-entrada     # Registrar entrada
GET    /api/salidas              # Listar salidas
POST   /api/registro-salida      # Registrar salida
```

Ver documentación completa en `backend/api/routes.py`

## 🎨 Personalización

### Tema de Colores

Edita `frontend/src/styles/index.css`:

```css
:root {
  --sw-bg: #000000;        /* Negro principal */
  --sw-bg-2: #0a0a0a;      /* Negro secundario */
  --sw-gold: #d4af37;      /* Dorado corporativo */
  --sw-text: #ffffff;      /* Texto blanco */
}
```

### Logo

Reemplaza: `frontend/src/img/logospecialwash.jpg`

## 🐛 Troubleshooting

### Backend no arranca
```bash
# Verifica Python
python --version  # Debe ser 3.8+

# Reinstala dependencias
pip install -r requirements.txt

# Revisa logs
python app.py  # Ver errores en consola
```

### Frontend no conecta
```bash
# 1. Verifica backend corriendo en http://localhost:5000
# 2. Revisa .env tiene REACT_APP_BACKEND_URL correcto
# 3. Limpia caché
npm start  # Ctrl+Shift+R en navegador

# 4. Verifica consola del navegador (F12)
```

### Error CORS
```python
# backend/app.py - Agrega origen específico
CORS(app, origins=["http://localhost:3000"])
```

### Build falla
```bash
cd frontend
rm -rf node_modules build
npm install
npm run build
```

## 📊 Base de Datos

### Desarrollo (SQLite)
- Archivo: `backend/specialwash.db`
- Se crea automáticamente al iniciar
- Ubicación: carpeta `backend/`

### Producción (Recomendado)
- Migrar a PostgreSQL o MySQL
- Actualizar `backend/config.py`:

```python
SQLALCHEMY_DATABASE_URI = "postgresql://user:pass@host/dbname"
```

### Modelos Principales

- **User** - Usuarios del sistema
- **Producto** - Inventario de productos
- **Proveedor** - Proveedores
- **Entrada** - Registro de compras
- **Salida** - Registro de consumos
- **Maquinaria** - Equipos y maquinaria

## 🔒 Seguridad

⚠️ **Importante para Producción:**

1. **Cambia claves secretas:**
```python
# backend/config.py
SECRET_KEY = "genera-clave-aleatoria-segura"
JWT_SECRET_KEY = "genera-otra-clave-diferente"
```

2. **Usa HTTPS:**
- Obtén certificado SSL (Let's Encrypt gratis)
- Configura en servidor web

3. **Restringe CORS:**
```python
CORS(app, origins=["https://tudominio.com"])
```

4. **Cambia usuarios por defecto:**
- Elimina o cambia contraseñas de admin/empleado de prueba

5. **Variables de entorno:**
- No subas archivos `.env` a Git
- Usa variables de entorno en servidor

## 📈 Roadmap / Mejoras Futuras

- [ ] Dashboard con gráficos
- [ ] Exportación de reportes a PDF
- [ ] Notificaciones en tiempo real
- [ ] App móvil nativa
- [ ] Integración con APIs de proveedores
- [ ] Sistema de alertas por email
- [ ] Backup automático de base de datos
- [ ] Multi-idioma (i18n)

## 🤝 Contribución

Este es un proyecto privado de uso interno. Para cambios o mejoras, contacta al equipo de desarrollo.

## 📞 Soporte

Para soporte técnico o consultas:
- Email: [tu-email]
- Documentación: Ver carpeta `/docs`
- Issues: Contactar administrador

## 📄 Licencia

© 2025 SpecialWash. Todos los derechos reservados.
Software de uso interno exclusivo.

---

**Versión:** 1.0.0  
**Última actualización:** Diciembre 2025  
**Desarrollado para:** SpecialWash  
**Stack:** React + Flask + SQLAlchemy
