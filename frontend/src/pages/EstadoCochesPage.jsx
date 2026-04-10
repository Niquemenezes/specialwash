import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Context } from "../store/appContext";
import { normalizeRol } from "../utils/authSession";
import { editarParteTrabajo } from "../utils/parteTrabajoApi";

const ESTADOS = [
  { key: "todos", label: "Todos" },
  { key: "en_proceso", label: "En trabajo" },
  { key: "en_pausa", label: "En pausa" },
  { key: "parte_pendiente", label: "Parte asignado" },
  { key: "en_repaso", label: "En repaso" },
  { key: "listo_entrega", label: "Listo entrega" },
  { key: "esperando_parte", label: "Esperando" },
];

const ESTADO_THEME = {
  en_proceso:      { color: "#f97316", bg: "rgba(249,115,22,0.12)",   border: "rgba(249,115,22,0.34)",   dot: "#f97316" },
  en_pausa:        { color: "#f59e0b", bg: "rgba(245,158,11,0.1)",    border: "rgba(245,158,11,0.3)",    dot: "#f59e0b" },
  parte_pendiente: { color: "#818cf8", bg: "rgba(129,140,248,0.1)",   border: "rgba(129,140,248,0.3)",   dot: "#818cf8" },
  en_repaso:       { color: "#38bdf8", bg: "rgba(56,189,248,0.1)",    border: "rgba(56,189,248,0.3)",    dot: "#38bdf8" },
  listo_entrega:   { color: "#d4af37", bg: "rgba(212,175,55,0.1)",    border: "rgba(212,175,55,0.3)",    dot: "#d4af37" },
  finalizado:      { color: "#22c55e", bg: "rgba(34,197,94,0.12)",    border: "rgba(34,197,94,0.34)",    dot: "#22c55e" },
  esperando_parte: { color: "#94a3b8", bg: "rgba(148,163,184,0.10)",  border: "rgba(148,163,184,0.26)",  dot: "#94a3b8" },
};

const fmtFecha = (value) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("es-ES");
};

const formatMinutes = (minutes) => {
  const total = Number.isFinite(Number(minutes)) ? Math.max(0, Number(minutes)) : 0;
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
};

const ROL_LABEL = {
  detailing: "Detailing",
  pintura: "Pintura",
  tapicero: "Tapicería",
  calidad: "Calidad",
  otro: "General",
};

const STATUS_ROL_META = {
  en_proceso: { label: "En trabajo", themeKey: "en_proceso", priority: 0 },
  en_pausa: { label: "En pausa", themeKey: "en_pausa", priority: 1 },
  pendiente_otros: { label: "Pendiente de otros trabajos", themeKey: "parte_pendiente", priority: 2 },
  pendiente: { label: "Pendiente", themeKey: "parte_pendiente", priority: 3 },
  finalizado: { label: "Finalizado", themeKey: "finalizado", priority: 4 },
  sin_parte: { label: "Esperando", themeKey: "esperando_parte", priority: 5 },
};

