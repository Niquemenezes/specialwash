import React, { useContext, useEffect } from "react";
import { Link } from "react-router-dom";
import { Context } from "../store/appContext";
import { getStoredRol, getStoredToken, normalizeRol } from "../utils/authSession";

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 20) return "Buenas tardes";
  return "Buenas noches";
};

const SECTIONS = [
  {
    id: "inventario",
    title: "Productos e Inventario",
    subtitle: "Flujo completo de producto y stock",
    emoji: "📦",
    items: [
      { to: "/productos",        label: "Crear y gestionar productos", detail: "Catálogo, precios y stock mínimo",       roles: ["administrador"] },
      { to: "/entradas",         label: "Registrar entrada",           detail: "Compras y abastecimiento",               roles: ["administrador"] },
      { to: "/salidas",          label: "Registrar salida",            detail: "Consumo de taller y operaciones",        roles: ["administrador", "encargado", "calidad", "detailing", "pintura", "tapicero"] },
      { to: "/resumen-entradas", label: "Historial de entradas",       detail: "Resumen económico y compras",            roles: ["administrador"] },
      { to: "/historial-salidas",label: "Historial de salidas",        detail: "Trazabilidad por fecha y usuario",       roles: ["administrador"] },
    ],
  },
  {
    id: "vehiculos",
    title: "Vehículos",
    subtitle: "Flujo de recepción, repaso y entrega",
    emoji: "🚗",
    items: [
      { to: "/inspeccion-recepcion",   label: "Inspección de recepción",  detail: "Estado inicial y firmas",              roles: ["administrador", "detailing", "calidad"] },
      { to: "/inspecciones-guardadas", label: "Inspecciones + Pendientes", detail: "Revisión y validación (admin)",        roles: ["administrador"] },
      { to: "/repaso-entrega",         label: "Repaso + Firma entrega",    detail: "Control y firma cliente",              roles: ["administrador", "detailing", "calidad"] },
      { to: "/entregados",             label: "Coches entregados",         detail: "Historial final",                      roles: ["administrador"] },
      { to: "/repaso-entrega?tab=estado", label: "Dónde está cada coche", detail: "Estado operativo por vehículo",        roles: ["administrador", "detailing", "calidad"] },
    ],
  },
  {
    id: "partes",
    title: "Partes de Trabajo",
    subtitle: "Asignación de tareas y avance",
    emoji: "🧰",
    items: [
      { to: "/partes-trabajo",              label: "📋 Partes activos",          detail: "Crear, asignar y dar seguimiento",             roles: ["administrador", "calidad"] },
      { to: "/flujo-trabajo",               label: "👨‍🔧 Mis partes",              detail: "Ver y actualizar tus tareas asignadas",        roles: ["detailing", "pintura"] },
      { to: "/flujo-trabajo-tapicero",      label: "🪑 Mis partes (tapicería)",  detail: "Ver y actualizar tus tareas de tapicería",     roles: ["tapicero"] },
      { to: "/partes-trabajo-finalizados",  label: "✅ Partes finalizados",       detail: "Historial de trabajos completados",            roles: ["administrador"] },
      { to: "/catalogo-servicios",          label: "🛠️ Catálogo de servicios",   detail: "Gestionar servicios disponibles",              roles: ["administrador"] },
    ],
  },
  {
    id: "admin",
    title: "Administración",
    subtitle: "Estructura interna y recursos",
    emoji: "🧩",
    items: [
      { to: "/dashboard",                      label: "📊 Dashboard",          detail: "KPIs, facturación y alertas",    roles: ["administrador"] },
      { to: "/clientes",                        label: "Clientes",              detail: "Ficha y datos de contacto",      roles: ["administrador"] },
      { to: "/coches",                          label: "Coches",                detail: "Registro de vehículos",          roles: ["administrador"] },
      { to: "/resumen-clientes",                label: "Resumen de clientes",   detail: "Facturación y períodos",         roles: ["administrador"] },
      { to: "/administracion/finanzas",         label: "Finanzas",              detail: "Control de gastos e ingresos",   roles: ["administrador"] },
      { to: "/proveedores",                     label: "Proveedores",           detail: "Contactos y compras",            roles: ["administrador"] },
      { to: "/maquinaria",                      label: "Maquinaria",            detail: "Control y garantías",            roles: ["administrador"] },
      { to: "/usuarios",                        label: "Usuarios",              detail: "Permisos y personal",            roles: ["administrador"] },
    ],
  },
];

export default function Home() {
  const { store, actions } = useContext(Context);
  const token = getStoredToken();
  const rol = normalizeRol(store?.user?.rol) || normalizeRol(getStoredRol()) || "detailing";

  useEffect(() => {
    if (token && !store.user) {
      actions.me().catch(() => {});
    }
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!token) {
    return (
      <div className="sw-home-wrapper">
        <div className="container py-5 d-flex flex-column align-items-center justify-content-center" style={{ minHeight: "60vh" }}>
          <div className="text-uppercase small mb-2" style={{ color: "rgba(212,175,55,0.9)", letterSpacing: "0.08em" }}>
            Panel interno · SpecialWash
          </div>
          <h1 className="fw-bold mb-3 text-center" style={{ color: "#ffffff", letterSpacing: "0.04em" }}>
            Bienvenido a <span style={{ color: "#d4af37" }}>SpecialWash</span>
          </h1>
          <p className="mb-4 text-center" style={{ color: "#dcdcdc", maxWidth: 420 }}>
            Inicia sesión para acceder a tu panel de trabajo.
          </p>
          <Link to="/login" className="btn sw-btn-gold px-5 py-2" style={{ fontSize: "1rem" }}>
            Iniciar sesión
          </Link>
        </div>
      </div>
    );
  }

  const visibleSections = SECTIONS
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => item.roles.includes(rol)),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <div className="sw-home-wrapper">
      <div className="container py-4 py-md-5">
        <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between mb-4 mb-md-5 gap-3">
          <div>
            <div className="text-uppercase small mb-1" style={{ color: "rgba(212,175,55,0.9)", letterSpacing: "0.08em" }}>
              Panel interno · SpecialWash
            </div>
            <h1 className="fw-bold mb-2" style={{ letterSpacing: "0.04em", color: "#ffffff" }}>
              {getGreeting()}{store.user?.nombre ? `, ${store.user.nombre}.` : "."}
            </h1>
            <p className="mb-0" style={{ color: "#dcdcdc" }}>
              Elige un módulo para empezar a trabajar.
            </p>
          </div>
          <div className="sw-home-tag text-end">
            <div className="sw-home-chip mb-2">Sesión activa</div>
            <div className="small" style={{ color: "#e5e5e5" }}>
              Usa el menú superior o las tarjetas para navegar.
            </div>
          </div>
        </div>

        <div className="row g-3 g-lg-4">
          {visibleSections.map((section) => (
            <div className="col-12 col-xl-4" key={section.id}>
              <div className="sw-home-section h-100">
                <div className="sw-home-section-head">
                  <div className="sw-home-icon-wrap">
                    <span className="sw-home-icon" style={{ fontSize: "1.7rem" }}>{section.emoji}</span>
                  </div>
                  <div>
                    <h4 className="sw-home-section-title mb-1">{section.title}</h4>
                    <p className="sw-home-section-subtitle mb-0">{section.subtitle}</p>
                  </div>
                </div>
                <div className="sw-home-links">
                  {section.items.map((item) => (
                    <Link key={item.to} to={item.to} className="sw-home-link-item text-decoration-none">
                      <div className="sw-home-link-main">{item.label}</div>
                      <div className="sw-home-link-detail">{item.detail}</div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
