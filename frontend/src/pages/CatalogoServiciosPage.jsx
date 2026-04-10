import React, { useEffect, useState, useCallback } from "react";
import { confirmar } from "../utils/confirmar";
import { toast } from "../utils/toast";
import { apiFetch } from "../utils/apiFetch";

/* ── Iconos SVG ─────────────────────────────────────────────────── */
const ICONS = {
  catalogo: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>),
  plus:     (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>),
  search:   (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>),
  pen:      (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>),
  trash:    (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>),
  clock:    (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>),
  close:    (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>),
  save:     (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>),
  pause:    (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>),
  play:     (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>),
};

const EMPTY_FORM = {
  nombre: "",
  descripcion: "",
  precio_base: "",
  tiempo_estimado_minutos: "",
  rol_responsable: "detailing",
};

const ROLE_OPTIONS = [
  { value: "detailing", label: "Detailing",  color: "#38bdf8" },
  { value: "pintura",   label: "Pintura",    color: "#f87171" },
  { value: "tapicero",  label: "Tapicería",  color: "#fbbf24" },
  { value: "calidad",   label: "Calidad",    color: "#34d399" },
  { value: "otro",      label: "Otro",       color: "#a78bfa" },
];

const getRoleColor = (role) =>
  ROLE_OPTIONS.find((r) => r.value === role)?.color || "#a78bfa";

const getRoleLabel = (role) =>
  ROLE_OPTIONS.find((r) => r.value === role)?.label || "Otro";

