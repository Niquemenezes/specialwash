import React from "react";

/**
 * Paginacion — componente reutilizable de paginación.
 *
 * Props:
 *   total   {number}   — total de elementos (no de páginas)
 *   page    {number}   — página actual (base 1)
 *   limit   {number}   — elementos por página
 *   onChange {fn}      — callback (nuevaPagina: number) => void
 */
export default function Paginacion({ total, page, limit, onChange }) {
  const pages = Math.ceil(total / limit);
  if (pages <= 1) return null;

  // Ventana de hasta 5 botones de página
  let start = Math.max(1, page - 2);
  let end = Math.min(pages, start + 4);
  if (end - start < 4) start = Math.max(1, end - 4);
  const visibles = [];
  for (let i = start; i <= end; i++) visibles.push(i);

  const btn = (label, target, disabled = false, active = false) => (
    <li key={label} className={`page-item${disabled ? " disabled" : ""}${active ? " active" : ""}`}>
      <button
        className="page-link"
        onClick={() => !disabled && onChange(target)}
        style={{
          background: active ? "var(--sw-accent,#d4af37)" : "var(--sw-surface)",
          borderColor: active ? "var(--sw-accent,#d4af37)" : "var(--sw-border)",
          color: active ? "#000" : "var(--sw-text)",
          fontWeight: active ? 700 : 400,
          minWidth: 36,
        }}
      >
        {label}
      </button>
    </li>
  );

  return (
    <nav aria-label="Paginación" className="d-flex justify-content-center mt-3">
      <ul className="pagination pagination-sm mb-0 gap-1">
        {btn("‹", page - 1, page === 1)}
        {start > 1 && (
          <>
            {btn(1, 1, false, page === 1)}
            {start > 2 && <li className="page-item disabled"><span className="page-link" style={{ background: "var(--sw-surface)", borderColor: "var(--sw-border)", color: "var(--sw-muted)" }}>…</span></li>}
          </>
        )}
        {visibles.map((p) => btn(p, p, false, p === page))}
        {end < pages && (
          <>
            {end < pages - 1 && <li className="page-item disabled"><span className="page-link" style={{ background: "var(--sw-surface)", borderColor: "var(--sw-border)", color: "var(--sw-muted)" }}>…</span></li>}
            {btn(pages, pages, false, page === pages)}
          </>
        )}
        {btn("›", page + 1, page === pages)}
      </ul>
    </nav>
  );
}
