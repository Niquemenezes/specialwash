import React, { useContext, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Context } from "../store/appContext";

// Normaliza nombres de rol
const normalizeRol = (r) => {
  r = (r || "").toString().toLowerCase().trim();
  if (r === "admin" || r === "administrator") return "administrador";
  if (r === "employee" || r === "staff") return "empleado";
  return r;
};

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 20) return "Buenas tardes";
  return "Buenas noches";
};

export default function Home() {
  const { store, actions } = useContext(Context);

  const token =
    (typeof sessionStorage !== "undefined" && sessionStorage.getItem("token")) ||
    (typeof localStorage !== "undefined" && localStorage.getItem("token")) ||
    null;

  const rolFromUser = normalizeRol(store?.user?.rol);
  const rolFromStorage = normalizeRol(
    (typeof sessionStorage !== "undefined" && sessionStorage.getItem("rol")) ||
      (typeof localStorage !== "undefined" && localStorage.getItem("rol"))
  );

  const rol = rolFromUser || rolFromStorage || "empleado";

  useEffect(() => {
    if (token && !store.user) {
      actions.me().catch(() => {});
    }
  }, [token, store.user, actions]);

  const tiles = useMemo(
    () => [
      {
        to: "/productos",
        title: "Productos",
        subtitle: "Control de stock y mínimos",
        emoji: "📦",
        roles: ["empleado", "administrador"],
      },
      {
        to: "/entradas",
        title: "Registrar Entrada",
        subtitle: "Compras y proveedores",
        emoji: "📥",
        roles: ["administrador"],
      },
      {
        to: "/salidas",
        title: "Registrar Salida",
        subtitle: "Consumo diario de productos",
        emoji: "📤",
        roles: ["empleado", "administrador"],
      },
      {
        to: "/clientes",
        title: "Clientes",
        subtitle: "Gestión de clientes y contactos",
        emoji: "👥",
        roles: ["administrador"],
      },
      {
        to: "/coches",
        title: "Coches",
        subtitle: "Registro de vehículos",
        emoji: "🚗",
        roles: ["administrador"],
      },
      {
        to: "/servicios",
        title: "Servicios",
        subtitle: "Historial de trabajos realizados",
        emoji: "🔧",
        roles: ["empleado", "administrador"],
      },
      {
        to: "/resumen-clientes",
        title: "Resumen Clientes",
        subtitle: "Facturación por cliente y período",
        emoji: "📊",
        roles: ["administrador"],
      },
      {
        to: "/resumen-entradas",
        title: "Resumen Entradas",
        subtitle: "Informe económico de compras",
        emoji: "🧾",
        roles: ["administrador"],
      },
      {
        to: "/historial-salidas",
        title: "Historial Salidas",
        subtitle: "Trazabilidad de uso por día/usuario",
        emoji: "🕐",
        roles: ["administrador"],
      },
      {
        to: "/proveedores",
        title: "Proveedores",
        subtitle: "Gestión de contactos y compras",
        emoji: "🤝",
        roles: ["administrador"],
      },
      {
        to: "/usuarios",
        title: "Usuarios",
        subtitle: "Altas y gestión de personal",
        emoji: "👤",
        roles: ["administrador"],
      },
      {
        to: "/maquinaria",
        title: "Maquinaria",
        subtitle: "Control de equipos y garantías",
        emoji: "⚙️",
        roles: ["administrador"],
      },
    ],
    []
  );

  const visibles = !token ? tiles : tiles.filter((t) => t.roles.includes(rol));
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

        {/* Grid de módulos */}
        <div className="sw-home-grid row g-3 g-md-4">
          {visibles.map((t) => (
            <div className="col-12 col-sm-6 col-lg-3" key={t.to}>
              <Link to={t.to} className="text-decoration-none">
                <div className="sw-home-card card h-100 border-0">
                  <div className="card-body d-flex flex-column justify-content-between">
                    <div>
                      <div className="sw-home-icon-wrap mb-3">
                        <span className="sw-home-icon" style={{ fontSize: "2rem" }}>{t.emoji}</span>
                      </div>
                      <h5 className="sw-home-title mb-1">{t.title}</h5>
                      <p className="sw-home-subtitle mb-0">{t.subtitle}</p>
                    </div>
                    <div className="mt-3 sw-home-cta">
                      <span>Acceder al módulo</span>
                      <span className="ms-2">➡️</span>
                    </div>
                  </div>
                </div>
              </Link>
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