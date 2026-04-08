import React, { useContext } from "react";
import { Link } from "react-router-dom";
import { Context } from "../store/appContext";
import { normalizeRol, getStoredRol } from "../utils/authSession";

const ICONS = {
  back:      (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>),
  arrow:     (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>),
  wrench:    (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>),
  list:      (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>),
  user:      (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>),
  check:     (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>),
  catalog:   (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>),
  sofa:      (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v3"/><path d="M2 16a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v1.5a.5.5 0 0 1-.5.5h-7a.5.5 0 0 1-.5-.5V11a2 2 0 0 0-4 0z"/><line x1="4" y1="18" x2="4" y2="22"/><line x1="20" y1="18" x2="20" y2="22"/></svg>),
  chart:     (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>),
};

const ACCENT = "#6366f1";

const GRUPOS = [
  {
    id: "supervision",
    title: "Supervisión",
    subtitle: "Gestión de partes de trabajo",
    accent: "#6366f1",
    icon: "list",
    items: [
      {
        to: "/partes-trabajo",
        label: "Acompañamiento",
        detail: "Dashboard en tiempo real del flujo de coches en taller",
        icon: "list",
        roles: ["administrador", "calidad"],
      },
      {
        to: "/calidad-entrega",
        label: "Calidad y entrega",
        detail: "Vehículos completados listos para entregar al cliente",
        icon: "check",
        roles: ["administrador", "calidad"],
      },
      {
        to: "/partes-trabajo-finalizados",
        label: "Historial",
        detail: "Registro histórico de trabajos completados",
        icon: "check",
        roles: ["administrador"],
      },
    ],
  },
  {
    id: "empleado",
    title: "Mis tareas",
    subtitle: "Trabajos asignados a ti",
    accent: "#38bdf8",
    icon: "user",
    items: [
      {
        to: "/mis-partes-trabajo",
        label: "Mis trabajos",
        detail: "Tus tareas asignadas en flujo lineal y sin vueltas",
        icon: "wrench",
        roles: ["detailing", "pintura", "tapicero"],
      },
    ],
  },
  {
    id: "catalogo",
    title: "Catálogo y servicios",
    subtitle: "Gestión de servicios disponibles",
    accent: "#f59e0b",
    icon: "catalog",
    items: [
      {
        to: "/catalogo-servicios",
        label: "Catálogo de servicios",
        detail: "Define servicios, tarifas y tiempos estimados",
        icon: "catalog",
        roles: ["administrador"],
      },
    ],
  },
];

function GrupoCard({ grupo, rol }) {
  const visibleItems = grupo.items.filter((i) => i.roles.includes(rol));
  if (visibleItems.length === 0) return null;

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
        {visibleItems.map((item) => (
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

export default function PartesPage() {
  const { store } = useContext(Context);
  const rol = normalizeRol(store?.user?.rol) || normalizeRol(getStoredRol()) || "detailing";

  const visibleGrupos = GRUPOS.filter((g) =>
    g.items.some((i) => i.roles.includes(rol))
  );

  // CTA según rol
  const ctaLink = ["detailing", "pintura", "tapicero"].includes(rol)
    ? "/mis-partes-trabajo"
    : "/partes-trabajo";

  const ctaLabel = ["administrador", "calidad"].includes(rol)
    ? "Ver acompañamiento"
    : "Ver mis trabajos";

  return (
    <div className="sw-veh-wrapper">
      <div className="sw-veh-hero">
        <div className="container sw-veh-hero-inner">
          <Link to="/" className="sw-veh-back">{ICONS.back}<span>Inicio</span></Link>
          <div className="sw-veh-hero-body">
            <span className="sw-veh-hero-icon" style={{ background: `${ACCENT}15`, borderColor: `${ACCENT}30`, color: ACCENT }}>
              {ICONS.wrench}
            </span>
            <div>
              <h1 className="sw-veh-hero-title">Partes de trabajo</h1>
              <p className="sw-veh-hero-sub">Gestión unificada de servicios y tareas del taller</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container sw-veh-content">
        <div className="sw-hub-grid">
          {visibleGrupos.map((g) => (
            <GrupoCard key={g.id} grupo={g} rol={rol} />
          ))}
        </div>

        <div className="sw-veh-quick-action" style={{ background: `${ACCENT}08`, borderColor: `${ACCENT}30` }}>
          <div className="sw-veh-quick-inner">
            <div>
              <p className="sw-veh-quick-label" style={{ color: ACCENT }}>Acceso rápido</p>
              <p className="sw-veh-quick-title">{ctaLabel}</p>
              <p className="sw-veh-quick-sub">
                {["administrador", "calidad"].includes(rol)
                  ? "Supervisa el flujo en tiempo real: vehículos en proceso, pausas, y estadísticas."
                  : "Consulta tus trabajos asignados en un flujo simple y lineal. Sin búsqueda, sin vueltas."}
              </p>
            </div>
            <Link to={ctaLink} className="sw-veh-quick-btn" style={{ background: ACCENT, boxShadow: `0 4px 16px ${ACCENT}35` }}>
              {ICONS.list}
              <span>{ctaLabel}</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
