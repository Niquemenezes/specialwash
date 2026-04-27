import React, { useState, useEffect, useCallback } from "react";
import {
  obtenerPartesPorEmpleadoYEstado,
  cambiarEstadoParte,
  sugerirSiguienteTrabajo,
} from "../utils/parteTrabajoApi";

const ACCENT = "#6366f1";
const GREEN  = "#10b981";
const AMBER  = "#f59e0b";

const TIPO_ORDER   = { preparacion: 0, pintura: 1, interna: 2 };
const TIPO_LABELS  = { preparacion: "Preparación", pintura: "Pintura", interna: "Tarea interna" };
const ESTADO_ORDER = { en_proceso: 0, en_pausa: 1, pendiente: 2 };

function getLabelTipo(tipo) {
  return TIPO_LABELS[(tipo || "").toLowerCase()] || (tipo || "Trabajo");
}

function getStageEstado(p) {
  if (!p) return "pending";
  if (p.estado === "finalizado") return "done";
  if (p.estado === "en_proceso") return "active";
  if (p.estado === "en_pausa")   return "paused";
  return "pending";
}

function groupByCoche(partes) {
  const map = new Map();
  for (const p of partes) {
    const key = p.coche_id != null ? `coche-${p.coche_id}` : `solo-${p.id}`;
    if (!map.has(key)) {
      map.set(key, {
        key,
        coche_id: p.coche_id,
        matricula:   p.matricula   || p.coche_matricula || "---",
        descripcion: [p.coche_marca || p.vehiculo_marca || "", p.coche_modelo || p.vehiculo_modelo || ""]
          .filter(Boolean).join(" ") || "Vehículo",
        partes: [],
      });
    }
    map.get(key).partes.push(p);
  }

  return Array.from(map.values()).map(coche => {
    const sorted = [...coche.partes].sort((a, b) => {
      const ta = (a.tipo_tarea || a.fase || "preparacion").toLowerCase();
      const tb = (b.tipo_tarea || b.fase || "preparacion").toLowerCase();
      return (TIPO_ORDER[ta] ?? 9) - (TIPO_ORDER[tb] ?? 9);
    });

    const allInternal = sorted.every(p => (p.tipo_tarea || "").toLowerCase() === "interna");
    const stages = sorted.map(p => ({
      tipo:   (p.tipo_tarea || p.fase || "preparacion").toLowerCase(),
      label:  getLabelTipo(p.tipo_tarea || p.fase),
      estado: getStageEstado(p),
      parte:  p,
    }));
    if (!allInternal) {
      stages.push({ tipo: "entrega", label: "Entrega", estado: "pending", parte: null });
    }

    const activo = sorted.find(p => p.estado === "en_proceso") ||
                   sorted.find(p => p.estado === "en_pausa")   ||
                   sorted.find(p => p.estado === "pendiente");

    return { ...coche, partes: sorted, stages, activo };
  }).sort((a, b) =>
    (ESTADO_ORDER[a.activo?.estado] ?? 3) - (ESTADO_ORDER[b.activo?.estado] ?? 3)
  );
}

// ── Burbuja de etapa ──────────────────────────────────────────────────────────
function StepDot({ stage, idx }) {
  const colors = {
    done:    { bg: GREEN,   text: "white",   label: GREEN },
    active:  { bg: ACCENT,  text: "white",   label: ACCENT },
    paused:  { bg: AMBER,   text: "white",   label: AMBER },
    pending: { bg: "#e5e7eb", text: "#9ca3af", label: "#9ca3af" },
  };
  const c = colors[stage.estado] || colors.pending;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <div style={{
        width: 34, height: 34, borderRadius: "50%",
        display: "flex", alignItems: "center", justifyContent: "center",
        background: c.bg, color: c.text, fontWeight: 700, fontSize: 14,
        boxShadow: stage.estado === "active" ? `0 0 0 5px ${ACCENT}20` : "none",
        border: stage.estado === "active" ? `2px solid ${ACCENT}` : "2px solid transparent",
        transition: "all 0.3s",
      }}>
        {stage.estado === "done" ? "✓" : idx + 1}
      </div>
      <span style={{
        fontSize: 11,
        fontWeight: ["active","paused"].includes(stage.estado) ? 700 : 500,
        color: c.label, whiteSpace: "nowrap",
      }}>
        {stage.label}
      </span>
    </div>
  );
}

