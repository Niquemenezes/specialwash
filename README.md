# SpecialWash

Sistema de gestión para lavaderos de coches.

## Estructura
- **backend/**: API Flask, modelos y base de datos
- **frontend/**: Aplicación React para la interfaz de usuario

## Instalación rápida

### Backend (Flask)
1. Instala Python 3.10+ y pip
2. Crea y activa un entorno virtual:
   ```
   python -m venv .venv
   .venv\Scripts\activate
   ```
3. Instala dependencias:
   ```
   pip install -r backend/requirements.txt
   ```
4. Ejecuta el backend:
   ```
   cd backend
   python app.py
   ```

### Frontend (React)
1. Instala Node.js y npm
2. Instala dependencias:
   ```
   cd frontend
   npm install
   ```
3. Ejecuta el frontend:
   ```
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
