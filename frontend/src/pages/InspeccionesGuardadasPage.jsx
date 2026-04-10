import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Context } from "../store/appContext";
import CochesPendientesEntrega from "./CochesPendientesEntrega";
import { getApiBase } from "../utils/apiBase";
import { confirmar } from "../utils/confirmar";
import "../styles/inspeccion-responsive.css";

/* ─── SVG icons ─── */
const IconRefresh = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M4 9a9 9 0 0115.454-3.454M20 15a9 9 0 01-15.454 3.454"/>
  </svg>
);
const IconEye = () => (
  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M1 12S5 4 12 4s11 8 11 8-4 8-11 8S1 12 1 12z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);
const IconPencil = () => (
  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
    <path strokeLinecap="round" strokeLinejoin="round" d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);
const IconTrash = () => (
  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <polyline points="3 6 5 6 21 6"/><path strokeLinecap="round" strokeLinejoin="round" d="M19 6l-1 14H6L5 6m5 0V4h4v2"/>
  </svg>
);
const IconWA = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347"/>
  </svg>
);
const IconClose = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const getStoredToken = () =>
  (typeof sessionStorage !== "undefined" && sessionStorage.getItem("token")) ||
  (typeof localStorage !== "undefined" && localStorage.getItem("token")) || "";
const getVideoUrl = (item, inspeccionId) => {
  if (!item) return "";
  if (typeof item === "string") return item; // legado string
  if (item.filename) {
    // Video local en IONOS: necesita token JWT en query param para el tag <video>
    const base = getApiBase();
    const token = getStoredToken();
    return `${base}/api/inspeccion-recepcion/${inspeccionId}/video-file/${item.filename}?token=${encodeURIComponent(token)}`;
  }
  return item.url || ""; // legado Cloudinary
};

/**
 * Devuelve la URL mostrable de un item de foto.
 *  - Fotos Cloudinary nuevas: { url, public_id, ... }
 *  - Fotos locales IONOS (fallback sin Cloudinary): { filename, ... }
 *  - Legado string o { url }
 */
const getFotoUrl = (item, inspeccionId) => {
  if (!item) return "";
  if (typeof item === "string") return item;
  if (item.filename) {
    const base = getApiBase();
    const token = getStoredToken();
    return `${base}/api/inspeccion-recepcion/${inspeccionId}/foto-file/${item.filename}?token=${encodeURIComponent(token)}`;
  }
  return item.url || "";
};

const phoneToDigits = (value) => (value || "").replace(/\D/g, "");

const ESTADO_FILTERS = [
  { key: "todos", label: "Todos" },
  { key: "en_proceso", label: "En trabajo" },
  { key: "en_pausa", label: "En pausa" },
  { key: "en_repaso", label: "En repaso" },
  { key: "listo_entrega", label: "Listo entrega" },
  { key: "esperando_parte", label: "Sin parte" },
];

