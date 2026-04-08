import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Context } from "../store/appContext";
import { getApiBase } from "../utils/apiBase";

const toDateInputValue = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatFecha = (value) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("es-ES");
};

const parseKm = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const getStoredToken = () =>
  (typeof sessionStorage !== "undefined" && sessionStorage.getItem("token")) ||
  (typeof localStorage !== "undefined" && localStorage.getItem("token")) || "";

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

const getVideoUrl = (item, inspeccionId) => {
  if (!item) return "";
  if (typeof item === "string") return item;
  if (item.filename) {
    const base = getApiBase();
    const token = getStoredToken();
    return `${base}/api/inspeccion-recepcion/${inspeccionId}/video-file/${item.filename}?token=${encodeURIComponent(token)}`;
  }
  return item.url || "";
};

const CochesEntregadosPage = () => {
  const { actions } = useContext(Context);
  const navigate = useNavigate();
  const [inspecciones, setInspecciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detalle, setDetalle] = useState(null);
  const [loadingDetalle, setLoadingDetalle] = useState(false);

  const [busqueda, setBusqueda] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  const cargarInspecciones = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await actions.getMisInspecciones();
      setInspecciones(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "No se pudieron cargar los coches entregados");
    } finally {
      setLoading(false);
    }
  }, [actions]);

  useEffect(() => {
    cargarInspecciones();
  }, [cargarInspecciones]);

  const entregados = useMemo(() => {
    const term = busqueda.trim().toLowerCase();
    const from = fechaDesde ? new Date(`${fechaDesde}T00:00:00`) : null;
    const to = fechaHasta ? new Date(`${fechaHasta}T23:59:59`) : null;

    return inspecciones
      .filter((item) => item.entregado)
      .filter((item) => {
        const texto = `${item.cliente_nombre || ""} ${item.coche_descripcion || ""} ${item.matricula || ""}`.toLowerCase();
        return term ? texto.includes(term) : true;
      })
      .filter((item) => {
        if (!from && !to) return true;
        const fecha = new Date(item.fecha_entrega || item.updated_at || item.fecha_inspeccion || 0);
        if (Number.isNaN(fecha.getTime())) return false;
        if (from && fecha < from) return false;
        if (to && fecha > to) return false;
        return true;
      })
      .sort((a, b) => new Date(b.fecha_entrega || b.updated_at || 0) - new Date(a.fecha_entrega || a.updated_at || 0));
  }, [inspecciones, busqueda, fechaDesde, fechaHasta]);

  const stats = useMemo(() => {
    const total = entregados.length;
    const kmValues = entregados.map((item) => parseKm(item.kilometros)).filter((v) => v !== null);
    const kmPromedio = kmValues.length > 0
      ? Math.round(kmValues.reduce((acc, n) => acc + n, 0) / kmValues.length)
      : 0;

    const hoy = new Date();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const entregadosMes = entregados.filter((item) => {
      const fecha = new Date(item.fecha_entrega || item.updated_at || 0);
      return !Number.isNaN(fecha.getTime()) && fecha >= inicioMes;
    }).length;

    return { total, kmPromedio, entregadosMes };
  }, [entregados]);

  const limpiarFiltros = () => {
    setBusqueda("");
    setFechaDesde("");
    setFechaHasta("");
  };

  const usarMesActual = () => {
    const hoy = new Date();
    setFechaDesde(toDateInputValue(new Date(hoy.getFullYear(), hoy.getMonth(), 1)));
    setFechaHasta(toDateInputValue(hoy));
  };

  const editarInspeccion = (id) => {
    navigate(`/inspeccion-recepcion?editId=${id}`);
  };

  const verInspeccion = async (id) => {
    try {
      setLoadingDetalle(true);
      const data = await actions.getInspeccion(id);
      setDetalle(data || null);
    } catch (err) {
      setError(err?.message || "No se pudo cargar el detalle de inspección");
    } finally {
      setLoadingDetalle(false);
    }
  };

  const eliminarInspeccion = async (item) => {
    const confirmado = window.confirm(
      `Vas a eliminar la inspeccion #${item.id} de ${item.cliente_nombre || "cliente"}.\n\nEsta accion no se puede deshacer.\n\n¿Deseas continuar?`
    );
    if (!confirmado) return;

    try {
      await actions.eliminarInspeccion(item.id);
      await cargarInspecciones();
    } catch (err) {
      setError(err?.message || "No se pudo eliminar la inspeccion.");
    }
  };

  /* ── SVG icons ── */
  const ICONS = {
    car: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" rx="2"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>),
    search: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>),
    refresh: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4v5h5M20 20v-5h-5M4 9a9 9 0 0115.454-3.454M20 15a9 9 0 01-15.454 3.454"/></svg>),
    eye: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12S5 4 12 4s11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>),
    pen: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>),
    trash: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>),
    pdf: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>),
    check: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>),
    close: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>),
    calendar: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>),
    km: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>),
  };

  return (
    <div className="sw-ent-wrapper">

      {/* ── Hero ── */}
      <div className="sw-veh-hero">
        <div className="sw-veh-hero-inner container">
          <div className="sw-veh-hero-body">
            <div className="sw-veh-hero-icon">
              <span style={{ width: 24, height: 24, display: "flex" }}>{ICONS.car}</span>
            </div>
            <div style={{ flex: 1 }}>
              <p className="sw-home-eyebrow" style={{ marginBottom: "0.2rem" }}>Taller · Historial</p>
              <h1 className="sw-veh-hero-title">Coches Entregados</h1>
              <p className="sw-veh-hero-sub">Registro histórico de vehículos entregados al cliente</p>
            </div>
            <button
              className="sw-ent-submit-btn"
              onClick={cargarInspecciones}
              style={{ padding: "0.6rem 1.4rem", display: "flex", alignItems: "center", gap: "0.45rem" }}
            >
              <span style={{ width: 16, height: 16, display: "inline-flex" }}>{ICONS.refresh}</span>
              Actualizar
            </button>
          </div>
        </div>
      </div>

      <div className="container sw-ent-content" style={{ maxWidth: 1100 }}>

        {/* ── Error ── */}
        {error && (
          <div style={{
            background: "color-mix(in srgb,var(--sw-danger,#ef4444) 12%,transparent)",
            border: "1px solid color-mix(in srgb,var(--sw-danger,#ef4444) 30%,transparent)",
            color: "var(--sw-danger,#ef4444)", borderRadius: 12, padding: "0.75rem 1rem",
            display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.9rem",
          }}>
            {error}
            <button onClick={() => setError("")} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", display: "flex" }}>
              <span style={{ width: 18, height: 18, display: "flex" }}>{ICONS.close}</span>
            </button>
          </div>
        )}

        {/* ── Stats ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: "1rem" }}>
          {[
            { label: "Filtrados",        value: stats.total,                             color: "var(--sw-accent,#d4af37)" },
            { label: "Este mes",         value: stats.entregadosMes,                     color: "#22c55e" },
            { label: "Km promedio",      value: `${stats.kmPromedio.toLocaleString("es-ES")} km`, color: "#38bdf8" },
          ].map((item) => (
            <div key={item.label} style={{
              background: "var(--sw-surface)", border: "1px solid var(--sw-border)",
              borderRadius: 14, padding: "1rem 1.25rem", display: "flex", flexDirection: "column", gap: "0.25rem",
            }}>
              <span style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--sw-muted)" }}>{item.label}</span>
              <span style={{ fontSize: "1.4rem", fontWeight: 800, color: item.color, lineHeight: 1.2 }}>{item.value}</span>
            </div>
          ))}
        </div>

        {/* ── Filtros ── */}
        <div className="sw-ent-card">
          <div className="sw-ent-card-header">
            <div className="sw-ent-card-header-icon" style={{ background: "rgba(212,175,55,0.1)", border: "1px solid rgba(212,175,55,0.22)", color: "var(--sw-accent,#d4af37)" }}>
              <span style={{ width: 18, height: 18, display: "flex" }}>{ICONS.search}</span>
            </div>
            <div>
              <p className="sw-ent-card-eyebrow">Búsqueda</p>
              <h2 className="sw-ent-card-title">Filtrar entregados</h2>
            </div>
          </div>
          <div className="sw-ent-card-body">
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end" }}>
              {/* Búsqueda */}
              <div style={{ position: "relative", flex: "2 1 220px", minWidth: 200 }}>
                <span style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", width: 16, height: 16, color: "var(--sw-muted)", display: "flex", pointerEvents: "none" }}>{ICONS.search}</span>
                <input
                  className="form-control sw-pinput"
                  style={{ paddingLeft: "2.2rem" }}
                  placeholder="Cliente, coche o matrícula…"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                />
              </div>
              {/* Desde */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", flex: "1 1 140px", minWidth: 130 }}>
                <span style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--sw-muted)" }}>Desde</span>
                <input
                  type="date"
                  className="form-control sw-pinput"
                  value={fechaDesde}
                  onChange={(e) => setFechaDesde(e.target.value)}
                />
              </div>
              {/* Hasta */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", flex: "1 1 140px", minWidth: 130 }}>
                <span style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--sw-muted)" }}>Hasta</span>
                <input
                  type="date"
                  className="form-control sw-pinput"
                  value={fechaHasta}
                  onChange={(e) => setFechaHasta(e.target.value)}
                />
              </div>
              {/* Botones */}
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <button
                  onClick={usarMesActual}
                  style={{
                    background: "color-mix(in srgb,#38bdf8 12%,transparent)",
                    border: "1px solid color-mix(in srgb,#38bdf8 30%,transparent)",
                    color: "#38bdf8", borderRadius: 10, padding: "0.55rem 1rem",
                    cursor: "pointer", fontWeight: 600, fontSize: "0.82rem",
                    display: "flex", alignItems: "center", gap: "0.35rem",
                  }}
                >
                  <span style={{ width: 13, height: 13, display: "flex" }}>{ICONS.calendar}</span>
                  Mes actual
                </button>
                <button
                  onClick={limpiarFiltros}
                  style={{
                    background: "var(--sw-surface-2)", border: "1px solid var(--sw-border)",
                    color: "var(--sw-muted)", borderRadius: 10, padding: "0.55rem 1rem",
                    cursor: "pointer", fontWeight: 600, fontSize: "0.82rem",
                  }}
                >
                  Limpiar
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Tabla ── */}
        <div style={{
          background: "var(--sw-surface)", border: "1px solid var(--sw-border)",
          borderRadius: 16, overflow: "hidden",
          boxShadow: "0 4px 20px rgba(0,0,0,0.18)",
        }}>
          <div className="table-responsive">
            <table className="table align-middle mb-0" style={{ color: "var(--sw-text)" }}>
              <thead>
                <tr style={{ background: "var(--sw-surface-2)", borderBottom: "2px solid var(--sw-border)" }}>
                  {["#", "Fecha entrega", "Cliente", "Coche", "Matrícula", "Km", ""].map((h) => (
                    <th key={h} style={{
                      padding: "0.85rem 1rem", fontSize: "0.65rem", fontWeight: 700,
                      letterSpacing: "0.08em", textTransform: "uppercase",
                      color: "var(--sw-muted)", border: "none",
                      textAlign: h === "Km" || h === "" ? "right" : "left",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: "3.5rem", color: "var(--sw-muted)" }}>
                      <div className="spinner-border spinner-border-sm me-2" style={{ color: "var(--sw-accent,#d4af37)" }} />
                      Cargando…
                    </td>
                  </tr>
                )}
                {!loading && entregados.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: "3.5rem", color: "var(--sw-muted)", fontSize: "0.9rem" }}>
                      No hay coches entregados con esos filtros.
                    </td>
                  </tr>
                )}
                {!loading && entregados.map((item) => (
                  <tr
                    key={item.id}
                    style={{ borderBottom: "1px solid var(--sw-border)", transition: "background 0.15s" }}
                    onMouseEnter={e => e.currentTarget.style.background = "color-mix(in srgb,var(--sw-accent,#d4af37) 5%,transparent)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <td style={{ padding: "0.85rem 1rem", color: "var(--sw-muted)", fontSize: "0.78rem", fontWeight: 600 }}>
                      {item.id}
                    </td>
                    <td style={{ padding: "0.85rem 1rem", color: "var(--sw-text)", fontSize: "0.85rem" }}>
                      {formatFecha(item.fecha_entrega || item.updated_at)}
                    </td>
                    <td style={{ padding: "0.85rem 1rem", fontWeight: 700, color: "var(--sw-text)" }}>
                      {item.cliente_nombre || "-"}
                    </td>
                    <td style={{ padding: "0.85rem 1rem", color: "var(--sw-muted)", fontSize: "0.85rem" }}>
                      {item.coche_descripcion || "-"}
                    </td>
                    <td style={{ padding: "0.85rem 1rem" }}>
                      {item.matricula ? (
                        <span style={{
                          background: "color-mix(in srgb,var(--sw-accent,#d4af37) 12%,transparent)",
                          border: "1px solid color-mix(in srgb,var(--sw-accent,#d4af37) 30%,transparent)",
                          color: "var(--sw-accent,#d4af37)", borderRadius: 6,
                          padding: "0.15rem 0.6rem", fontWeight: 700, fontSize: "0.78rem", letterSpacing: "0.05em",
                        }}>{item.matricula}</span>
                      ) : <span style={{ color: "var(--sw-muted)", fontStyle: "italic" }}>—</span>}
                    </td>
                    <td style={{ padding: "0.85rem 1rem", textAlign: "right", color: "var(--sw-muted)", fontSize: "0.85rem" }}>
                      {parseKm(item.kilometros) != null
                        ? <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                            <span style={{ width: 13, height: 13, display: "inline-flex", opacity: 0.6 }}>{ICONS.km}</span>
                            {parseKm(item.kilometros).toLocaleString("es-ES")}
                          </span>
                        : <span style={{ fontStyle: "italic", opacity: 0.5 }}>—</span>}
                    </td>
                    <td style={{ padding: "0.85rem 1rem", textAlign: "right" }}>
                      <div style={{ display: "flex", gap: "0.4rem", justifyContent: "flex-end", flexWrap: "wrap" }}>
                        {/* Ver hoja firmada */}
                        <Link
                          to={`/acta-entrega/${item.id}`}
                          title="Ver hoja firmada"
                          style={{
                            background: "color-mix(in srgb,#22c55e 12%,transparent)",
                            border: "1px solid color-mix(in srgb,#22c55e 30%,transparent)",
                            color: "#22c55e", borderRadius: 8,
                            padding: "0.35rem 0.55rem", cursor: "pointer", display: "flex", alignItems: "center", textDecoration: "none",
                          }}
                        >
                          <span style={{ width: 14, height: 14, display: "flex" }}>{ICONS.check}</span>
                        </Link>
                        {/* PDF */}
                        <a
                          href={`/acta-entrega/${item.id}?print=1`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Descargar PDF"
                          style={{
                            background: "color-mix(in srgb,#f87171 12%,transparent)",
                            border: "1px solid color-mix(in srgb,#f87171 30%,transparent)",
                            color: "#f87171", borderRadius: 8,
                            padding: "0.35rem 0.55rem", cursor: "pointer", display: "flex", alignItems: "center", textDecoration: "none",
                          }}
                        >
                          <span style={{ width: 14, height: 14, display: "flex" }}>{ICONS.pdf}</span>
                        </a>
                        {/* Editar */}
                        <button
                          onClick={() => editarInspeccion(item.id)}
                          title="Editar"
                          style={{
                            background: "color-mix(in srgb,var(--sw-accent,#d4af37) 12%,transparent)",
                            border: "1px solid color-mix(in srgb,var(--sw-accent,#d4af37) 30%,transparent)",
                            color: "var(--sw-accent,#d4af37)", borderRadius: 8,
                            padding: "0.35rem 0.55rem", cursor: "pointer", display: "flex", alignItems: "center",
                          }}
                        >
                          <span style={{ width: 14, height: 14, display: "flex" }}>{ICONS.pen}</span>
                        </button>
                        {/* Ver inspección */}
                        <button
                          onClick={() => verInspeccion(item.id)}
                          disabled={loadingDetalle}
                          title="Ver inspección"
                          style={{
                            background: "color-mix(in srgb,#38bdf8 12%,transparent)",
                            border: "1px solid color-mix(in srgb,#38bdf8 30%,transparent)",
                            color: "#38bdf8", borderRadius: 8,
                            padding: "0.35rem 0.55rem", cursor: "pointer", display: "flex", alignItems: "center",
                            opacity: loadingDetalle ? 0.5 : 1,
                          }}
                        >
                          <span style={{ width: 14, height: 14, display: "flex" }}>{ICONS.eye}</span>
                        </button>
                        {/* Eliminar */}
                        <button
                          onClick={() => eliminarInspeccion(item)}
                          title="Eliminar"
                          style={{
                            background: "color-mix(in srgb,var(--sw-danger,#ef4444) 10%,transparent)",
                            border: "1px solid color-mix(in srgb,var(--sw-danger,#ef4444) 28%,transparent)",
                            color: "var(--sw-danger,#ef4444)", borderRadius: 8,
                            padding: "0.35rem 0.55rem", cursor: "pointer", display: "flex", alignItems: "center",
                          }}
                        >
                          <span style={{ width: 14, height: 14, display: "flex" }}>{ICONS.trash}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
            borderRadius: 20, width: "100%", maxWidth: 680, maxHeight: "90vh", overflowY: "auto",
            boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
            animation: "sw-fade-up 0.22s ease both",
          }}>
            {/* Header modal */}
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
                  <span style={{ width: 18, height: 18, display: "flex" }}>{ICONS.car}</span>
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
              <button
                onClick={() => setDetalle(null)}
                style={{ background: "none", border: "none", color: "var(--sw-muted)", cursor: "pointer", padding: "0.25rem", borderRadius: 6, display: "flex" }}
              >
                <span style={{ width: 20, height: 20, display: "flex" }}>{ICONS.close}</span>
              </button>
            </div>

            {/* Body modal */}
            <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>

              {/* Datos recepción */}
              <div style={{ background: "var(--sw-surface-2)", border: "1px solid var(--sw-border)", borderRadius: 14, padding: "1.25rem" }}>
                <p style={{ margin: "0 0 0.75rem", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--sw-accent,#d4af37)" }}>
                  Datos de la recepción
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: "0.6rem" }}>
                  {[
                    { label: "Cliente", value: detalle.cliente_nombre },
                    { label: "Teléfono", value: detalle.cliente_telefono },
                    { label: "Coche", value: detalle.coche_descripcion },
                    { label: "Fecha inspección", value: formatFecha(detalle.fecha_inspeccion) },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <span style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--sw-muted)" }}>{label}</span>
                      <p style={{ margin: "0.15rem 0 0", fontWeight: 600, color: "var(--sw-text)", fontSize: "0.9rem" }}>{value || "—"}</p>
                    </div>
                  ))}
                  {detalle.averias_notas && (
                    <div style={{ gridColumn: "1/-1" }}>
                      <span style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--sw-muted)" }}>Observaciones</span>
                      <p style={{ margin: "0.15rem 0 0", color: "var(--sw-text)", fontSize: "0.88rem" }}>{detalle.averias_notas}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Fotos */}
              {Array.isArray(detalle.fotos_cloudinary) && detalle.fotos_cloudinary.length > 0 && (
                <div>
                  <p style={{ margin: "0 0 0.75rem", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--sw-accent,#d4af37)" }}>
                    Fotos de inspección ({detalle.fotos_cloudinary.length})
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

              {/* Videos */}
              {Array.isArray(detalle.videos_cloudinary) && detalle.videos_cloudinary.length > 0 && (
                <div>
                  <p style={{ margin: "0 0 0.75rem", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--sw-accent,#d4af37)" }}>
                    Vídeos de inspección ({detalle.videos_cloudinary.length})
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

            </div>

            {/* Footer modal */}
            <div style={{ padding: "1rem 1.5rem", borderTop: "1px solid var(--sw-border)", display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
              <Link
                to={`/acta-entrega/${detalle.id}`}
                style={{
                  background: "color-mix(in srgb,#22c55e 14%,transparent)",
                  border: "1px solid color-mix(in srgb,#22c55e 32%,transparent)",
                  color: "#22c55e", borderRadius: 10, padding: "0.6rem 1.2rem",
                  fontWeight: 700, fontSize: "0.85rem", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "0.4rem",
                }}
              >
                <span style={{ width: 14, height: 14, display: "flex" }}>{ICONS.check}</span>
                Hoja firmada
              </Link>
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
    </div>
  );
};

export default CochesEntregadosPage;
