/**
 * Configuración centralizada de roles y permisos
 * Define qué rutas y funciones puede acceder cada rol
 * Simplifica mantenimiento y hace el sistema más claro
 */

// Definición de roles
export const ROLES = {
  ADMIN: "administrador",
  CALIDAD: "calidad",
  DETAILING: "detailing",
  PINTURA: "pintura",
  TAPICERO: "tapicero",
};

// Roles de empleados operativos
export const EMPLOYEE_ROLES = [ROLES.DETAILING, ROLES.PINTURA, ROLES.TAPICERO];

// Mapa de permisos: ruta -> array de roles permitidos
export const ROUTE_PERMISSIONS = {
  // ═══ HOME Y AUTENTICACIÓN ═══
  "/": ["*"], // Todos
  "/login": ["*"], // Todos (sin autenticar)

  // ═══ FLUJO CALIDAD (Inspección → Repaso → Entrega → Cobro) ═══
  "/inspeccion-recepcion": [ROLES.ADMIN, ROLES.CALIDAD],
  "/vehiculo-detalle/:inspeccion_id": [ROLES.ADMIN, ROLES.CALIDAD],
  "/inspecciones-guardadas": [ROLES.ADMIN],
  "/repaso-entrega": [ROLES.ADMIN, ROLES.CALIDAD, ...EMPLOYEE_ROLES],
  "/calidad-entrega": [ROLES.ADMIN, ROLES.CALIDAD],
  "/entrega-cliente/:inspeccion_id": [ROLES.ADMIN, ROLES.CALIDAD],
  "/acta-entrega/:id": [ROLES.ADMIN, ...EMPLOYEE_ROLES, ROLES.CALIDAD],

  // ═══ INFORME TÉCNICO (Solo Admin) ═══
  "/hoja-tecnica/:inspeccion_id": [ROLES.ADMIN],

  // ═══ PARTES DE TRABAJO ═══
  "/partes-trabajo": [ROLES.ADMIN, ROLES.CALIDAD], // Acompañamiento en tiempo real
  "/mis-partes-trabajo": [...EMPLOYEE_ROLES], // Mis trabajos
  "/partes-trabajo-finalizados": [ROLES.ADMIN],
  "/partes": [ROLES.ADMIN, ROLES.CALIDAD, ...EMPLOYEE_ROLES],

  // ═══ INVENTARIO Y SALIDAS ═══
  "/productos": [ROLES.ADMIN],
  "/entradas": [ROLES.ADMIN],
  "/salidas": [ROLES.ADMIN, ROLES.CALIDAD, ...EMPLOYEE_ROLES],
  "/resumen-entradas": [ROLES.ADMIN],
  "/historial-salidas": [ROLES.ADMIN],
  "/inventario": [ROLES.ADMIN, ROLES.CALIDAD, ...EMPLOYEE_ROLES],

  // ═══ ADMINISTRACIÓN Y GESTIÓN ═══
  "/administracion": [ROLES.ADMIN],
  "/dashboard": [ROLES.ADMIN],
  "/usuarios": [ROLES.ADMIN],
  "/clientes": [ROLES.ADMIN],
  "/coches": [ROLES.ADMIN],
  "/resumen-clientes": [ROLES.ADMIN],
  "/vehiculos": [ROLES.ADMIN, ROLES.CALIDAD, ...EMPLOYEE_ROLES],
  "/proveedores": [ROLES.ADMIN],
  "/maquinaria": [ROLES.ADMIN],
  "/catalogo-servicios": [ROLES.ADMIN],

  // ═══ FINANZAS Y COBROS ═══
  "/administracion/finanzas": [ROLES.ADMIN],
  "/administracion/cobros-profesionales": [ROLES.ADMIN], // Cobro concesionarios
  "/cobro-particulares": [ROLES.ADMIN, ROLES.CALIDAD], // Cobro particulares (NUEVO)

  // ═══ CITAS Y RESPALDO ═══
  "/citas": [ROLES.ADMIN, ROLES.CALIDAD, ROLES.DETAILING],
  "/fichar": [ROLES.ADMIN, ROLES.CALIDAD, ...EMPLOYEE_ROLES],
  "/horarios": [ROLES.ADMIN],
};

