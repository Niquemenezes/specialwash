import React, { useContext, useEffect } from "react";
import { Link } from "react-router-dom";
import { Context } from "../store/appContext";
import { getStoredRol, getStoredToken, normalizeRol } from "../utils/authSession";

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 6)  return "Buenas noches";
  if (h < 12) return "Buenos días";
  if (h < 20) return "Buenas tardes";
  return "Buenas noches";
};

const ICONS = {
  vehiculos:  (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 17H3a1 1 0 0 1-1-1v-5l2.3-6A1 1 0 0 1 5.24 4h13.5a1 1 0 0 1 .94.67L22 11v5a1 1 0 0 1-1 1h-2"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="17.5" r="2.5"/><path d="M2 11h20"/></svg>),
  inventario: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-4 0v2M12 12v5M9.5 14.5h5"/></svg>),
  partes:     (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>),
  admin:      (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM6 20v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/></svg>),
  arrow:      (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>),
};

const MODULES = [
  {
    id: "vehiculos",
    title: "Vehículos",
    subtitle: "Recepción, seguimiento y entrega",
    accent: "#d4af37",
    to: "/vehiculos",
    cta: "Ver flujo completo",
    roles: ["administrador", "calidad"],
  },
  {
    id: "inventario",
    title: "Inventario",
    subtitle: "Stock, entradas, salidas y trazabilidad",
    accent: "#22c55e",
    to: "/inventario",
    cta: "Gestionar inventario",
    roles: ["administrador", "calidad", "detailing", "pintura", "tapicero"],
  },
  {
    id: "partes",
    title: "Partes de trabajo",
    subtitle: "Tareas, asignación y servicios",
    accent: "#6366f1",
    to: "/partes",
    cta: "Ver partes",
    roles: ["administrador", "calidad", "detailing", "pintura", "tapicero"],
  },
  {
    id: "admin",
    title: "Administración",
    subtitle: "KPIs, finanzas, equipo y recursos",
    accent: "#f59e0b",
    to: "/administracion",
    cta: "Panel de administración",
    roles: ["administrador"],
  },
];

// ── Pantalla sin sesión ───────────────────────────────────────────────────────
function HomeGuest() {
  return (
    <div className="sw-home-guest">
      <div className="sw-home-guest-inner">
        <div className="sw-home-guest-eyebrow">Panel profesional · SpecialWash</div>
        <h1 className="sw-home-guest-title">
          Bienvenido a <span className="sw-home-guest-brand">SpecialWash</span>
        </h1>
        <p className="sw-home-guest-sub">
          Gestión integral de taller: vehículos, inventario, partes de trabajo y más.
        </p>
        <Link to="/login" className="sw-home-guest-btn">
          Iniciar sesión
          <span className="sw-home-guest-btn-arrow">{ICONS.arrow}</span>
        </Link>
      </div>
    </div>
  );
}

// ── Home principal ────────────────────────────────────────────────────────────
export default function Home() {
  const { store, actions } = useContext(Context);
  const token = getStoredToken();
  const rol = normalizeRol(store?.user?.rol) || normalizeRol(getStoredRol()) || "detailing";

  useEffect(() => {
    if (token && !store.user) {
      actions.me().catch(() => {});
    }
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!token) return <HomeGuest />;

  const visibleModules = MODULES.filter((m) => m.roles.includes(rol));
  const nombre = store.user?.nombre ?? "";

  return (
    <div className="sw-home-wrapper">
      <div className="sw-home-hero">
        <div className="sw-home-hero-inner container">
          <div className="sw-home-hero-left">
            <p className="sw-home-eyebrow">Panel interno · SpecialWash</p>
            <h1 className="sw-home-heading">
              {getGreeting()}{nombre ? <>, <span className="sw-home-heading-name">{nombre}</span></> : ""}.
            </h1>
            <p className="sw-home-lead">¿Qué vas a hacer hoy?</p>
          </div>
          <div className="sw-home-hero-badge">
            <span className="sw-home-badge-dot" />
            Sesión activa
          </div>
        </div>
      </div>

      <div className="container sw-home-content">
        <div className="sw-home-grid">
          {visibleModules.map((mod) => (
            <Link
              key={mod.id}
              to={mod.to}
              className="sw-hcard sw-hcard--cta"
              style={{ "--card-accent": mod.accent }}
            >
              <div className="sw-hcard-header">
                <span className="sw-hcard-icon">{ICONS[mod.id]}</span>
                <div className="sw-hcard-header-text">
                  <h3 className="sw-hcard-title">{mod.title}</h3>
                  <p className="sw-hcard-subtitle">{mod.subtitle}</p>
                </div>
              </div>
              <div className="sw-hcard-cta">
                <span>{mod.cta}</span>
                <span className="sw-hcard-cta-arrow">{ICONS.arrow}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
