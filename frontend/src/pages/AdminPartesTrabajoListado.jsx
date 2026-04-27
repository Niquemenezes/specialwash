import React, { useCallback, useEffect, useState } from "react";
import { confirmar } from "../utils/confirmar";
import {
  listarPartesTrabajo,
  cambiarEstadoParte,
  quitarPausa,
  eliminarParteTrabajo,
  editarParteTrabajo,
  listarEmpleadosDisponibles,
  listarCochesCatalogo,
} from "../utils/parteTrabajoApi";
import CrearParteTrabajo from "../components/CrearParteTrabajo";

const PRIORIDAD_CONFIG = {
  0: { label: "Normal",       color: "#9ca3af", bg: "rgba(156,163,175,0.1)",  border: "rgba(156,163,175,0.25)", icon: "—" },
  1: { label: "Urgente",      color: "#f59e0b", bg: "rgba(245,158,11,0.12)",  border: "rgba(245,158,11,0.35)",  icon: "⚡" },
  2: { label: "Muy urgente",  color: "#ef4444", bg: "rgba(239,68,68,0.12)",   border: "rgba(239,68,68,0.35)",   icon: "🔴" },
};

function PrioridadBadge({ prioridad }) {
  const cfg = PRIORIDAD_CONFIG[prioridad] || PRIORIDAD_CONFIG[0];
  if (prioridad === 0) return null;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "0.3rem",
      padding: "0.15rem 0.55rem", borderRadius: "999px",
      fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.04em",
      background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color,
      whiteSpace: "nowrap",
    }}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

function EstadoBadge({ estado }) {
  const config = {
    pendiente:  { label: "Pendiente",  color: "#9ca3af", bg: "rgba(156,163,175,0.12)", border: "rgba(156,163,175,0.28)" },
    en_proceso: { label: "En proceso", color: "#f59e0b", bg: "rgba(245,158,11,0.12)",  border: "rgba(245,158,11,0.32)" },
    en_pausa:   { label: "En pausa",   color: "#818cf8", bg: "rgba(129,140,248,0.12)", border: "rgba(129,140,248,0.3)" },
    finalizado: { label: "Finalizado", color: "#4ade80", bg: "rgba(34,197,94,0.12)",   border: "rgba(34,197,94,0.28)" },
  };
  const { label, color, bg, border } = config[estado] || { label: estado, color: "#9ca3af", bg: "rgba(156,163,175,0.1)", border: "rgba(156,163,175,0.2)" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "0.35rem",
      padding: "0.2rem 0.65rem", borderRadius: "999px",
      fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.05em",
      background: bg, border: `1px solid ${border}`, color,
      whiteSpace: "nowrap",
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: color, flexShrink: 0 }} />
      {label}
    </span>
  );
}

