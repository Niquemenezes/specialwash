import React, { useState, useEffect, useContext } from "react";
import { Link } from "react-router-dom";
import { Context } from "../store/appContext";
import {
  obtenerCochesEnProgreso,
  listarPartesTrabajo,
  cambiarEstadoParte,
  formatDate,
  formatMinutes,
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
  list: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  ),
  chevron: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="9 18 15 12 9 6" />
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
  user: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
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
};

const ACCENT = "#6366f1";

function VehicleTimeline({ parte, stats }) {
  const getEstadoBadge = (estado) => {
    const configs = {
      pendiente: { bg: "#f3f4f6", text: "#6b7280", label: "Pendiente" },
      nuevo: { bg: "#f3f4f6", text: "#6b7280", label: "Nuevo" },
      en_progreso: { bg: `${ACCENT}15`, text: ACCENT, label: "En progreso" },
      pausado: { bg: "#fef3c7", text: "#92400e", label: "En pausa" },
      completado: { bg: "#d1fae5", text: "#065f46", label: "Completado" },
      en_calidad: { bg: "#dbeafe", text: "#0c4a6e", label: "En calidad" },
      entreg: { bg: "#d1fae5", text: "#065f46", label: "Entregado" },
    };
    const config = configs[estado] || configs.pendiente;
    return config;
  };

  const estadoConfig = getEstadoBadge(parte.estado);

  return (
    <div
      style={{
        background: "white",
        border: "1px solid #e5e7eb",
        borderRadius: "10px",
        padding: "16px",
        marginBottom: "12px",
        display: "grid",
        gridTemplateColumns: "1fr auto auto",
        gap: "16px",
        alignItems: "center",
      }}
    >
      <div>
        <div
          style={{
            fontSize: "14px",
            fontWeight: "600",
            color: "#111827",
            marginBottom: "8px",
          }}
        >
          {parte.coche_matricula || "---"} ·{" "}
          {parte.coche_marca || "Vehículo"}
        </div>
        <div style={{ display: "flex", gap: "12px", fontSize: "13px", color: "#6b7280" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            {ICONS.user}
            {parte.empleado_nombre || "Sin asignar"}
          </div>
          {parte.tipo_tarea && (
            <>
              <span>·</span>
              <span>{parte.tipo_tarea}</span>
            </>
          )}
        </div>
        {parte.observaciones && (
          <div
            style={{
              fontSize: "12px",
              color: "#9ca3af",
              marginTop: "6px",
              fontStyle: "italic",
            }}
          >
            {parte.observaciones}
          </div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "4px",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "12px", color: "#6b7280" }}>Tiempo est.</div>
        <div style={{ fontSize: "16px", fontWeight: "700", color: ACCENT }}>
          {formatMinutes(parte.tiempo_estimado_minutos)}
        </div>
      </div>

      <div
        style={{
          background: estadoConfig.bg,
          color: estadoConfig.text,
          padding: "8px 12px",
          borderRadius: "6px",
          fontSize: "12px",
          fontWeight: "600",
          whiteSpace: "nowrap",
        }}
      >
        {estadoConfig.label}
      </div>
    </div>
  );
}

function StatsCard({ label, value, color = ACCENT, icon = null }) {
  return (
    <div
      style={{
        background: "white",
        border: "1px solid #e5e7eb",
        borderRadius: "10px",
        padding: "16px",
        display: "flex",
        alignItems: "center",
        gap: "12px",
      }}
    >
      {icon && (
        <div
          style={{
            width: "40px",
            height: "40px",
            background: `${color}15`,
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: color,
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
      )}
      <div>
        <div style={{ fontSize: "12px", color: "#6b7280" }}>{label}</div>
        <div style={{ fontSize: "24px", fontWeight: "700", color: color }}>
          {value}
        </div>
      </div>
    </div>
  );
}

export default function AdminPartesTrabajoAcompanamiento() {
  const [partes, setPartes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    total: 0,
    enProgreso: 0,
    enPausa: 0,
    pendiente: 0,
    completado: 0,
    enCalidad: 0,
  });

  const cargarPartes = async () => {
    try {
      setCargando(true);
      const data = await listarPartesTrabajo();
      const lista = Array.isArray(data) ? data : [];

      // Obtener hoy
      const hoy = new Date().toISOString().split("T")[0];
      const partesHoy = lista.filter((p) => {
        const fech = (p.created_at || p.fecha_creacion || "").split("T")[0];
        return fech === hoy;
      });

      setPartes(partesHoy);

      // Calcular stats
      const statsObj = {
        total: partesHoy.length,
        enProgreso: partesHoy.filter((p) => p.estado === "en_progreso").length,
        enPausa: partesHoy.filter((p) => p.estado === "pausado").length,
        pendiente: partesHoy.filter((p) => p.estado === "pendiente" || p.estado === "nuevo").length,
        completado: partesHoy.filter((p) => p.estado === "completado").length,
        enCalidad: partesHoy.filter((p) => p.estado === "en_calidad").length,
      };
      setStats(statsObj);
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
    const intervalo = setInterval(cargarPartes, 10000); // Actualizar cada 10s
    return () => clearInterval(intervalo);
  }, []);

  const partesOrdenados = {
    enProgreso: partes.filter((p) => p.estado === "en_progreso"),
    enPausa: partes.filter((p) => p.estado === "pausado"),
    enCalidad: partes.filter((p) => p.estado === "en_calidad"),
    completado: partes.filter((p) => p.estado === "completado"),
    pendiente: partes.filter((p) => p.estado === "pendiente" || p.estado === "nuevo"),
  };

  return (
    <div className="sw-veh-wrapper">
      <div className="sw-veh-hero">
        <div className="container sw-veh-hero-inner">
          <Link to="/" className="sw-veh-back" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "8px", color: ACCENT }}>
            {ICONS.back}
            <span>Inicio</span>
          </Link>
          <div className="sw-veh-hero-body">
            <span
              className="sw-veh-hero-icon"
              style={{
                background: `${ACCENT}15`,
                borderColor: `${ACCENT}30`,
                color: ACCENT,
              }}
            >
              {ICONS.list}
            </span>
            <div>
              <h1 className="sw-veh-hero-title">Acompañamiento de trabajos</h1>
              <p className="sw-veh-hero-sub">Supervisión en tiempo real del flujo de coches</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container sw-veh-content">
        {/* STATS */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "12px",
            marginBottom: "32px",
          }}
        >
          <StatsCard label="Trabajos hoy" value={stats.total} icon={ICONS.clock} />
          <StatsCard
            label="En progreso"
            value={stats.enProgreso}
            color="#ef4444"
            icon={ICONS.play}
          />
          <StatsCard
            label="En pausa"
            value={stats.enPausa}
            color="#f59e0b"
            icon={ICONS.alert}
          />
          <StatsCard
            label="Completados"
            value={stats.completado}
            color="#10b981"
            icon={ICONS.check}
          />
        </div>

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

        {cargando && !partes.length && (
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

        {/* EN PROGRESO */}
        {partesOrdenados.enProgreso.length > 0 && (
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
                  background: "#ef4444",
                  borderRadius: "50%",
                  animation: "pulse 2s infinite",
                }}
              />
              En progreso ({partesOrdenados.enProgreso.length})
            </h2>
            {partesOrdenados.enProgreso.map((parte) => (
              <VehicleTimeline key={parte.id} parte={parte} stats={stats} />
            ))}
          </div>
        )}

        {/* EN PAUSA */}
        {partesOrdenados.enPausa.length > 0 && (
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
                  background: "#f59e0b",
                  borderRadius: "50%",
                }}
              />
              En pausa ({partesOrdenados.enPausa.length})
            </h2>
            {partesOrdenados.enPausa.map((parte) => (
              <VehicleTimeline key={parte.id} parte={parte} stats={stats} />
            ))}
          </div>
        )}

        {/* EN CALIDAD */}
        {partesOrdenados.enCalidad.length > 0 && (
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
                  background: "#0ea5e9",
                  borderRadius: "50%",
                }}
              />
              En calidad ({partesOrdenados.enCalidad.length})
            </h2>
            {partesOrdenados.enCalidad.map((parte) => (
              <VehicleTimeline key={parte.id} parte={parte} stats={stats} />
            ))}
          </div>
        )}

        {/* PENDIENTES */}
        {partesOrdenados.pendiente.length > 0 && (
          <div style={{ marginBottom: "32px" }}>
            <h2
              style={{
                fontSize: "16px",
                fontWeight: "700",
                color: "#111827",
                marginBottom: "12px",
              }}
            >
              Pendientes ({partesOrdenados.pendiente.length})
            </h2>
            {partesOrdenados.pendiente.map((parte) => (
              <VehicleTimeline key={parte.id} parte={parte} stats={stats} />
            ))}
          </div>
        )}

        {/* COMPLETADOS */}
        {partesOrdenados.completado.length > 0 && (
          <div style={{ marginBottom: "32px" }}>
            <h2
              style={{
                fontSize: "14px",
                fontWeight: "600",
                color: "#6b7280",
                marginBottom: "12px",
              }}
            >
              Completados hoy ({partesOrdenados.completado.length})
            </h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
                gap: "8px",
              }}
            >
              {partesOrdenados.completado.map((parte) => (
                <div
                  key={parte.id}
                  style={{
                    background: "#f0fdf4",
                    border: "1px solid #86efac",
                    padding: "12px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    textAlign: "center",
                    color: "#065f46",
                  }}
                >
                  <div style={{ fontWeight: "600", marginBottom: "4px" }}>
                    {parte.coche_matricula || "---"}
                  </div>
                  <div style={{ fontSize: "11px", opacity: 0.8 }}>
                    {parte.tipo_tarea || "Trabajo"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!cargando && partes.length === 0 && (
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
            <div style={{ fontSize: "32px", marginBottom: "12px" }}>📋</div>
            <p style={{ fontSize: "16px", fontWeight: "600", color: "#111827" }}>
              Sin trabajos hoy
            </p>
            <p style={{ fontSize: "14px", marginTop: "6px" }}>
              Los trabajos aparecerán aquí cuando se creen nuevos partes.
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
