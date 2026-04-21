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
  SALIDA: "salida",
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
  "/inspecciones-guardadas": [ROLES.ADMIN, ROLES.CALIDAD],
  "/repaso-entrega": [ROLES.ADMIN, ROLES.CALIDAD],
  "/calidad-entrega": [ROLES.ADMIN, ROLES.CALIDAD],
  "/entrega-cliente/:inspeccion_id": [ROLES.ADMIN, ROLES.CALIDAD],
  "/entregados": [ROLES.ADMIN, ROLES.CALIDAD],
  "/acta-entrega/:id": [ROLES.ADMIN, ROLES.CALIDAD],
  "/acta-entrega-doc/:id": [ROLES.ADMIN, ROLES.CALIDAD],

  // ═══ INFORME TÉCNICO (Solo Admin) ═══
  "/hoja-tecnica/:inspeccion_id": [ROLES.ADMIN],

  // ═══ PARTES DE TRABAJO ═══
  "/partes-trabajo": [ROLES.ADMIN, ROLES.CALIDAD], // Acompañamiento en tiempo real
  "/productividad-trabajadores": [ROLES.ADMIN, ROLES.CALIDAD],
  "/mis-partes-trabajo": [...EMPLOYEE_ROLES], // Mis trabajos
  "/partes-trabajo-finalizados": [ROLES.ADMIN],
  "/partes": [ROLES.ADMIN, ROLES.CALIDAD, ...EMPLOYEE_ROLES],

  // ═══ INVENTARIO Y SALIDAS ═══
  "/productos": [ROLES.ADMIN],
  "/entradas": [ROLES.ADMIN],
  "/salidas": [ROLES.ADMIN, ROLES.CALIDAD, ...EMPLOYEE_ROLES, ROLES.SALIDA],
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
  "/vehiculos": [ROLES.ADMIN, ROLES.CALIDAD],
  "/proveedores": [ROLES.ADMIN],
  "/maquinaria": [ROLES.ADMIN],
  "/catalogo-servicios": [ROLES.ADMIN],

  // ═══ FINANZAS Y COBROS ═══
  "/administracion/finanzas": [ROLES.ADMIN],
  "/administracion/cobros-profesionales": [ROLES.ADMIN], // Cobro concesionarios
  "/cobro-particulares": [ROLES.ADMIN, ROLES.CALIDAD], // Cobro particulares (NUEVO)

  // ═══ CITAS Y RESPALDO ═══
  "/citas": [ROLES.ADMIN, ROLES.CALIDAD],
  "/fichar": [ROLES.ADMIN, ROLES.CALIDAD, ...EMPLOYEE_ROLES],
  "/horarios": [ROLES.ADMIN],

  // ═══ PEDIDOS ═══
  "/pedido-bajo-stock": [ROLES.ADMIN],
  "/pedido-bajo-stock/imprimir": [ROLES.ADMIN],

  // ═══ UNIFORMES ═══
  "/uniformes": [ROLES.ADMIN],

  // ═══ COCHE DE SUSTITUCIÓN ═══
  "/coche-sustitucion": [ROLES.ADMIN, ROLES.CALIDAD],
};

/**
 * Define el flujo visual en la navegación por rol
 * Estructura: qué ve cada rol en el menú navbar
 */
export const NAVIGATION_BY_ROLE = {
  [ROLES.ADMIN]: [
    {
      section: "Flujo principal",
      items: [
        { label: "🚗 Estado de coches", to: "/partes-trabajo" },
        { label: "� Productividad equipo", to: "/productividad-trabajadores" },
        { label: "�🔍 Inspección de entrada", to: "/inspeccion-recepcion" },
        { label: "📝 Inspecciones guardadas", to: "/inspecciones-guardadas" },
        { label: "✅ Control final", to: "/repaso-entrega?tab=repaso" },
        { label: "📝 Hoja intervención / firma", to: "/repaso-entrega?tab=firma" },
        { label: "✓ Coches entregados", to: "/entregados" },
      ],
    },
    {
      section: "Inventario",
      items: [
        { label: "📦 Productos", to: "/productos" },
        { label: "⤓ Entradas", to: "/entradas" },
        { label: "⤒ Salidas", to: "/salidas" },
        { label: "📥 Historial de entradas", to: "/resumen-entradas" },
        { label: "📤 Historial de salidas", to: "/historial-salidas" },
      ],
    },
    {
      section: "Gestión",
      items: [
        { label: "📊 Dashboard", to: "/dashboard" },
        { label: "👥 Clientes", to: "/clientes" },
        { label: "🚗 Coches", to: "/coches" },
        { label: "� Proveedores", to: "/proveedores" },
        { label: "🛠️ Maquinarias", to: "/maquinaria" },
        { label: "👤 Usuarios", to: "/usuarios" },
        { label: "👔 Uniformes", to: "/uniformes" },
        { label: "🚙 Coches sustitución", to: "/coche-sustitucion" },
        { label: "�💶 Finanzas", to: "/administracion/finanzas" },
        { label: "💼 Cobros Concesionarios", to: "/administracion/cobros-profesionales" },
      ],
    },
  ],

  [ROLES.CALIDAD]: [
    { label: "🚙 Coches sustitución", to: "/coche-sustitucion" },
  ],

  [ROLES.DETAILING]: [
    { label: "📋 Mis trabajos", to: "/mis-partes-trabajo" },
    { label: "⤒ Salida de productos", to: "/salidas" },
  ],
  [ROLES.PINTURA]: [
    { label: "📋 Mis trabajos", to: "/mis-partes-trabajo" },
    { label: "⤒ Salida de productos", to: "/salidas" },
  ],
  [ROLES.TAPICERO]: [
    { label: "📋 Mis trabajos", to: "/mis-partes-trabajo" },
    { label: "⤒ Salida de productos", to: "/salidas" },
  ],
  [ROLES.SALIDA]: [
    { label: "⤒ Salida de productos", to: "/salidas" },
  ],
};

/**
 * Descripción de lo que hace cada rol
 */
export const ROLE_DESCRIPTIONS = {
  [ROLES.ADMIN]: "Acceso completo: administración, control de flujos, finanzas y usuarios",
  [ROLES.CALIDAD]: "Inspección, repaso, entrega, citas, salidas y cobro de particulares",
  [ROLES.DETAILING]: "Fichaje, salida de productos y partes de detailing",
  [ROLES.PINTURA]: "Fichaje, salida de productos y partes de pintura",
  [ROLES.TAPICERO]: "Fichaje, salida de productos y partes de tapicería",
  [ROLES.SALIDA]: "Salida de productos: acceso directo a registrar salidas",
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