function EtapaFlow({ stages }) {
  return (
    <div style={{ display: "flex", alignItems: "center", margin: "18px 0 16px" }}>
      {stages.map((stage, idx) => (
        <React.Fragment key={stage.tipo}>
          <StepDot stage={stage} idx={idx} />
          {idx < stages.length - 1 && (
            <div style={{
              flex: 1, height: 2, margin: "0 4px 20px",
              background:
                stage.estado === "done"  ? GREEN :
                stage.estado === "active"? `linear-gradient(to right, ${ACCENT}60, #e5e7eb)` :
                stage.estado === "paused"? `linear-gradient(to right, ${AMBER}60, #e5e7eb)` :
                "#e5e7eb",
            }} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ── Tarjeta por coche ─────────────────────────────────────────────────────────
function CocheFlowCard({ coche, onAccion }) {
  const { matricula, descripcion, stages, activo } = coche;
  const enProgreso = activo?.estado === "en_proceso";
  const enPausa    = activo?.estado === "en_pausa";
  const pendiente  = activo?.estado === "pendiente";

  const borderColor = enProgreso ? `${GREEN}50` : enPausa ? `${AMBER}50` : "#e5e7eb";
  const shadowColor = enProgreso ? `${GREEN}15` : enPausa ? `${AMBER}15` : "rgba(0,0,0,0.04)";
  const estadoColor = enProgreso ? GREEN : enPausa ? AMBER : "#9ca3af";
  const estadoLabel = enProgreso ? "En proceso" : enPausa ? "En pausa" : "Pendiente";

  const activeStageLabel = activo
    ? getLabelTipo(activo.tipo_tarea || activo.fase)
    : "";

  return (
    <div style={{
      background: "white", borderRadius: 14,
      border: `1px solid ${borderColor}`,
      boxShadow: `0 4px 20px ${shadowColor}`,
      padding: "20px 22px", marginBottom: 16,
      transition: "all 0.3s",
    }}>
      {/* Cabecera */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 10,
            background: `${ACCENT}12`, color: ACCENT,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22,
          }}>
            🚗
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#111827", letterSpacing: "-0.3px" }}>
              {matricula}
            </div>
            <div style={{ fontSize: 13, color: "#6b7280" }}>{descripcion}</div>
          </div>
        </div>
        <div style={{
          fontSize: 12, fontWeight: 600, color: estadoColor,
          background: `${estadoColor}14`,
          padding: "4px 12px", borderRadius: 999,
          display: "flex", alignItems: "center", gap: 6,
        }}>
          {enProgreso && (
            <span style={{
              width: 7, height: 7, borderRadius: "50%",
              background: GREEN, display: "inline-block",
              animation: "pulse 2s infinite",
            }} />
          )}
          {estadoLabel}
        </div>
      </div>

      {/* Flujo de etapas */}
      <EtapaFlow stages={stages} />

      {/* Observaciones del parte activo */}
      {activo?.observaciones && (
        <div style={{
          fontSize: 13, color: "#6b7280",
          background: "#f9fafb", borderRadius: 8,
          padding: "8px 12px", marginBottom: 16,
          borderLeft: `3px solid ${ACCENT}50`,
        }}>
          {activo.observaciones}
        </div>
      )}

      {/* Botones */}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        {pendiente && activo && (
          <button onClick={() => onAccion("iniciar", activo)} style={btnSolid(ACCENT)}>
            ▶ Iniciar {activeStageLabel}
          </button>
        )}
        {(enProgreso || enPausa) && activo && (
          <>
            <button
              onClick={() => onAccion(enProgreso ? "pausar" : "reanudar", activo)}
              style={btnOutline()}
            >
              {enProgreso ? "⏸ Pausar" : "▶ Reanudar"}
            </button>
            <button onClick={() => onAccion("finalizar", activo)} style={btnSolid(GREEN)}>
              ✓ Finalizar
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function btnSolid(color) {
  return {
    background: color, color: "white", border: "none",
    padding: "9px 20px", borderRadius: 8,
    fontSize: 13, fontWeight: 700, cursor: "pointer",
    display: "flex", alignItems: "center", gap: 6,
  };
}
function btnOutline() {
  return {
    background: "transparent", color: "#6b7280",
    border: "1px solid #d1d5db",
    padding: "9px 18px", borderRadius: 8,
    fontSize: 13, fontWeight: 600, cursor: "pointer",
    display: "flex", alignItems: "center", gap: 6,
  };
}
function StatCard({ label, value, color }) {
  return (
    <div style={{
      background: "white", border: "1px solid #e5e7eb",
      padding: 16, borderRadius: 10, textAlign: "center",
    }}>
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function EmpleadoMisTrabajosSimple({ empleadoId, userRol }) {
  const [coches, setCoches] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [completados, setCompletados] = useState(0);

  const cargarPartes = useCallback(async () => {
    try {
      setCargando(true);
      const data = await obtenerPartesPorEmpleadoYEstado(empleadoId);
      const lista = Array.isArray(data) ? data : [];

      const activos = lista.filter(p => p.estado !== "finalizado");
      setCoches(groupByCoche(activos));
      setCompletados(lista.filter(p => p.estado === "finalizado").length);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, [empleadoId]);

  useEffect(() => {
    cargarPartes();
    const iv = setInterval(cargarPartes, 30000);
    return () => clearInterval(iv);
  }, [cargarPartes]);

  const handleAccion = async (accion, parte) => {
    const estadoMap = {
      iniciar:   "en_proceso",
      pausar:    "en_pausa",
      reanudar:  "en_proceso",
      finalizar: "finalizado",
    };
    try {
      await cambiarEstadoParte(parte.id, estadoMap[accion]);
      if (accion === "finalizar") {
        try { await sugerirSiguienteTrabajo(empleadoId); } catch {}
      }
      setTimeout(cargarPartes, 500);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="sw-veh-wrapper">
      <div className="sw-veh-hero">
        <div className="container sw-veh-hero-inner">
          <a href="/" className="sw-veh-back" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 8, color: ACCENT }}>
            ← <span>Inicio</span>
          </a>
          <div className="sw-veh-hero-body">
            <span className="sw-veh-hero-icon" style={{ background: `${ACCENT}15`, borderColor: `${ACCENT}30`, color: ACCENT }}>
              🔧
            </span>
            <div>
              <h1 className="sw-veh-hero-title">Mis Trabajos</h1>
              <p className="sw-veh-hero-sub">Tus vehículos asignados</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container sw-veh-content">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
          <StatCard label="Completados hoy" value={completados} color={GREEN} />
          <StatCard label="En curso"         value={coches.length} color={ACCENT} />
        </div>

        {error && (
          <div style={{
            background: "#fee2e2", border: "1px solid #fca5a5",
            padding: 16, borderRadius: 10, color: "#991b1b", marginBottom: 20,
          }}>
            {error}
          </div>
        )}

        {cargando && coches.length === 0 && (
          <div style={{ textAlign: "center", color: "#6b7280", padding: 40 }}>
            Cargando trabajos...
          </div>
        )}

        {coches.map(coche => (
          <CocheFlowCard key={coche.key} coche={coche} onAccion={handleAccion} />
        ))}

        {!cargando && coches.length === 0 && (
          <div style={{
            background: `${ACCENT}08`, border: `2px dashed ${ACCENT}30`,
            padding: 48, borderRadius: 14, textAlign: "center",
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
            <p style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>Todo al día</p>
            <p style={{ fontSize: 14, color: "#6b7280", marginTop: 6 }}>
              No tienes trabajos pendientes.
            </p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
