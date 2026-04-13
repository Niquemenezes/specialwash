import React, { useState, useEffect, useCallback } from "react";
import { NavLink } from "react-router-dom";
import { getStoredRol } from "../utils/authSession";

const DESKTOP_SIDEBAR_BREAKPOINT = 1100;
const AUTO_COLLAPSE_BREAKPOINT = 1280;

// ── Secciones de navegación del sidebar (solo admin) ──────────────────────────
const SECTIONS = [
  {
    id: "flujo",
    icon: "fas fa-route",
    label: "Flujo principal",
    items: [
      { to: "/partes-trabajo",             icon: "fas fa-eye",           label: "Estado de coches"     },
      { to: "/productividad-trabajadores", icon: "fas fa-chart-line",    label: "Productividad equipo" },
      { to: "/inspeccion-recepcion",       icon: "fas fa-search",        label: "Inspección entrada"   },
      { to: "/inspecciones-guardadas",     icon: "fas fa-folder-open",   label: "Inspecciones guardadas" },
      { to: "/repaso-entrega?tab=repaso",  icon: "fas fa-edit",            label: "Control final"             },
      { to: "/repaso-entrega?tab=firma",   icon: "fas fa-file-signature",  label: "Hoja intervención / firma" },
      { to: "/entregados",                 icon: "fas fa-check-double",    label: "Coches entregados"         },
    ],
  },
  {
    id: "inventario",
    icon: "fas fa-warehouse",
    label: "Inventario",
    items: [
      { to: "/productos",          icon: "fas fa-tag",         label: "Productos"             },
      { to: "/entradas",           icon: "fas fa-arrow-down",  label: "Entradas"              },
      { to: "/salidas",            icon: "fas fa-arrow-up",    label: "Salidas"               },
      { to: "/resumen-entradas",   icon: "fas fa-boxes",       label: "Historial de entradas" },
      { to: "/historial-salidas",  icon: "fas fa-history",     label: "Historial de salidas"  },
    ],
  },
  {
    id: "admin",
    icon: "fas fa-cog",
    label: "Gestión",
    items: [
      { to: "/dashboard",                           icon: "fas fa-chart-pie",  label: "Dashboard"       },
      { to: "/clientes",                            icon: "fas fa-users",      label: "Clientes"        },
      { to: "/coches",                              icon: "fas fa-car-side",   label: "Coches"          },
      { to: "/proveedores",                         icon: "fas fa-truck",          label: "Proveedores"            },
      { to: "/maquinaria",                          icon: "fas fa-tools",          label: "Maquinarias"            },
      { to: "/catalogo-servicios",                  icon: "fas fa-clipboard-list", label: "Catálogo de servicios" },
      { to: "/usuarios",                            icon: "fas fa-user-cog",       label: "Usuarios"               },
      { to: "/uniformes",                           icon: "fas fa-tshirt",         label: "Uniformes"              },
      { to: "/administracion/finanzas",             icon: "fas fa-euro-sign",      label: "Finanzas"               },
      { to: "/administracion/cobros-profesionales", icon: "fas fa-briefcase",      label: "Concesionarios"         },
    ],
  },
];

