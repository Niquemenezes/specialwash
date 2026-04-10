import { useEffect, useState } from "react";
import { _registrarAddToast } from "../utils/toast";

const ICONS = {
  success: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18, flexShrink: 0 }}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  error: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18, flexShrink: 0 }}>
      <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
    </svg>
  ),
  info: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18, flexShrink: 0 }}>
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  ),
};

const COLORS = {
  success: { bg: "rgba(34,197,94,0.12)", border: "rgba(34,197,94,0.35)", color: "#22c55e" },
  error:   { bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.35)", color: "#ef4444" },
  info:    { bg: "rgba(212,175,55,0.12)", border: "rgba(212,175,55,0.35)", color: "var(--sw-accent,#d4af37)" },
};

function ToastItem({ item, onRemove }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger enter animation
    const t1 = setTimeout(() => setVisible(true), 10);
    // Start exit animation before removal
    const t2 = setTimeout(() => setVisible(false), item.duracion - 350);
    const t3 = setTimeout(() => onRemove(item.id), item.duracion);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [item.id, item.duracion, onRemove]);

  const c = COLORS[item.tipo] || COLORS.info;

  return (
    <div
      role="alert"
      onClick={() => { setVisible(false); setTimeout(() => onRemove(item.id), 300); }}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "0.6rem",
        background: "var(--sw-surface)",
        border: `1px solid ${c.border}`,
        borderLeft: `3px solid ${c.color}`,
        borderRadius: 10,
        padding: "0.7rem 1rem",
        boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
        color: "var(--sw-text)",
        fontSize: "0.875rem",
        lineHeight: 1.45,
        cursor: "pointer",
        minWidth: 220,
        maxWidth: 360,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateX(0)" : "translateX(24px)",
        transition: "opacity 0.3s ease, transform 0.3s ease",
        pointerEvents: "all",
      }}
    >
      <span style={{ color: c.color, marginTop: 1 }}>{ICONS[item.tipo]}</span>
      <span style={{ flex: 1 }}>{item.mensaje}</span>
    </div>
  );
}

/**
 * ToastSW — debe renderizarse UNA SOLA VEZ en App.js.
 */
export default function ToastSW() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    _registrarAddToast((t) => setToasts((prev) => [...prev, t]));
    return () => _registrarAddToast(null);
  }, []);

  const remove = (id) => setToasts((prev) => prev.filter((t) => t.id !== id));

  if (!toasts.length) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "1.5rem",
        right: "1.5rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.6rem",
        zIndex: 99999,
        pointerEvents: "none",
      }}
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} item={t} onRemove={remove} />
      ))}
    </div>
  );
}