export default function CatalogoServiciosPage() {
  const [servicios, setServicios]     = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState("");
  const [form, setForm]               = useState(EMPTY_FORM);
  const [editandoId, setEditandoId]   = useState(null);
  const [showModal, setShowModal]     = useState(false);
  const [saving, setSaving]           = useState(false);
  const [modalError, setModalError]   = useState("");
  const [filtro, setFiltro]           = useState("");
  const [soloActivos, setSoloActivos] = useState(false);

  /* ── Cargar ──────────────────────────────────────────────────── */
  const cargar = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch("/api/servicios_catalogo");
      setServicios(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || "Error al cargar servicios");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  /* ── Filtrado ────────────────────────────────────────────────── */
  const serviciosFiltrados = servicios.filter((s) => {
    const term = filtro.trim().toLowerCase();
    if (soloActivos && !s.activo) return false;
    if (!term) return true;
    return (
      (s.nombre || "").toLowerCase().includes(term) ||
      (s.descripcion || "").toLowerCase().includes(term)
    );
  });

  /* ── Modal helpers ───────────────────────────────────────────── */
  const abrirCrear = () => {
    setEditandoId(null);
    setForm(EMPTY_FORM);
    setModalError("");
    setShowModal(true);
  };

  const abrirEditar = (s) => {
    setEditandoId(s.id);
    setForm({
      nombre: s.nombre || "",
      descripcion: s.descripcion || "",
      precio_base: s.precio_base != null ? String(s.precio_base) : "",
      tiempo_estimado_minutos: s.tiempo_estimado_minutos != null ? String(s.tiempo_estimado_minutos) : "",
      rol_responsable: s.rol_responsable || "detailing",
    });
    setModalError("");
    setShowModal(true);
  };

  const cerrarModal = () => {
    setShowModal(false);
    setEditandoId(null);
    setForm(EMPTY_FORM);
    setModalError("");
  };

  /* ── CRUD ────────────────────────────────────────────────────── */
  const guardar = async (e) => {
    e.preventDefault();
    const nombre = form.nombre.trim();
    if (!nombre) { setModalError("El nombre es obligatorio."); return; }
    const tiempo = Number.parseInt(String(form.tiempo_estimado_minutos ?? "").trim(), 10);
    if (!Number.isFinite(tiempo) || tiempo <= 0) {
      setModalError("El tiempo estimado es obligatorio y debe ser mayor que 0 minutos.");
      return;
    }
    setSaving(true);
    setModalError("");
    try {
      const payload = {
        nombre,
        descripcion: form.descripcion.trim() || null,
        precio_base: form.precio_base !== "" ? parseFloat(form.precio_base) : null,
        tiempo_estimado_minutos: tiempo,
        rol_responsable: String(form.rol_responsable || "").trim() || null,
      };
      if (editandoId) {
        await apiFetch(`/api/servicios_catalogo/${editandoId}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await apiFetch("/api/servicios_catalogo", { method: "POST", body: JSON.stringify(payload) });
      }
      toast.success(editandoId ? "Servicio actualizado" : "Servicio creado");
      await cargar();
      cerrarModal();
    } catch (e) {
      setModalError(e.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const toggleActivo = async (s) => {
    try {
      await apiFetch(`/api/servicios_catalogo/${s.id}`, { method: "PUT", body: JSON.stringify({ activo: !s.activo }) });
      await cargar();
    } catch (e) {
      setError(e.message || "Error al cambiar estado");
    }
  };

  const eliminar = async (s) => {
    if (!await confirmar(`¿Eliminar el servicio "${s.nombre}"?`)) return;
    try {
      await apiFetch(`/api/servicios_catalogo/${s.id}`, { method: "DELETE" });
      toast.success("Servicio eliminado");
      await cargar();
    } catch (e) {
      setError(e.message || "Error al eliminar");
    }
  };

  /* ── Render ──────────────────────────────────────────────────── */
  return (
    <div className="sw-ent-wrapper">

      {/* ── Hero ──────────────────────────────────────────────────── */}
      <div className="sw-veh-hero">
        <div className="sw-veh-hero-inner container">
          <div className="sw-veh-hero-body">
            <div className="sw-veh-hero-icon">
              <span style={{ width: 24, height: 24, display: "flex" }}>{ICONS.catalogo}</span>
            </div>
            <div style={{ flex: 1 }}>
              <p className="sw-home-eyebrow" style={{ marginBottom: "0.2rem" }}>Taller · Configuración</p>
              <h1 className="sw-veh-hero-title">Catálogo de Servicios</h1>
              <p className="sw-veh-hero-sub">Gestión de servicios disponibles, precios y tiempos estimados</p>
            </div>
            <button
              className="sw-ent-submit-btn"
              onClick={abrirCrear}
              style={{ padding: "0.6rem 1.4rem", display: "flex", alignItems: "center", gap: "0.45rem" }}
            >
              <span style={{ width: 16, height: 16, display: "inline-flex" }}>{ICONS.plus}</span>
              Nuevo servicio
            </button>
          </div>
        </div>
      </div>

      <div className="container sw-ent-content" style={{ maxWidth: 1100 }}>

        {/* ── Error ─────────────────────────────────────────────── */}
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

        {/* ── Stats ─────────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: "1rem" }}>
          {[
            { label: "Total",    value: servicios.length,                           color: "var(--sw-accent,#d4af37)" },
            { label: "Activos",  value: servicios.filter(s => s.activo).length,    color: "#22c55e" },
            { label: "Inactivos",value: servicios.filter(s => !s.activo).length,   color: "var(--sw-muted)" },
            { label: "Filtrados",value: serviciosFiltrados.length,                  color: "#38bdf8" },
          ].map((item) => (
            <div key={item.label} style={{
              background: "var(--sw-surface)", border: "1px solid var(--sw-border)",
              borderRadius: 14, padding: "1rem 1.25rem", display: "flex", flexDirection: "column", gap: "0.25rem",
            }}>
              <span style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--sw-muted)" }}>{item.label}</span>
              <span style={{ fontSize: "1.5rem", fontWeight: 800, color: item.color, lineHeight: 1.2 }}>{item.value}</span>
            </div>
          ))}
        </div>

        {/* ── Filtros ───────────────────────────────────────────── */}
        <div className="sw-ent-card">
          <div className="sw-ent-card-header">
            <div className="sw-ent-card-header-icon" style={{ background: "rgba(212,175,55,0.1)", border: "1px solid rgba(212,175,55,0.22)", color: "var(--sw-accent,#d4af37)" }}>
              <span style={{ width: 18, height: 18, display: "flex" }}>{ICONS.search}</span>
            </div>
            <div>
              <p className="sw-ent-card-eyebrow">Búsqueda</p>
              <h2 className="sw-ent-card-title">Filtrar servicios</h2>
            </div>
          </div>
          <div className="sw-ent-card-body">
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
                <span style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", width: 16, height: 16, color: "var(--sw-muted)", display: "flex", pointerEvents: "none" }}>{ICONS.search}</span>
                <input
                  className="form-control sw-pinput"
                  style={{ paddingLeft: "2.2rem" }}
                  placeholder="Buscar por nombre o descripción…"
                  value={filtro}
                  onChange={(e) => setFiltro(e.target.value)}
                />
              </div>
              {/* Toggle solo activos */}
              <div
                style={{
                  display: "flex", alignItems: "center", gap: "0.5rem",
                  cursor: "pointer", userSelect: "none",
                  padding: "0.55rem 1rem",
                  background: soloActivos ? "color-mix(in srgb,#22c55e 12%,transparent)" : "var(--sw-surface-2)",
                  border: `1px solid ${soloActivos ? "color-mix(in srgb,#22c55e 35%,transparent)" : "var(--sw-border)"}`,
                  borderRadius: 10, transition: "all 0.2s",
                }}
                onClick={() => setSoloActivos(v => !v)}
              >
                <div style={{
                  width: 32, height: 18, borderRadius: 9, transition: "background 0.2s",
                  background: soloActivos ? "#22c55e" : "var(--sw-border)", position: "relative", flexShrink: 0,
                }}>
                  <div style={{
                    width: 12, height: 12, borderRadius: "50%", background: "#fff",
                    position: "absolute", top: 3, left: soloActivos ? 17 : 3, transition: "left 0.2s",
                  }} />
                </div>
                <span style={{ fontSize: "0.82rem", fontWeight: 600, color: soloActivos ? "#22c55e" : "var(--sw-muted)" }}>
                  Solo activos
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Tabla ─────────────────────────────────────────────── */}
        <div style={{
          background: "var(--sw-surface)", border: "1px solid var(--sw-border)",
          borderRadius: 16, overflow: "hidden",
          boxShadow: "0 4px 20px rgba(0,0,0,0.18)",
        }}>
          <div className="table-responsive">
            <table className="table align-middle mb-0" style={{ color: "var(--sw-text)" }}>
              <thead>
                <tr style={{ background: "var(--sw-surface-2)", borderBottom: "2px solid var(--sw-border)" }}>
                  {["#", "Nombre", "Descripción", "Precio base", "Tiempo", "Rol", "Estado", ""].map((h) => (
                    <th key={h} style={{
                      padding: "0.85rem 1rem", fontSize: "0.65rem", fontWeight: 700,
                      letterSpacing: "0.08em", textTransform: "uppercase",
                      color: "var(--sw-muted)", border: "none",
                      textAlign: h === "Precio base" || h === "Tiempo" || h === "" ? "right" : "left",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", padding: "3.5rem", color: "var(--sw-muted)" }}>
                      <div className="spinner-border spinner-border-sm me-2" style={{ color: "var(--sw-accent,#d4af37)" }} />
                      Cargando…
                    </td>
                  </tr>
                )}
                {!loading && serviciosFiltrados.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", padding: "3.5rem", color: "var(--sw-muted)", fontSize: "0.9rem" }}>
                      {filtro ? "No hay servicios que coincidan con la búsqueda." : "No hay servicios en el catálogo."}
                    </td>
                  </tr>
                )}
                {!loading && serviciosFiltrados.map((s) => {
                  const roleColor = getRoleColor(s.rol_responsable);
                  return (
                    <tr
                      key={s.id}
                      style={{
                        borderBottom: "1px solid var(--sw-border)",
                        opacity: s.activo ? 1 : 0.5,
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = "color-mix(in srgb,var(--sw-accent,#d4af37) 5%,transparent)"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                      <td style={{ padding: "0.85rem 1rem", color: "var(--sw-muted)", fontSize: "0.78rem", fontWeight: 600 }}>
                        {s.id}
                      </td>
                      <td style={{ padding: "0.85rem 1rem", fontWeight: 700, color: "var(--sw-text)" }}>
                        {s.nombre}
                      </td>
                      <td style={{ padding: "0.85rem 1rem", color: "var(--sw-muted)", fontSize: "0.85rem", maxWidth: 220 }}>
                        <span style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                          {s.descripcion || <span style={{ fontStyle: "italic", opacity: 0.5 }}>—</span>}
                        </span>
                      </td>
                      <td style={{ padding: "0.85rem 1rem", textAlign: "right", fontWeight: 700, color: "var(--sw-accent,#d4af37)" }}>
                        {s.precio_base != null
                          ? `${Number(s.precio_base).toFixed(2)} €`
                          : <span style={{ fontStyle: "italic", color: "var(--sw-muted)", fontWeight: 400 }}>—</span>}
                      </td>
                      <td style={{ padding: "0.85rem 1rem", textAlign: "right" }}>
                        {s.tiempo_estimado_minutos != null ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", color: "var(--sw-muted)", fontSize: "0.85rem" }}>
                            <span style={{ width: 13, height: 13, display: "inline-flex", opacity: 0.6 }}>{ICONS.clock}</span>
                            {Number(s.tiempo_estimado_minutos)} min
                          </span>
                        ) : <span style={{ fontStyle: "italic", color: "var(--sw-muted)", opacity: 0.5 }}>—</span>}
                      </td>
                      <td style={{ padding: "0.85rem 1rem" }}>
                        <span style={{
                          background: `color-mix(in srgb,${roleColor} 14%,transparent)`,
                          border: `1px solid color-mix(in srgb,${roleColor} 32%,transparent)`,
                          color: roleColor, borderRadius: 6,
                          padding: "0.15rem 0.6rem", fontWeight: 700, fontSize: "0.72rem",
                        }}>
                          {getRoleLabel(s.rol_responsable)}
                        </span>
                      </td>
                      <td style={{ padding: "0.85rem 1rem" }}>
                        <span style={{
                          background: s.activo ? "color-mix(in srgb,#22c55e 12%,transparent)" : "color-mix(in srgb,var(--sw-muted) 10%,transparent)",
                          border: `1px solid ${s.activo ? "color-mix(in srgb,#22c55e 28%,transparent)" : "color-mix(in srgb,var(--sw-muted) 22%,transparent)"}`,
                          color: s.activo ? "#22c55e" : "var(--sw-muted)",
                          borderRadius: 6, padding: "0.15rem 0.6rem",
                          fontWeight: 700, fontSize: "0.72rem",
                        }}>
                          {s.activo ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td style={{ padding: "0.85rem 1rem", textAlign: "right" }}>
                        <div style={{ display: "flex", gap: "0.4rem", justifyContent: "flex-end" }}>
                          <button
                            onClick={() => abrirEditar(s)}
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
                          <button
                            onClick={() => toggleActivo(s)}
                            title={s.activo ? "Desactivar" : "Activar"}
                            style={{
                              background: s.activo
                                ? "color-mix(in srgb,#f59e0b 12%,transparent)"
                                : "color-mix(in srgb,#22c55e 12%,transparent)",
                              border: s.activo
                                ? "1px solid color-mix(in srgb,#f59e0b 30%,transparent)"
                                : "1px solid color-mix(in srgb,#22c55e 30%,transparent)",
                              color: s.activo ? "#f59e0b" : "#22c55e",
                              borderRadius: 8, padding: "0.35rem 0.55rem",
                              cursor: "pointer", display: "flex", alignItems: "center",
                            }}
                          >
                            <span style={{ width: 14, height: 14, display: "flex" }}>{s.activo ? ICONS.pause : ICONS.play}</span>
                          </button>
                          <button
                            onClick={() => eliminar(s)}
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
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* ── Modal crear / editar ───────────────────────────────────── */}
      {showModal && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 1050,
            background: "var(--sw-overlay-bg,rgba(0,0,0,0.55))",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "1rem", backdropFilter: "blur(4px)",
          }}
          onClick={(e) => { if (e.target === e.currentTarget) cerrarModal(); }}
        >
          <div style={{
            background: "var(--sw-surface)", border: "1px solid var(--sw-border)",
            borderRadius: 20, width: "100%", maxWidth: 560,
            boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
            animation: "sw-fade-up 0.22s ease both",
          }}>
            {/* Header */}
            <div style={{
              padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--sw-border)",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <span style={{
                  width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
                  background: "color-mix(in srgb,var(--sw-accent,#d4af37) 14%,transparent)",
                  border: "1px solid color-mix(in srgb,var(--sw-accent,#d4af37) 28%,transparent)",
                  color: "var(--sw-accent,#d4af37)",
                }}>
                  <span style={{ width: 18, height: 18, display: "flex" }}>{editandoId ? ICONS.pen : ICONS.plus}</span>
                </span>
                <div>
                  <p style={{ margin: 0, fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--sw-muted)" }}>
                    {editandoId ? "Modificar servicio" : "Nuevo servicio"}
                  </p>
                  <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "var(--sw-text)" }}>
                    {editandoId ? "Editar servicio" : "Crear servicio"}
                  </h3>
                </div>
              </div>
              <button
                onClick={cerrarModal}
                style={{ background: "none", border: "none", color: "var(--sw-muted)", cursor: "pointer", padding: "0.25rem", borderRadius: 6, display: "flex" }}
              >
                <span style={{ width: 20, height: 20, display: "flex" }}>{ICONS.close}</span>
              </button>
            </div>

            {/* Body */}
            <form onSubmit={guardar}>
              <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
                {modalError && (
                  <div style={{
                    background: "color-mix(in srgb,var(--sw-danger,#ef4444) 12%,transparent)",
                    border: "1px solid color-mix(in srgb,var(--sw-danger,#ef4444) 30%,transparent)",
                    color: "var(--sw-danger,#ef4444)", borderRadius: 10, padding: "0.65rem 1rem", fontSize: "0.88rem",
                  }}>
                    {modalError}
                  </div>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  <label className="sw-plbl">Nombre *</label>
                  <input
                    className="form-control sw-pinput"
                    value={form.nombre}
                    onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                    placeholder="Ej.: Lavado interior completo"
                    autoFocus required
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  <label className="sw-plbl">Descripción</label>
                  <input
                    className="form-control sw-pinput"
                    value={form.descripcion}
                    onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                    placeholder="Descripción breve (opcional)"
                  />
                </div>

                <div className="sw-ent-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                    <label className="sw-plbl">Precio base (€)</label>
                    <input
                      className="form-control sw-pinput"
                      type="number" step="0.01" min="0"
                      value={form.precio_base}
                      onChange={(e) => setForm({ ...form, precio_base: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                    <label className="sw-plbl">Tiempo estimado (min) *</label>
                    <input
                      className="form-control sw-pinput"
                      type="number" step="1" min="1"
                      value={form.tiempo_estimado_minutos}
                      onChange={(e) => setForm({ ...form, tiempo_estimado_minutos: e.target.value })}
                      placeholder="Ej.: 60"
                      required
                    />
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  <label className="sw-plbl">Rol responsable *</label>
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    {ROLE_OPTIONS.map((role) => {
                      const sel = form.rol_responsable === role.value;
                      return (
                        <button
                          key={role.value}
                          type="button"
                          onClick={() => setForm({ ...form, rol_responsable: role.value })}
                          style={{
                            background: sel ? `color-mix(in srgb,${role.color} 16%,transparent)` : "var(--sw-surface-2)",
                            border: `1px solid ${sel ? `color-mix(in srgb,${role.color} 38%,transparent)` : "var(--sw-border)"}`,
                            color: sel ? role.color : "var(--sw-muted)",
                            borderRadius: 8, padding: "0.4rem 0.85rem",
                            fontWeight: 700, fontSize: "0.82rem", cursor: "pointer",
                            transition: "all 0.15s",
                          }}
                        >
                          {role.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div style={{
                padding: "1rem 1.5rem", borderTop: "1px solid var(--sw-border)",
                display: "flex", gap: "0.75rem", justifyContent: "flex-end",
              }}>
                <button
                  type="button" onClick={cerrarModal}
                  style={{
                    background: "transparent", border: "1px solid var(--sw-border)",
                    color: "var(--sw-text)", borderRadius: 10,
                    padding: "0.6rem 1.25rem", cursor: "pointer", fontWeight: 600, fontSize: "0.9rem",
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="sw-ent-submit-btn"
                  disabled={saving}
                  style={{ padding: "0.6rem 1.5rem", display: "flex", alignItems: "center", gap: "0.4rem" }}
                >
                  <span style={{ width: 15, height: 15, display: "inline-flex" }}>{ICONS.save}</span>
                  {saving ? "Guardando…" : editandoId ? "Guardar cambios" : "Crear servicio"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
