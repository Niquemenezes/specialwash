import { useEffect, useState } from "react";
import { _registrarSetter, _resolver } from "../utils/confirmar";

const EMPTY = { show: false, mensaje: "", titulo: "Confirmar", labelConfirmar: "Eliminar", labelCancelar: "Cancelar", danger: true };

/**
 * ModalConfirmar — debe renderizarse UNA SOLA VEZ en App.js.
 * No necesita props; se controla internamente vía confirmar().
 */
export default function ModalConfirmar() {
  const [state, setState] = useState(EMPTY);

  useEffect(() => {
    _registrarSetter((s) => setState((prev) => ({ ...prev, ...s })));
    return () => _registrarSetter(null);
  }, []);

  if (!state.show) return null;

  return (
    <div
      className="modal fade show d-block"
      tabIndex="-1"
      role="dialog"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)", zIndex: 9999 }}
      onClick={(e) => { if (e.target === e.currentTarget) _resolver(false); }}
    >
      <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: 420 }}>
        <div
          className="modal-content"
          style={{
            background: "var(--sw-surface)",
            border: "1px solid var(--sw-border)",
            borderRadius: 14,
            boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
          }}
        >
          {/* Cabecera */}
          <div
            className="modal-header"
            style={{
              borderBottom: "1px solid var(--sw-border)",
              padding: "1rem 1.25rem 0.85rem",
            }}
          >
            <h5
              className="modal-title fw-bold"
              style={{ color: state.danger ? "#ef4444" : "var(--sw-accent,#d4af37)", fontSize: "1rem" }}
            >
              {state.danger ? "⚠ " : ""}
              {state.titulo}
            </h5>
            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={() => _resolver(false)}
              aria-label="Cancelar"
              style={{ filter: "invert(1) brightness(0.7)" }}
            />
          </div>

          {/* Cuerpo */}
          <div className="modal-body" style={{ padding: "1.25rem", color: "var(--sw-text)", fontSize: "0.92rem", lineHeight: 1.55 }}>
            {state.mensaje}
          </div>

          {/* Botones */}
          <div
            className="modal-footer"
            style={{ borderTop: "1px solid var(--sw-border)", padding: "0.85rem 1.25rem", gap: "0.6rem", justifyContent: "flex-end" }}
          >
            <button
              type="button"
              className="btn"
              onClick={() => _resolver(false)}
              style={{
                background: "var(--sw-surface-2)",
                border: "1px solid var(--sw-border)",
                color: "var(--sw-muted)",
                borderRadius: 9,
                padding: "0.45rem 1.1rem",
                fontWeight: 500,
                fontSize: "0.875rem",
              }}
            >
              {state.labelCancelar}
            </button>
            <button
              type="button"
              onClick={() => _resolver(true)}
              style={{
                background: state.danger
                  ? "linear-gradient(135deg,#ef4444,#dc2626)"
                  : "linear-gradient(135deg,var(--sw-accent,#d4af37),color-mix(in srgb,var(--sw-accent,#d4af37) 75%,#fff))",
                border: "none",
                color: state.danger ? "#fff" : "#000",
                borderRadius: 9,
                padding: "0.45rem 1.25rem",
                fontWeight: 700,
                fontSize: "0.875rem",
                cursor: "pointer",
              }}
            >
              {state.labelConfirmar}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