// ── SidebarSW ─────────────────────────────────────────────────────────────────
const SidebarSW = () => {
  const rol = getStoredRol();
  const isAdmin = rol === "administrador";

  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    if (window.innerWidth < DESKTOP_SIDEBAR_BREAKPOINT) return false;
    if (window.innerWidth < AUTO_COLLAPSE_BREAKPOINT) return true;
    const stored = localStorage.getItem("sw-sidebar-collapsed");
    if (stored !== null) return stored === "true";
    return false; // expandido por defecto en desktop grande
  });

  const [mobileOpen, setMobileOpen] = useState(false);

  // Aplica atributos data al <html> solo cuando el usuario es admin.
  useEffect(() => {
    if (!isAdmin) {
      document.documentElement.removeAttribute("data-has-sidebar");
      document.documentElement.removeAttribute("data-sidebar-collapsed");
      return undefined;
    }

    document.documentElement.setAttribute("data-has-sidebar", "true");
    return () => {
      document.documentElement.removeAttribute("data-has-sidebar");
      document.documentElement.removeAttribute("data-sidebar-collapsed");
    };
  }, [isAdmin]);

  // Sincronizar data-sidebar-collapsed con el estado collapsed solo en admin.
  useEffect(() => {
    if (!isAdmin) return;
    document.documentElement.setAttribute("data-sidebar-collapsed", String(collapsed));
  }, [collapsed, isAdmin]);

  // Toggle desktop: colapsado ↔ expandido
  const toggleDesktop = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sw-sidebar-collapsed", String(next));
      return next;
    });
  }, []);

  const handleSidebarHeadAction = useCallback(() => {
    if (window.innerWidth < DESKTOP_SIDEBAR_BREAKPOINT) {
      setMobileOpen(false);
      return;
    }
    toggleDesktop();
  }, [toggleDesktop]);

  // Escuchar evento del Navbar para toggle solo en admin.
  useEffect(() => {
    if (!isAdmin) return undefined;

    const handler = () => {
      if (window.innerWidth < DESKTOP_SIDEBAR_BREAKPOINT) {
        setMobileOpen((o) => !o);
      } else {
        toggleDesktop();
      }
    };
    window.addEventListener("sw:sidebar-toggle", handler);
    return () => window.removeEventListener("sw:sidebar-toggle", handler);
  }, [isAdmin, toggleDesktop]);

  // Cerrar drawer al redimensionar a desktop.
  useEffect(() => {
    if (!isAdmin) {
      setMobileOpen(false);
      return undefined;
    }

    const onResize = () => {
      if (window.innerWidth < DESKTOP_SIDEBAR_BREAKPOINT) {
        setMobileOpen(false);
        setCollapsed(false);
        return;
      }

      setMobileOpen(false);

      if (window.innerWidth < AUTO_COLLAPSE_BREAKPOINT) {
        setCollapsed(true);
        return;
      }

      const stored = localStorage.getItem("sw-sidebar-collapsed");
      setCollapsed(stored !== null ? stored === "true" : false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [isAdmin]);

  // Solo para administrador
  if (!isAdmin) return null;

  const closeMobile = () => setMobileOpen(false);

  return (
    <>
      {/* Overlay oscuro en mobile */}
      {mobileOpen && (
        <div
          className="sw-sidebar-overlay"
          onClick={closeMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={[
          "sw-sidebar",
          collapsed ? "sw-sidebar--collapsed" : "",
          mobileOpen ? "sw-sidebar--mobile-open" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-label="Menú de navegación"
      >
        {/* Cabecera del sidebar con botón de colapso */}
        <div className="sw-sidebar-head">
          {!collapsed && <span className="sw-sidebar-head-title">Menú</span>}
          <button
            className="sw-sidebar-collapse-btn"
            onClick={handleSidebarHeadAction}
            title={mobileOpen && window.innerWidth < DESKTOP_SIDEBAR_BREAKPOINT ? "Cerrar menú" : collapsed ? "Expandir menú" : "Colapsar menú"}
            aria-label={mobileOpen && window.innerWidth < DESKTOP_SIDEBAR_BREAKPOINT ? "Cerrar menú" : collapsed ? "Expandir menú" : "Colapsar menú"}
          >
            <i className={`fas fa-chevron-${collapsed ? "right" : "left"}`} />
          </button>
        </div>

        {/* Navegación */}
        <nav className="sw-sidebar-nav" aria-label="Secciones">
          {SECTIONS.map((section) => (
            <div key={section.id} className="sw-sidebar-section">
              {/* Cabecera de sección */}
              <div
                className="sw-sidebar-section-header"
                title={collapsed ? section.label : undefined}
              >
                <i className={`${section.icon} sw-sidebar-section-icon`} />
                {!collapsed && (
                  <span className="sw-sidebar-section-label">{section.label}</span>
                )}
              </div>

              {/* Ítems */}
              <ul className="sw-sidebar-items">
                {section.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      className={({ isActive }) =>
                        `sw-sidebar-item${isActive ? " sw-sidebar-item--active" : ""}`
                      }
                      title={collapsed ? item.label : undefined}
                      onClick={closeMobile}
                    >
                      <i className={`${item.icon} sw-sidebar-item-icon`} />
                      {!collapsed && (
                        <span className="sw-sidebar-item-label">{item.label}</span>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
};

export default SidebarSW;
