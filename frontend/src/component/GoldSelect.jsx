import React, { useState, useRef, useEffect } from "react";

/**
 * Select custom con estilo dorado.
 * Props:
 *  - options: [{ value, label }]
 *  - value:   valor seleccionado
 *  - onChange: (value) => void
 *  - placeholder: texto por defecto
 *  - className: clases extra para el wrapper
 *  - disabled
 */
const GoldSelect = ({
  options = [],
  value,
  onChange,
  placeholder = "-- Seleccione --",
  className = "",
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef(null);
  const inputRef = useRef(null);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Focus en el input de búsqueda al abrir
  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const selected = options.find((o) => String(o.value) === String(value));

  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div
      ref={ref}
      className={`gold-select ${className} ${disabled ? "disabled" : ""}`}
      style={{ position: "relative" }}
    >
      {/* Botón trigger */}
      <button
        type="button"
        className="gold-select-trigger form-select"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
      >
        {selected ? selected.label : placeholder}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="gold-select-dropdown">
          {options.length > 6 && (
            <input
              ref={inputRef}
              type="text"
              className="gold-select-search"
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          )}
          <ul className="gold-select-list">
            {/* Opción vacía */}
            <li
              className={`gold-select-option ${!value ? "selected" : ""}`}
              onClick={() => {
                onChange("");
                setOpen(false);
                setSearch("");
              }}
            >
              {placeholder}
            </li>
            {filtered.map((o) => (
              <li
                key={o.value}
                className={`gold-select-option ${
                  String(o.value) === String(value) ? "selected" : ""
                }`}
                onClick={() => {
                  onChange(String(o.value));
                  setOpen(false);
                  setSearch("");
                }}
              >
                {o.label}
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="gold-select-option no-results">Sin resultados</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export default GoldSelect;
