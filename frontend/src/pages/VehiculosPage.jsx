import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Context } from "../store/appContext";
import { normalizeRol, getStoredRol } from "../utils/authSession";

// ── Iconos SVG ────────────────────────────────────────────────────────────────
const ICONS = {
  car:        (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 17H3a1 1 0 0 1-1-1v-5l2.3-6A1 1 0 0 1 5.24 4h13.5a1 1 0 0 1 .94.67L22 11v5a1 1 0 0 1-1 1h-2"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="17.5" r="2.5"/><path d="M2 11h20"/></svg>),
  clipboard:  (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="m9 14 2 2 4-4"/></svg>),
  save:       (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>),
  eye:        (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>),
  pen:        (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>),
  check:      (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>),
  arrow:      (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>),
  back:       (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>),
  plus:       (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>),
  spinner:    (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sw-veh-spinner"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>),
};

// ── Pasos del flujo ───────────────────────────────────────────────────────────
const PASOS = [
  {
    num: 1,
    id: "inspeccion",
    label: "Inspección",
    detail: "Recibe el vehículo, revisa el estado inicial y registra la entrada.",
    tag: "PASO 1",
    accent: "#d4af37",
    to: "/inspeccion-recepcion",
    ctaLabel: "Ir a inspección",
    ctaIcon: "plus",
    roles: ["administrador", "calidad"],
    countKey: "guardadas",
  },
  {
    num: 2,
    id: "repaso",
    label: "Control final",
    detail: "Comprueba acabados y deja el coche listo para entregar.",
    tag: "PASO 2",
    accent: "#38bdf8",
    to: "/repaso-entrega?tab=repaso",
    ctaLabel: "Abrir repaso",
    ctaIcon: "pen",
    roles: ["administrador", "calidad"],
    countKey: "en_proceso",
  },
  {
    num: 3,
    id: "entrega",
    label: "Entrega / firma",
    detail: "Abre el acta, firma con el cliente y registra ahí el cobro si es particular.",
    tag: "PASO 3",
    accent: "#22c55e",
    to: "/repaso-entrega?tab=firma",
    ctaLabel: "Abrir entrega",
    ctaIcon: "check",
    roles: ["administrador", "calidad"],
    countKey: "listos",
  },
];

// ── Componente principal ──────────────────────────────────────────────────────
export default function VehiculosPage() {
  const { actions, store } = useContext(Context);
  const rol = normalizeRol(store?.user?.rol) || normalizeRol(getStoredRol()) || "detailing";

  const [loading, setLoading] = useState(true);
  const [inspecciones, setInspecciones] = useState([]);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await actions.getMisInspecciones();
      setInspecciones(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, [actions]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // ── Conteos derivados ─────────────────────────────────────────────────────
  const counts = useMemo(() => {
    const entregados = inspecciones.filter((i) => i.entregado).length;
    const pendientes = inspecciones.filter((i) => !i.entregado);
    const listos     = pendientes.filter((i) => i.repaso_completado).length;
    const en_proceso = pendientes.filter((i) => !i.repaso_completado).length;
    const guardadas  = pendientes.length; // todas las no entregadas
    return { guardadas, en_proceso, listos, entregados };
  }, [inspecciones]);

  const visiblePasos = PASOS.filter((p) => p.roles.includes(rol));

  return (
    <div className="sw-veh-wrapper">

      {/* ── Cabecera ─────────────────────────────────── */}
      <div className="sw-veh-hero">
        <div className="container sw-veh-hero-inner">
          <Link to="/" className="sw-veh-back">
            {ICONS.back}
            <span>Inicio</span>
          </Link>
          <div className="sw-veh-hero-body">
            <span className="sw-veh-hero-icon">{ICONS.car}</span>
            <div>
              <h1 className="sw-veh-hero-title">Seguimiento de vehículos</h1>
              <p className="sw-veh-hero-sub">
                Sigue el flujo paso a paso: inspección, repaso, entrega y cobro.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Contenido ────────────────────────────────── */}
      <div className="container sw-veh-content">

        {/* Indicador numérico de progreso */}
        <div className="sw-veh-steps-bar">
          {visiblePasos.map((paso, idx) => (
            <React.Fragment key={paso.id}>
              <div className="sw-veh-step-dot" style={{ "--dot-color": paso.accent }}>
                <span className="sw-veh-step-dot-num">{paso.num}</span>
                <span className="sw-veh-step-dot-label">{paso.label}</span>
              </div>
              {idx < visiblePasos.length - 1 && (
                <div className="sw-veh-step-line" aria-hidden="true" />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Tarjetas de paso */}
        <div className="sw-veh-cards">
          {visiblePasos.map((paso) => {
            const count = paso.countKey ? counts[paso.countKey] : null;
            const hasAlert = count !== null && count > 0;

            return (
              <div
                key={paso.id}
                className="sw-veh-card"
                style={{ "--paso-accent": paso.accent }}
              >
                {/* Número de paso */}
                <span className="sw-veh-card-num">{paso.num}</span>

                {/* Tag */}
                <span
                  className="sw-veh-card-tag"
                  style={{
                    color: paso.accent,
                    background: `${paso.accent}15`,
                    borderColor: `${paso.accent}40`,
                  }}
                >
                  {paso.tag}
                </span>

                {/* Título y descripción */}
                <h3 className="sw-veh-card-title">{paso.label}</h3>
                <p className="sw-veh-card-detail">{paso.detail}</p>

                {/* Contador */}
                <div className="sw-veh-card-count">
                  {loading ? (
                    <span className="sw-veh-count-loading">{ICONS.spinner}</span>
                  ) : count !== null ? (
                    <span
                      className={`sw-veh-count-badge ${hasAlert ? "sw-veh-count-badge--active" : ""}`}
                      style={hasAlert ? { background: `${paso.accent}18`, color: paso.accent, borderColor: `${paso.accent}40` } : {}}
                    >
                      {count} {count === 1 ? "coche" : "coches"}
                    </span>
                  ) : null}
                </div>

                {/* CTA */}
                <Link to={paso.to} className="sw-veh-card-btn">
                  <span className="sw-veh-card-btn-icon">{ICONS[paso.ctaIcon]}</span>
                  <span>{paso.ctaLabel}</span>
                  <span className="sw-veh-card-btn-arrow">{ICONS.arrow}</span>
                </Link>
              </div>
            );
          })}
        </div>

        {/* Acción rápida destacada */}
        {visiblePasos.some((p) => p.id === "recepcion") && (
          <div className="sw-veh-quick-action">
            <div className="sw-veh-quick-inner">
              <div>
                <p className="sw-veh-quick-label">Acción rápida</p>
                <p className="sw-veh-quick-title">Registrar nuevo vehículo</p>
                <p className="sw-veh-quick-sub">
                  ¿Acaba de llegar un coche? Empieza aquí el paso 1 del seguimiento.
                </p>
              </div>
              <Link to="/inspeccion-recepcion" className="sw-veh-quick-btn">
                {ICONS.plus}
                <span>Nueva recepción</span>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