const fmtRol = (rol) => ROL_LABEL[String(rol || "").toLowerCase()] || "General";
const fmtTrabajoNombre = (parte) => {
  const obs = String(parte?.observaciones || "").trim();
  if (obs && obs.toLowerCase() !== "apoyo en trabajo del coche") return obs;
  return fmtRol(parte?.tipo_tarea);
};
const dedupeStrings = (values = []) => [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
const formatNaturalList = (values = []) => {
  const items = dedupeStrings(values);
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} y ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
};
const getStatusLabelForRole = (statusKey, waitingOnRoles = []) => {
  if (statusKey === "pendiente_otros" && waitingOnRoles.length > 0) {
    return `Esperando ${formatNaturalList(waitingOnRoles.map((rol) => String(rol || "").toLowerCase()))}`;
  }
  return STATUS_ROL_META[statusKey]?.label || "Esperando";
};
const mapEstadoCocheToParteEstado = (estadoKey) => {
  if (estadoKey === "en_proceso") return "en_proceso";
  if (estadoKey === "en_pausa") return "en_pausa";
  if (estadoKey === "parte_pendiente") return "pendiente";
  return "";
};
const getPartesActivasDetalle = (row) => {
  const estado = row?.estado_coche || {};
  const base = Array.isArray(estado?.partes_activas_detalle)
    ? estado.partes_activas_detalle.filter(Boolean)
    : [];

  const fallbackEstado = mapEstadoCocheToParteEstado(estado?.estado);
  const fallbackId = Number(estado?.parte_id);
  const fallbackRol = normalizeRol(estado?.parte_tipo_tarea || "");

  if (Number.isFinite(fallbackId) && fallbackEstado) {
    const fallbackDetalle = {
      id: fallbackId,
      empleado_id: Number.isFinite(Number(estado?.parte_empleado_id)) ? Number(estado.parte_empleado_id) : null,
      empleado_nombre: String(estado?.parte_empleado_nombre || "").trim() || null,
      tipo_tarea: fallbackRol || null,
      observaciones: String(estado?.parte_obs || "").trim() || null,
      estado: fallbackEstado,
    };

    const existingIndex = base.findIndex((parte) => Number(parte?.id) === fallbackId);
    if (existingIndex >= 0) {
      base[existingIndex] = {
        ...fallbackDetalle,
        ...base[existingIndex],
        empleado_id: base[existingIndex]?.empleado_id ?? fallbackDetalle.empleado_id,
        empleado_nombre: base[existingIndex]?.empleado_nombre || fallbackDetalle.empleado_nombre,
        tipo_tarea: base[existingIndex]?.tipo_tarea || fallbackDetalle.tipo_tarea,
        observaciones: base[existingIndex]?.observaciones || fallbackDetalle.observaciones,
        estado: base[existingIndex]?.estado || fallbackDetalle.estado,
      };
    } else {
      base.push(fallbackDetalle);
    }
  }

  return base;
};
const buildEstadosPorRol = (row) => {
  const estado = row?.estado_coche || {};
  const partesActivasDetalle = getPartesActivasDetalle(row);
  const partesFinalizadasDetalle = Array.isArray(estado?.partes_finalizados_detalle)
    ? estado.partes_finalizados_detalle.filter(Boolean)
    : [];
  const serviciosAplicados = Array.isArray(row?.servicios_aplicados)
    ? row.servicios_aplicados
    : [];

  const roles = new Set();
  serviciosAplicados.forEach((servicio) => {
    const rol = normalizeRol(servicio?.tipo_tarea || servicio?.rol || servicio?.rol_responsable);
    if (rol) roles.add(rol);
  });
  (Array.isArray(estado?.partes_roles_todos) ? estado.partes_roles_todos : []).forEach((rol) => {
    const normalizado = normalizeRol(rol);
    if (normalizado) roles.add(normalizado);
  });
  partesActivasDetalle.forEach((parte) => {
    const rol = normalizeRol(parte?.tipo_tarea);
    if (rol) roles.add(rol);
  });
  partesFinalizadasDetalle.forEach((parte) => {
    const rol = normalizeRol(parte?.tipo_tarea);
    if (rol) roles.add(rol);
  });

  const hasAnyRoleWorking = partesActivasDetalle.some((parte) => ["en_proceso", "en_pausa"].includes(String(parte?.estado || "")));

  return Array.from(roles)
    .map((rol) => {
      const serviciosRol = serviciosAplicados.filter(
        (servicio) => normalizeRol(servicio?.tipo_tarea || servicio?.rol || servicio?.rol_responsable) === rol
      );
      const partesRol = partesActivasDetalle.filter(
        (parte) => normalizeRol(parte?.tipo_tarea) === rol
      );
      const partesFinalizadasRol = partesFinalizadasDetalle.filter(
        (parte) => normalizeRol(parte?.tipo_tarea) === rol
      );
      const rolesQueBloquean = dedupeStrings(
        partesActivasDetalle
          .filter(
            (parte) => normalizeRol(parte?.tipo_tarea) !== rol && ["en_proceso", "en_pausa"].includes(String(parte?.estado || ""))
          )
          .map((parte) => fmtRol(normalizeRol(parte?.tipo_tarea)))
      );
      const otrosRolesTrabajando = rolesQueBloquean.length > 0;

      let statusKey = "sin_parte";
      if (partesRol.some((parte) => parte?.estado === "en_proceso")) {
        statusKey = "en_proceso";
      } else if (partesRol.some((parte) => parte?.estado === "en_pausa")) {
        statusKey = "en_pausa";
      } else if (partesRol.some((parte) => parte?.estado === "pendiente")) {
        statusKey = otrosRolesTrabajando ? "pendiente_otros" : "pendiente";
      } else if (partesFinalizadasRol.length > 0) {
        statusKey = "finalizado";
      } else if (serviciosRol.length > 0 && hasAnyRoleWorking) {
        statusKey = "pendiente_otros";
      }

      const empleadosActivos = dedupeStrings(partesRol.map((parte) => parte?.empleado_nombre));
      const empleadosFinalizados = dedupeStrings(partesFinalizadasRol.map((parte) => parte?.empleado_nombre));
      const empleados = statusKey === "finalizado" ? empleadosFinalizados : empleadosActivos;
      const empleadosLabel = statusKey === "finalizado"
        ? "Hecho por"
        : ["en_proceso", "en_pausa"].includes(statusKey)
          ? "Trabajando"
          : "Asignado a";

      return {
        rol,
        rolLabel: fmtRol(rol),
        statusKey,
        statusLabel: getStatusLabelForRole(statusKey, rolesQueBloquean),
        themeKey: STATUS_ROL_META[statusKey]?.themeKey || "esperando_parte",
        prioridad: STATUS_ROL_META[statusKey]?.priority ?? 99,
        trabajos: dedupeStrings([
          ...serviciosRol.map((servicio) => servicio?.nombre),
          ...partesRol.map((parte) => fmtTrabajoNombre(parte)),
          ...partesFinalizadasRol.map((parte) => fmtTrabajoNombre(parte)),
        ]),
        empleados,
        empleadosLabel,
      };
    })
    .sort((a, b) => a.prioridad - b.prioridad || a.rolLabel.localeCompare(b.rolLabel, "es"));
};

