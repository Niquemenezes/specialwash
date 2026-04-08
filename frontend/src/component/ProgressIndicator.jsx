import React from "react";
import "../styles/progress-indicator.css";

/**
 * ProgressIndicator - Muestra dónde está el usuario en el flujo de vehículos
 *
 * @param {Array} steps - Pasos del flujo: [{id, label, completed, active, disabled}]
 * @param {Function} onStepClick - Callback cuando clickean un paso (opcional)
 */
const ProgressIndicator = ({ steps = [], onStepClick = null }) => {
  if (!steps || steps.length === 0) return null;

  return (
    <div className="progress-indicator">
      <div className="progress-container">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          const status = step.completed ? "completed" : step.active ? "active" : "pending";

          return (
            <React.Fragment key={step.id || index}>
              {/* Paso */}
              <button
                className={`progress-step progress-step--${status} ${step.disabled ? "progress-step--disabled" : ""}`}
                onClick={() => {
                  if (!step.disabled && onStepClick) {
                    onStepClick(step.id);
                  }
                }}
                disabled={step.disabled}
                aria-label={`Paso ${index + 1}: ${step.label}`}
              >
                <span className="progress-step__number">
                  {step.completed ? "✓" : index + 1}
                </span>
                <span className="progress-step__label">{step.label}</span>
              </button>

              {/* Conector (solo si no es el último) */}
              {!isLast && (
                <div className={`progress-connector progress-connector--${status}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Barra de progreso visual */}
      <div className="progress-bar-container">
        <div
          className="progress-bar"
          style={{
            width: `${((steps.filter(s => s.completed).length) / steps.length) * 100}%`
          }}
        />
      </div>
    </div>
  );
};

export default ProgressIndicator;
