import React, { useState, useEffect, useCallback } from "react";
import { NavLink } from "react-router-dom";
import { getStoredRol } from "../utils/authSession";

// ── Secciones de navegación del sidebar (solo admin) ──────────────────────────
const SECTIONS = [
  {
    id: "flujo",
    icon: "fas fa-tasks",
    label: "Flujo de Trabajo",
    items: [
      { to: "/partes-trabajo",             icon: "fas fa-eye",          label: "Acompañamiento en vivo" },
      { to: "/partes-trabajo-finalizados", icon: "fas fa-history",      label: "Historial de trabajos" },
    ],
  },
  {
    id: "inspeccion",
    icon: "fas fa-car",
    label: "Inspección y Entrega",
    items: [
      { to: "/inspeccion-recepcion",   icon: "fas fa-search",          label: "Inspección entrada"  },
      { to: "/inspecciones-guardadas", icon: "fas fa-folder-open",     label: "Inspecciones guardadas" },
      { to: "/repaso-entrega",         icon: "fas fa-edit",            label: "Repaso y firma"      },
      { to: "/calidad-entrega",        icon: "fas fa-check-circle",    label: "Finalizar entrega"   },
      { to: "/entregados",             icon: "fas fa-check-double",    label: "Coches entregados"   },
    ],
  },
  {
    id: "inventario",
    icon: "fas fa-warehouse",
    label: "Inventario",
    items: [
      { to: "/productos",        icon: "fas fa-tag",       label: "Productos"        },
      { to: "/entradas",         icon: "fas fa-arrow-down", label: "Entradas"        },
      { to: "/salidas",          icon: "fas fa-arrow-up",  label: "Salidas"          },
      { to: "/resumen-entradas", icon: "fas fa-chart-bar", label: "Resumen entradas" },
    ],
  },
  {
    id: "admin",
    icon: "fas fa-cog",
    label: "Administración",
    items: [
      { to: "/dashboard",                           icon: "fas fa-chart-pie",        label: "Dashboard"            },
      { to: "/clientes",                            icon: "fas fa-users",            label: "Clientes"             },
      { to: "/coches",                              icon: "fas fa-car-side",         label: "Coches"               },
      { to: "/resumen-clientes",                    icon: "fas fa-chart-line",       label: "Resumen clientes"     },
      { to: "/administracion/finanzas",             icon: "fas fa-euro-sign",        label: "Finanzas"             },
      { to: "/administracion/cobros-profesionales", icon: "fas fa-briefcase",        label: "Concesionarios"       },
      { to: "/maquinaria",                          icon: "fas fa-wrench",           label: "Maquinaria"           },
      { to: "/usuarios",                            icon: "fas fa-user-cog",         label: "Usuarios"             },
      { to: "/proveedores",                         icon: "fas fa-truck",            label: "Proveedores"          },
      { to: "/catalogo-servicios",                  icon: "fas fa-concierge-bell",   label: "Servicios"            },
      { to: "/horarios",                            icon: "fas fa-calendar-alt",     label: "Horarios"             },
    ],
  },
];

// ── SidebarSW ─────────────────────────────────────────────────────────────────
const SidebarSW = () => {
  const rol = getStoredRol();

  const [collapsed, setCollapsed] = useState(() => {
    const stored = localStorage.getItem("sw-sidebar-collapsed");
    if (stored !== null) return stored === "true";
    return false; // expandido por defecto en desktop
  });

  const [mobileOpen, setMobileOpen] = useState(false);

  // Aplica atributos data al <html> para que el CSS pueda ajustar el layout.
  // Este efecto solo gestiona el montaje/desmontaje del sidebar (data-has-sidebar).
  useEffect(() => {
    document.documentElement.setAttribute("data-has-sidebar", "true");
    return () => {
      document.documentElement.removeAttribute("data-has-sidebar");
      document.documentElement.removeAttribute("data-sidebar-collapsed");
    };
  }, []);

  // Sincronizar data-sidebar-collapsed con el estado collapsed cada vez que cambia.
  useEffect(() => {
    document.documentElement.setAttribute("data-sidebar-collapsed", String(collapsed));
  }, [collapsed]);

  // Toggle desktop: colapsado ↔ expandido
  const toggleDesktop = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sw-sidebar-collapsed", String(next));
      return next;
    });
  }, []);

  // Escuchar evento del Navbar para toggle
  useEffect(() => {
    const handler = () => {
      if (window.innerWidth < 992) {
        setMobileOpen((o) => !o);
      } else {
        toggleDesktop();
      }
    };
    window.addEventListener("sw:sidebar-toggle", handler);
    return () => window.removeEventListener("sw:sidebar-toggle", handler);
  }, [toggleDesktop]);

  // Cerrar drawer al redimensionar a desktop
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 992) setMobileOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Solo para administrador
  if (rol !== "administrador") return null;

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
            onClick={toggleDesktop}
            title={collapsed ? "Expandir menú" : "Colapsar menú"}
            aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
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
