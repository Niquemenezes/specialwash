import React, { useEffect, useState, useContext } from "react";
import { Context } from "../store/appContext";
import GoldSelect from "../components/GoldSelect.jsx";
import { confirmar } from "../utils/confirmar";
import EmptyState from "../components/EmptyState.jsx";

/* ── Iconos SVG ─────────────────────────────────────────────────── */
const ICONS = {
  car:    (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1l3-4h10l3 4h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>),
  plus:   (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>),
  edit:   (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>),
  trash:  (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>),
  search: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>),
};

const Field = ({ label, required, children }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
    <label className="sw-plbl">
      {label}
      {required && <span style={{ color: "var(--sw-accent,#d4af37)", marginLeft: 2 }}>*</span>}
    </label>
    {children}
  </div>
);

const CochesPage = () => {
  const { store, actions } = useContext(Context);
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    actions.getCoches();
    actions.getClientes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNuevo = () => {
    setEditando(null);
    setShowModal(true);
  };

  const handleEditar = (coche) => {
    setEditando(coche);
    setShowModal(true);
  };

  const handleEliminar = async (id) => {
    if (!await confirmar("¿Eliminar este coche?")) return;
    try {
      await actions.eliminarCoche(id);
      actions.getCoches();
    } catch (err) {
      setDeleteError("Error al eliminar el coche");
    }
  };

  const cochesFiltrados = (store.coches || []).filter((c) =>
    c.matricula?.toLowerCase().includes(busqueda.toLowerCase()) ||
    c.marca?.toLowerCase().includes(busqueda.toLowerCase()) ||
    c.modelo?.toLowerCase().includes(busqueda.toLowerCase()) ||
    c.cliente_nombre?.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="sw-ent-wrapper">
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <div className="sw-veh-hero">
        <div className="sw-veh-hero-inner container">
          <div className="sw-veh-hero-body">
            <div className="sw-veh-hero-icon">
              <span style={{ width: 24, height: 24, display: "flex" }}>{ICONS.car}</span>
            </div>
            <div style={{ flex: 1 }}>
              <p className="sw-home-eyebrow" style={{ marginBottom: "0.2rem" }}>Gestión</p>
              <h1 className="sw-veh-hero-title">Coches</h1>
              <p className="sw-veh-hero-sub">Registro de vehículos de clientes</p>
            </div>
            <button className="sw-ent-submit-btn" onClick={handleNuevo}>
              <span style={{ width: 16, height: 16, display: "inline-flex" }}>{ICONS.plus}</span>
              Nuevo Coche
            </button>
          </div>
        </div>
      </div>

      <div className="container sw-ent-content">
        {/* Error al eliminar */}
        {deleteError && (
          <div style={{
            display: "flex", alignItems: "flex-start", justifyContent: "space-between",
            gap: "0.75rem", padding: "0.85rem 1.1rem", borderRadius: 10,
            background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)",
            color: "#fca5a5", fontSize: "0.875rem", fontWeight: 500,
          }}>
            <span>{deleteError}</span>
            <button onClick={() => setDeleteError("")} style={{ background: "none", border: "none", color: "inherit", opacity: 0.6, cursor: "pointer", padding: 0, fontSize: "1rem" }}>✕</button>
          </div>
        )}

        {/* ── Buscador ─────────────────────────────────────────── */}
        <div className="sw-ent-card" style={{ overflow: "visible" }}>
          <div className="sw-ent-card-body" style={{ paddingTop: "1rem", paddingBottom: "1rem" }}>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: "0.85rem", top: "50%", transform: "translateY(-50%)", width: 16, height: 16, color: "var(--sw-muted)", display: "flex", pointerEvents: "none" }}>{ICONS.search}</span>
              <input
                type="text"
                className="form-control sw-pinput"
                style={{ paddingLeft: "2.4rem" }}
                placeholder="Buscar por matrícula, marca, modelo o cliente…"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* ── Tabla ────────────────────────────────────────────── */}
        <div className="sw-ent-table-card">
          <div className="sw-ent-table-header">
            <p className="sw-home-eyebrow" style={{ marginBottom: 0 }}>Listado</p>
            <h3 className="sw-ent-table-title">
              {cochesFiltrados.length} {cochesFiltrados.length === 1 ? "vehículo" : "vehículos"}
              {busqueda && <span style={{ fontSize: "0.78rem", fontWeight: 400, color: "var(--sw-muted)", marginLeft: "0.5rem" }}>— filtrando por "{busqueda}"</span>}
            </h3>
          </div>
          <div className="table-responsive">
            <table className="table mb-0 sw-ent-table">
              <thead>
                <tr>
                  <th>Matrícula</th>
                  <th>Marca</th>
                  <th>Modelo</th>
                  <th>Color</th>
                  <th>Cliente</th>
                  <th style={{ width: 80 }}></th>
                </tr>
              </thead>
              <tbody>
                {cochesFiltrados.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <span style={{
                        fontFamily: "monospace", fontWeight: 700, fontSize: "0.9rem",
                        color: "var(--sw-accent,#d4af37)", letterSpacing: "0.05em",
                      }}>{c.matricula}</span>
                    </td>
                    <td style={{ fontWeight: 600, fontSize: "0.85rem" }}>{c.marca || "-"}</td>
                    <td style={{ fontSize: "0.85rem", color: "var(--sw-muted)" }}>{c.modelo || "-"}</td>
                    <td style={{ fontSize: "0.82rem", color: "var(--sw-muted)" }}>{c.color || "-"}</td>
                    <td style={{ fontSize: "0.85rem" }}>{c.cliente_nombre || "-"}</td>
                    <td>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button className="sw-ent-icon-btn" title="Editar" onClick={() => handleEditar(c)}>
                          <span style={{ width: 14, height: 14, display: "flex" }}>{ICONS.edit}</span>
                        </button>
                        <button className="sw-ent-icon-btn sw-ent-icon-btn--danger" title="Eliminar" onClick={() => handleEliminar(c.id)}>
                          <span style={{ width: 14, height: 14, display: "flex" }}>{ICONS.trash}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {cochesFiltrados.length === 0 && (
                  <EmptyState
                    colSpan={6}
                    title={busqueda ? "Sin resultados" : "Sin coches"}
                    subtitle={busqueda ? "Ningún coche coincide con esa búsqueda." : "No hay coches registrados. Añade el primero con Nuevo coche."}
                  />
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showModal && (
        <CocheModal
          show={showModal}
          coche={editando}
          clientes={store.clientes || []}
          onClose={() => { setShowModal(false); setEditando(null); }}
          onSaved={() => { actions.getCoches(); setShowModal(false); setEditando(null); }}
        />
      )}
    </div>
  );
};

