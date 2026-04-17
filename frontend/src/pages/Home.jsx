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
  vehiculos:       (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 17H3a1 1 0 0 1-1-1v-5l2.3-6A1 1 0 0 1 5.24 4h13.5a1 1 0 0 1 .94.67L22 11v5a1 1 0 0 1-1 1h-2"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="17.5" r="2.5"/><path d="M2 11h20"/></svg>),
  inventario:      (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-4 0v2M12 12v5M9.5 14.5h5"/></svg>),
  partes:          (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>),
  "partes-admin":  (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>),
  admin:           (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM6 20v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/></svg>),
  arrow:           (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>),
};

const MODULES = [
  {
    id: "vehiculos",
    title: () => "Flujo de coches",
    subtitle: () => "Inspección, seguimiento y entrega",
    accent: "#d4af37",
    to: () => "/partes-trabajo",
    cta: "Abrir flujo principal",
    links: () => [
      { to: "/inspeccion-recepcion", label: "Inspección de entrada", detail: "Crear o editar la recepción del coche" },
      { to: "/partes-trabajo", label: "Seguimiento", detail: "Ver dónde está cada coche" },
      { to: "/repaso-entrega?tab=firma", label: "Entrega y firma", detail: "Firma y cobro final del cliente" },
    ],
    roles: ["administrador", "calidad"],
  },
  {
    id: "inventario",
    title: "Inventario",
    subtitle: "Productos, entradas y salidas de stock",
    accent: "#22c55e",
    to: (rol) => (rol === "administrador" ? "/productos" : "/salidas"),
    cta: (rol) => (rol === "administrador" ? "Ver productos" : "Registrar salida"),
    links: (rol) => rol === "administrador" ? [
      { to: "/productos", label: "Productos", detail: "Catálogo y stock actual" },
      { to: "/entradas", label: "Registrar entrada", detail: "Añadir stock recibido" },
      { to: "/historial-salidas", label: "Historial de salidas", detail: "Consumos registrados" },
    ] : [],
    roles: ["administrador", "calidad", "detailing", "pintura", "tapicero", "salida"],
  },
  {
    id: "partes",
    title: () => "Partes de trabajo",
    subtitle: () => "Tareas, asignación y servicios",
    accent: "#6366f1",
    to: () => "/mis-partes-trabajo",
    cta: () => "Ver mis trabajos",
    roles: ["detailing", "pintura", "tapicero"],
  },
  {
    id: "partes-admin",
    title: () => "Partes de trabajo",
    subtitle: () => "Estado del coche, productividad y control",
    accent: "#6366f1",
    to: () => "/partes-trabajo",
    cta: "Abrir estado de coches",
    links: () => [
      { to: "/partes-trabajo", label: "Estado de coches", detail: "Ver en qué punto está cada vehículo del taller" },
      { to: "/productividad-trabajadores", label: "Productividad equipo", detail: "Consultar tiempos, partes y rendimiento del equipo" },
      { to: "/partes-trabajo-finalizados", label: "Trabajos finalizados", detail: "Revisar histórico y cierres recientes" },
    ],
    roles: ["administrador"],
  },
  {
    id: "admin",
    title: "Administración",
    subtitle: "KPIs, finanzas y equipo",
    accent: "#f59e0b",
    to: () => "/dashboard",
    cta: "Panel principal",
    links: () => [
      { to: "/dashboard", label: "Dashboard", detail: "KPIs y métricas del taller" },
      { to: "/administracion/finanzas", label: "Finanzas", detail: "Gastos e ingresos" },
      { to: "/usuarios", label: "Equipo", detail: "Usuarios y roles" },
    ],
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
          Bienvenido a <span className="sw-home-guest-brand">SpecialWashStudio</span>
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
  const isOperationalEmployee = ["detailing", "pintura", "tapicero", "salida"].includes(rol);

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
            <p className="sw-home-eyebrow">Panel interno · SpecialWashStudio</p>
            <h1 className="sw-home-heading">
              {getGreeting()}{nombre ? <>, <span className="sw-home-heading-name">{nombre}</span></> : ""}.
            </h1>
           </div>
          <div className="sw-home-hero-badge">
            <span className="sw-home-badge-dot" />
            Sesión activa
          </div>
        </div>
      </div>

      <div className="container sw-home-content">
        <div className={`sw-home-grid${isOperationalEmployee ? " sw-home-grid--employee" : ""}`}>
          {visibleModules.map((mod) => {
            const titleText = typeof mod.title === "function" ? mod.title(rol) : mod.title;
            const subtitleText = typeof mod.subtitle === "function" ? mod.subtitle(rol) : mod.subtitle;
            const destination = typeof mod.to === "function" ? mod.to(rol) : mod.to;
            const ctaText = typeof mod.cta === "function" ? mod.cta(rol) : mod.cta;
            const quickLinks = typeof mod.links === "function" ? mod.links(rol) : (mod.links || []);

            return (
              <article
                key={mod.id}
                className={`sw-hcard sw-hcard--cta${isOperationalEmployee ? " sw-hcard--employee" : ""}`}
                style={{ "--card-accent": mod.accent }}
              >
                <div className="sw-hcard-header">
                  <span className="sw-hcard-icon">{ICONS[mod.id]}</span>
                  <div className="sw-hcard-header-text">
                    <h3 className="sw-hcard-title">{titleText}</h3>
                    <p className="sw-hcard-subtitle">{subtitleText}</p>
                  </div>
                </div>

                {quickLinks.length > 0 && (
                  <>
                    <div className="sw-hcard-divider" />
                    <div className="sw-hcard-list">
                      {quickLinks.map((item) => (
                        <Link key={item.to} to={item.to} className="sw-hcard-link">
                          <span className="sw-hcard-link-body">
                            <span className="sw-hcard-link-label">{item.label}</span>
                            {item.detail && <span className="sw-hcard-link-detail">{item.detail}</span>}
                          </span>
                          <span className="sw-hcard-link-arrow">{ICONS.arrow}</span>
                        </Link>
                      ))}
                    </div>
                  </>
                )}

                <Link to={destination} className="sw-hcard-cta sw-hcard-cta-link">
                  <span>{ctaText}</span>
                  <span className="sw-hcard-cta-arrow">{ICONS.arrow}</span>
                </Link>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
