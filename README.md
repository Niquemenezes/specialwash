# 🚗 SpecialWash - Sistema de Gestión

**Servidor:** http://194.164.164.78  
**API:** http://194.164.164.78:5000  
**Login:** m@m / m

Sistema de gestión interna con inventario, entradas/salidas, clientes y servicios.

## 📦 Características

- ✅ Productos con alertas de stock mínimo (137 productos)
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

## 🚀 Deployment

### Backend
```bash
cd /var/www/specialwash/backend
source venv/bin/activate
nohup python app.py > app.log 2>&1 &
```

### Frontend
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

---
© 2026 Monique Menezes