const CocheModal = ({ show, coche, clientes, onClose, onSaved }) => {
  const { actions } = useContext(Context);
  const [form, setForm] = useState({
    matricula: "",
    marca: "",
    modelo: "",
    color: "",
    cliente_id: "",
    notas: "",
  });
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState("");

  useEffect(() => {
    if (coche) {
      setForm({
        matricula: coche.matricula || "",
        marca: coche.marca || "",
        modelo: coche.modelo || "",
        color: coche.color || "",
        cliente_id: coche.cliente_id || "",
        notas: coche.notas || "",
      });
    } else {
      setForm({ matricula: "", marca: "", modelo: "", color: "", cliente_id: "", notas: "" });
    }
  }, [coche]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.cliente_id) { setModalError("Selecciona un cliente"); return; }
    setSaving(true);
    setModalError("");
    try {
      const payload = { ...form, matricula: form.matricula.toUpperCase(), cliente_id: Number(form.cliente_id) };
      if (coche) {
        await actions.actualizarCoche(coche.id, payload);
      } else {
        await actions.crearCoche(payload);
      }
      onSaved();
    } catch (err) {
      setModalError(err?.message || "Error al guardar el coche");
    } finally {
      setSaving(false);
    }
  };

  if (!show) return null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1050, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--sw-overlay-bg, rgba(0,0,0,0.5))", padding: "1rem" }}>
      <div style={{ background: "var(--sw-surface)", border: "1px solid var(--sw-border)", borderRadius: 16, width: "100%", maxWidth: 540, maxHeight: "90vh", overflowY: "auto", animation: "sw-fade-up 0.25s ease both" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--sw-border)", background: "var(--sw-surface-2)", borderRadius: "16px 16px 0 0" }}>
          <h5 style={{ margin: 0, fontWeight: 700, color: "var(--sw-text)", fontSize: "1rem" }}>
            {coche ? "Editar Coche" : "Nuevo Coche"}
          </h5>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--sw-muted)", cursor: "pointer", fontSize: "1.1rem", lineHeight: 1, padding: 4 }}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
            {modalError && (
              <div style={{ padding: "0.75rem 1rem", borderRadius: 8, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#fca5a5", fontSize: "0.85rem" }}>
                {modalError}
              </div>
            )}
            <Field label="Matrícula" required>
              <input type="text" className="form-control sw-pinput text-uppercase" name="matricula"
                value={form.matricula} onChange={handleChange} required placeholder="1234ABC" />
            </Field>
            <Field label="Cliente" required>
              <GoldSelect
                value={form.cliente_id}
                onChange={(v) => setForm((f) => ({ ...f, cliente_id: v }))}
                placeholder="Seleccionar…"
                options={clientes.map((c) => ({ value: c.id, label: c.nombre }))}
              />
            </Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <Field label="Marca">
                <input type="text" className="form-control sw-pinput" name="marca" value={form.marca} onChange={handleChange} />
              </Field>
              <Field label="Modelo">
                <input type="text" className="form-control sw-pinput" name="modelo" value={form.modelo} onChange={handleChange} />
              </Field>
            </div>
            <Field label="Color">
              <input type="text" className="form-control sw-pinput" name="color" value={form.color} onChange={handleChange} />
            </Field>
            <Field label="Notas">
              <textarea className="form-control sw-pinput" name="notas" value={form.notas} onChange={handleChange} rows="3" />
            </Field>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", padding: "1rem 1.5rem", borderTop: "1px solid var(--sw-border)", background: "var(--sw-surface-2)", borderRadius: "0 0 16px 16px" }}>
            <button type="button" onClick={onClose} style={{ padding: "0.5rem 1.25rem", borderRadius: 8, border: "1px solid var(--sw-border)", background: "transparent", color: "var(--sw-text)", cursor: "pointer", fontWeight: 600, fontSize: "0.85rem" }}>
              Cancelar
            </button>
            <button type="submit" className="sw-ent-submit-btn" disabled={saving} style={{ padding: "0.5rem 1.5rem" }}>
              {saving ? "Guardando…" : coche ? "Guardar cambios" : "Crear coche"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CochesPage;
