import React, { useContext, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Context } from "../store/appContext";
import { getStoredRol, getStoredToken, normalizeRol } from "../utils/authSession";

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 20) return "Buenas tardes";
  return "Buenas noches";
};

export default function Home() {
  const { store, actions } = useContext(Context);

  const token = getStoredToken() || null;

  const rolFromUser = normalizeRol(store?.user?.rol);
  const rolFromStorage = normalizeRol(getStoredRol());

  const rol = rolFromUser || rolFromStorage || "empleado";

  useEffect(() => {
    if (token && !store.user) {
      actions.me().catch(() => {});
    }
  }, [token, store.user, actions]);

  const sections = useMemo(
    () => [
      {
        id: "inventario",
        title: "Productos e Inventario",
        subtitle: "Flujo completo de producto y stock",
        emoji: "📦",
        items: [
          {
            to: "/productos",
            label: "Crear y gestionar productos",
            detail: "Catálogo, precios y stock mínimo",
            roles: ["administrador"],
          },
          {
            to: "/entradas",
            label: "Registrar entrada",
            detail: "Compras y abastecimiento",
            roles: ["administrador"],
          },
          {
            to: "/salidas",
            label: "Registrar salida",
            detail: "Consumo de taller y operaciones",
            roles: ["administrador", "empleado", "encargado", "calidad", "detailing", "pintura"],
          },
          {
            to: "/resumen-entradas",
            label: "Historial de entradas",
            detail: "Resumen económico y compras",
            roles: ["administrador"],
          },
          {
            to: "/historial-salidas",
            label: "Historial de salidas",
            detail: "Trazabilidad por fecha y usuario",
            roles: ["administrador"],
          },
        ],
      },
      {
        id: "clientes",
        title: "Vehículos",
        subtitle: "Flujo de recepción, repaso y entrega",
        emoji: "🚗",
        items: [
          {
            to: "/inspeccion-recepcion",
            label: "Inspección de recepción",
            detail: "Estado inicial y firmas",
            roles: ["administrador", "detailing", "calidad"],
          },
          {
            to: "/inspecciones-guardadas",
            label: "Inspecciones + Pendientes",
            detail: "Revisión y validación (admin)",
            roles: ["administrador"],
          },
          {
            to: "/repaso-entrega",
            label: "Repaso + Firma entrega",
            detail: "Control y firma cliente",
            roles: ["administrador", "detailing", "calidad"],
          },
          {
            to: "/entregados",
            label: "Coches entregados",
            detail: "Historial final",
            roles: ["administrador"],
          },
          {
            to: "/citas",
            label: "📅 Citas",
            detail: "Agenda y gestión de citas",
            roles: ["administrador", "encargado", "tecnico_comercial", "calidad", "detailing"],
          },
        ],
      },
      {
        id: "partes",
        title: "Partes de Trabajo",
        subtitle: "Asignacion de tareas y avance",
        emoji: "🧰",
        items: [
          {
            to: "/partes-trabajo",
            label: "📋 Partes activos",
            detail: "Crear, asignar y dar seguimiento",
            roles: ["administrador", "calidad"],
          },
          {
            to: "/flujo-trabajo",
            label: "👨‍🔧 Mis partes",
            detail: "Ver y actualizar tus tareas",
            roles: ["empleado", "detailing", "pintura"],
          },
          {
            to: "/partes-trabajo-finalizados",
            label: "✅ Partes finalizados",
            detail: "Historial de trabajos completados",
            roles: ["administrador"],
          },
          {
            to: "/catalogo-servicios",
            label: "🛠️ Catálogo de servicios",
            detail: "Gestionar servicios disponibles",
            roles: ["administrador"],
          },
        ],
      },
      {
        id: "admin",
        title: "Administración",
        subtitle: "Estructura interna y recursos",
        emoji: "🧩",
        items: [
          {
            to: "/clientes",
            label: "Clientes",
            detail: "Ficha y datos de contacto",
            roles: ["administrador"],
          },
          {
            to: "/coches",
            label: "Coches",
            detail: "Registro de vehículos",
            roles: ["administrador"],
          },
          {
            to: "/resumen-clientes",
            label: "Resumen de clientes",
            detail: "Facturación y períodos",
            roles: ["administrador"],
          },
          {
            to: "/administracion/finanzas",
            label: "Finanzas",
            detail: "Control de gastos e ingresos",
            roles: ["administrador"],
          },
          {
            to: "/proveedores",
            label: "Proveedores",
            detail: "Contactos y compras",
            roles: ["administrador"],
          },
          {
            to: "/maquinaria",
            label: "Maquinaria",
            detail: "Control y garantías",
            roles: ["administrador"],
          },
          {
            to: "/usuarios",
            label: "Usuarios",
            detail: "Permisos y personal",
            roles: ["administrador"],
          },
        ],
      },
    ],
    []
  );

  const visibleSections = !token
    ? sections
    : sections
        .map((section) => ({
          ...section,
          items: section.items.filter((item) => item.roles.includes(rol)),
        }))
        .filter((section) => section.items.length > 0);

  const greeting = getGreeting();

  return (
    <div className="sw-home-wrapper">
      <div className="container py-4 py-md-5">
        {/* Encabezado */}
        <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between mb-4 mb-md-5 gap-3">
          <div>
            <div
              className="text-uppercase small mb-1"
              style={{ color: "rgba(212,175,55,0.9)", letterSpacing: "0.08em" }}
            >
              Panel interno · SpecialWash
            </div>

            <h1
              className="fw-bold mb-2"
              style={{ letterSpacing: "0.04em", color: "#ffffff" }}
            >
              {greeting}
              {store.user?.nombre ? `, ${store.user.nombre}.` : "."}
            </h1>

            {token ? (
              <p className="mb-0" style={{ color: "#dcdcdc" }}>
                Elige un módulo para empezar a trabajar.
              </p>
            ) : (
              <p className="mb-0" style={{ color: "#dcdcdc" }}>
                Esta es la consola interna de{" "}
                <span style={{ color: "#d4af37" }}>SpecialWash</span>. Inicia
                sesión para acceder a las secciones restringidas.
              </p>
            )}
          </div>

          {token && (
            <div className="sw-home-tag text-end">
              <div className="sw-home-chip mb-2">Sesión activa</div>
              <div className="small" style={{ color: "#e5e5e5" }}>
                Usa el menú superior o las tarjetas para navegar.
              </div>
            </div>
          )}
        </div>

        <div className="row g-3 g-lg-4">
          {visibleSections.map((section) => (
            <div className="col-12 col-xl-4" key={section.id}>
              <div className="sw-home-section h-100">
                <div className="sw-home-section-head">
                  <div className="sw-home-icon-wrap">
                    <span className="sw-home-icon" style={{ fontSize: "1.7rem" }}>
                      {section.emoji}
                    </span>
                  </div>
                  <div>
                    <h4 className="sw-home-section-title mb-1">{section.title}</h4>
                    <p className="sw-home-section-subtitle mb-0">{section.subtitle}</p>
                  </div>
                </div>

                <div className="sw-home-links">
                  {token ? (
                    section.items.map((item) => (
                      <Link key={item.to} to={item.to} className="sw-home-link-item text-decoration-none">
                        <div className="sw-home-link-main">{item.label}</div>
                        <div className="sw-home-link-detail">{item.detail}</div>
                      </Link>
                    ))
                  ) : (
                    <div className="sw-home-locked">
                      Inicia sesión para ver y usar los accesos de este bloque.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {!token && (
          <p className="text-center mt-4 mb-0" style={{ color: "#c0c0c0" }}>
            Para gestionar stock, maquinaria y entradas/salidas, inicia sesión
            desde el menú superior.
          </p>
        )}
      </div>
    </div>
  );
}