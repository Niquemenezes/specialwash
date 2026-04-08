import React, { useContext } from "react";
import { Link } from "react-router-dom";
import { Context } from "../store/appContext";
import { normalizeRol, getStoredRol } from "../utils/authSession";

const ICONS = {
  back:      (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>),
  arrow:     (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>),
  shield:    (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>),
  dashboard: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>),
  finance:   (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>),
  users:     (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>),
  client:    (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>),
  car:       (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 17H3a1 1 0 0 1-1-1v-5l2.3-6A1 1 0 0 1 5.24 4h13.5a1 1 0 0 1 .94.67L22 11v5a1 1 0 0 1-1 1h-2"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="17.5" r="2.5"/><path d="M2 11h20"/></svg>),
  truck:     (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>),
  tool:      (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>),
  summary:   (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>),
};

const ACCENT = "#f59e0b";

const GRUPOS = [
  {
    id: "kpis",
    title: "Análisis y finanzas",
    subtitle: "Rendimiento, métricas y control económico",
    accent: "#f59e0b",
    icon: "dashboard",
    items: [
      { to: "/dashboard",               label: "Dashboard",           detail: "KPIs, facturación y alertas del taller",  icon: "dashboard" },
      { to: "/resumen-clientes",        label: "Resumen de clientes", detail: "Facturación por cliente y período",        icon: "summary"   },
      { to: "/administracion/finanzas", label: "Finanzas",            detail: "Control de gastos, ingresos y pagos",      icon: "finance"   },
    ],
  },
  {
    id: "clientes",
    title: "Clientes y vehículos",
    subtitle: "Registro y gestión de clientes y sus coches",
    accent: "#38bdf8",
    icon: "client",
    items: [
      { to: "/clientes", label: "Clientes",   detail: "Ficha, datos de contacto e historial",         icon: "client" },
      { to: "/coches",   label: "Vehículos",  detail: "Registro de todos los vehículos del sistema",  icon: "car"    },
    ],
  },
  {
    id: "recursos",
    title: "Proveedores, maquinaria y personal",
    subtitle: "Gestión de recursos del taller",
    accent: "#a78bfa",
    icon: "truck",
    items: [
      { to: "/proveedores", label: "Proveedores", detail: "Contactos, compras y condiciones",          icon: "truck"  },
      { to: "/maquinaria",  label: "Maquinaria",  detail: "Equipos, mantenimiento y garantías",        icon: "tool"   },
      { to: "/usuarios",    label: "Usuarios",    detail: "Gestión de personal, roles y permisos",     icon: "users"  },
    ],
  },
];

function GrupoCard({ grupo }) {
  return (
    <div className="sw-hub-group" style={{ "--grp-accent": grupo.accent }}>
      <div className="sw-hub-group-header">
        <span className="sw-hub-group-icon">{ICONS[grupo.icon]}</span>
        <div>
          <h3 className="sw-hub-group-title">{grupo.title}</h3>
          <p className="sw-hub-group-sub">{grupo.subtitle}</p>
        </div>
      </div>
      <div className="sw-hub-group-items">
        {grupo.items.map((item) => (
          <Link key={item.to} to={item.to} className="sw-hub-item">
            <span className="sw-hub-item-icon" style={{ color: grupo.accent }}>{ICONS[item.icon]}</span>
            <div className="sw-hub-item-body">
              <span className="sw-hub-item-label">{item.label}</span>
              <span className="sw-hub-item-detail">{item.detail}</span>
            </div>
            <span className="sw-hub-item-arrow">{ICONS.arrow}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function AdminPage() {
  const { store } = useContext(Context);
  const rol = normalizeRol(store?.user?.rol) || normalizeRol(getStoredRol());

  // Solo accesible para administrador
  if (rol !== "administrador") {
    return (
      <div className="sw-veh-wrapper">
        <div className="container" style={{ paddingTop: "3rem", textAlign: "center", color: "var(--sw-muted)" }}>
          No tienes acceso a esta sección.
        </div>
      </div>
    );
  }

  return (
    <div className="sw-veh-wrapper">
      <div className="sw-veh-hero">
        <div className="container sw-veh-hero-inner">
          <Link to="/" className="sw-veh-back">{ICONS.back}<span>Inicio</span></Link>
          <div className="sw-veh-hero-body">
            <span className="sw-veh-hero-icon" style={{ background: `${ACCENT}15`, borderColor: `${ACCENT}30`, color: ACCENT }}>
              {ICONS.shield}
            </span>
            <div>
              <h1 className="sw-veh-hero-title">Administración</h1>
              <p className="sw-veh-hero-sub">KPIs, finanzas, clientes, proveedores y gestión de personal</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container sw-veh-content">
        <div className="sw-hub-grid">
          {GRUPOS.map((g) => (
            <GrupoCard key={g.id} grupo={g} />
          ))}
        </div>

        <div className="sw-veh-quick-action" style={{ background: `${ACCENT}08`, borderColor: `${ACCENT}30` }}>
          <div className="sw-veh-quick-inner">
            <div>
              <p className="sw-veh-quick-label" style={{ color: ACCENT }}>Acceso rápido</p>
              <p className="sw-veh-quick-title">Dashboard del taller</p>
              <p className="sw-veh-quick-sub">Consulta KPIs, facturación y alertas en tiempo real.</p>
            </div>
            <Link to="/dashboard" className="sw-veh-quick-btn" style={{ background: ACCENT, color: "#0a0b0e", boxShadow: `0 4px 16px ${ACCENT}35` }}>
              {ICONS.dashboard}
              <span>Ir al Dashboard</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