/**
 * Define el flujo visual en la navegación por rol
 * Estructura: qué ve cada rol en el menú navbar
 */
export const NAVIGATION_BY_ROLE = {
  [ROLES.ADMIN]: [
    {
      section: "Flujo de Trabajo",
      items: [
        { label: "👁️ Acompañamiento en tiempo real", to: "/partes-trabajo" },
        { label: "📋 Historial de trabajos", to: "/partes-trabajo-finalizados" },
      ],
    },
    {
      section: "Inspección y Entrega",
      items: [
        { label: "🔍 Inspección de entrada", to: "/inspeccion-recepcion" },
        { label: "📝 Inspecciones guardadas", to: "/inspecciones-guardadas" },
        { label: "🏁 Repaso y firma", to: "/repaso-entrega" },
        { label: "✅ Finalizar entrega", to: "/calidad-entrega" },
        { label: "✓ Coches entregados", to: "/entregados" },
      ],
    },
    {
      section: "Inventario",
      items: [
        { label: "📦 Productos", to: "/productos" },
        { label: "⤓ Entradas", to: "/entradas" },
        { label: "⤒ Salidas", to: "/salidas" },
        { label: "📊 Resumen Entradas", to: "/resumen-entradas" },
      ],
    },
    {
      section: "Administración",
      items: [
        { label: "📊 Dashboard", to: "/dashboard" },
        { label: "👥 Clientes", to: "/clientes" },
        { label: "🚗 Coches", to: "/coches" },
        { label: "📋 Resumen Clientes", to: "/resumen-clientes" },
        { label: "💶 Finanzas", to: "/administracion/finanzas" },
        { label: "💼 Cobros Concesionarios", to: "/administracion/cobros-profesionales" },
        { label: "🏭 Maquinaria", to: "/maquinaria" },
        { label: "👤 Usuarios", to: "/usuarios" },
        { label: "🚚 Proveedores", to: "/proveedores" },
        { label: "🛠️ Servicios", to: "/catalogo-servicios" },
        { label: "🕒 Horarios", to: "/horarios" },
      ],
    },
  ],

  [ROLES.CALIDAD]: [
    { label: "🔍 Inspección de entrada", to: "/inspeccion-recepcion" },
    { label: "🏁 Repaso y firma", to: "/repaso-entrega" },
    { label: "✅ Finalizar entrega", to: "/calidad-entrega" },
    { label: "⤒ Salida de productos", to: "/salidas" },
    { label: "💰 Cobro de particulares", to: "/cobro-particulares" },
  ],

  [ROLES.DETAILING]: [
    { label: "📋 Mis trabajos", to: "/mis-partes-trabajo" },
  ],
  [ROLES.PINTURA]: [
    { label: "📋 Mis trabajos", to: "/mis-partes-trabajo" },
  ],
  [ROLES.TAPICERO]: [
    { label: "📋 Mis trabajos", to: "/mis-partes-trabajo" },
  ],
};

/**
 * Descripción de lo que hace cada rol
 */
export const ROLE_DESCRIPTIONS = {
  [ROLES.ADMIN]: "Acceso completo: administración, control de flujos, finanzas y usuarios",
  [ROLES.CALIDAD]: "Inspección, repaso, entrega de vehículos y cobro de particulares",
  [ROLES.DETAILING]: "Realización de trabajos de detailing",
  [ROLES.PINTURA]: "Realización de trabajos de pintura",
  [ROLES.TAPICERO]: "Realización de trabajos de tapicería",
};

/**
 * Verifica si un rol tiene permiso para una ruta
 */
export const hasRoutePermission = (role, route) => {
  const allowed = ROUTE_PERMISSIONS[route];
  if (!allowed) return true; // Si no está definida, permitir (ruta pública)
  return allowed.includes("*") || allowed.includes(role);
};

/**
 * Obtiene los ítems de navegación para un rol
 */
export const getNavItemsForRole = (role) => {
  return NAVIGATION_BY_ROLE[role] || [];
};
