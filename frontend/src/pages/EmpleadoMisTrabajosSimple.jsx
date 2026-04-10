import React, { useState, useEffect, useContext } from "react";
import { Context } from "../store/appContext";
import {
  obtenerPartesPorEmpleadoYEstado,
  cambiarEstadoParte,
  formatMinutes,
  formatDate,
  sugerirSiguienteTrabajo,
} from "../utils/parteTrabajoApi";

const ICONS = {
  back: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  ),
  play: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  ),
  pause: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="6" y="4" width="4" height="16" />
      <rect x="14" y="4" width="4" height="16" />
    </svg>
  ),
  check: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
  clock: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  car: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 17h2c.55 0 1-.45 1-1v-1c0-.55-.45-1-1-1V7c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v8c-.55 0-1 .45-1 1v1c0 .55.45 1 1 1h2" />
      <circle cx="7" cy="17" r="2" />
      <circle cx="17" cy="17" r="2" />
    </svg>
  ),
  alert: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
};

const ACCENT = "#6366f1";

function TrabajoCarte({ parte, onAccion, tipo = "proximo" }) {
  const coche_descripcion =
    parte.coche_marca || parte.vehiculo_marca
      ? `${parte.coche_marca || parte.vehiculo_marca} ${
          parte.coche_modelo || parte.vehiculo_modelo || ""
        }`.trim()
      : "Vehículo sin especificar";

  const matricula = parte.matricula || parte.coche_matricula || "---";

  return (
    <div
      className="sw-trabajo-card"
      style={{
        background: "white",
        border: `1px solid #e5e7eb`,
        borderRadius: "10px",
        padding: "16px",
        marginBottom: "12px",
        position: "relative",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: "14px",
              fontWeight: "500",
              color: "#1f2937",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              marginBottom: "4px",
            }}
          >
            <span style={{ color: ACCENT }}>#{parte.id}</span>
            <span style={{ color: "#6b7280" }}>·</span>
            <span style={{ color: "#6b7280" }}>{parte.tipo_tarea || "Trabajo"}</span>
          </div>
          <div style={{ fontSize: "15px", fontWeight: "600", color: "#111827", marginBottom: "8px" }}>
            {parte.observaciones || "Sin descripción"}
          </div>
          <div
            style={{
              fontSize: "13px",
              color: "#6b7280",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              {ICONS.car}
              {coche_descripcion} ({matricula})
            </span>
          </div>
        </div>
        <div
          style={{
            background: `${ACCENT}12`,
            color: ACCENT,
            padding: "6px 12px",
            borderRadius: "6px",
            fontSize: "12px",
            fontWeight: "600",
            whiteSpace: "nowrap",
            marginLeft: "12px",
          }}
        >
          {formatMinutes(parte.tiempo_estimado_minutos)}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: "8px",
          justifyContent: "flex-end",
        }}
      >
        {tipo === "proximo" && (
          <>
            <button
              onClick={() => onAccion("iniciar", parte)}
              style={{
                background: ACCENT,
                color: "white",
                border: "none",
                padding: "8px 16px",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: "600",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.boxShadow = `0 4px 12px ${ACCENT}40`)}
              onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "none")}
            >
              {ICONS.play}
              Iniciar
            </button>
          </>
        )}

        {tipo === "en-progreso" && (
          <>
            <button
              onClick={() => onAccion("pausar", parte)}
              style={{
                background: "transparent",
                color: "#6b7280",
                border: "1px solid #d1d5db",
                padding: "8px 16px",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: "600",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              {ICONS.pause}
              Pausar
            </button>
            <button
              onClick={() => onAccion("finalizar", parte)}
              style={{
                background: "#10b981",
                color: "white",
                border: "none",
                padding: "8px 16px",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: "600",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              {ICONS.check}
              Finalizar
            </button>
          </>
        )}

        {tipo === "en-pausa" && (
          <>
            <button
              onClick={() => onAccion("reanudar", parte)}
              style={{
                background: ACCENT,
                color: "white",
                border: "none",
                padding: "8px 16px",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: "600",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              {ICONS.play}
              Reanudar
            </button>
            <button
              onClick={() => onAccion("finalizar", parte)}
              style={{
                background: "#10b981",
                color: "white",
                border: "none",
                padding: "8px 16px",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: "600",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              {ICONS.check}
              Finalizar
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function EmpleadoMisTrabajosSimple({ empleadoId, userRol }) {
  const { store } = useContext(Context);
  const [partes, setPartes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [enProgreso, setEnProgreso] = useState(null);
  const [enPausa, setEnPausa] = useState(null);
  const [completados, setCompletados] = useState(0);

  const cargarPartes = async () => {
    try {
      setCargando(true);
      const data = await obtenerPartesPorEmpleadoYEstado(empleadoId);
      const lista = Array.isArray(data) ? data : [];

      // Separar por estado
      const enProg = lista.find((p) => p.estado === "en_proceso");
      const enPa = lista.find((p) => p.estado === "en_pausa");
      const pendientes = lista.filter((p) => p.estado === "pendiente");
      const finaliz = lista.filter((p) => p.estado === "finalizado").length;

      setEnProgreso(enProg || null);
      setEnPausa(enPa || null);
      setPartes(pendientes);
      setCompletados(finaliz);
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error("Error cargando partes:", err);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarPartes();
    const intervalo = setInterval(cargarPartes, 30000); // Actualizar cada 30s
    return () => clearInterval(intervalo);
  }, [empleadoId]);

  const handleAccion = async (accion, parte) => {
    try {
      let nuevoEstado;
      if (accion === "iniciar") {
        nuevoEstado = "en_proceso";
      } else if (accion === "pausar") {
        nuevoEstado = "en_pausa";
      } else if (accion === "reanudar") {
        nuevoEstado = "en_proceso";
      } else if (accion === "finalizar") {
        nuevoEstado = "finalizado";
      }

      await cambiarEstadoParte(parte.id, nuevoEstado);

      // Sugerir siguiente si se finalizó
      if (accion === "finalizar") {
        try {
          const siguiente = await sugerirSiguienteTrabajo(empleadoId);
          // El siguiente se cargará al refrescar desde el intervalo
        } catch {
          // Si no hay siguiente, es normal
        }
      }

      // Recargar
      setTimeout(cargarPartes, 500);
    } catch (err) {
      setError(err.message);
      console.error("Error actualizando parte:", err);
    }
  };

  return (
    <div className="sw-veh-wrapper">
      <div className="sw-veh-hero">
        <div className="container sw-veh-hero-inner">
          <a href="/" className="sw-veh-back" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "8px", color: ACCENT }}>
            {ICONS.back}
            <span>Inicio</span>
          </a>
          <div className="sw-veh-hero-body">
            <span
              className="sw-veh-hero-icon"
              style={{
                background: `${ACCENT}15`,
                borderColor: `${ACCENT}30`,
                color: ACCENT,
              }}
            >
              {ICONS.clock}
            </span>
            <div>
              <h1 className="sw-veh-hero-title">Mis Trabajos</h1>
              <p className="sw-veh-hero-sub">Tus tareas asignadas en tiempo real</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container sw-veh-content">
        {/* HEADER CON STATS */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "12px",
            marginBottom: "24px",
          }}
        >
          <div
            style={{
              background: "white",
              border: `1px solid #e5e7eb`,
              padding: "16px",
              borderRadius: "10px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "6px" }}>
              Completados hoy
            </div>
            <div style={{ fontSize: "28px", fontWeight: "700", color: ACCENT }}>
              {completados}
            </div>
          </div>
          <div
            style={{
              background: "white",
              border: `1px solid #e5e7eb`,
              padding: "16px",
              borderRadius: "10px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "6px" }}>
              Por hacer
            </div>
            <div style={{ fontSize: "28px", fontWeight: "700", color: "#6b7280" }}>
              {partes.length + (enProgreso ? 1 : 0) + (enPausa ? 1 : 0)}
            </div>
          </div>
        </div>

        {cargando && !partes.length && !enProgreso && (
          <div
            style={{
              background: "white",
              padding: "40px",
              borderRadius: "10px",
              textAlign: "center",
              color: "#6b7280",
            }}
          >
            Cargando trabajos...
          </div>
        )}

        {error && (
          <div
            style={{
              background: "#fee2e2",
              border: "1px solid #fca5a5",
              padding: "16px",
              borderRadius: "10px",
              color: "#991b1b",
              marginBottom: "20px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            {ICONS.alert}
            {error}
          </div>
        )}

        {/* EN PROGRESO */}
        {(enProgreso || enPausa) && (
          <div style={{ marginBottom: "32px" }}>
            <h2
              style={{
                fontSize: "16px",
                fontWeight: "700",
                color: "#111827",
                marginBottom: "12px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span
                style={{
                  width: "8px",
                  height: "8px",
                  background: enProgreso ? "#ef4444" : "#f59e0b",
                  borderRadius: "50%",
                  animation: enProgreso ? "pulse 2s infinite" : "none",
                }}
              />
              {enProgreso ? "EN PROGRESO AHORA" : "EN PAUSA"}
            </h2>
            <TrabajoCarte
              parte={enProgreso || enPausa}
              onAccion={handleAccion}
              tipo={enProgreso ? "en-progreso" : "en-pausa"}
            />
          </div>
        )}

        {/* PRÓXIMOS TRABAJOS */}
        {partes.length > 0 && (
          <div style={{ marginBottom: "32px" }}>
            <h2
              style={{
                fontSize: "16px",
                fontWeight: "700",
                color: "#111827",
                marginBottom: "12px",
              }}
            >
              Próximos trabajos {partes.length > 1 && `(${partes.length})`}
            </h2>
            <div>
              {partes.map((parte, idx) => (
                <TrabajoCarte
                  key={parte.id}
                  parte={parte}
                  onAccion={handleAccion}
                  tipo="proximo"
                />
              ))}
            </div>
          </div>
        )}

        {!cargando && partes.length === 0 && !enProgreso && !enPausa && (
          <div
            style={{
              background: `${ACCENT}08`,
              border: `2px dashed ${ACCENT}30`,
              padding: "40px",
              borderRadius: "10px",
              textAlign: "center",
              color: "#6b7280",
            }}
          >
            <div style={{ fontSize: "32px", marginBottom: "12px" }}>✓</div>
            <p style={{ fontSize: "16px", fontWeight: "600", color: "#111827" }}>
              Todos los trabajos completados
            </p>
            <p style={{ fontSize: "14px", marginTop: "6px" }}>
              Buen trabajo. Vuelve pronto para nuevas tareas.
            </p>
          </div>
        )}
      </div>

      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}
      </style>
    </div>
  );
}
