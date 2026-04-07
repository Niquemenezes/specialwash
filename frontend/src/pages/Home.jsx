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

// Iconos SVG inline — sin dependencias externas, consistentes
const ICONS = {
  vehiculos:  (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 17H3a1 1 0 0 1-1-1v-5l2.3-6A1 1 0 0 1 5.24 4h13.5a1 1 0 0 1 .94.67L22 11v5a1 1 0 0 1-1 1h-2"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="17.5" r="2.5"/><path d="M2 11h20"/></svg>),
  inventario: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-4 0v2M12 12v5M9.5 14.5h5"/></svg>),
  partes:     (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>),
  admin:      (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM6 20v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/></svg>),
  arrow:      (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>),
};

const SECTIONS = [
  {
    id: "vehiculos",
    title: "Vehículos",
    subtitle: "Recepción, seguimiento y entrega",
    accent: "#d4af37",
    items: [
      { to: "/inspeccion-recepcion",      label: "Inspección de recepción",    detail: "Estado inicial y firmas",             roles: ["administrador", "detailing", "calidad"] },
      { to: "/inspecciones-guardadas",    label: "Inspecciones guardadas",      detail: "Revisión y validación",               roles: ["administrador"] },
      { to: "/repaso-entrega",            label: "Repaso y firma de entrega",   detail: "Control y firma del cliente",         roles: ["administrador", "detailing", "calidad"] },
      { to: "/repaso-entrega?tab=estado", label: "Estado de cada coche",        detail: "Vista operativa en tiempo real",      roles: ["administrador", "detailing", "calidad"] },
      { to: "/entregados",                label: "Coches entregados",           detail: "Historial y archivo final",           roles: ["administrador"] },
    ],
  },
  {
    id: "inventario",
    title: "Productos e Inventario",
    subtitle: "Stock, entradas, salidas y trazabilidad",
    accent: "#22c55e",
    items: [
      { to: "/productos",         label: "Gestionar productos",       detail: "Catálogo, precios y stock mínimo",    roles: ["administrador"] },
      { to: "/entradas",          label: "Registrar entrada",         detail: "Compras y abastecimiento",            roles: ["administrador"] },
      { to: "/salidas",           label: "Registrar salida",          detail: "Consumo de taller y operaciones",     roles: ["administrador", "encargado", "calidad", "detailing", "pintura", "tapicero"] },
      { to: "/resumen-entradas",  label: "Historial de entradas",     detail: "Resumen económico y compras",         roles: ["administrador"] },
      { to: "/historial-salidas", label: "Historial de salidas",      detail: "Trazabilidad por fecha y usuario",    roles: ["administrador"] },
    ],
  },
  {
    id: "partes",
    title: "Partes de Trabajo",
    subtitle: "Asignación de tareas y seguimiento",
    accent: "#6366f1",
    items: [
      { to: "/partes-trabajo",             label: "Partes activos",            detail: "Crear, asignar y supervisar",          roles: ["administrador", "calidad"] },
      { to: "/flujo-trabajo",              label: "Mis partes",                detail: "Tus tareas asignadas",                 roles: ["detailing", "pintura"] },
      { to: "/flujo-trabajo-tapicero",     label: "Mis partes — Tapicería",    detail: "Tus tareas de tapicería",              roles: ["tapicero"] },
      { to: "/partes-trabajo-finalizados", label: "Partes finalizados",        detail: "Historial de trabajos completados",    roles: ["administrador"] },
      { to: "/catalogo-servicios",         label: "Catálogo de servicios",     detail: "Servicios disponibles y tarifas",      roles: ["administrador"] },
    ],
  },
  {
    id: "admin",
    title: "Administración",
    subtitle: "KPIs, finanzas, equipo y recursos",
    accent: "#f59e0b",
    items: [
      { to: "/dashboard",               label: "Dashboard",           detail: "KPIs, facturación y alertas",     roles: ["administrador"] },
      { to: "/clientes",                label: "Clientes",            detail: "Ficha y datos de contacto",       roles: ["administrador"] },
      { to: "/coches",                  label: "Coches",              detail: "Registro de vehículos",           roles: ["administrador"] },
      { to: "/resumen-clientes",        label: "Resumen de clientes", detail: "Facturación y períodos",          roles: ["administrador"] },
      { to: "/administracion/finanzas", label: "Finanzas",            detail: "Control de gastos e ingresos",    roles: ["administrador"] },
      { to: "/proveedores",             label: "Proveedores",         detail: "Contactos y compras",             roles: ["administrador"] },
      { to: "/maquinaria",              label: "Maquinaria",          detail: "Control y garantías",             roles: ["administrador"] },
      { to: "/usuarios",                label: "Usuarios",            detail: "Permisos y personal",             roles: ["administrador"] },
    ],
  },
];

// ─── Pantalla sin sesión ──────────────────────────────────────────────────────
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

// ─── Tarjeta de sección ───────────────────────────────────────────────────────
function SectionCard({ section }) {
  return (
    <div className="sw-hcard" style={{ "--card-accent": section.accent }}>
      <div className="sw-hcard-header">
        <span className="sw-hcard-icon">{ICONS[section.id]}</span>
        <div className="sw-hcard-header-text">
          <h3 className="sw-hcard-title">{section.title}</h3>
          <p className="sw-hcard-subtitle">{section.subtitle}</p>
        </div>
      </div>
      <div className="sw-hcard-divider" />
      <ul className="sw-hcard-list">
        {section.items.map((item) => (
          <li key={item.to}>
            <Link to={item.to} className="sw-hcard-link">
              <div className="sw-hcard-link-body">
                <span className="sw-hcard-link-label">{item.label}</span>
                <span className="sw-hcard-link-detail">{item.detail}</span>
              </div>
              <span className="sw-hcard-link-arrow">{ICONS.arrow}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Home principal ───────────────────────────────────────────────────────────
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

  const visibleSections = SECTIONS
    .map((s) => ({ ...s, items: s.items.filter((i) => i.roles.includes(rol)) }))
    .filter((s) => s.items.length > 0);

  const nombre = store.user?.nombre ?? "";

  return (
    <div className="sw-home-wrapper">
      {/* ── Hero / Cabecera ─────────────────────────────── */}
      <div className="sw-home-hero">
        <div className="sw-home-hero-inner container">
          <div className="sw-home-hero-left">
            <p className="sw-home-eyebrow">Panel interno · SpecialWash</p>
            <h1 className="sw-home-heading">
              {getGreeting()}{nombre ? <>, <span className="sw-home-heading-name">{nombre}</span></> : ""}.
            </h1>
            <p className="sw-home-lead">Selecciona un módulo para empezar a trabajar.</p>
          </div>
          <div className="sw-home-hero-badge">
            <span className="sw-home-badge-dot" />
            Sesión activa
          </div>
        </div>
      </div>

      {/* ── Grid de secciones ──────────────────────────── */}
      <div className="container sw-home-grid-wrapper">
        <div className="sw-home-grid">
          {visibleSections.map((section) => (
            <SectionCard key={section.id} section={section} />
          ))}
        </div>
      </div>
    </div>
  );
}