const InspeccionesGuardadasPage = () => {
  const { actions } = useContext(Context);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [inspecciones, setInspecciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detalle, setDetalle] = useState(null);
  const [actionError, setActionError] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("todos");
  const focoAbiertoRef = useRef(null);
  const requestedTab = searchParams.get("tab") || "guardadas";
  const activeTab = ["guardadas", "pendientes"].includes(requestedTab) ? requestedTab : "guardadas";
  const inspeccionesGuardadas = inspecciones.filter((insp) => !insp?.entregado);

  const conteoPorEstado = useMemo(() => {
    const acc = { todos: inspeccionesGuardadas.length };
    for (const insp of inspeccionesGuardadas) {
      const estado = insp?.estado_coche?.estado || "sin_estado";
      acc[estado] = (acc[estado] || 0) + 1;
    }
    return acc;
  }, [inspeccionesGuardadas]);

  const inspeccionesFiltradas = useMemo(() => {
    if (estadoFiltro === "todos") return inspeccionesGuardadas;
    return inspeccionesGuardadas.filter((insp) => insp?.estado_coche?.estado === estadoFiltro);
  }, [inspeccionesGuardadas, estadoFiltro]);

  const switchTab = (tab) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", tab);
    setSearchParams(next, { replace: true });
  };

  const cargarInspecciones = useCallback(async () => {
    setLoading(true);
    try {
      const data = await actions.getMisInspecciones();
      setInspecciones(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error al cargar inspecciones:", error);
      setInspecciones([]);
    } finally {
      setLoading(false);
    }
  }, [actions]);

  useEffect(() => {
    cargarInspecciones();
  }, [cargarInspecciones]);

  const verDetalle = useCallback(async (id) => {
    try {
      const data = await actions.getInspeccion(id);
      setDetalle(data || null);
    } catch (error) {
      console.error("Error al cargar detalle:", error);
      setActionError(`No se pudo cargar el detalle: ${error.message}`);
    }
  }, [actions]);

  useEffect(() => {
    if (loading) return;

    const focusIdRaw = searchParams.get("focusId");
    const focusId = Number(focusIdRaw);
    if (!Number.isInteger(focusId) || focusId <= 0) return;
    if (focoAbiertoRef.current === focusId) return;

    const existe = inspeccionesGuardadas.some((insp) => insp.id === focusId);
    if (!existe) return;

    focoAbiertoRef.current = focusId;
    void verDetalle(focusId);

    const next = new URLSearchParams(searchParams);
    next.delete("focusId");
    setSearchParams(next, { replace: true });
  }, [loading, inspeccionesGuardadas, searchParams, setSearchParams, verDetalle]);

  const eliminarInspeccion = async (id) => {
    if (!await confirmar("¿Seguro que quieres eliminar esta inspección?")) return;

    try {
      await actions.eliminarInspeccion(id);
      await cargarInspecciones();
      if (detalle?.id === id) setDetalle(null);
    } catch (error) {
      console.error("Error al eliminar inspección:", error);
      setActionError(`No se pudo eliminar: ${error.message}`);
    }
  };

  const irAEditar = (id) => {
    setDetalle(null);
    navigate(`/inspeccion-recepcion?editId=${id}`);
  };

  const ESTADO_COLORS = {
    todos: "#d4af37",
    en_proceso: "#38bdf8",
    en_pausa: "#f59e0b",
    en_repaso: "#a78bfa",
    listo_entrega: "#22c55e",
    esperando_parte: "#94a3b8",
  };

  return (
    <div className="sw-ent-wrapper">

      {/* ── Hero ── */}
      <div className="sw-veh-hero">
        <div className="sw-veh-hero-inner container">
          <div className="sw-veh-hero-body">
            <div className="sw-veh-hero-icon">
              <span style={{ width: 24, height: 24, display: "flex" }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
                  <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
                  <line x1="9" y1="12" x2="15" y2="12"/>
                  <line x1="9" y1="16" x2="13" y2="16"/>
                </svg>
              </span>
            </div>
            <div style={{ flex: 1 }}>
              <p className="sw-home-eyebrow" style={{ marginBottom: "0.2rem" }}>Taller · Administración</p>
              <h1 className="sw-veh-hero-title">Inspecciones y Pendientes</h1>
              <p className="sw-veh-hero-sub">Centraliza datos de inspección. Acceso exclusivo para administradores.</p>
            </div>
            <button
              className="sw-ent-submit-btn"
              onClick={cargarInspecciones}
              style={{ padding: "0.6rem 1.4rem", display: "flex", alignItems: "center", gap: "0.45rem" }}
            >
              <span style={{ width: 16, height: 16, display: "inline-flex" }}><IconRefresh /></span>
              Actualizar
            </button>
          </div>
        </div>
      </div>

      <div className="container sw-ent-content" style={{ maxWidth: 1200 }}>

        {/* ── Error ── */}
        {actionError && (
          <div style={{
            background: "color-mix(in srgb,var(--sw-danger,#ef4444) 12%,transparent)",
            border: "1px solid color-mix(in srgb,var(--sw-danger,#ef4444) 30%,transparent)",
            color: "var(--sw-danger,#ef4444)", borderRadius: 12, padding: "0.75rem 1rem",
            display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.9rem",
            marginBottom: "1rem",
          }}>
            {actionError}
            <button onClick={() => setActionError("")} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", display: "flex" }}>
              <span style={{ width: 18, height: 18, display: "flex" }}><IconClose /></span>
            </button>
          </div>
        )}

        {/* ── Tabs ── */}
        <div style={{ display: "flex", gap: 0, borderBottom: "2px solid var(--sw-border)", marginBottom: "1.75rem" }}>
          {[
            { key: "guardadas", label: "Guardadas", count: inspeccionesGuardadas.length },
            { key: "pendientes", label: "Pendientes / Hoja", count: null },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => switchTab(tab.key)}
              style={{
                background: "none", border: "none",
                borderBottom: activeTab === tab.key ? "2px solid var(--sw-accent,#d4af37)" : "2px solid transparent",
                color: activeTab === tab.key ? "var(--sw-accent,#d4af37)" : "var(--sw-muted)",
                fontWeight: activeTab === tab.key ? 700 : 500,
                padding: "0.7rem 1.25rem",
                cursor: "pointer", fontSize: "0.88rem",
                display: "flex", alignItems: "center", gap: "0.45rem",
                marginBottom: -2, transition: "color 0.18s, border-color 0.18s",
                whiteSpace: "nowrap",
              }}
            >
              {tab.label}
              {tab.count !== null && (
                <span style={{
                  background: activeTab === tab.key
                    ? "color-mix(in srgb,var(--sw-accent,#d4af37) 18%,transparent)"
                    : "var(--sw-surface-2)",
                  border: `1px solid ${activeTab === tab.key ? "color-mix(in srgb,var(--sw-accent,#d4af37) 35%,transparent)" : "var(--sw-border)"}`,
                  color: activeTab === tab.key ? "var(--sw-accent,#d4af37)" : "var(--sw-muted)",
                  borderRadius: 20, padding: "0.05rem 0.5rem",
                  fontSize: "0.7rem", fontWeight: 700,
                }}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {activeTab === "guardadas" && (
          <>
            {/* Filtros por estado */}
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1.25rem" }}>
              {ESTADO_FILTERS.map((f) => {
                const count = conteoPorEstado[f.key] || 0;
                const active = estadoFiltro === f.key;
                const color = ESTADO_COLORS[f.key] || "#d4af37";
                return (
                  <button
                    key={f.key}
                    onClick={() => setEstadoFiltro(f.key)}
                    style={{
                      background: active ? `color-mix(in srgb,${color} 14%,transparent)` : "var(--sw-surface-2)",
                      border: active ? `1px solid color-mix(in srgb,${color} 38%,transparent)` : "1px solid var(--sw-border)",
                      color: active ? color : "var(--sw-muted)",
                      borderRadius: 20, padding: "0.4rem 0.9rem",
                      cursor: "pointer", fontSize: "0.82rem", fontWeight: active ? 700 : 500,
                      display: "flex", alignItems: "center", gap: "0.4rem",
                      transition: "all 0.17s",
                    }}
                  >
                    {f.label}
                    <span style={{
                      background: active ? `color-mix(in srgb,${color} 20%,transparent)` : "var(--sw-surface)",
                      border: `1px solid ${active ? `color-mix(in srgb,${color} 35%,transparent)` : "var(--sw-border)"}`,
                      color: active ? color : "var(--sw-muted)",
                      borderRadius: 10, padding: "0 0.35rem",
                      fontSize: "0.7rem", fontWeight: 700,
                    }}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Tabla */}
            <div style={{
              background: "var(--sw-surface)", border: "1px solid var(--sw-border)",
              borderRadius: 16, overflow: "hidden",
              boxShadow: "0 4px 20px rgba(0,0,0,0.18)",
            }}>
              <div className="table-responsive">
                <table className="table align-middle mb-0" style={{ color: "var(--sw-text)" }}>
                  <thead>
                    <tr style={{ background: "var(--sw-surface-2)", borderBottom: "2px solid var(--sw-border)" }}>
                      {["#", "Fecha", "Cliente", "Coche", "Matrícula", "Por", "📷", "🎥", "Estado", "Cobro", ""].map((h) => (
                        <th key={h} style={{
                          padding: "0.85rem 0.9rem", fontSize: "0.65rem", fontWeight: 700,
                          letterSpacing: "0.08em", textTransform: "uppercase",
                          color: "var(--sw-muted)", border: "none",
                          textAlign: h === "" ? "right" : "left",
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading && (
                      <tr>
                        <td colSpan={11} style={{ textAlign: "center", padding: "3.5rem", color: "var(--sw-muted)" }}>
                          <div className="spinner-border spinner-border-sm me-2" style={{ color: "var(--sw-accent,#d4af37)" }} />
                          Cargando…
                        </td>
                      </tr>
                    )}
                    {!loading && inspeccionesFiltradas.length === 0 && (
                      <tr>
                        <td colSpan={11} style={{ textAlign: "center", padding: "3.5rem", color: "var(--sw-muted)", fontSize: "0.9rem" }}>
                          {inspeccionesGuardadas.length === 0
                            ? "No hay inspecciones pendientes registradas."
                            : "No hay inspecciones para el estado seleccionado."}
                        </td>
                      </tr>
                    )}
                    {!loading && inspeccionesFiltradas.map((insp) => {
                      const estado = insp?.estado_coche || null;
                      const nombresServicios = Array.isArray(insp?.servicios_aplicados)
                        ? insp.servicios_aplicados.map((s) => String(s?.nombre || "").trim()).filter(Boolean)
                        : [];
                      return (
                        <tr
                          key={insp.id}
                          style={{ borderBottom: "1px solid var(--sw-border)", transition: "background 0.15s" }}
                          onMouseEnter={e => e.currentTarget.style.background = "color-mix(in srgb,var(--sw-accent,#d4af37) 5%,transparent)"}
                          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                        >
                          <td style={{ padding: "0.8rem 0.9rem", color: "var(--sw-muted)", fontSize: "0.78rem", fontWeight: 600 }}>
                            #{insp.id}
                          </td>
                          <td style={{ padding: "0.8rem 0.9rem", color: "var(--sw-text)", fontSize: "0.82rem", whiteSpace: "nowrap" }}>
                            {new Date(insp.fecha_inspeccion).toLocaleString("es-ES")}
                          </td>
                          <td style={{ padding: "0.8rem 0.9rem", fontWeight: 700, color: "var(--sw-text)" }}>
                            {insp.cliente_nombre || "—"}
                          </td>
                          <td style={{ padding: "0.8rem 0.9rem", color: "var(--sw-muted)", fontSize: "0.85rem" }}>
                            {insp.coche_descripcion || "—"}
                          </td>
                          <td style={{ padding: "0.8rem 0.9rem" }}>
                            {insp.matricula ? (
                              <span style={{
                                background: "color-mix(in srgb,var(--sw-accent,#d4af37) 12%,transparent)",
                                border: "1px solid color-mix(in srgb,var(--sw-accent,#d4af37) 30%,transparent)",
                                color: "var(--sw-accent,#d4af37)", borderRadius: 6,
                                padding: "0.15rem 0.55rem", fontWeight: 700, fontSize: "0.78rem", letterSpacing: "0.05em",
                              }}>{insp.matricula}</span>
                            ) : <span style={{ color: "var(--sw-muted)", fontStyle: "italic" }}>—</span>}
                          </td>
                          <td style={{ padding: "0.8rem 0.9rem", color: "var(--sw-muted)", fontSize: "0.82rem" }}>
                            {insp.usuario_nombre || "—"}
                          </td>
                          <td style={{ padding: "0.8rem 0.9rem", textAlign: "center", color: "var(--sw-muted)", fontSize: "0.82rem" }}>
                            {insp.fotos_cloudinary?.length || 0}
                          </td>
                          <td style={{ padding: "0.8rem 0.9rem", textAlign: "center", color: "var(--sw-muted)", fontSize: "0.82rem" }}>
                            {insp.videos_cloudinary?.length || 0}
                          </td>
                          <td style={{ padding: "0.8rem 0.9rem", minWidth: 150 }}>
                            {estado ? (
                              <div>
                                <span style={{
                                  background: `${estado.color}22`,
                                  border: `1px solid ${estado.color}55`,
                                  color: estado.color,
                                  borderRadius: 6, padding: "0.15rem 0.55rem",
                                  fontWeight: 700, fontSize: "0.72rem",
                                }}>{estado.label}</span>
                                {nombresServicios.length > 0 && (
                                  <div style={{ fontSize: "0.72rem", color: "var(--sw-muted)", marginTop: "0.25rem", maxWidth: 200, lineHeight: 1.3 }}>
                                    {nombresServicios.join(", ")}
                                  </div>
                                )}
                              </div>
                            ) : insp.entregado ? (
                              <span style={{
                                background: "color-mix(in srgb,#22c55e 14%,transparent)",
                                border: "1px solid color-mix(in srgb,#22c55e 30%,transparent)",
                                color: "#22c55e", borderRadius: 6, padding: "0.15rem 0.55rem",
                                fontWeight: 700, fontSize: "0.72rem",
                              }}>Entregado</span>
                            ) : (
                              <span style={{
                                background: "color-mix(in srgb,#f59e0b 14%,transparent)",
                                border: "1px solid color-mix(in srgb,#f59e0b 30%,transparent)",
                                color: "#f59e0b", borderRadius: 6, padding: "0.15rem 0.55rem",
                                fontWeight: 700, fontSize: "0.72rem",
                              }}>Pendiente</span>
                            )}
                          </td>
                          <td style={{ padding: "0.8rem 0.9rem" }}>
                            {insp.cobro ? (
                              <div>
                                <span style={{
                                  background: `${insp.cobro.color}22`,
                                  border: `1px solid ${insp.cobro.color}55`,
                                  color: insp.cobro.color,
                                  borderRadius: 6, padding: "0.15rem 0.55rem",
                                  fontWeight: 700, fontSize: "0.72rem",
                                }}>{insp.cobro.label}</span>
                                <div style={{ fontSize: "0.72rem", color: "var(--sw-muted)", marginTop: "0.2rem" }}>
                                  {Number(insp.cobro.importe_pagado || 0).toFixed(2)} / {Number(insp.cobro.importe_total || 0).toFixed(2)} €
                                </div>
                              </div>
                            ) : (
                              <span style={{ color: "var(--sw-muted)", fontStyle: "italic", fontSize: "0.82rem" }}>—</span>
                            )}
                          </td>
                          <td style={{ padding: "0.8rem 0.9rem", textAlign: "right" }}>
                            <div style={{ display: "flex", gap: "0.4rem", justifyContent: "flex-end" }}>
                              <button
                                onClick={() => verDetalle(insp.id)}
                                title="Ver detalle"
                                style={{
                                  background: "color-mix(in srgb,#38bdf8 12%,transparent)",
                                  border: "1px solid color-mix(in srgb,#38bdf8 30%,transparent)",
                                  color: "#38bdf8", borderRadius: 8,
                                  padding: "0.35rem 0.55rem", cursor: "pointer", display: "flex", alignItems: "center",
                                }}
                              >
                                <span style={{ width: 14, height: 14, display: "flex" }}><IconEye /></span>
                              </button>
                              {phoneToDigits(insp.cliente_telefono) && (
                                <a
                                  href={`https://wa.me/${phoneToDigits(insp.cliente_telefono)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title={`WhatsApp ${insp.cliente_nombre}`}
                                  style={{
                                    background: "color-mix(in srgb,#25D366 12%,transparent)",
                                    border: "1px solid color-mix(in srgb,#25D366 30%,transparent)",
                                    color: "#25D366", borderRadius: 8,
                                    padding: "0.35rem 0.55rem", display: "flex", alignItems: "center", textDecoration: "none",
                                  }}
                                >
                                  <span style={{ width: 14, height: 14, display: "flex" }}><IconWA /></span>
                                </a>
                              )}
                              <button
                                onClick={() => irAEditar(insp.id)}
                                title="Editar"
                                style={{
                                  background: "color-mix(in srgb,var(--sw-accent,#d4af37) 12%,transparent)",
                                  border: "1px solid color-mix(in srgb,var(--sw-accent,#d4af37) 30%,transparent)",
                                  color: "var(--sw-accent,#d4af37)", borderRadius: 8,
                                  padding: "0.35rem 0.55rem", cursor: "pointer", display: "flex", alignItems: "center",
                                }}
                              >
                                <span style={{ width: 14, height: 14, display: "flex" }}><IconPencil /></span>
                              </button>
                              <button
                                onClick={() => eliminarInspeccion(insp.id)}
                                title="Eliminar"
                                style={{
                                  background: "color-mix(in srgb,var(--sw-danger,#ef4444) 10%,transparent)",
                                  border: "1px solid color-mix(in srgb,var(--sw-danger,#ef4444) 28%,transparent)",
                                  color: "var(--sw-danger,#ef4444)", borderRadius: 8,
                                  padding: "0.35rem 0.55rem", cursor: "pointer", display: "flex", alignItems: "center",
                                }}
                              >
                                <span style={{ width: 14, height: 14, display: "flex" }}><IconTrash /></span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── Modal detalle ── */}
            {detalle && (
              <div
                style={{
                  position: "fixed", inset: 0, zIndex: 1050,
                  background: "var(--sw-overlay-bg,rgba(0,0,0,0.6))",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  padding: "1rem", backdropFilter: "blur(4px)",
                }}
                onClick={(e) => { if (e.target === e.currentTarget) setDetalle(null); }}
              >
                <div style={{
                  background: "var(--sw-surface)", border: "1px solid var(--sw-border)",
                  borderRadius: 20, width: "100%", maxWidth: 740, maxHeight: "92vh", overflowY: "auto",
                  boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
                  animation: "sw-fade-up 0.22s ease both",
                }}>
                  {/* Header */}
                  <div style={{
                    padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--sw-border)",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    position: "sticky", top: 0, background: "var(--sw-surface)", zIndex: 1,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <span style={{
                        width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
                        background: "color-mix(in srgb,var(--sw-accent,#d4af37) 14%,transparent)",
                        border: "1px solid color-mix(in srgb,var(--sw-accent,#d4af37) 28%,transparent)",
                        color: "var(--sw-accent,#d4af37)",
                      }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="1" y="3" width="15" height="13" rx="2"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
                        </svg>
                      </span>
                      <div>
                        <p style={{ margin: 0, fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--sw-muted)" }}>
                          Detalle de inspección
                        </p>
                        <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "var(--sw-text)" }}>
                          #{detalle.id} — {detalle.matricula || "Sin matrícula"}
                        </h3>
                      </div>
                    </div>
                    <button onClick={() => setDetalle(null)} style={{ background: "none", border: "none", color: "var(--sw-muted)", cursor: "pointer", padding: "0.25rem", borderRadius: 6, display: "flex" }}>
                      <span style={{ width: 20, height: 20, display: "flex" }}><IconClose /></span>
                    </button>
                  </div>

                  {/* Body */}
                  <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>

                    {/* Cliente + Vehículo */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: "1rem" }}>
                      <div style={{ background: "var(--sw-surface-2)", border: "1px solid var(--sw-border)", borderRadius: 14, padding: "1.1rem" }}>
                        <p style={{ margin: "0 0 0.65rem", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--sw-accent,#d4af37)" }}>Cliente</p>
                        {[{ label: "Nombre", value: detalle.cliente_nombre }, { label: "Teléfono", value: detalle.cliente_telefono }].map(({ label, value }) => (
                          <div key={label} style={{ marginBottom: "0.5rem" }}>
                            <span style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", color: "var(--sw-muted)", letterSpacing: "0.06em" }}>{label}</span>
                            <p style={{ margin: "0.1rem 0 0", fontWeight: 600, color: "var(--sw-text)", fontSize: "0.9rem" }}>{value || "—"}</p>
                          </div>
                        ))}
                      </div>
                      <div style={{ background: "var(--sw-surface-2)", border: "1px solid var(--sw-border)", borderRadius: 14, padding: "1.1rem" }}>
                        <p style={{ margin: "0 0 0.65rem", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--sw-accent,#d4af37)" }}>Vehículo</p>
                        {[
                          { label: "Coche", value: detalle.coche_descripcion },
                          { label: "Matrícula", value: detalle.matricula },
                          { label: "Kilómetros", value: Number.isFinite(detalle.kilometros) ? `${detalle.kilometros.toLocaleString("es-ES")} km` : null },
                          { label: "Fecha", value: new Date(detalle.fecha_inspeccion).toLocaleString("es-ES") },
                        ].map(({ label, value }) => (
                          <div key={label} style={{ marginBottom: "0.5rem" }}>
                            <span style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", color: "var(--sw-muted)", letterSpacing: "0.06em" }}>{label}</span>
                            <p style={{ margin: "0.1rem 0 0", fontWeight: 600, color: "var(--sw-text)", fontSize: "0.9rem" }}>{value || "—"}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Estado */}
                    {detalle.estado_coche && (
                      <div style={{ background: "var(--sw-surface-2)", border: "1px solid var(--sw-border)", borderRadius: 14, padding: "1.1rem" }}>
                        <p style={{ margin: "0 0 0.65rem", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--sw-accent,#d4af37)" }}>Estado del coche</p>
                        {(() => {
                          const nombresServicios = Array.isArray(detalle.servicios_aplicados)
                            ? detalle.servicios_aplicados.map((s) => String(s?.nombre || "").trim()).filter(Boolean)
                            : [];
                          return (
                            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                              <span style={{
                                background: `${detalle.estado_coche.color}22`,
                                border: `1px solid ${detalle.estado_coche.color}55`,
                                color: detalle.estado_coche.color,
                                borderRadius: 8, padding: "0.3rem 0.75rem",
                                fontWeight: 700, fontSize: "0.85rem",
                              }}>{detalle.estado_coche.label}</span>
                              {nombresServicios.length > 0 && (
                                <span style={{ color: "var(--sw-muted)", fontSize: "0.82rem" }}>{nombresServicios.join(", ")}</span>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* Cobro */}
                    {detalle.cobro && (
                      <div style={{ background: "var(--sw-surface-2)", border: "1px solid var(--sw-border)", borderRadius: 14, padding: "1.1rem" }}>
                        <p style={{ margin: "0 0 0.65rem", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--sw-accent,#d4af37)" }}>Cobro</p>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center" }}>
                          <span style={{
                            background: `${detalle.cobro.color}22`,
                            border: `1px solid ${detalle.cobro.color}55`,
                            color: detalle.cobro.color,
                            borderRadius: 8, padding: "0.3rem 0.75rem",
                            fontWeight: 700, fontSize: "0.85rem",
                          }}>{detalle.cobro.label}</span>
                          <span style={{ color: "var(--sw-muted)", fontSize: "0.82rem" }}>
                            Total <strong style={{ color: "var(--sw-text)" }}>{Number(detalle.cobro.importe_total || 0).toFixed(2)} €</strong>
                            {" · "}Pagado <strong style={{ color: "#22c55e" }}>{Number(detalle.cobro.importe_pagado || 0).toFixed(2)} €</strong>
                            {" · "}Pendiente <strong style={{ color: "#f87171" }}>{Number(detalle.cobro.importe_pendiente || 0).toFixed(2)} €</strong>
                          </span>
                          <span style={{ color: "var(--sw-muted)", fontSize: "0.78rem" }}>
                            Método: {detalle.cobro.metodo || "—"} · Ref: {detalle.cobro.referencia || "—"}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Firmas */}
                    {(detalle.firma_cliente_recepcion || detalle.firma_empleado_recepcion) && (
                      <div style={{ background: "var(--sw-surface-2)", border: "1px solid var(--sw-border)", borderRadius: 14, padding: "1.1rem" }}>
                        <p style={{ margin: "0 0 0.65rem", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--sw-accent,#d4af37)" }}>Firmas de recepción</p>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: "1rem" }}>
                          {detalle.firma_cliente_recepcion && (
                            <div>
                              <span style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", color: "var(--sw-muted)", letterSpacing: "0.06em" }}>Cliente</span>
                              <img src={detalle.firma_cliente_recepcion} alt="Firma cliente recepcion" style={{ marginTop: "0.4rem", width: "100%", maxHeight: 150, objectFit: "contain", background: "#fff", borderRadius: 8, border: "1px solid var(--sw-border)" }} />
                            </div>
                          )}
                          {detalle.firma_empleado_recepcion && (
                            <div>
                              <span style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", color: "var(--sw-muted)", letterSpacing: "0.06em" }}>Empleado</span>
                              <img src={detalle.firma_empleado_recepcion} alt="Firma empleado recepcion" style={{ marginTop: "0.4rem", width: "100%", maxHeight: 150, objectFit: "contain", background: "#fff", borderRadius: 8, border: "1px solid var(--sw-border)" }} />
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Observaciones */}
                    {detalle.averias_notas && (
                      <div style={{ background: "var(--sw-surface-2)", border: "1px solid var(--sw-border)", borderRadius: 14, padding: "1.1rem" }}>
                        <p style={{ margin: "0 0 0.5rem", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--sw-accent,#d4af37)" }}>Observaciones y averías</p>
                        <p style={{ margin: 0, color: "var(--sw-text)", fontSize: "0.88rem", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{detalle.averias_notas}</p>
                      </div>
                    )}

                    {/* Fotos */}
                    {Array.isArray(detalle.fotos_cloudinary) && detalle.fotos_cloudinary.length > 0 && (
                      <div>
                        <p style={{ margin: "0 0 0.75rem", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--sw-accent,#d4af37)" }}>
                          Fotos del vehículo ({detalle.fotos_cloudinary.length})
                        </p>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: "0.75rem" }}>
                          {detalle.fotos_cloudinary.map((foto, index) => {
                            const url = getFotoUrl(foto, detalle.id);
                            if (!url) return null;
                            return (
                              <a key={index} href={url} target="_blank" rel="noopener noreferrer" style={{ borderRadius: 10, overflow: "hidden", display: "block", border: "1px solid var(--sw-border)" }}>
                                <img src={url} alt={`Foto ${index + 1}`} style={{ width: "100%", height: 130, objectFit: "cover", display: "block" }} />
                              </a>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Vídeos */}
                    {Array.isArray(detalle.videos_cloudinary) && detalle.videos_cloudinary.length > 0 && (
                      <div>
                        <p style={{ margin: "0 0 0.75rem", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--sw-accent,#d4af37)" }}>
                          Vídeos del vehículo ({detalle.videos_cloudinary.length})
                        </p>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: "0.75rem" }}>
                          {detalle.videos_cloudinary.map((video, index) => {
                            const url = getVideoUrl(video, detalle.id);
                            if (!url) return null;
                            return (
                              <video key={index} src={url} controls style={{ width: "100%", maxHeight: 260, borderRadius: 10, border: "1px solid var(--sw-border)" }} />
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {(!detalle.fotos_cloudinary || detalle.fotos_cloudinary.length === 0) &&
                      (!detalle.videos_cloudinary || detalle.videos_cloudinary.length === 0) && (
                        <div style={{
                          background: "color-mix(in srgb,#38bdf8 8%,transparent)",
                          border: "1px solid color-mix(in srgb,#38bdf8 25%,transparent)",
                          color: "#38bdf8", borderRadius: 12, padding: "0.75rem 1rem", fontSize: "0.88rem",
                        }}>
                          Esta inspección no tiene fotos ni vídeos guardados.
                        </div>
                      )}
                  </div>

                  {/* Footer */}
                  <div style={{ padding: "1rem 1.5rem", borderTop: "1px solid var(--sw-border)", display: "flex", justifyContent: "flex-end", gap: "0.75rem", flexWrap: "wrap" }}>
                    <button
                      onClick={() => irAEditar(detalle.id)}
                      style={{
                        background: "color-mix(in srgb,var(--sw-accent,#d4af37) 14%,transparent)",
                        border: "1px solid color-mix(in srgb,var(--sw-accent,#d4af37) 32%,transparent)",
                        color: "var(--sw-accent,#d4af37)", borderRadius: 10, padding: "0.6rem 1.2rem",
                        fontWeight: 700, fontSize: "0.85rem", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "0.4rem",
                      }}
                    >
                      <span style={{ width: 14, height: 14, display: "flex" }}><IconPencil /></span>
                      Editar
                    </button>
                    {phoneToDigits(detalle.cliente_telefono) && (
                      <a
                        href={`https://wa.me/${phoneToDigits(detalle.cliente_telefono)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          background: "color-mix(in srgb,#25D366 14%,transparent)",
                          border: "1px solid color-mix(in srgb,#25D366 32%,transparent)",
                          color: "#25D366", borderRadius: 10, padding: "0.6rem 1.2rem",
                          fontWeight: 700, fontSize: "0.85rem", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "0.4rem",
                        }}
                      >
                        <span style={{ width: 14, height: 14, display: "flex" }}><IconWA /></span>
                        WhatsApp
                      </a>
                    )}
                    <button
                      onClick={() => setDetalle(null)}
                      style={{
                        background: "var(--sw-surface-2)", border: "1px solid var(--sw-border)",
                        color: "var(--sw-muted)", borderRadius: 10, padding: "0.6rem 1.2rem",
                        fontWeight: 600, fontSize: "0.85rem", cursor: "pointer",
                      }}
                    >
                      Cerrar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === "pendientes" && <CochesPendientesEntrega />}
      </div>
    </div>
  );
};

export default InspeccionesGuardadasPage;
