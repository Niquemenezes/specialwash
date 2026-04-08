import React from "react";
import { useNavigate } from "react-router-dom";
import "../styles/next-steps-modal.css";

/**
 * NextStepsModal - Muestra qué sigue después de completar una acción
 *
 * @param {boolean} isOpen - Si el modal está abierto
 * @param {Object} config - Configuración del modal
 * @param {string} config.title - Título del modal
 * @param {string} config.message - Mensaje principal
 * @param {string} config.details - Detalles adicionales (opcional)
 * @param {Array} config.actions - Array de acciones [{label, href o onClick, primary}]
 * @param {Function} onClose - Callback para cerrar el modal
 */
const NextStepsModal = ({ isOpen, config = {}, onClose }) => {
  const navigate = useNavigate();
  const {
    title = "Paso completado",
    message = "",
    details = "",
    actions = [],
    icon = "✓"
  } = config;

  if (!isOpen) return null;

  const handleAction = (action) => {
    if (action.href) {
      navigate(action.href);
    } else if (action.onClick) {
      action.onClick();
    }
    onClose();
  };

  return (
    <div className="next-steps-modal-overlay" onClick={onClose}>
      <div className="next-steps-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="next-steps-modal__header">
          <span className="next-steps-modal__icon">{icon}</span>
          <h2 className="next-steps-modal__title">{title}</h2>
          <button
            className="next-steps-modal__close"
            onClick={onClose}
            aria-label="Cerrar modal"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="next-steps-modal__content">
          <p className="next-steps-modal__message">{message}</p>
          {details && (
            <p className="next-steps-modal__details">{details}</p>
          )}
        </div>

        {/* Actions */}
        {actions.length > 0 && (
          <div className="next-steps-modal__actions">
            {actions.map((action, index) => (
              <button
                key={index}
                className={`btn ${action.primary ? "btn-primary" : "btn-secondary"}`}
                onClick={() => handleAction(action)}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}

        {/* Footer */}
        {!actions.length && (
          <button
            className="btn btn-primary"
            onClick={onClose}
            style={{ width: "100%" }}
          >
            Entendido
          </button>
        )}
      </div>
    </div>
  );
};

export default NextStepsModal;
