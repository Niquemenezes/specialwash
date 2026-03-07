# 🚗 SpecialWash – Sistema de gestión interna

Sistema interno desarrollado para la gestión completa de un **centro profesional de detailing automotriz**.

El objetivo del proyecto es digitalizar y organizar los procesos internos del negocio, permitiendo controlar:

* empleados
* productos
* proveedores
* maquinaria
* entradas y salidas de stock

todo desde una única plataforma.

---

# 📌 Características principales

## 👥 Gestión de empleados

Permite administrar los usuarios del sistema.

Funciones:

* Crear empleados
* Editar información
* Eliminar usuarios
* Control de roles

---

## 📦 Gestión de productos

Registro de los productos utilizados en el centro.

Información registrada:

* Nombre del producto
* Descripción
* Categoría
* Proveedor
* Stock mínimo

---

## 🏢 Gestión de proveedores

Permite controlar los proveedores que suministran productos o maquinaria.

Funciones:

* Crear proveedor
* Editar proveedor
* Eliminar proveedor

---

## 📊 Control de stock

Sistema de control para conocer el inventario disponible.

Incluye:

* visualización del stock
* control de inventario
* alerta de bajo stock

---

## 📥 Registro de entradas de productos

Permite registrar los productos que entran al almacén.

Datos registrados:

* producto
* proveedor
* número de factura o albarán
* fecha de entrada
* cantidad
* precio sin IVA
* IVA
* descuento
* precio final

---

## 📤 Registro de salidas de productos

Permite registrar los productos utilizados por los empleados.

Datos registrados:

* producto
* cantidad utilizada
* fecha
* usuario
* observaciones

---

## 🛠 Gestión de maquinaria

Registro de maquinaria utilizada en el negocio.

Información registrada:

* nombre de la máquina
* proveedor
* fecha de compra
* garantía
* observaciones

---

# 🧱 Arquitectura del sistema

El proyecto está dividido en dos partes principales.

## Backend

API desarrollada con **Python y Flask**.

Responsable de:

* autenticación
* control de usuarios
* gestión de productos
* control de stock
* registro de movimientos
* conexión con base de datos

---

## Frontend

Interfaz web desarrollada con **React**.

Permite:

* gestionar información
* visualizar datos
* interactuar con la API

---

# ⚙️ Tecnologías utilizadas

### Backend

* Python
* Flask
* Flask-JWT-Extended
* Flask-SQLAlchemy
* Flask-CORS

### Frontend

* React
* Bootstrap

### Base de datos

* MySQL

### Control de versiones

* Git
* GitHub

---

# 📂 Estructura del proyecto

```
specialwash
│
├── backend
│
├── Interfaz
│
├── README.md
├── DESPLIEGUE.md
├── GUIA_ACTUALIZAR_BD.md
└── .gitignore
```

---

# 🚀 Instalación del proyecto

## Clonar el repositorio

```
git clone https://github.com/Niquemenezes/specialwash
```

---

## Instalar backend

```
cd backend
pip install -r requirements.txt
python app.py
```

---

## Instalar frontend

```
cd Interfaz
npm install
npm start
```

---

# 🌐 Despliegue

El proyecto está desplegado en un servidor propio utilizando **IONOS**.

La documentación de despliegue se encuentra en:

```
DESPLIEGUE.md
```

---

# 📈 Estado del proyecto

Proyecto en desarrollo activo.

Actualmente se siguen implementando mejoras en:

* optimización del backend
* control avanzado de stock
* mejoras en la interfaz
* nuevas funcionalidades administrativas

---

# 👩‍💻 Autor

**Monique Menezes**
