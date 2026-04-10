import React from "react";
import { Navigate } from "react-router-dom";

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
  pdf: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  ),
  download: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  ),
  print: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </svg>
  ),
  box: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
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
  loader: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ animation: "spin 1s linear infinite" }}
    >
      <line x1="12" y1="2" x2="12" y2="6" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="4.22" y1="4.22" x2="7.34" y2="7.34" />
      <line x1="16.66" y1="16.66" x2="19.78" y2="19.78" />
      <line x1="2" y1="12" x2="6" y2="12" />
      <line x1="18" y1="12" x2="22" y2="12" />
      <line x1="4.22" y1="19.78" x2="7.34" y2="16.66" />
      <line x1="16.66" y1="7.34" x2="19.78" y2="4.22" />
    </svg>
  ),
};

const ACCENT = "#6366f1";

function CocheEntregaCard({ coche, onGenerarInforme, onEntregar, generando, entreganCombinados }) {
  const isParticular = !coche.cliente_tipo || coche.cliente_tipo === "particular";

  // Agrupar por coche_id los partes completados
  const serviciosRealizados = coche.servicios_realizados || [];
  const tiempoTotal = coche.tiempo_total || 0;

  return (
    <div
      style={{
        background: "white",
        border: "1px solid #e5e7eb",
        borderRadius: "10px",
        padding: "20px",
        marginBottom: "16px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
        <div>
          <h3
            style={{
              fontSize: "18px",
              fontWeight: "700",
              color: "#111827",
              marginBottom: "4px",
            }}
          >
            {coche.matricula || "---"}
          </h3>
          <p style={{ fontSize: "14px", color: "#6b7280", marginBottom: "8px" }}>
            {coche.marca || "Marca"} {coche.modelo || "Modelo"}
          </p>
          {coche.cliente_nombre && (
            <p style={{ fontSize: "13px", color: "#6b7280" }}>
              <strong>Cliente:</strong> {coche.cliente_nombre}
            </p>
          )}
        </div>
        <div
          style={{
            background: "#d1fae5",
            color: "#065f46",
            padding: "8px 16px",
            borderRadius: "6px",
            fontSize: "12px",
            fontWeight: "600",
            whiteSpace: "nowrap",
          }}
        >
          ✓ Listo para entregar
        </div>
      </div>

      {/* SERVICIOS REALIZADOS */}
      {serviciosRealizados.length > 0 && (
        <div style={{ marginBottom: "16px" }}>
          <h4 style={{ fontSize: "13px", fontWeight: "600", color: "#6b7280", marginBottom: "8px" }}>
            Servicios realizados:
          </h4>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
            }}
          >
            {serviciosRealizados.map((srv, idx) => (
              <div
                key={idx}
                style={{
                  background: `${ACCENT}08`,
                  color: ACCENT,
                  padding: "6px 12px",
                  borderRadius: "4px",
                  fontSize: "12px",
                  fontWeight: "600",
                }}
              >
                {srv}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* OBSERVACIONES */}
      {coche.observaciones && (
        <div style={{ marginBottom: "16px", padding: "12px", background: "#f9fafb", borderRadius: "6px" }}>
          <p style={{ fontSize: "12px", color: "#6b7280", fontStyle: "italic" }}>
            <strong>Observaciones:</strong> {coche.observaciones}
          </p>
        </div>
      )}

      {/* ACCIONES */}
      <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
        {isParticular && (
          <button
            onClick={() => onGenerarInforme(coche)}
            disabled={generando}
            style={{
              background: "transparent",
              color: ACCENT,
              border: `1px solid ${ACCENT}`,
              padding: "10px 16px",
              borderRadius: "6px",
              fontSize: "13px",
              fontWeight: "600",
              cursor: generando ? "default" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              opacity: generando ? 0.6 : 1,
            }}
          >
            {generando ? ICONS.loader : ICONS.pdf}
            {generando ? "Generando..." : "Generar informe"}
          </button>
        )}
        <button
          onClick={() => onEntregar(coche)}
          style={{
            background: "#10b981",
            color: "white",
            border: "none",
            padding: "10px 16px",
            borderRadius: "6px",
            fontSize: "13px",
            fontWeight: "600",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          {ICONS.box}
          Marcar como entregado
        </button>
      </div>
    </div>
  );
}

export default function CalidadEntregaPage() {
  return <Navigate to="/repaso-entrega?tab=firma" replace />;
}