function EstadoBadge({ estadoKey, label, overrideColor }) {
  const theme = ESTADO_THEME[estadoKey] || { color: "#9ca3af", bg: "rgba(156,163,175,0.08)", border: "rgba(156,163,175,0.22)", dot: "#9ca3af" };
  const c = overrideColor || theme.color;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "0.35rem",
      padding: "0.22rem 0.65rem", borderRadius: "999px",
      fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.05em",
      background: theme.bg, border: `1px solid ${theme.border}`, color: c,
      whiteSpace: "nowrap",
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: c, flexShrink: 0 }} />
      {label}
    </span>
  );
}

const TIPO_TAREA_OPTIONS = [
  { value: "detailing", label: "Detailing" },
  { value: "pintura", label: "Pintura" },
  { value: "tapicero", label: "Tapicería" },
  { value: "calidad", label: "Calidad" },
  { value: "otro", label: "Otro" },
];

function EditarPartesModal({ row, onClose, onSaved }) {
  const partes = getPartesActivasDetalle(row);
  const [valores, setValores] = useState(() =>
    partes.reduce((acc, p) => {
      acc[p.id] = { tipo_tarea: p.tipo_tarea || "", observaciones: p.observaciones || "" };
      return acc;
    }, {})
  );
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const onChange = (id, campo, valor) =>
    setValores((prev) => ({ ...prev, [id]: { ...prev[id], [campo]: valor } }));

  const onGuardar = async () => {
    setError("");
    setGuardando(true);
    try {
      for (const p of partes) {
        const v = valores[p.id];
        if (!v) continue;
        await editarParteTrabajo(p.id, {
          tipo_tarea: v.tipo_tarea || p.tipo_tarea,
          observaciones: v.observaciones,
        });
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e?.message || "Error al guardar");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem",
    }} onClick={onClose}>
      <div style={{
        background: "var(--sw-surface)", border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: "16px", padding: "1.5rem", width: "100%", maxWidth: "520px",
        boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
          <div>
            <h4 style={{ margin: 0, fontWeight: 700, color: "var(--sw-text)", fontSize: "1rem" }}>
              Editar servicios
            </h4>
            <p style={{ margin: "0.2rem 0 0", fontSize: "0.78rem", color: "var(--sw-muted)" }}>
              {row?.matricula} · {row?.cliente_nombre}
            </p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--sw-muted)", fontSize: "1.2rem", cursor: "pointer", lineHeight: 1 }}>✕</button>
        </div>

        {partes.length === 0 ? (
          <p style={{ color: "var(--sw-muted)", fontSize: "0.88rem" }}>No hay partes activos para este coche.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {partes.map((p) => (
              <div key={p.id} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "10px", padding: "0.85rem" }}>
                <div style={{ fontSize: "0.7rem", color: "var(--sw-muted)", marginBottom: "0.5rem", fontFamily: "monospace" }}>Parte #{p.id}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <div>
                    <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--sw-muted)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "0.3rem" }}>Área</label>
                    <select
                      value={valores[p.id]?.tipo_tarea || ""}
                      onChange={(e) => onChange(p.id, "tipo_tarea", e.target.value)}
                      style={{ width: "100%", padding: "0.4rem 0.6rem", borderRadius: "7px", border: "1px solid rgba(212,175,55,0.3)", background: "var(--sw-bg, #0a0b0e)", color: "var(--sw-text)", fontSize: "0.85rem" }}
                    >
                      <option value="">-- Sin asignar --</option>
                      {TIPO_TAREA_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--sw-muted)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "0.3rem" }}>Descripción</label>
                    <input
                      type="text"
                      value={valores[p.id]?.observaciones || ""}
                      onChange={(e) => onChange(p.id, "observaciones", e.target.value)}
                      placeholder="Descripción del servicio..."
                      style={{ width: "100%", padding: "0.4rem 0.6rem", borderRadius: "7px", border: "1px solid rgba(255,255,255,0.1)", background: "var(--sw-bg, #0a0b0e)", color: "var(--sw-text)", fontSize: "0.85rem" }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <p style={{ color: "#f87171", fontSize: "0.82rem", marginTop: "0.75rem" }}>{error}</p>
        )}

        <div style={{ display: "flex", gap: "0.6rem", justifyContent: "flex-end", marginTop: "1.25rem" }}>
          <button onClick={onClose} disabled={guardando} style={{ background: "none", border: "1px solid var(--sw-border)", color: "var(--sw-muted)", borderRadius: "8px", padding: "0.45rem 1rem", fontSize: "0.84rem", cursor: "pointer", fontWeight: 600 }}>
            Cancelar
          </button>
          {partes.length > 0 && (
            <button onClick={onGuardar} disabled={guardando} style={{ background: "linear-gradient(135deg,#f5e19a,#d4af37)", border: "none", color: "#0a0b0e", borderRadius: "8px", padding: "0.45rem 1.2rem", fontSize: "0.84rem", cursor: "pointer", fontWeight: 700 }}>
              {guardando ? "Guardando…" : "Guardar cambios"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function EstadoCochesPage() {
  const { actions } = useContext(Context);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [q, setQ] = useState("");
  const [editandoRow, setEditandoRow] = useState(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await actions.getPendientesEntrega();
      setRows(Array.isArray(data) ? data : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [actions]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const conteoPorEstado = useMemo(() => {
    const out = { todos: rows.length };
    for (const r of rows) {
      const k = r?.estado_coche?.estado || "sin_estado";
      out[k] = (out[k] || 0) + 1;
    }
    return out;
  }, [rows]);

  const filtradas = useMemo(() => {
    const texto = q.trim().toLowerCase();
    return rows.filter((r) => {
      const estadoOk = filtroEstado === "todos" || (r?.estado_coche?.estado === filtroEstado);
      if (!estadoOk) return false;
      if (!texto) return true;
      const bag = [
        r?.matricula,
        r?.cliente_nombre,
        r?.coche_descripcion,
        r?.estado_coche?.label,
        r?.estado_coche?.parte_empleado_nombre,
      ].filter(Boolean).join(" ").toLowerCase();
      return bag.includes(texto);
    });
  }, [rows, filtroEstado, q]);

  return (
    <div>
      {/* ESTADO HERO */}
      <div style={{
        borderBottom: "1px solid color-mix(in srgb, var(--sw-accent) 12%, var(--sw-border))",
        padding: "1.5rem 0 1.25rem",
        animation: "sw-fade-up 0.4s ease both",
      }}>
        <div className="container" style={{ maxWidth: "1200px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
            <div>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--sw-text)", margin: 0 }}>
                Dónde está cada coche
              </h3>
              <p style={{ fontSize: "0.82rem", color: "var(--sw-muted)", margin: "0.25rem 0 0" }}>
                Seguimiento operativo en tiempo real
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: "0.4rem",
                padding: "0.28rem 0.8rem 0.28rem 0.6rem", borderRadius: "999px",
                fontSize: "0.74rem", fontWeight: 600,
                border: "1px solid rgba(34,197,94,0.4)", background: "rgba(34,197,94,0.07)", color: "#6ee7b7",
                whiteSpace: "nowrap",
              }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", animation: "sw-pulse-dot 2s ease-in-out infinite", flexShrink: 0 }} />
                {rows.filter(r => r?.estado_coche?.estado === "en_proceso").length} en proceso
              </span>
              <button
                onClick={cargar}
                style={{
                  background: "var(--sw-surface)", border: "1px solid var(--sw-border)",
                  color: "var(--sw-muted)", borderRadius: "8px", padding: "0.35rem 0.85rem",
                  fontSize: "0.8rem", fontWeight: 600, cursor: "pointer",
                  transition: "border-color 0.15s, color 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--sw-accent)"; e.currentTarget.style.color = "var(--sw-accent)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--sw-border)"; e.currentTarget.style.color = "var(--sw-muted)"; }}
              >
                ↺ Recargar
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-4" style={{ maxWidth: "1200px" }}>
        {/* FILTROS PILL */}
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1.25rem", animation: "sw-fade-up 0.45s ease 0.05s both" }}>
          {ESTADOS.map((e) => {
            const count = conteoPorEstado[e.key] || 0;
            const active = filtroEstado === e.key;
            const theme = ESTADO_THEME[e.key] || {};
            return (
              <button
                key={e.key}
                type="button"
                onClick={() => setFiltroEstado(e.key)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: "0.4rem",
                  padding: "0.32rem 0.9rem", borderRadius: "999px",
                  fontSize: "0.77rem", fontWeight: 700, cursor: "pointer",
                  border: active ? `1px solid ${theme.border || "rgba(212,175,55,0.4)"}` : "1px solid var(--sw-border)",
                  background: active ? (theme.bg || "rgba(212,175,55,0.08)") : "var(--sw-surface)",
                  color: active ? (theme.color || "var(--sw-accent)") : "var(--sw-muted)",
                  transition: "all 0.15s",
                }}
              >
                {e.label}
                <span style={{
                  background: active ? (theme.color || "var(--sw-accent)") : "rgba(255,255,255,0.08)",
                  color: active ? "#0a0b0e" : "var(--sw-muted)",
                  borderRadius: "999px", padding: "0.05rem 0.4rem",
                  fontSize: "0.68rem", fontWeight: 800, minWidth: "1.3rem", textAlign: "center",
                }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* BUSCADOR */}
        <div style={{ marginBottom: "1.5rem", animation: "sw-fade-up 0.45s ease 0.1s both" }}>
          <div style={{ position: "relative", maxWidth: "480px" }}>
            <span style={{ position: "absolute", left: "0.9rem", top: "50%", transform: "translateY(-50%)", color: "var(--sw-muted)", fontSize: "0.82rem", pointerEvents: "none" }}>🔍</span>
            <input
              className="sw-pinput"
              style={{ paddingLeft: "2.3rem", width: "100%" }}
              placeholder="Buscar por matrícula, cliente, estado o empleado..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>

        <div style={{
          background: "var(--sw-surface)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderTop: "3px solid rgba(99,102,241,0.45)",
          borderRadius: "16px",
          padding: "1rem",
          marginBottom: "1.5rem",
          animation: "sw-fade-up 0.45s ease 0.12s both",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.8rem", flexWrap: "wrap" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "0.98rem", fontWeight: 700, color: "var(--sw-text)" }}>👥 Productividad del equipo</h3>
              <p style={{ margin: "0.2rem 0 0", fontSize: "0.8rem", color: "var(--sw-muted)" }}>
                La vista detallada por trabajador está ahora separada para revisarla mejor.
              </p>
            </div>
            <Link
              to="/productividad-trabajadores"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.45rem",
                padding: "0.55rem 0.95rem",
                borderRadius: "10px",
                textDecoration: "none",
                background: "rgba(99,102,241,0.12)",
                border: "1px solid rgba(99,102,241,0.30)",
                color: "#a5b4fc",
                fontWeight: 700,
              }}
            >
              Abrir vista detallada →
            </Link>
          </div>
        </div>

        {/* CONTENIDO */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "4rem 0", animation: "sw-fade-up 0.35s ease both" }}>
            <div className="spinner-border" style={{ color: "var(--sw-accent)", width: "2rem", height: "2rem" }} role="status" />
            <p style={{ color: "var(--sw-muted)", marginTop: "1rem", fontSize: "0.88rem" }}>Cargando vehículos…</p>
          </div>
        ) : filtradas.length === 0 ? (
          <div style={{
            background: "rgba(212,175,55,0.04)", border: "1px solid rgba(212,175,55,0.12)",
            borderRadius: "14px", padding: "3rem", textAlign: "center",
            color: "var(--sw-muted)", fontSize: "0.9rem",
            animation: "sw-fade-up 0.35s ease both",
          }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem", opacity: 0.4 }}>🚗</div>
            No hay vehículos para los filtros seleccionados.
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))",
            gap: "1rem",
            animation: "sw-fade-up 0.45s ease 0.15s both",
          }}>
            {filtradas.map((r) => {
              const estado = r?.estado_coche || null;
              const empleadosActivos = Array.isArray(estado?.partes_activas_empleados)
                ? estado.partes_activas_empleados : [];
              const partesActivasIds = Array.isArray(estado?.partes_activas_ids)
                ? estado.partes_activas_ids : [];
              const partesActivasDetalle = getPartesActivasDetalle(r);
              const rolesTodos = Array.isArray(estado?.partes_roles_todos)
                ? estado.partes_roles_todos : [];
              const rolesDesdeServicios = Array.isArray(r?.servicios_aplicados)
                ? [...new Set(
                    r.servicios_aplicados
                      .map((s) => normalizeRol(s?.tipo_tarea || s?.rol || s?.rol_responsable))
                      .filter(Boolean)
                  )]
                : [];
              const rolesAsignados = rolesTodos.length > 0
                ? rolesTodos
                : [...new Set(partesActivasDetalle.map((p) => normalizeRol(p?.tipo_tarea)).filter(Boolean))];
              const rolesAsignadosFinal = rolesAsignados.length > 0 ? rolesAsignados : rolesDesdeServicios;
              const estadosPorRol = buildEstadosPorRol(r);
              let trabajosPorEmpleado = partesActivasDetalle.reduce((acc, p) => {
                const empleado = String(p?.empleado_nombre || estado?.parte_empleado_nombre || "Pendiente de asignar").trim() || "Pendiente de asignar";
                const trabajo = fmtTrabajoNombre(p);
                const actual = acc.find((item) => item.empleado === empleado);
                if (actual) {
                  if (trabajo && !actual.trabajos.includes(trabajo)) actual.trabajos.push(trabajo);
                } else {
                  acc.push({ empleado, trabajos: trabajo ? [trabajo] : [] });
                }
                return acc;
              }, []);
              if (trabajosPorEmpleado.length === 0) {
                const trabajoFallback = String(estado?.parte_obs || "").trim() || (rolesAsignadosFinal.length > 0 ? rolesAsignadosFinal.map((rol) => fmtRol(rol)).join(" · ") : "");
                if (trabajoFallback) {
                  trabajosPorEmpleado = [{
                    empleado: empleadosActivos.length > 0 ? empleadosActivos.join(", ") : (estado?.parte_empleado_nombre || "Pendiente de asignar"),
                    trabajos: [trabajoFallback],
                  }];
                }
              }
              const estadoLabel = estado?.label || "Sin estado";
              const estadoConConteo = estadoLabel;
              const estadoKey = estado?.estado || "sin_estado";
              const theme = ESTADO_THEME[estadoKey] || { color: "#9ca3af", bg: "rgba(156,163,175,0.05)", border: "rgba(156,163,175,0.18)", dot: "#9ca3af" };

              return (
                <div
                  key={r.id}
                  style={{
                    background: "var(--sw-surface)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderLeft: `3px solid ${theme.color}`,
                    borderRadius: "14px",
                    overflow: "hidden",
                    transition: "box-shadow 0.18s",
                  }}
                  onMouseEnter={e => e.currentTarget.style.boxShadow = `0 6px 28px rgba(0,0,0,0.28), 0 0 0 1px ${theme.border}`}
                  onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}
                >
                  {/* Cabecera de la tarjeta */}
                  <div style={{
                    padding: "0.8rem 1rem",
                    borderBottom: "1px solid rgba(255,255,255,0.05)",
                    display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.65rem",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.55rem", minWidth: 0 }}>
                      <span style={{
                        fontFamily: "monospace", fontWeight: 800, fontSize: "0.95rem",
                        color: "var(--sw-accent)", letterSpacing: "0.08em",
                        background: "color-mix(in srgb, var(--sw-accent) 8%, transparent)",
                        border: "1px solid color-mix(in srgb, var(--sw-accent) 22%, transparent)",
                        borderRadius: "6px", padding: "0.1rem 0.55rem",
                        flexShrink: 0,
                      }}>
                        {r?.matricula || "-"}
                      </span>
                      <span style={{ fontSize: "0.82rem", color: "var(--sw-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r?.coche_descripcion || "-"}
                      </span>
                    </div>
                    <EstadoBadge estadoKey={estadoKey} label={estadoConConteo} overrideColor={estado?.color} />
                  </div>

                  {/* Cuerpo */}
                  <div style={{ padding: "0.8rem 1rem", display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                    {/* Cliente */}
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "baseline" }}>
                      <span style={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--sw-muted)", minWidth: "4.2rem" }}>Cliente</span>
                      <span style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--sw-text)" }}>{r?.cliente_nombre || "-"}</span>
                    </div>

                    {/* Estado por área */}
                    {estadosPorRol.length > 0 && (
                      <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
                        <span style={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--sw-muted)", minWidth: "4.2rem", paddingTop: "0.08rem" }}>Áreas</span>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem", flex: 1 }}>
                          {estadosPorRol.map((item) => {
                            const itemTheme = ESTADO_THEME[item.themeKey] || ESTADO_THEME.esperando_parte;
                            return (
                            <div key={`${r.id}-${item.rol}`} style={{ background: itemTheme.bg, border: `1px solid ${itemTheme.border}`, borderLeft: `3px solid ${itemTheme.color}`, borderRadius: "10px", padding: "0.45rem 0.6rem" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                                <strong style={{ fontSize: "0.82rem", color: "var(--sw-text)" }}>{item.rolLabel}</strong>
                                <EstadoBadge estadoKey={item.themeKey} label={item.statusLabel} />
                              </div>
                              <div style={{ marginTop: "0.28rem", fontSize: "0.8rem", color: "var(--sw-muted)" }}>
                                {item.trabajos.join(" · ") || "Trabajo asignado"}
                              </div>
                              {item.empleados.length > 0 && (
                                <div style={{ marginTop: "0.2rem", fontSize: "0.74rem", color: "var(--sw-text)" }}>
                                  <strong>{item.empleadosLabel || "Trabajando"}:</strong> {item.empleados.join(", ")}
                                </div>
                              )}
                            </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Trabajos por empleado */}
                    {trabajosPorEmpleado.length > 0 && (
                      <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
                        <span style={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--sw-muted)", minWidth: "4.2rem", paddingTop: "0.08rem" }}>Equipo</span>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", flex: 1 }}>
                          {trabajosPorEmpleado.map((item) => (
                            <div key={`${r.id}-${item.empleado}`} style={{ fontSize: "0.84rem", color: "var(--sw-text)" }}>
                              <strong>{item.empleado}:</strong>{" "}
                              <span style={{ color: "var(--sw-muted)" }}>{item.trabajos.join(" · ") || "Trabajo asignado"}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Roles asignados */}
                    {rolesAsignadosFinal.length > 0 && (
                      <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", marginTop: "0.1rem" }}>
                        {rolesAsignadosFinal.map((rol) => (
                          <span key={rol} style={{
                            background: "rgba(212,175,55,0.08)", border: "1px solid rgba(212,175,55,0.2)",
                            borderRadius: "4px", padding: "0.08rem 0.5rem",
                            fontSize: "0.68rem", fontWeight: 700, color: "var(--sw-accent)", letterSpacing: "0.05em",
                          }}>
                            {fmtRol(rol)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div style={{
                    padding: "0.5rem 1rem",
                    borderTop: "1px solid rgba(255,255,255,0.04)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}>
                    <span style={{ fontSize: "0.7rem", color: "var(--sw-muted)" }}>
                      🕐 {fmtFecha(r?.fecha_inspeccion)}
                    </span>
                    <button
                      onClick={() => setEditandoRow(r)}
                      style={{
                        background: "rgba(212,175,55,0.08)", border: "1px solid rgba(212,175,55,0.25)",
                        color: "var(--sw-accent)", borderRadius: "6px", padding: "0.2rem 0.65rem",
                        fontSize: "0.7rem", fontWeight: 700, cursor: "pointer", flexShrink: 0,
                      }}
                    >
                      ✎ Editar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {editandoRow && (
        <EditarPartesModal
          row={editandoRow}
          onClose={() => setEditandoRow(null)}
          onSaved={cargar}
        />
      )}
    </div>
  );
}
