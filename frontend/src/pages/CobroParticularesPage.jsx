import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { confirmar } from "../utils/confirmar";
import { toast } from "../utils/toast";

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
  money: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="8" />
      <path d="M8 12h8M12 8v8" />
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
      <polyline points="20 6 9 17 4 12" />
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

const ACCENT = "#10b981";

function CobroCocheCard({ coche, onMarcarCobrado }) {
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
        <div style={{ textAlign: "right" }}>
          <p style={{ fontSize: "14px", fontWeight: "600", color: ACCENT, marginBottom: "8px" }}>
            Importe
          </p>
          <p style={{ fontSize: "20px", fontWeight: "700", color: "#111827" }}>
            {coche.precio_estimado ? `$${Number(coche.precio_estimado).toFixed(2)}` : "---"}
          </p>
        </div>
      </div>

      {coche.observaciones && (
        <div style={{ marginBottom: "16px", padding: "12px", background: "#f9fafb", borderRadius: "6px" }}>
          <p style={{ fontSize: "12px", color: "#6b7280" }}>
            <strong>Observaciones:</strong> {coche.observaciones}
          </p>
        </div>
      )}

      <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
        <button
          onClick={() => onMarcarCobrado(coche)}
          style={{
            background: ACCENT,
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
          {ICONS.check}
          Cobrado
        </button>
      </div>
    </div>
  );
}

export default function CobroParticularesPage() {
  const [coches, setCoches] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Placeholder: aquí iría la lógica para obtener coches para cobrar
    // Por ahora mostrar empty state
    setCargando(false);
  }, []);

  const handleMarcarCobrado = async (coche) => {
    if (await confirmar(`¿Confirmar cobro del vehículo ${coche.matricula}?`, { danger: false, labelConfirmar: "Sí, confirmar" })) {
      // Placeholder: aquí iría la lógica para marcar como cobrado
      toast.success("Cobro registrado: " + coche.matricula);
      setCoches(coches.filter(c => c.id !== coche.id));
    }
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
              {ICONS.money}
            </span>
            <div>
              <h1 className="sw-veh-hero-title">Cobro de Particulares</h1>
              <p className="sw-veh-hero-sub">Registra cobros de clientes particulares</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container sw-veh-content">
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

        {cargando && !coches.length && (
          <div
            style={{
              background: "white",
              padding: "40px",
              borderRadius: "10px",
              textAlign: "center",
              color: "#6b7280",
            }}
          >
            Cargando vehículos...
          </div>
        )}

        {!cargando && coches.length === 0 && (
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
            <div style={{ fontSize: "32px", marginBottom: "12px" }}>💰</div>
            <p style={{ fontSize: "16px", fontWeight: "600", color: "#111827" }}>
              Sin coches para cobrar
            </p>
            <p style={{ fontSize: "14px", marginTop: "6px" }}>
              Los vehículos de particulares entregados aparecerán aquí.
            </p>
          </div>
        )}

        {coches.length > 0 && (
          <>
            <div
              style={{
                background: "white",
                border: `1px solid #e5e7eb`,
                borderRadius: "10px",
                padding: "16px",
                marginBottom: "24px",
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  background: `${ACCENT}15`,
                  borderRadius: "8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: ACCENT,
                  fontSize: "18px",
                }}
              >
                {ICONS.money}
              </div>
              <div>
                <div style={{ fontSize: "14px", fontWeight: "600", color: "#111827" }}>
                  {coches.length} vehículo{coches.length > 1 ? "s" : ""} para cobrar
                </div>
                <p style={{ fontSize: "12px", color: "#6b7280", marginTop: "2px" }}>
                  Registra los cobros realizados
                </p>
              </div>
            </div>

            {coches.map((coche) => (
              <CobroCocheCard
                key={coche.id}
                coche={coche}
                onMarcarCobrado={handleMarcarCobrado}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