function formatMinutes(minutes) {
  const total = Number.isFinite(Number(minutes)) ? Math.max(0, Number(minutes)) : 0;
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

function getTipoTareaLabel(tipoTarea) {
  const TIPO_TAREA_OPTIONS = [
    { value: "pintura", label: "Pintor / Pintura" },
    { value: "detailing", label: "Detailing / Lavado" },
    { value: "tapicero", label: "Tapicero / Tapicería" },
    { value: "otro", label: "Empleado general / Otro" },
  ];
  const normalized = tipoTarea === "tapiceria" ? "tapicero" : tipoTarea;
  return TIPO_TAREA_OPTIONS.find((item) => item.value === normalized)?.label || "Sin área";
}

export default function AdminPartesTrabajoListado() {
  const [partes, setPartes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [empleadoFiltro, setEmpleadoFiltro] = useState("");
  const [cocheFiltro, setCocheFiltro] = useState("");
  const [empleadosDisponibles, setEmpleadosDisponibles] = useState([]);
  const [cochesCatalogo, setCochesCatalogo] = useState([]);
  const [modalCrearAbierto, setModalCrearAbierto] = useState(false);

  const empleadoNombrePorId = useCallback(
    (id) => {
      const emp = empleadosDisponibles.find((u) => Number(u.id) === Number(id));
      return emp ? emp.nombre : `ID ${id}`;
    },
    [empleadosDisponibles]
  );

  const cocheTextoPorId = useCallback(
    (id) => {
      const coche = cochesCatalogo.find((c) => Number(c.coche_id) === Number(id));
      if (!coche) return `ID ${id}`;
      return `${coche.matricula}${coche.cliente_nombre ? ` - ${coche.cliente_nombre}` : ""}`;
    },
    [cochesCatalogo]
  );

  const groupByDate = (partesArray) => {
    const grupos = {};
    partesArray.forEach((p) => {
      const fecha = p.fecha_inicio ? new Date(p.fecha_inicio).toLocaleDateString("es-ES") : "Sin fecha";
      if (!grupos[fecha]) grupos[fecha] = [];
      grupos[fecha].push(p);
    });
    return Object.entries(grupos)
      .sort((a, b) => new Date(b[0]) - new Date(a[0]))
      .map(([fecha, lista]) => [fecha, [...lista].sort((a, b) => a.coche_id - b.coche_id)]);
  };

  const cargarPartes = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const todasLosPartes = await listarPartesTrabajo({
        empleado_id: empleadoFiltro,
        coche_id: cocheFiltro,
      });
      const activos = (Array.isArray(todasLosPartes) ? todasLosPartes : []).filter(
        (p) => p.estado !== "finalizado"
      );
      setPartes(activos);
    } catch (e) {
      setError(e?.message || "No se pudieron cargar los partes.");
      setPartes([]);
    } finally {
      setLoading(false);
    }
  }, [empleadoFiltro, cocheFiltro]);

  useEffect(() => {
    cargarPartes();
  }, [cargarPartes]);

  useEffect(() => {
    const iv = setInterval(() => cargarPartes(), 30000);
    return () => clearInterval(iv);
  }, [cargarPartes]);

  useEffect(() => {
    const cargarRecursos = async () => {
      try {
        const [empleados, cochesAll] = await Promise.all([
          listarEmpleadosDisponibles(),
          listarCochesCatalogo(),
        ]);
        setEmpleadosDisponibles(Array.isArray(empleados) ? empleados : []);
        setCochesCatalogo(Array.isArray(cochesAll) ? cochesAll : []);
      } catch (e) {
        setError(e?.message || "No se pudieron cargar recursos.");
      }
    };
    cargarRecursos();
  }, []);

  const onQuitarPausa = async (id) => {
    setError("");
    try {
      await quitarPausa(id);
      await cargarPartes();
    } catch (e) {
      setError(e?.message || "No se pudo quitar la pausa.");
    }
  };

  const onFinalizar = async (id) => {
    setError("");
    try {
      await cambiarEstadoParte(id, "finalizado");
      await cargarPartes();
    } catch (e) {
      setError(e?.message || "No se pudo finalizar el parte.");
    }
  };

  const onEliminarParte = async (parte) => {
    const confirmado = await confirmar(
      `Vas a eliminar el parte #${parte.id} (${parte.matricula || `coche ${parte.coche_id}`}). Esta acción no se puede deshacer.`
    );
    if (!confirmado) return;

    setError("");
    try {
      await eliminarParteTrabajo(parte.id);
      await cargarPartes();
    } catch (e) {
      setError(e?.message || "No se pudo eliminar el parte.");
    }
  };

  const onFinalizarGrupo = async (ids) => {
    setError("");
    try {
      for (const id of ids) await cambiarEstadoParte(id, "finalizado");
      await cargarPartes();
    } catch (e) {
      setError(e?.message || "No se pudo finalizar el grupo.");
    }
  };

  const onBorrarGrupo = async (partes) => {
    const matricula = partes[0]?.matricula || `coche ${partes[0]?.coche_id}`;
    const confirmado = await confirmar(
      `Vas a eliminar los ${partes.length} parte(s) de ${matricula}. Esta acción no se puede deshacer.`
    );
    if (!confirmado) return;
    setError("");
    try {
      for (const p of partes) await eliminarParteTrabajo(p.id);
      await cargarPartes();
    } catch (e) {
      setError(e?.message || "No se pudo eliminar el grupo.");
    }
  };

  const onReanudarGrupo = async (ids) => {
    setError("");
    try {
      for (const id of ids) await quitarPausa(id);
      await cargarPartes();
    } catch (e) {
      setError(e?.message || "No se pudo reanudar el grupo.");
    }
  };

  const [editandoAreaId, setEditandoAreaId] = useState(null);
  const [cambiandoPrioridadId, setCambiandoPrioridadId] = useState(null);

  const onCambiarPrioridad = async (parteId, prioridadActual) => {
    const siguiente = (prioridadActual + 1) % 3;
    setCambiandoPrioridadId(parteId);
    try {
      await editarParteTrabajo(parteId, { prioridad: siguiente });
      await cargarPartes();
    } catch (e) {
      setError(e?.message || "No se pudo cambiar la prioridad.");
    } finally {
      setCambiandoPrioridadId(null);
    }
  };

  const onCambiarArea = async (parteId, nuevoTipo) => {
    setError("");
    try {
      await editarParteTrabajo(parteId, { tipo_tarea: nuevoTipo });
      setEditandoAreaId(null);
      await cargarPartes();
    } catch (e) {
      setError(e?.message || "No se pudo cambiar el área.");
    }
  };

  return (
    <div className="sw-page-bg" style={{ minHeight: "calc(100vh - 56px)" }}>
      {/* HERO */}
      <div style={{ borderBottom: "1px solid color-mix(in srgb, var(--sw-accent) 15%, var(--sw-border))", padding: "1.75rem 0 1.5rem", animation: "sw-fade-up 0.4s ease both" }}>
        <div className="container" style={{ maxWidth: "1100px" }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "1.5rem", flexWrap: "wrap" }}>
            <div>
              <p style={{ fontSize: "0.73rem", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--sw-accent)", opacity: 0.85, marginBottom: "0.4rem" }}>
                Panel de gestión · SpecialWash
              </p>
              <h1 style={{ fontSize: "clamp(1.4rem, 3vw, 2rem)", fontWeight: 700, color: "var(--sw-text)", margin: 0, letterSpacing: "-0.01em" }}>
                Partes Activos
              </h1>
              <p style={{ fontSize: "0.85rem", color: "var(--sw-muted)", marginTop: "0.35rem", marginBottom: 0 }}>
                Seguimiento y finalización de servicios en curso
              </p>
            </div>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem", padding: "0.3rem 0.85rem 0.3rem 0.65rem", borderRadius: "999px", fontSize: "0.76rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", border: "1px solid rgba(34,197,94,0.4)", background: "rgba(34,197,94,0.07)", color: "#6ee7b7", whiteSpace: "nowrap" }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", animation: "sw-pulse-dot 2s ease-in-out infinite", flexShrink: 0 }} />
              {partes.filter(p => p.estado === "en_proceso").length} en proceso
            </span>
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div className="container py-4" style={{ maxWidth: "1100px" }}>
        {/* STATS */}
        <div className="row g-3 mb-4" style={{ animation: "sw-fade-up 0.45s ease 0.05s both" }}>
          {[
            { icon: "📋", label: "Partes activos", value: partes.length, color: "var(--sw-accent)" },
            { icon: "⏳", label: "En proceso", value: partes.filter(p => p.estado === "en_proceso").length, color: "#f59e0b" },
            { icon: "⏸", label: "En pausa", value: partes.filter(p => p.estado === "en_pausa").length, color: "#818cf8" },
          ].map((stat) => (
            <div key={stat.label} className="col-md-4">
              <div style={{ background: "var(--sw-surface)", border: "1px solid var(--sw-border)", borderTop: `3px solid ${stat.color}`, borderRadius: "16px", padding: "1.1rem 1.25rem" }}>
                <p style={{ fontSize: "0.76rem", color: "var(--sw-muted)", marginBottom: "0.5rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {stat.icon} {stat.label}
                </p>
                <h3 style={{ fontSize: "2rem", fontWeight: 800, color: stat.color, margin: 0 }}>{stat.value}</h3>
              </div>
            </div>
          ))}
        </div>

        {error && (
          <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "10px", padding: "0.85rem 1rem", marginBottom: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center", color: "#fca5a5", animation: "sw-fade-up 0.3s ease both" }}>
            <span><strong>Error:</strong> {error}</span>
            <button type="button" className="btn-close btn-close-white btn-sm" onClick={() => setError("")} />
          </div>
        )}

        {/* FILTROS */}
        <div style={{ background: "var(--sw-surface)", border: "1px solid var(--sw-border)", borderTop: "3px solid rgba(212,175,55,0.3)", borderRadius: "18px", marginBottom: "1.5rem", animation: "sw-fade-up 0.45s ease 0.1s both", overflow: "hidden" }}>
          <div style={{ padding: "1.1rem 1.25rem", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h5 style={{ fontWeight: 700, color: "var(--sw-text)", margin: 0, fontSize: "0.95rem" }}>
              <span style={{ color: "var(--sw-accent)", marginRight: "0.5rem" }}>⊞</span>
              Filtros
            </h5>
            <button
              onClick={() => setModalCrearAbierto(true)}
              style={{ background: "linear-gradient(135deg, #f5e19a, #d4af37)", border: "none", color: "#0a0b0e", fontWeight: 700, fontSize: "0.85rem", padding: "0.45rem 1.2rem", borderRadius: "9px", cursor: "pointer" }}
            >
              ✦ Crear parte
            </button>
          </div>
          <div style={{ padding: "1.25rem" }}>
            <div className="row g-3">
              <div className="col-md-6">
                <label style={{ color: "var(--sw-muted)", fontSize: "0.78rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "0.4rem" }}>Empleado</label>
                <select
                  className="form-select"
                  value={empleadoFiltro}
                  onChange={(e) => setEmpleadoFiltro(e.target.value)}
                  style={{ background: "var(--sw-surface-2)", border: "1px solid var(--sw-border)", color: "var(--sw-text)", borderRadius: "10px" }}
                >
                  <option value="">Todos</option>
                  {empleadosDisponibles.map((u) => (
                    <option key={u.id} value={u.id}>{u.nombre} ({u.rol})</option>
                  ))}
                </select>
              </div>
              <div className="col-md-6">
                <label style={{ color: "var(--sw-muted)", fontSize: "0.78rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "0.4rem" }}>Coche</label>
                <select
                  className="form-select"
                  value={cocheFiltro}
                  onChange={(e) => setCocheFiltro(e.target.value)}
                  style={{ background: "var(--sw-surface-2)", border: "1px solid var(--sw-border)", color: "var(--sw-text)", borderRadius: "10px" }}
                >
                  <option value="">Todos</option>
                  {cochesCatalogo.map((c) => (
                    <option key={c.coche_id} value={c.coche_id}>
                      {c.matricula} {c.coche_descripcion ? ` - ${c.coche_descripcion}` : ""} {c.cliente_nombre ? ` - ${c.cliente_nombre}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* LISTA PARTES */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "3rem 0" }}>
            <div className="spinner-border" style={{ color: "var(--sw-accent)", width: "2rem", height: "2rem" }} role="status" />
            <p style={{ color: "var(--sw-muted)", marginTop: "1rem", fontSize: "0.88rem" }}>Cargando partes activos…</p>
          </div>
        ) : partes.length === 0 ? (
          <div style={{ background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: "14px", padding: "1.25rem 1.5rem", color: "#6ee7b7", fontSize: "0.9rem", marginBottom: "1.5rem", animation: "sw-fade-up 0.35s ease both" }}>
            ✦ No hay partes pendientes — todos los trabajos están finalizados
          </div>
        ) : (
          <div style={{ animation: "sw-fade-up 0.45s ease 0.15s both" }}>
            {groupByDate(partes).map(([fecha, grupoPartes]) => {
              const cocheGrupos = Object.values(
                grupoPartes.reduce((acc, p) => {
                  const k = p.coche_id;
                  if (!acc[k]) acc[k] = { coche_id: k, partes: [] };
                  acc[k].partes.push(p);
                  return acc;
                }, {})
              );
              return (
                <div key={fecha} style={{ marginBottom: "2rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.85rem" }}>
                    <span style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--sw-accent)", opacity: 0.75 }}>📅 {fecha}</span>
                    <div style={{ flex: 1, height: "1px", background: "rgba(212,175,55,0.12)" }} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                    {cocheGrupos.map(({ coche_id, partes: cp }) => {
                      const estadoGlobal = cp.some(p => p.estado === "en_proceso") ? "en_proceso"
                        : cp.some(p => p.estado === "en_pausa") ? "en_pausa"
                        : "pendiente";
                      const ids = cp.map(p => p.id);
                      const accentColor = estadoGlobal === "en_proceso" ? "#22c55e" : estadoGlobal === "en_pausa" ? "#f59e0b" : "rgba(212,175,55,0.4)";

                      // Datos del coche directamente desde el parte (API ya los devuelve)
                      const refParte = cp[0] || {};
                      const matricula = refParte.matricula || `#${coche_id}`;
                      const marcaModelo = [refParte.marca, refParte.modelo].filter(Boolean).join(" ");
                      const clienteNombre = refParte.cliente_nombre;

                      return (
                        <div key={coche_id} style={{ background: "var(--sw-surface)", border: `1px solid rgba(255,255,255,0.07)`, borderLeft: `3px solid ${accentColor}`, borderRadius: "14px", overflow: "hidden" }}>
                          {/* Cabecera */}
                          <div style={{ padding: "0.85rem 1.1rem", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.55rem", flexWrap: "wrap" }}>
                                <span style={{
                                  fontFamily: "monospace", fontWeight: 800, fontSize: "1rem",
                                  color: "var(--sw-accent)", letterSpacing: "0.08em",
                                  background: "color-mix(in srgb, var(--sw-accent) 8%, transparent)",
                                  border: "1px solid color-mix(in srgb, var(--sw-accent) 22%, transparent)",
                                  borderRadius: "6px", padding: "0.1rem 0.6rem",
                                }}>
                                  {matricula}
                                </span>
                                {marcaModelo && (
                                  <span style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--sw-text)" }}>
                                    {marcaModelo}
                                  </span>
                                )}
                                {clienteNombre && (
                                  <span style={{ fontSize: "0.78rem", color: "var(--sw-muted)" }}>
                                    · {clienteNombre}
                                  </span>
                                )}
                              </div>
                              <div style={{ display: "flex", gap: "1rem", marginTop: "0.35rem", fontSize: "0.78rem", color: "var(--sw-muted)", flexWrap: "wrap" }}>
                                <span>👤 {cp.map(p => empleadoNombrePorId(p.empleado_id)).filter(Boolean).join(", ") || <em>Sin asignar</em>}</span>
                              </div>
                            </div>
                            <EstadoBadge estado={estadoGlobal} />
                          </div>
                          {/* Servicios */}
                          <div style={{ padding: "0.5rem 0" }}>
                            {cp.map(p => (
                              <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.5rem 1.1rem", borderBottom: "1px solid rgba(255,255,255,0.03)", gap: "0.75rem" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flex: 1, minWidth: 0, flexWrap: "wrap" }}>
                                  <span style={{ fontSize: "0.7rem", color: "var(--sw-muted)", fontFamily: "monospace", flexShrink: 0 }}>#{p.id}</span>
                                  <PrioridadBadge prioridad={p.prioridad || 0} />
                                  <span style={{ fontSize: "0.87rem", color: "var(--sw-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {p.observaciones || getTipoTareaLabel(p.tipo_tarea)}
                                  </span>
                                  {editandoAreaId === p.id ? (
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexShrink: 0 }}>
                                      <select
                                        defaultValue={p.tipo_tarea || ""}
                                        onChange={(e) => e.target.value && onCambiarArea(p.id, e.target.value)}
                                        style={{ fontSize: "0.78rem", padding: "0.2rem 0.5rem", borderRadius: "6px", border: "1px solid rgba(212,175,55,0.4)", background: "var(--sw-surface)", color: "var(--sw-text)", cursor: "pointer" }}
                                      >
                                        <option value="">-- Seleccionar --</option>
                                        <option value="detailing">Detailing</option>
                                        <option value="pintura">Pintura</option>
                                        <option value="tapicero">Tapicería</option>
                                        <option value="otro">Otro</option>
                                      </select>
                                      <button onClick={() => setEditandoAreaId(null)} style={{ fontSize: "0.7rem", background: "none", border: "none", color: "var(--sw-muted)", cursor: "pointer" }}>✕</button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => setEditandoAreaId(p.id)}
                                      title="Cambiar área del parte"
                                      style={{ fontSize: "0.68rem", padding: "0.15rem 0.45rem", borderRadius: "5px", border: "1px solid rgba(212,175,55,0.25)", background: "rgba(212,175,55,0.07)", color: "var(--sw-accent)", cursor: "pointer", flexShrink: 0, fontWeight: 600 }}
                                    >
                                      {getTipoTareaLabel(p.tipo_tarea)} ✎
                                    </button>
                                  )}
                                  <button
                                    onClick={() => onCambiarPrioridad(p.id, p.prioridad || 0)}
                                    disabled={cambiandoPrioridadId === p.id}
                                    title="Cambiar prioridad (clic para rotar)"
                                    style={{
                                      fontSize: "0.68rem", padding: "0.15rem 0.45rem", borderRadius: "5px", fontWeight: 700, cursor: "pointer", flexShrink: 0,
                                      border: `1px solid ${PRIORIDAD_CONFIG[p.prioridad || 0].border}`,
                                      background: PRIORIDAD_CONFIG[p.prioridad || 0].bg,
                                      color: PRIORIDAD_CONFIG[p.prioridad || 0].color,
                                      opacity: cambiandoPrioridadId === p.id ? 0.5 : 1,
                                    }}
                                  >
                                    {PRIORIDAD_CONFIG[p.prioridad || 0].icon} Prioridad
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                          {/* Acciones */}
                          <div style={{ padding: "0.65rem 1.1rem", display: "flex", gap: "0.5rem", justifyContent: "flex-end", flexWrap: "wrap" }}>
                            {estadoGlobal === "en_pausa" && (
                              <button
                                onClick={() => onReanudarGrupo(ids)}
                                style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.35)", color: "#a5b4fc", borderRadius: "8px", padding: "0.35rem 0.9rem", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer" }}
                              >
                                ▶ Reanudar
                              </button>
                            )}
                            <button
                              onClick={() => onBorrarGrupo(cp)}
                              style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171", borderRadius: "8px", padding: "0.35rem 0.9rem", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer" }}
                            >
                              🗑 Borrar
                            </button>
                            <button
                              onClick={() => onFinalizarGrupo(ids)}
                              style={{ background: "linear-gradient(135deg,#16a34a,#15803d)", border: "none", color: "var(--sw-text)", borderRadius: "8px", padding: "0.35rem 1rem", fontSize: "0.82rem", fontWeight: 700, cursor: "pointer" }}
                            >
                              ✦ Finalizar
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <CrearParteTrabajo
        isOpen={modalCrearAbierto}
        onClose={() => setModalCrearAbierto(false)}
        onSuccess={cargarPartes}
      />
    </div>
  );
}
