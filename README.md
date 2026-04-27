# SpecialWash — Plataforma de gestión operativa para taller

SpecialWash es una aplicación web interna orientada a talleres de detailing, pintura, tapicería y reacondicionamiento de vehículos. Centraliza la operativa diaria desde la recepción del coche hasta su entrega final, incluyendo planificación, partes de trabajo, control de calidad, inventario, cobros, control horario, uniformes y utilidades administrativas.

**Producción:** [https://specialwash.studio](https://specialwash.studio)

---

## Resumen ejecutivo

La plataforma cubre un flujo real de taller con varios perfiles de usuario y procesos encadenados:

1. Recepción del vehículo con inspección, firma y evidencias.
2. Asignación y ejecución de partes por área o empleado.
3. Seguimiento del estado del coche en tiempo real.
4. Repaso de calidad previo a entrega.
5. Entrega, firma final, acta y cobro según tipo de cliente.
6. Gestión transversal de inventario, personal, uniformes, citas, gastos y reporting.

Su objetivo es reducir trabajo manual, mejorar la trazabilidad por coche y evitar cierres incompletos antes de llegar al cliente final.

---

## Funcionalidades principales

### Operativa de taller

| Módulo | Descripción |
|--------|-------------|
| **Inspección de recepción** | Alta del vehículo con cliente, matrícula, kilometraje, servicios solicitados, fotos, vídeos y firma digital. |
| **Servicios aplicados** | Registro estructurado de servicios contratados, con precio, tiempo estimado y rol responsable. |
| **Partes de trabajo** | Creación y seguimiento de partes por empleado o por coche, con estados, pausas, tiempos y observaciones. |
| **Flujo por áreas** | Soporte operativo para `detailing`, `pintura`, `tapicero`, `calidad` y trabajo general. |
| **Estado de coches** | Vista de acompañamiento en tiempo real para saber qué coche está pendiente, en proceso, en pausa, en repaso o listo para entrega. |
| **Repaso de calidad** | Checklist previo a entrega centrado en trabajos contratados/realizados, con notas y validación final. |
| **Entrega al cliente** | Registro de trabajos realizados, firma de entrega, observaciones y validaciones de cierre. |
| **Acta de entrega** | Documento final ligado a la inspección, con trazabilidad del cierre y snapshot operativo. |
| **Hoja de intervención** | Documento técnico/imprimible opcional para casos que requieren informe o intervención formal. |
| **Coches entregados** | Histórico de vehículos cerrados y entregados. |

### Cobros y tipologías de cliente

| Módulo | Descripción |
|--------|-------------|
| **Cobro de particulares** | Flujo de cierre económico para clientes particulares. |
| **Cobros profesionales / concesionarios** | Gestión diferenciada para clientes profesionales, pagos pendientes y registro posterior. |
| **Bloqueos operativos** | La entrega se bloquea si el repaso no está completado o si quedan partes abiertos, salvo permisos de administración. |

### Inventario y materiales

| Módulo | Descripción |
|--------|-------------|
| **Productos** | Catálogo interno con stock actual, stock mínimo y soporte para códigos de barras. |
| **Entradas de almacén** | Registro de entradas por producto y proveedor. |
| **Salidas de material** | Control de salidas y consumos por operario o proceso. |
| **Inventario operativo** | Vista consolidada de stock y movimientos. |
| **Pedido por bajo stock** | Listado imprimible de necesidades de compra. |

### Gestión comercial y administrativa

| Módulo | Descripción |
|--------|-------------|
| **Clientes** | Gestión de clientes, historial y relación con inspecciones/vehículos. |
| **Vehículos / coches** | Gestión del parque de vehículos y trazabilidad por matrícula. |
| **Resumen de clientes** | Consulta agregada del histórico de actividad. |
| **Catálogo de servicios** | Servicios configurables con precio base, tiempo estimado y área responsable. |
| **Citas** | Agenda de citas y planificación operativa. |
| **Proveedores** | Gestión de proveedores para entradas y compras. |
| **Maquinaria** | Módulo de apoyo para activos y recursos del taller. |
| **Gastos de empresa** | Registro y consulta de gastos. |
| **Dashboard / finanzas** | Panel de control con ingresos, gastos, balance y seguimiento administrativo. |

### Personal y control interno

| Módulo | Descripción |
|--------|-------------|
| **Fichaje** | Registro horario adaptado a operarios y personal interno. |
| **Horarios** | Gestión administrativa de jornadas y control horario. |
| **Uniformes** | Control de stock de prendas, entregas a empleados, edición y resumen por trabajador. |
| **Productividad** | Vista de productividad y rendimiento del equipo. |
| **Notificaciones internas** | Alertas del sistema para eventos operativos relevantes. |

### Movilidad y soporte documental

| Módulo | Descripción |
|--------|-------------|
| **Firmas digitales** | Firma en recepción, coche de sustitución y entrega. |
| **Evidencias multimedia** | Subida de fotos y vídeos para documentar el estado del vehículo. |
| **Coche de sustitución** | Gestión de préstamo con contrato, RGPD, fotos de documentación y firma. |
| **Documentos imprimibles** | Soporte de impresión para actas, hoja técnica y pedidos. |

---

## Flujo operativo principal

```text
1. Recepción
   └── Inspección de entrada
       ├── Datos cliente/vehículo
       ├── Fotos y vídeos
       ├── Firma digital
       └── Servicios contratados

2. Ejecución en taller
   └── Partes de trabajo
       ├── Asignación por rol o empleado
       ├── Inicio / pausa / reanudación / finalización
       └── Seguimiento del estado del coche

3. Repaso de calidad
   └── Validación final de trabajos contratados o realizados

4. Entrega
   └── Firma final + acta + observaciones + cobro

5. Post-entrega / reporting
   └── Histórico, cobros profesionales, gastos, dashboard
```

---

## Roles y permisos

La plataforma utiliza permisos por rol en frontend y backend para acotar accesos por proceso.

| Rol | Alcance principal | Token |
|-----|-------------------|-------|
| `administrador` | Acceso global a operativa, administración, finanzas, usuarios y configuraciones | 8 horas |
| `calidad` | Inspección, repaso, entrega, citas, estado de coches y coche de sustitución | 8 horas |
| `salida` | Registro de salidas de material | 30 días |
| `detailing` | Partes propios, fichaje y operativa asociada | 10 minutos |
| `pintura` | Partes propios, fichaje y operativa de pintura | 10 minutos |
| `tapicero` | Partes propios, fichaje y operativa de tapicería | 10 minutos |
| `empleado` | Soporte operativo adicional según flujo | 10 minutos |

> Los tokens cortos para roles operativos reducen el riesgo de dejar sesiones abiertas en dispositivos compartidos del taller.

---

## Stack tecnológico

### Backend

- Python 3.12
- Flask 3
- SQLAlchemy 2
- SQLite
- JWT (`flask-jwt-extended`)
- Cloudinary para evidencias multimedia
- Integración OpenAI para apoyo en redacción documental

### Frontend

- React
- React Router
- Bootstrap 5
- Font Awesome
- SignaturePad para firmas digitales
- Tema visual dark/light personalizado

### Infraestructura

- VPS Linux en IONOS
- Nginx como proxy y servidor estático
- HTTPS con Let's Encrypt
- Entorno virtual Python para backend

---

## Estructura del proyecto

```text
specialwash/
├── backend/
│   ├── api/                  # Endpoints principales de negocio
│   ├── models/               # Modelos SQLAlchemy
│   ├── routes/               # Blueprints por dominio funcional
│   ├── services/             # Integraciones y lógica de apoyo
│   ├── utils/                # Helpers, auth, validaciones
│   ├── prompts/              # Soporte IA / prompts
│   ├── app.py                # Bootstrap principal
│   └── config.py             # Configuración
├── frontend/
│   ├── src/
│   │   ├── pages/            # Pantallas principales
│   │   ├── components/       # Componentes reutilizables
│   │   ├── config/           # Roles y permisos
│   │   ├── store/            # Estado global / acciones
│   │   ├── utils/            # API, auth y helpers
│   │   └── styles/           # Tema y estilos globales
│   ├── public/
│   └── build/                # Build de producción
└── README.md
```

---

## Módulos representativos en el código

### Frontend

- `frontend/src/pages/InspeccionRecepcionPage.jsx`
- `frontend/src/pages/RepasoEntregaPage.jsx`
- `frontend/src/pages/FirmaEntregaPage.jsx`
- `frontend/src/pages/VehiculoDetallePage.jsx`
- `frontend/src/pages/UniformesPage.jsx`
- `frontend/src/pages/FicharPage.jsx`
- `frontend/src/pages/HorariosAdminPage.jsx`
- `frontend/src/pages/CocheSustitucionPage.jsx`
- `frontend/src/pages/InventarioPage.jsx`
- `frontend/src/pages/DashboardPage.jsx`
- `frontend/src/pages/ProfesionalesPage.jsx`

### Backend

- `backend/api/inspeccion_routes.py`
- `backend/api/uniforme_routes.py`
- `backend/routes/horario_routes.py`
- `backend/routes/parte_trabajo_routes.py`
- `backend/routes/servicio_catalogo_routes.py`

---

## Desarrollo local

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate           # Windows
# source venv/bin/activate      # Linux/macOS
pip install -r requirements.txt
python app.py
```

Backend en:

`http://localhost:5000`

### Frontend

```bash
cd frontend
npm install
npm start
```

Frontend en:

`http://localhost:3000`

### Variables de entorno del backend

```env
FLASK_ENV=development
SECRET_KEY=dev_secret_key
JWT_SECRET_KEY=jwt_secret_key
DATABASE_URL=sqlite:///instance/specialwash.db
FRONTEND_URLS=http://localhost:3000
OPENAI_API_KEY=
CLOUDINARY_URL=
WHATSAPP_TOKEN=
```

Notas:

- `OPENAI_API_KEY` es opcional y se usa para ayudas de redacción.
- `CLOUDINARY_URL` es opcional para subida de fotos y vídeos.
- `FRONTEND_URLS` define orígenes permitidos.

---

## Despliegue en producción

El despliegue actual es manual vía SCP. El backend corre en `/root/specialwash/backend/` y el frontend en `/var/www/specialwash/public_html/`.

### 1. Compilar frontend

```bash
cd frontend
npm run build
```

### 2. Subir archivos

```powershell
scp -r frontend/build/* root@194.164.164.78:/var/www/specialwash/public_html/
scp backend/api/inspeccion_routes.py root@194.164.164.78:/root/specialwash/backend/api/
```

### 3. Reiniciar backend en servidor

```bash
ssh root@194.164.164.78
cd /root/specialwash/backend
pkill -f "app.py"
nohup venv/bin/python3 app.py >> /root/specialwash/logs/app.log 2>&1 &
```

### Comandos útiles

```bash
tail -f /root/specialwash/logs/app.log
curl -s http://127.0.0.1:5000/api/auth/me
nginx -t && systemctl reload nginx
```

---

## Consideraciones operativas

- La plataforma prioriza la trazabilidad por coche e inspección.
- La entrega final está protegida por validaciones de proceso.
- Los módulos de personal e inventario conviven con la operativa de taller en una única aplicación.
- El sistema está pensado para uso en escritorio y tablet dentro del entorno del taller.

---

## Estado actual del proyecto

SpecialWash no es un CRM genérico: está modelado alrededor de una operativa física real de recepción, ejecución, repaso y entrega de vehículos.

Su alcance actual combina:

- flujo de taller,
- control administrativo,
- documentación firmada,
- seguimiento interno de personal,
- control de recursos y materiales,
- soporte a clientes particulares y profesionales.
