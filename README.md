# 🚗 SpecialWash - Sistema de Gestión


## 🌐 URLs de acceso

### Codespaces
- **Backend:** https://TU-CODESPACE-5000.app.github.dev
- **Panel Admin:** https://TU-CODESPACE-5000.app.github.dev/admin/
- **Frontend:** https://TU-CODESPACE-3000.app.github.dev

### IONOS
- **Servidor:** http://194.164.164.78
- **API:** http://194.164.164.78:5000
- **Frontend:** http://194.164.164.78:3000

**Login demo:** m@m / m

Sistema de gestión interna con inventario, entradas/salidas, clientes y servicios.

## 📦 Características

- ✅ Productos con alertas de stock mínimo 
- ✅ Entradas con cálculo de IVA y descuentos
- ✅ Salidas con trazabilidad por usuario
- ✅ Usuarios con roles (Admin/Encargado/Empleado)
- ✅ Maquinaria con control de garantías
- ✅ Clientes, coches y servicios
- ✅ Reportes e impresión optimizada

## 🛠️ Stack

- **Backend:** Python 3.12 + Flask + SQLite
- **Frontend:** React 18 + Bootstrap 5
- **Server:** Ubuntu 24.04 + Nginx

## 📁 Estructura

```
backend/
  ├── api/          # Rutas API
  ├── models/       # SQLAlchemy models
  ├── instance/     # Base de datos
  ├── app.py        # App principal
  └── config.py     # Configuración

frontend/
  ├── src/
  │   ├── pages/    # Vistas
  │   ├── component/# Navbar, Footer
  │   └── store/    # Estado global
  └── build/        # Build producción
```


## 🚀 Cómo levantar el proyecto

### En Codespaces
#### Backend
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py
```

#### Frontend
```bash
cd frontend
npm install
npm start
```

### En IONOS
#### Backend
```bash
cd /var/www/specialwash/backend
source venv/bin/activate
nohup python app.py > app.log 2>&1 &
```

#### Frontend
```bash
# Nginx sirve desde: /var/www/specialwash/public_html
systemctl reload nginx
```

## 🔐 Usuarios

| Email | Password | Rol |
|-------|----------|-----|
| m@m | m | Admin |
| c@c | c | Encargado |
| a@a | a | Empleado |

## 📝 Desarrollo Local

**Backend:**
```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

**Frontend:**
```bash
cd frontend
npm install
npm start
```


## Despliegue
- El backend corre en Flask (puerto 5000)
- El frontend corre en React (puerto 3000)
- Nginx puede usarse como proxy y servidor estático

## Notas
- Configura las variables de entorno según tu entorno
- La base de datos SQLite se encuentra en `backend/specialwash.db`
- Para producción, revisa la configuración de CORS y seguridad

---

Cualquier duda, abre un issue en GitHub o contacta al autor.
