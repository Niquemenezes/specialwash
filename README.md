# SpecialWash

Plataforma interna para la gestion operativa de un centro profesional de detailing automotriz.

El sistema centraliza procesos de negocio en una unica aplicacion web:

- gestion de usuarios y roles
- clientes y vehiculos
- inspeccion de recepcion y entrega
- productos, proveedores y stock
- entradas y salidas de almacen
- trazabilidad operativa para equipo y administracion

## Objetivo

Digitalizar operaciones clave del taller para reducir errores manuales, mejorar el control de stock y profesionalizar la experiencia de entrega al cliente.

## Stack Tecnologico

### Backend

- Python
- Flask
- Flask-JWT-Extended
- Flask-SQLAlchemy
- Flask-CORS

### Frontend

- React
- React Router
- Bootstrap

### Base de Datos

- SQLite (entorno actual)

## Estructura del Proyecto

```text
specialwash/
	backend/
		app.py
		config.py
		api/
		models/
		routes/
		services/
		utils/
	frontend/
		package.json
		public/
		src/
	DEPLOY.md
	GUIA_ACTUALIZAR_BD.md
	deploy.sh
```

## Requisitos

- Python 3.10+
- Node.js 18+
- npm

## Puesta en Marcha (Local)

### 1. Clonar repositorio

```bash
git clone https://github.com/Niquemenezes/specialwash
cd specialwash
```

### 2. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py
```

Backend disponible en `http://localhost:5000`.

### 3. Frontend

En otra terminal:

```bash
cd frontend
npm install
npm start
```

Frontend disponible en `http://localhost:3000`.

## Deploy en Produccion (IONOS)

Este proyecto se despliega en VPS de IONOS.

Comandos principales:

```bash
./deploy.sh backend
./deploy.sh frontend
./deploy.sh all
```

Documentacion completa de despliegue:

- `DEPLOY.md`

## Seguridad y Configuracion

- Variables de entorno sensibles no deben versionarse (`.env`).
- La base de datos productiva no debe sobrescribirse en deploy de codigo.
- Para cambios de esquema, seguir `GUIA_ACTUALIZAR_BD.md`.

## Estado del Proyecto

Proyecto en evolucion continua con foco en:

- mantenibilidad de arquitectura
- modularizacion del backend
- robustez del flujo inspeccion/entrega
- calidad de experiencia de usuario en frontend

## Autor

Monique Menezes
