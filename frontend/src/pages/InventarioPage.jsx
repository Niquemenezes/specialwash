import React, { useContext } from "react";
import { Link } from "react-router-dom";
import { Context } from "../store/appContext";
import { normalizeRol, getStoredRol } from "../utils/authSession";

const ICONS = {
  back:      (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>),
  arrow:     (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>),
  box:       (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-4 0v2M12 12v5M9.5 14.5h5"/></svg>),
  plus:      (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>),
  entrada:   (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M2 12l10-10 10 10"/></svg>),
  salida:    (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22V2M2 12l10 10 10-10"/></svg>),
  historial: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><path d="M12 7v5l4 2"/></svg>),
  tag:       (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>),
};

const ACCENT = "#22c55e";

const GRUPOS = [
  {
    id: "catalogo",
    title: "Catálogo y stock",
    subtitle: "Gestión de productos y niveles mínimos",
    accent: "#22c55e",
    icon: "box",
    items: [
      {
        to: "/productos",
        label: "Productos",
        detail: "Catálogo completo, precios y stock mínimo",
        icon: "tag",
        roles: ["administrador"],
      },
    ],
  },
  {
    id: "movimientos",
    title: "Movimientos de stock",
    subtitle: "Entradas y salidas del almacén",
    accent: "#38bdf8",
    icon: "entrada",
    items: [
      {
        to: "/entradas",
        label: "Registrar entrada",
        detail: "Compras y reabastecimiento de material",
        icon: "entrada",
        roles: ["administrador"],
      },
      {
        to: "/salidas",
        label: "Registrar salida",
        detail: "Consumo de taller por trabajo u operación",
        icon: "salida",
        roles: ["administrador", "encargado", "calidad", "detailing", "pintura", "tapicero"],
      },
    ],
  },
  {
    id: "historial",
    title: "Historial",
    subtitle: "Trazabilidad y resúmenes históricos",
    accent: "#a78bfa",
    icon: "historial",
    items: [
      {
        to: "/resumen-entradas",
        label: "Historial de entradas",
        detail: "Resumen económico de compras por período",
        icon: "historial",
        roles: ["administrador"],
      },
      {
        to: "/historial-salidas",
        label: "Historial de salidas",
        detail: "Trazabilidad por fecha y usuario",
        icon: "historial",
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

export default function InventarioPage() {
  const { store } = useContext(Context);
  const rol = normalizeRol(store?.user?.rol) || normalizeRol(getStoredRol()) || "detailing";

  const visibleGrupos = GRUPOS.filter((g) =>
    g.items.some((i) => i.roles.includes(rol))
  );

  return (
    <div className="sw-veh-wrapper">
      <div className="sw-veh-hero">
        <div className="container sw-veh-hero-inner">
          <Link to="/" className="sw-veh-back">{ICONS.back}<span>Inicio</span></Link>
          <div className="sw-veh-hero-body">
            <span className="sw-veh-hero-icon" style={{ background: `${ACCENT}15`, borderColor: `${ACCENT}30`, color: ACCENT }}>
              {ICONS.box}
            </span>
            <div>
              <h1 className="sw-veh-hero-title">Inventario</h1>
              <p className="sw-veh-hero-sub">Stock, entradas, salidas y trazabilidad de materiales</p>
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

        {/* Acción rápida: salida (la más frecuente para cualquier rol) */}
        <div className="sw-veh-quick-action" style={{ background: `${ACCENT}08`, borderColor: `${ACCENT}30` }}>
          <div className="sw-veh-quick-inner">
            <div>
              <p className="sw-veh-quick-label" style={{ color: ACCENT }}>Acción rápida</p>
              <p className="sw-veh-quick-title">Registrar salida de material</p>
              <p className="sw-veh-quick-sub">¿Estás usando material ahora? Regístralo aquí.</p>
            </div>
            <Link to="/salidas" className="sw-veh-quick-btn" style={{ background: ACCENT, boxShadow: `0 4px 16px ${ACCENT}35` }}>
              {ICONS.salida}
              <span>Registrar salida</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
