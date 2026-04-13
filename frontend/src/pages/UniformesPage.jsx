import { useEffect, useState } from "react";
import { apiFetch } from "../utils/apiFetch";
import { confirmar } from "../utils/confirmar";
import { toast } from "../utils/toast";

const PRENDAS = ["camiseta", "pantalon", "zapatilla", "chaqueta"];
const PRENDAS_LABEL = {
  camiseta: "Camiseta",
  pantalon: "Pantalón",
  zapatilla: "Zapatilla",
  chaqueta: "Chaqueta",
};
const PRENDAS_ICON = {
  camiseta: "👕",
  pantalon: "👖",
  zapatilla: "👟",
  chaqueta: "🧥",
};
const TALLAS_ROPA = ["XS", "S", "M", "L", "XL", "XXL"];
const TALLAS_ZAPATO = ["36", "37", "38", "39", "40", "41", "42", "43", "44", "45"];

const TABS = ["entregas", "stock", "resumen"];
const TAB_LABEL = { entregas: "Entregas", stock: "Stock", resumen: "Resumen por empleado" };

const fmtDate = (raw) => {
  if (!raw) return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return String(raw).slice(0, 10);
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const tallasParaPrenda = (prenda) =>
  prenda === "zapatilla" ? TALLAS_ZAPATO : TALLAS_ROPA;

const DEFAULT_FORM = { user_id: "", prenda: "camiseta", talla: "M", cantidad: 1, observaciones: "" };

const inputStyle = {
  background: "var(--sw-surface-2)",
  border: "1px solid var(--sw-border)",
  color: "var(--sw-text)",
  borderRadius: 8,
  padding: "0.5rem 0.75rem",
  width: "100%",
  fontSize: "0.92rem",
};

const labelStyle = { color: "var(--sw-text-muted)", fontSize: "0.8rem", marginBottom: 4, display: "block" };

export default function UniformesPage() {
  const [tab, setTab] = useState("entregas");
  const [empleados, setEmpleados] = useState([]);
  const [entregas, setEntregas] = useState([]);
  const [stock, setStock] = useState([]);
  const [resumen, setResumen] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Filtros entregas
  const [filtroEmpleado, setFiltroEmpleado] = useState("");
  const [filtroPrenda, setFiltroPrenda] = useState("");

  // Stock edit inline
  const [stockEdit, setStockEdit] = useState({}); // { "camiseta_M": 5 }
  const [savingStock, setSavingStock] = useState({});

  useEffect(() => {
    cargarEmpleados();
  }, []);

  useEffect(() => {
    if (tab === "entregas") cargarEntregas();
    if (tab === "stock") cargarStock();
    if (tab === "resumen") cargarResumen();
  }, [tab, filtroEmpleado, filtroPrenda]);

  const cargarEmpleados = async () => {
    try {
      const data = await apiFetch("/api/uniformes/empleados");
      setEmpleados(data);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const cargarEntregas = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filtroEmpleado) params.set("user_id", filtroEmpleado);
      if (filtroPrenda) params.set("prenda", filtroPrenda);
      const data = await apiFetch(`/api/uniformes/entregas?${params}`);
      setEntregas(data);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const cargarStock = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/api/uniformes/stock");
      setStock(data);
      const editInit = {};
      data.forEach((s) => { editInit[`${s.prenda}_${s.talla}`] = s.cantidad; });
      setStockEdit(editInit);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const cargarResumen = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/api/uniformes/resumen");
      setResumen(data);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => {
      const next = { ...f, [name]: value };
      // Si cambia prenda a zapatilla, resetear talla a 40
      if (name === "prenda") {
        next.talla = value === "zapatilla" ? "40" : "M";
      }
      return next;
    });
    setFormError("");
  };

  const handleRegistrarEntrega = async (e) => {
    e.preventDefault();
    if (!form.user_id) return setFormError("Selecciona un empleado.");
    if (!form.prenda) return setFormError("Selecciona una prenda.");
    if (!form.talla) return setFormError("Selecciona una talla.");
    setSaving(true);
    try {
      await apiFetch("/api/uniformes/entregas", {
        method: "POST",
        body: { ...form, cantidad: Number(form.cantidad) },
      });
      toast.success("Entrega registrada");
      setForm(DEFAULT_FORM);
      cargarEntregas();
      if (tab === "stock") cargarStock();
    } catch (e) {
      setFormError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEliminarEntrega = async (id) => {
    const ok = await confirmar("¿Eliminar esta entrega? El stock se recuperará.");
    if (!ok) return;
    try {
      await apiFetch(`/api/uniformes/entregas/${id}`, { method: "DELETE" });
      toast.success("Entrega eliminada");
      cargarEntregas();
      if (tab === "stock") cargarStock();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleGuardarStock = async (prenda, talla) => {
    const key = `${prenda}_${talla}`;
    const cantidad = Number(stockEdit[key] ?? 0);
    setSavingStock((s) => ({ ...s, [key]: true }));
    try {
      await apiFetch("/api/uniformes/stock", {
        method: "PUT",
        body: { prenda, talla, cantidad },
      });
      toast.success("Stock actualizado");
      cargarStock();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSavingStock((s) => ({ ...s, [key]: false }));
    }
  };

  // Construir tabla de stock: prendas x tallas
  const stockMap = {};
  stock.forEach((s) => { stockMap[`${s.prenda}_${s.talla}`] = s.cantidad; });

  const cardStyle = {
    background: "var(--sw-surface)",
    border: "1px solid var(--sw-border)",
    borderRadius: 14,
    padding: "1.25rem",
    marginBottom: "1rem",
  };

  const btnPrimary = {
    background: "var(--sw-accent)",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "0.55rem 1.1rem",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: "0.9rem",
  };

  const btnDanger = {
    background: "transparent",
    color: "#ef4444",
    border: "1px solid rgba(239,68,68,0.3)",
    borderRadius: 6,
    padding: "0.3rem 0.65rem",
    cursor: "pointer",
    fontSize: "0.82rem",
    fontWeight: 600,
  };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "1.5rem 1rem" }}>
      {/* Cabecera */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ color: "var(--sw-text)", fontWeight: 800, fontSize: "1.6rem", margin: 0 }}>
          👔 Uniformes
        </h1>
        <p style={{ color: "var(--sw-text-muted)", margin: "0.3rem 0 0", fontSize: "0.95rem" }}>
          Gestión de prendas entregadas a empleados y stock disponible.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", borderBottom: "1px solid var(--sw-border)", paddingBottom: "0.5rem" }}>
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              background: tab === t ? "var(--sw-accent)" : "transparent",
              color: tab === t ? "#fff" : "var(--sw-text-muted)",
              border: tab === t ? "none" : "1px solid var(--sw-border)",
              borderRadius: 8,
              padding: "0.45rem 1rem",
              fontWeight: 700,
              cursor: "pointer",
              fontSize: "0.88rem",
            }}
          >
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>

      {/* ─── TAB ENTREGAS ─── */}
      {tab === "entregas" && (
        <div>
          {/* Formulario registrar entrega */}
          <div style={cardStyle}>
            <h3 style={{ color: "var(--sw-text)", fontWeight: 700, marginBottom: "1rem", fontSize: "1rem" }}>
              Registrar entrega
            </h3>
            <form onSubmit={handleRegistrarEntrega}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "0.85rem", marginBottom: "0.85rem" }}>
                <div>
                  <label style={labelStyle}>Empleado *</label>
                  <select name="user_id" value={form.user_id} onChange={handleFormChange} style={inputStyle} required>
                    <option value="">Seleccionar...</option>
                    {empleados.map((e) => (
                      <option key={e.id} value={e.id}>{e.nombre}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Prenda *</label>
                  <select name="prenda" value={form.prenda} onChange={handleFormChange} style={inputStyle}>
                    {PRENDAS.map((p) => (
                      <option key={p} value={p}>{PRENDAS_ICON[p]} {PRENDAS_LABEL[p]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Talla *</label>
                  <select name="talla" value={form.talla} onChange={handleFormChange} style={inputStyle}>
                    {tallasParaPrenda(form.prenda).map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Cantidad</label>
                  <input
                    type="number" name="cantidad" min={1} max={20}
                    value={form.cantidad} onChange={handleFormChange}
                    style={inputStyle}
                  />
                </div>
                <div style={{ gridColumn: "span 2" }}>
                  <label style={labelStyle}>Observaciones</label>
                  <input
                    type="text" name="observaciones" value={form.observaciones}
                    onChange={handleFormChange} placeholder="Opcional..."
                    style={inputStyle}
                  />
                </div>
              </div>
              {formError && (
                <div style={{ color: "#ef4444", fontSize: "0.85rem", marginBottom: "0.75rem" }}>{formError}</div>
              )}
              <button type="submit" style={btnPrimary} disabled={saving}>
                {saving ? "Guardando..." : "Registrar entrega"}
              </button>
            </form>
          </div>

          {/* Filtros */}
          <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap" }}>
            <select
              value={filtroEmpleado} onChange={(e) => setFiltroEmpleado(e.target.value)}
              style={{ ...inputStyle, width: "auto", minWidth: 180 }}
            >
              <option value="">Todos los empleados</option>
              {empleados.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </select>
            <select
              value={filtroPrenda} onChange={(e) => setFiltroPrenda(e.target.value)}
              style={{ ...inputStyle, width: "auto", minWidth: 150 }}
            >
              <option value="">Todas las prendas</option>
              {PRENDAS.map((p) => <option key={p} value={p}>{PRENDAS_ICON[p]} {PRENDAS_LABEL[p]}</option>)}
            </select>
          </div>

          {/* Lista entregas */}
          {loading ? (
            <p style={{ color: "var(--sw-text-muted)", textAlign: "center", padding: "2rem" }}>Cargando...</p>
          ) : entregas.length === 0 ? (
            <div style={{ ...cardStyle, textAlign: "center", color: "var(--sw-text-muted)", padding: "2.5rem" }}>
              Sin entregas registradas.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--sw-border)" }}>
                    {["Empleado", "Prenda", "Talla", "Cantidad", "Fecha entrega", "Observaciones", ""].map((h) => (
                      <th key={h} style={{ color: "var(--sw-text-muted)", fontWeight: 600, padding: "0.5rem 0.75rem", textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {entregas.map((e) => (
                    <tr key={e.id} style={{ borderBottom: "1px solid var(--sw-border)" }}>
                      <td style={{ padding: "0.6rem 0.75rem", color: "var(--sw-text)", fontWeight: 600 }}>{e.nombre_empleado}</td>
                      <td style={{ padding: "0.6rem 0.75rem", color: "var(--sw-text)" }}>{PRENDAS_ICON[e.prenda]} {PRENDAS_LABEL[e.prenda] || e.prenda}</td>
                      <td style={{ padding: "0.6rem 0.75rem", color: "var(--sw-text)" }}>
                        <span style={{ background: "var(--sw-surface-2)", borderRadius: 6, padding: "0.2rem 0.55rem", fontWeight: 700, fontSize: "0.85rem" }}>{e.talla}</span>
                      </td>
                      <td style={{ padding: "0.6rem 0.75rem", color: "var(--sw-text)", textAlign: "center" }}>{e.cantidad}</td>
                      <td style={{ padding: "0.6rem 0.75rem", color: "var(--sw-text-muted)" }}>{fmtDate(e.fecha_entrega)}</td>
                      <td style={{ padding: "0.6rem 0.75rem", color: "var(--sw-text-muted)", maxWidth: 200 }}>{e.observaciones || "—"}</td>
                      <td style={{ padding: "0.6rem 0.75rem" }}>
                        <button style={btnDanger} onClick={() => handleEliminarEntrega(e.id)}>Eliminar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB STOCK ─── */}
      {tab === "stock" && (
        <div>
          <p style={{ color: "var(--sw-text-muted)", fontSize: "0.9rem", marginBottom: "1rem" }}>
            Edita la cantidad disponible de cada prenda. Al registrar una entrega, el stock se descuenta automáticamente.
          </p>
          {loading ? (
            <p style={{ color: "var(--sw-text-muted)", textAlign: "center", padding: "2rem" }}>Cargando...</p>
          ) : (
            PRENDAS.map((prenda) => {
              const tallas = tallasParaPrenda(prenda);
              return (
                <div key={prenda} style={{ ...cardStyle, marginBottom: "1.25rem" }}>
                  <h3 style={{ color: "var(--sw-text)", fontWeight: 700, marginBottom: "1rem", fontSize: "1rem" }}>
                    {PRENDAS_ICON[prenda]} {PRENDAS_LABEL[prenda]}
                  </h3>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
                    {tallas.map((talla) => {
                      const key = `${prenda}_${talla}`;
                      const cantidadActual = stockMap[key] ?? 0;
                      const editVal = stockEdit[key] ?? cantidadActual;
                      const isSaving = savingStock[key];
                      const sinStock = cantidadActual === 0;
                      return (
                        <div
                          key={talla}
                          style={{
                            background: "var(--sw-surface-2)",
                            border: sinStock ? "1px solid rgba(239,68,68,0.3)" : "1px solid var(--sw-border)",
                            borderRadius: 10,
                            padding: "0.75rem",
                            minWidth: 100,
                            textAlign: "center",
                          }}
                        >
                          <div style={{ color: "var(--sw-text-muted)", fontSize: "0.75rem", fontWeight: 600, marginBottom: 6 }}>
                            Talla {talla}
                          </div>
                          <input
                            type="number" min={0} max={999}
                            value={editVal}
                            onChange={(e) => setStockEdit((s) => ({ ...s, [key]: e.target.value }))}
                            style={{
                              ...inputStyle,
                              textAlign: "center",
                              fontWeight: 800,
                              fontSize: "1.1rem",
                              padding: "0.35rem",
                              marginBottom: 8,
                              color: sinStock ? "#ef4444" : "var(--sw-text)",
                            }}
                          />
                          <button
                            onClick={() => handleGuardarStock(prenda, talla)}
                            disabled={isSaving}
                            style={{ ...btnPrimary, padding: "0.3rem 0.65rem", fontSize: "0.78rem", width: "100%" }}
                          >
                            {isSaving ? "..." : "Guardar"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ─── TAB RESUMEN ─── */}
      {tab === "resumen" && (
        <div>
          {loading ? (
            <p style={{ color: "var(--sw-text-muted)", textAlign: "center", padding: "2rem" }}>Cargando...</p>
          ) : resumen.length === 0 ? (
            <div style={{ ...cardStyle, textAlign: "center", color: "var(--sw-text-muted)", padding: "2.5rem" }}>
              Sin datos. Registra entregas primero.
            </div>
          ) : (
            resumen.map((emp) => (
              <div key={emp.user_id} style={cardStyle}>
                <h3 style={{ color: "var(--sw-text)", fontWeight: 700, marginBottom: "0.85rem", fontSize: "1rem" }}>
                  👤 {emp.nombre}
                </h3>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem" }}>
                  {Object.values(emp.prendas).map((p) => (
                    <div
                      key={`${p.prenda}_${p.talla}`}
                      style={{
                        background: "var(--sw-surface-2)",
                        border: "1px solid var(--sw-border)",
                        borderRadius: 8,
                        padding: "0.5rem 0.85rem",
                        fontSize: "0.88rem",
                        color: "var(--sw-text)",
                      }}
                    >
                      <span style={{ marginRight: 4 }}>{PRENDAS_ICON[p.prenda]}</span>
                      <strong>{PRENDAS_LABEL[p.prenda] || p.prenda}</strong>
                      {" — "}
                      Talla <strong>{p.talla}</strong>
                      {" × "}
                      <strong>{p.total}</strong>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
