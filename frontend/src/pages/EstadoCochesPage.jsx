import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Context } from "../store/appContext";
import { normalizeRol } from "../utils/authSession";

const ESTADOS = [
  { key: "todos", label: "Todos" },
  { key: "en_proceso", label: "En trabajo" },
  { key: "en_pausa", label: "En pausa" },
  { key: "parte_pendiente", label: "Parte asignado" },
  { key: "en_repaso", label: "En repaso" },
  { key: "listo_entrega", label: "Listo entrega" },
  { key: "esperando_parte", label: "Sin parte" },
];

const ESTADO_THEME = {
  en_proceso:      { color: "#22c55e", bg: "rgba(34,197,94,0.1)",    border: "rgba(34,197,94,0.3)",    dot: "#22c55e" },
  en_pausa:        { color: "#f59e0b", bg: "rgba(245,158,11,0.1)",   border: "rgba(245,158,11,0.3)",   dot: "#f59e0b" },
  parte_pendiente: { color: "#818cf8", bg: "rgba(129,140,248,0.1)",  border: "rgba(129,140,248,0.3)",  dot: "#818cf8" },
  en_repaso:       { color: "#38bdf8", bg: "rgba(56,189,248,0.1)",   border: "rgba(56,189,248,0.3)",   dot: "#38bdf8" },
  listo_entrega:   { color: "#d4af37", bg: "rgba(212,175,55,0.1)",   border: "rgba(212,175,55,0.3)",   dot: "#d4af37" },
  esperando_parte: { color: "#9ca3af", bg: "rgba(156,163,175,0.08)", border: "rgba(156,163,175,0.22)", dot: "#9ca3af" },
};

const fmtFecha = (value) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("es-ES");
};

const ROL_LABEL = {
  detailing: "Detailing",
  pintura: "Pintura",
  tapicero: "Tapiceria",
  calidad: "Calidad",
  otro: "General",
};

const fmtRol = (rol) => ROL_LABEL[String(rol || "").toLowerCase()] || "General";

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

export default function EstadoCochesPage() {
  const { actions } = useContext(Context);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [q, setQ] = useState("");

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
              const partesActivasDetalle = Array.isArray(estado?.partes_activas_detalle)
                ? estado.partes_activas_detalle : [];
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
              const totalTrabajos = Math.max(
                Number(estado?.partes_activas_count || 0),
                partesActivasIds.length
              );
              const estadoLabel = estado?.label || "Sin estado";
              const estadoConConteo = totalTrabajos > 1 ? `${estadoLabel} (${totalTrabajos})` : estadoLabel;
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

                    {/* Empleado */}
                    {(empleadosActivos.length > 0 || estado?.parte_empleado_nombre) && (
                      <div style={{ display: "flex", gap: "0.5rem", alignItems: "baseline" }}>
                        <span style={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--sw-muted)", minWidth: "4.2rem" }}>Empleado</span>
                        <span style={{ fontSize: "0.85rem", color: "var(--sw-text)" }}>
                          {empleadosActivos.length > 0 ? empleadosActivos.join(", ") : estado?.parte_empleado_nombre}
                        </span>
                      </div>
                    )}

                    {/* Partes */}
                    {(partesActivasDetalle.length > 0 || partesActivasIds.length > 0 || estado?.parte_id) && (
                      <div style={{ display: "flex", gap: "0.5rem", alignItems: "baseline" }}>
                        <span style={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--sw-muted)", minWidth: "4.2rem" }}>Partes</span>
                        <span style={{ fontSize: "0.82rem", color: "var(--sw-text)", fontFamily: "monospace" }}>
                          {partesActivasDetalle.length > 0
                            ? partesActivasDetalle.map((p) => `#${p.id} ${fmtRol(p.tipo_tarea)}`).join(" · ")
                            : partesActivasIds.length > 0
                              ? partesActivasIds.map((id) => `#${id}`).join(", ")
                              : `#${estado.parte_id}`}
                        </span>
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
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}>
                    <span style={{ fontSize: "0.7rem", color: "var(--sw-muted)" }}>
                      🕐 {fmtFecha(r?.fecha_inspeccion)}
                    </span>
                    {totalTrabajos > 1 && (
                      <span style={{
                        background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.28)",
                        borderRadius: "999px", padding: "0.08rem 0.5rem",
                        fontSize: "0.68rem", fontWeight: 700, color: "#f59e0b",
                      }}>
                        {totalTrabajos} trabajos
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
