/**
 * EmptyState — bloque visual para listas sin datos.
 *
 * Props:
 *   icon       — SVG o emoji string. Defecto: caja abierta.
 *   title      — Título principal.
 *   subtitle   — Línea secundaria opcional.
 *   action     — { label, onClick } para un botón CTA opcional.
 *   compact    — versión reducida para usar dentro de <td> o espacios pequeños.
 *   colSpan    — si se renderiza como <tr><td> de tabla, indica el colSpan.
 */
export default function EmptyState({ icon, title, subtitle, action, compact = false, colSpan }) {
  const inner = (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: compact ? "1.75rem 1rem" : "3rem 1rem",
        gap: compact ? "0.4rem" : "0.65rem",
        color: "var(--sw-muted)",
        textAlign: "center",
      }}
    >
      {/* Icono */}
      <div
        style={{
          width: compact ? 36 : 52,
          height: compact ? 36 : 52,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "50%",
          background: "var(--sw-surface-light, rgba(255,255,255,0.04))",
          border: "1px solid var(--sw-border)",
          marginBottom: compact ? 0 : "0.25rem",
          flexShrink: 0,
        }}
      >
        {icon || (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ width: compact ? 18 : 26, height: compact ? 18 : 26, opacity: 0.5 }}>
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
            <line x1="12" y1="22.08" x2="12" y2="12"/>
          </svg>
        )}
      </div>

      {/* Título */}
      <p style={{ margin: 0, fontSize: compact ? "0.825rem" : "0.9rem", fontWeight: 600, color: "var(--sw-text)", opacity: 0.7 }}>
        {title}
      </p>

      {/* Subtítulo */}
      {subtitle && (
        <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--sw-muted)", maxWidth: 320, lineHeight: 1.45 }}>
          {subtitle}
        </p>
      )}

      {/* CTA */}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          style={{
            marginTop: compact ? "0.25rem" : "0.5rem",
            background: "var(--sw-surface-2)",
            border: "1px solid var(--sw-border)",
            color: "var(--sw-accent, #d4af37)",
            borderRadius: 8,
            padding: "0.4rem 1rem",
            fontSize: "0.8rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );

  // Versión para tablas
  if (colSpan !== undefined) {
    return (
      <tr>
        <td colSpan={colSpan} style={{ padding: 0, border: "none" }}>
          {inner}
        </td>
      </tr>
    );
  }

  return inner;
}
