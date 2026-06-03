import React, { useState, useEffect, useCallback, useRef } from "react";

const MESES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];

const METODOS = ["Efectivo","Bizum","Tarjeta","Transferencia","Factura"];

const ESTADOS_SUGERIDOS = ["Entregado","FACTURA","AGUARDANDO","PENDIENTE"];

const fmt = (num) =>
  num != null && num > 0
    ? `${parseFloat(num).toFixed(2).replace(".", ",")} €`
    : "";

const fmtInput = (num) =>
  num != null && num > 0 ? parseFloat(num).toFixed(2) : "";

// ── Celda editable ─────────────────────────────────────────────────────────────
function EditableCell({ value, onSave, type = "text", options = null, sugerencias = null, style = {} }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value ?? "");
  const inputRef = useRef();

  useEffect(() => { setVal(value ?? ""); }, [value]);
  useEffect(() => { if (editing && inputRef.current) inputRef.current.focus(); }, [editing]);

  const commit = () => {
    setEditing(false);
    const trimmed = type === "number" ? val : (typeof val === "string" ? val.trim() : val);
    if (String(trimmed) !== String(value ?? "")) onSave(trimmed);
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter") commit();
    if (e.key === "Escape") { setEditing(false); setVal(value ?? ""); }
  };

  if (!editing) {
    return (
      <span
        onClick={() => setEditing(true)}
        title="Clic para editar"
        style={{ cursor: "pointer", display: "block", minHeight: "18px", ...style }}
      >
        {value ?? ""}
      </span>
    );
  }

  if (options) {
    return (
      <select
        ref={inputRef}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={commit}
        style={{ width: "100%", border: "1px solid #ffd700", background: "#fffde7", padding: "1px 2px", fontSize: "12px" }}
      >
        <option value=""></option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      <input
        ref={inputRef}
        type={type}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={onKeyDown}
        list={sugerencias ? `sug-${Math.random()}` : undefined}
        style={{ width: "100%", border: "1px solid #ffd700", background: "#fffde7", padding: "1px 4px", fontSize: "12px" }}
      />
      {sugerencias && (
        <datalist id={`sug-${val}`}>
          {sugerencias.map((s) => <option key={s} value={s} />)}
        </datalist>
      )}
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────────────────────
export default function TablaRegistrosPage() {
  const today = new Date();
  const [mes, setMes] = useState(today.getMonth() + 1);
  const [anio, setAnio] = useState(today.getFullYear());
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(null); // id de la fila que se está guardando
  const [error, setError] = useState(null);

  const fetchRegistros = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/tabla-registros?mes=${mes}&anio=${anio}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Error al cargar registros");
      setRegistros(await res.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [mes, anio]);

  useEffect(() => { fetchRegistros(); }, [fetchRegistros]);

  const saveCell = async (id, campo, valor) => {
    setSaving(id);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/tabla-registros/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ [campo]: valor }),
      });
      if (!res.ok) throw new Error("Error al guardar");
      const updated = await res.json();
      setRegistros((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...updated } : r))
      );
    } catch (e) {
      alert(`Error al guardar: ${e.message}`);
    } finally {
      setSaving(null);
    }
  };

  const getRowStyle = (row) => {
    if (row.entregado) {
      return row.es_concesionario ? { color: "#1a65b5" } : { color: "#1a8a1a" };
    }
    if (!row.es_concesionario) return { color: "#c2185b" };
    return {};
  };

  const totalPrecio = registros.reduce((s, r) => s + (parseFloat(r.precio) || 0), 0);
  const totalIva = registros.reduce((s, r) => s + (parseFloat(r.iva) || 0), 0);

  // Generar opciones de mes (últimos 12 meses)
  const mesesOpciones = [];
  for (let i = 0; i < 12; i++) {
    let m = today.getMonth() + 1 - i;
    let a = today.getFullYear();
    if (m <= 0) { m += 12; a -= 1; }
    mesesOpciones.push({ mes: m, anio: a, label: `${MESES[m - 1]} ${a}` });
  }

  const cellStyle = {
    border: "1px solid #ddd",
    padding: "4px 6px",
    fontSize: "12px",
    whiteSpace: "nowrap",
    maxWidth: "160px",
    overflow: "hidden",
    textOverflow: "ellipsis",
  };
  const thStyle = {
    ...cellStyle,
    background: "#ffd700",
    fontWeight: "bold",
    color: "#333",
    textAlign: "center",
    whiteSpace: "nowrap",
  };

  return (
    <div style={{ padding: "16px", fontFamily: "Arial, sans-serif" }}>
      {/* Cabecera */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px", flexWrap: "wrap" }}>
        <h4 style={{ margin: 0, fontWeight: "bold" }}>Tabla de Registros</h4>
        <button
          onClick={fetchRegistros}
          style={{ padding: "4px 12px", fontSize: "12px", cursor: "pointer", borderRadius: "4px", border: "1px solid #aaa" }}
        >
          Actualizar
        </button>
      </div>

      {/* Selector de mes */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "12px", flexWrap: "wrap" }}>
        {mesesOpciones.map(({ mes: m, anio: a, label }) => {
          const activo = m === mes && a === anio;
          return (
            <button
              key={label}
              onClick={() => { setMes(m); setAnio(a); }}
              style={{
                padding: "4px 12px",
                fontSize: "12px",
                cursor: "pointer",
                borderRadius: "4px",
                border: activo ? "2px solid #f5a623" : "1px solid #ccc",
                background: activo ? "#ffd700" : "#f9f9f9",
                fontWeight: activo ? "bold" : "normal",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {error && (
        <div style={{ background: "#ffeeba", border: "1px solid #ffc107", padding: "8px", marginBottom: "12px", borderRadius: "4px" }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: "40px", color: "#888" }}>Cargando...</div>
      ) : (
        <>
          {/* Título del mes (como en Sheets) */}
          <div style={{ background: "#ffd700", fontWeight: "bold", textAlign: "center", padding: "6px", border: "1px solid #ddd", marginBottom: "-1px", fontSize: "14px" }}>
            {MESES[mes - 1]} {anio}
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", minWidth: "900px" }}>
              <thead>
                <tr>
                  <th style={thStyle}>Fecha</th>
                  <th style={thStyle}>Modelo/Marca</th>
                  <th style={thStyle}>Empresa/Particular</th>
                  <th style={thStyle}>Matrícula</th>
                  <th style={{ ...thStyle, maxWidth: "220px" }}>Tipo de Limpieza</th>
                  <th style={thStyle}>Precio</th>
                  <th style={thStyle}>IVA</th>
                  <th style={thStyle}>Método de Pago</th>
                  <th style={thStyle}>Entrega</th>
                  <th style={{ ...thStyle, maxWidth: "180px" }}>Observaciones</th>
                  <th style={thStyle}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {registros.length === 0 && (
                  <tr>
                    <td colSpan={11} style={{ ...cellStyle, textAlign: "center", color: "#999", padding: "20px" }}>
                      No hay registros para {MESES[mes - 1]} {anio}
                    </td>
                  </tr>
                )}
                {registros.map((row) => {
                  const rowStyle = getRowStyle(row);
                  const isSaving = saving === row.id;
                  return (
                    <tr
                      key={row.id}
                      style={{ background: isSaving ? "#fffde7" : "white", transition: "background 0.3s" }}
                    >
                      <td style={{ ...cellStyle, ...rowStyle }}>{row.fecha}</td>
                      <td style={{ ...cellStyle, ...rowStyle }}>{row.modelo}</td>
                      <td style={{ ...cellStyle, ...rowStyle }}>{row.cliente}</td>
                      <td style={{ ...cellStyle, ...rowStyle, fontWeight: "500" }}>{row.matricula}</td>
                      <td style={{ ...cellStyle, ...rowStyle, maxWidth: "220px", whiteSpace: "normal" }}>{row.servicios}</td>

                      {/* Precio — editable */}
                      <td style={{ ...cellStyle, ...rowStyle, textAlign: "right" }}>
                        <EditableCell
                          value={fmtInput(row.precio)}
                          type="number"
                          onSave={(v) => saveCell(row.id, "precio", v)}
                          style={rowStyle}
                        />
                      </td>

                      {/* IVA — solo lectura, calculado */}
                      <td style={{ ...cellStyle, ...rowStyle, textAlign: "right" }}>
                        {fmt(row.iva)}
                      </td>

                      {/* Método de Pago — editable (dropdown) */}
                      <td style={{ ...cellStyle, minWidth: "110px" }}>
                        <EditableCell
                          value={row.metodo}
                          options={METODOS}
                          onSave={(v) => saveCell(row.id, "metodo", v)}
                          style={rowStyle}
                        />
                      </td>

                      {/* Fecha entrega — editable */}
                      <td style={{ ...cellStyle, minWidth: "90px" }}>
                        <EditableCell
                          value={row.fecha_entrega}
                          type="text"
                          onSave={(v) => saveCell(row.id, "fecha_entrega", v)}
                          style={rowStyle}
                        />
                      </td>

                      {/* Observaciones — editable */}
                      <td style={{ ...cellStyle, maxWidth: "180px", whiteSpace: "normal" }}>
                        <EditableCell
                          value={row.observaciones}
                          type="text"
                          onSave={(v) => saveCell(row.id, "observaciones", v)}
                          style={rowStyle}
                        />
                      </td>

                      {/* Estado — editable con sugerencias */}
                      <td style={{ ...cellStyle, minWidth: "100px" }}>
                        <EditableCell
                          value={row.estado}
                          sugerencias={ESTADOS_SUGERIDOS}
                          onSave={(v) => saveCell(row.id, "estado", v)}
                          style={rowStyle}
                        />
                      </td>
                    </tr>
                  );
                })}

                {/* Fila Total */}
                {registros.length > 0 && (
                  <tr style={{ fontWeight: "bold", background: "#f5f5f5" }}>
                    <td colSpan={5} style={{ ...cellStyle, textAlign: "right" }}>Total</td>
                    <td style={{ ...cellStyle, textAlign: "right" }}>{fmt(totalPrecio)}</td>
                    <td style={{ ...cellStyle, textAlign: "right" }}>{fmt(totalIva)}</td>
                    <td colSpan={4} style={cellStyle}></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Leyenda */}
          <div style={{ marginTop: "12px", fontSize: "11px", color: "#666", display: "flex", gap: "16px", flexWrap: "wrap" }}>
            <span><span style={{ color: "#c2185b" }}>■</span> Particular (pendiente)</span>
            <span><span style={{ color: "#1a8a1a" }}>■</span> Particular entregado</span>
            <span><span style={{ color: "#1a65b5" }}>■</span> Concesionario entregado</span>
            <span style={{ color: "#999" }}>Clic en una celda para editar · Los cambios se sincronizan con Google Sheets</span>
          </div>
        </>
      )}
    </div>
  );
}
