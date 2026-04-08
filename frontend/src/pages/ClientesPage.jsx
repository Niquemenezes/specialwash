import React, { useEffect, useState, useContext } from "react";
import { Context } from "../store/appContext";

/* ── Iconos SVG ─────────────────────────────────────────────────── */
const ICONS = {
  clients: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>),
  plus:    (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>),
  edit:    (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>),
  trash:   (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>),
  car:     (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1l3-4h10l3 4h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="17.5" r="2.5"/></svg>),
  search:  (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>),
  spinner: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sw-veh-spinner"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>),
};

const ClientesPage = () => {
  const { store, actions } = useContext(Context);
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [showCochesModal, setShowCochesModal] = useState(false);
  const [clienteCochesSeleccionado, setClienteCochesSeleccionado] = useState(null);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    actions.getClientes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNuevo = () => {
    setEditando(null);
    setShowModal(true);
  };

  const handleEditar = (cliente) => {
    setEditando(cliente);
    setShowModal(true);
  };

  const handleEliminar = async (cliente) => {
    const nombre = cliente?.nombre || "este cliente";
    const confirmado = window.confirm(
      `Vas a eliminar a "${nombre}".\n\n¿Seguro que deseas continuar? Esta accion no se puede deshacer.`
    );
    if (!confirmado) return;

    try {
      await actions.eliminarCliente(cliente.id);
      actions.getClientes();
    } catch (err) {
      setDeleteError(err?.message || "No se pudo eliminar el cliente");
    }
  };

  const handleGestionarCoches = (cliente) => {
    setClienteCochesSeleccionado(cliente);
    setShowCochesModal(true);
  };

  const clientesFiltrados = (store.clientes || []).filter((c) =>
    c.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
    c.telefono?.includes(busqueda) ||
    c.email?.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="sw-ent-wrapper">
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <div className="sw-veh-hero">
        <div className="sw-veh-hero-inner container">
          <div className="sw-veh-hero-body">
            <div className="sw-veh-hero-icon">
              <span style={{ width: 24, height: 24, display: "flex" }}>{ICONS.clients}</span>
            </div>
            <div style={{ flex: 1 }}>
              <p className="sw-home-eyebrow" style={{ marginBottom: "0.2rem" }}>Gestión</p>
              <h1 className="sw-veh-hero-title">Clientes</h1>
              <p className="sw-veh-hero-sub">Base de datos de clientes y sus vehículos asociados</p>
            </div>
            <button className="sw-ent-submit-btn" onClick={handleNuevo}>
              <span style={{ width: 16, height: 16, display: "inline-flex" }}>{ICONS.plus}</span>
              Nuevo Cliente
            </button>
          </div>
        </div>
      </div>

      <div className="container sw-ent-content">

        {deleteError && (
          <div style={{
            display: "flex", alignItems: "flex-start", justifyContent: "space-between",
            gap: "0.75rem", padding: "0.85rem 1.1rem", borderRadius: 10,
            background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)",
            color: "#fca5a5", fontSize: "0.875rem", fontWeight: 500,
          }}>
            <span>{deleteError}</span>
            <button onClick={() => setDeleteError("")} style={{ background: "none", border: "none", color: "inherit", opacity: 0.6, cursor: "pointer", padding: 0 }}>✕</button>
          </div>
        )}

        {/* ── Búsqueda ─────────────────────────────────────────── */}
        <div className="sw-ent-card">
          <div className="sw-ent-card-body" style={{ paddingTop: "1rem", paddingBottom: "1rem" }}>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: "0.85rem", top: "50%", transform: "translateY(-50%)", width: 16, height: 16, color: "var(--sw-muted)", display: "flex", pointerEvents: "none" }}>{ICONS.search}</span>
              <input
                type="text"
                className="form-control sw-pinput"
                style={{ paddingLeft: "2.5rem" }}
                placeholder="Buscar por nombre, teléfono o email…"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* ── Tabla ────────────────────────────────────────────── */}
        <div className="sw-ent-table-card">
          <div className="sw-ent-table-header">
            <p className="sw-home-eyebrow" style={{ marginBottom: 0 }}>Directorio</p>
            <h3 className="sw-ent-table-title">
              {clientesFiltrados.length} cliente{clientesFiltrados.length !== 1 ? "s" : ""}
              {busqueda && ` — filtrado por "${busqueda}"`}
            </h3>
          </div>
          <div className="table-responsive">
            <table className="table mb-0 sw-ent-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>CIF/NIF</th>
                  <th>Teléfono</th>
                  <th>Email</th>
                  <th className="text-center">Coches</th>
                  <th>Dirección</th>
                  <th style={{ width: 96 }}></th>
                </tr>
              </thead>
              <tbody>
                {clientesFiltrados.map((c) => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600, fontSize: "0.88rem" }}>{c.nombre}</td>
                    <td style={{ fontSize: "0.82rem", color: "var(--sw-muted)" }}>{c.cif || "-"}</td>
                    <td style={{ fontSize: "0.82rem" }}>{c.telefono || "-"}</td>
                    <td style={{ fontSize: "0.82rem", color: "var(--sw-muted)" }}>{c.email || "-"}</td>
                    <td className="text-center">
                      <span style={{
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        width: 26, height: 26, borderRadius: 8, fontWeight: 700, fontSize: "0.8rem",
                        background: (c.total_coches ?? 0) > 0 ? "rgba(212,175,55,0.12)" : "var(--sw-surface-2)",
                        color: (c.total_coches ?? 0) > 0 ? "var(--sw-accent,#d4af37)" : "var(--sw-muted)",
                        border: "1px solid",
                        borderColor: (c.total_coches ?? 0) > 0 ? "rgba(212,175,55,0.3)" : "var(--sw-border)",
                      }}>{c.total_coches ?? 0}</span>
                    </td>
                    <td style={{ fontSize: "0.82rem", color: "var(--sw-muted)" }}>{c.direccion || "-"}</td>
                    <td>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button className="sw-ent-icon-btn" title="Ver coches" onClick={() => handleGestionarCoches(c)}>
                          <span style={{ width: 14, height: 14, display: "flex" }}>{ICONS.car}</span>
                        </button>
                        <button className="sw-ent-icon-btn" title="Editar" onClick={() => handleEditar(c)}>
                          <span style={{ width: 14, height: 14, display: "flex" }}>{ICONS.edit}</span>
                        </button>
                        <button className="sw-ent-icon-btn sw-ent-icon-btn--danger" title="Eliminar" onClick={() => handleEliminar(c)}>
                          <span style={{ width: 14, height: 14, display: "flex" }}>{ICONS.trash}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {clientesFiltrados.length === 0 && (
                  <tr>
                    <td colSpan="7" style={{ textAlign: "center", color: "var(--sw-muted)", padding: "2.5rem", fontSize: "0.875rem" }}>
                      {busqueda ? `No hay clientes que coincidan con "${busqueda}"` : "No hay clientes registrados"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showModal && (
        <ClienteModal
          show={showModal}
          cliente={editando}
          onClose={() => { setShowModal(false); setEditando(null); }}
          onSaved={() => { actions.getClientes(); setShowModal(false); setEditando(null); }}
        />
      )}

      {showCochesModal && clienteCochesSeleccionado && (
        <CochesClienteModal
          show={showCochesModal}
          cliente={clienteCochesSeleccionado}
          onClose={() => { setShowCochesModal(false); setClienteCochesSeleccionado(null); }}
        />
      )}
    </div>
  );
};

const ClienteModal = ({ show, cliente, onClose, onSaved }) => {
  const { actions } = useContext(Context);
  const [form, setForm] = useState({
    nombre: "",
    cif: "",
    telefono: "",
    email: "",
    direccion: "",
    notas: "",
  });
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState("");

  useEffect(() => {
    if (cliente) {
      setForm({
        nombre: cliente.nombre || "",
        cif: cliente.cif || "",
        telefono: cliente.telefono || "",
        email: cliente.email || "",
        direccion: cliente.direccion || "",
        notas: cliente.notas || "",
      });
    }
  }, [cliente]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (cliente) {
        await actions.actualizarCliente(cliente.id, form);
      } else {
        await actions.crearCliente(form);
      }
      onSaved();
    } catch (err) {
      setModalError(err?.message || "Error al guardar el cliente");
    } finally {
      setSaving(false);
    }
  };

  if (!show) return null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1050, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--sw-overlay-bg, rgba(0,0,0,0.5))", padding: "1rem" }}>
      <div style={{ background: "var(--sw-surface)", border: "1px solid var(--sw-border)", borderRadius: 16, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto", animation: "sw-fade-up 0.25s ease both" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--sw-border)", background: "var(--sw-surface-2)", borderRadius: "16px 16px 0 0" }}>
          <h5 style={{ margin: 0, fontWeight: 700, color: "var(--sw-text)", fontSize: "1rem" }}>
            {cliente ? "Editar Cliente" : "Nuevo Cliente"}
          </h5>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--sw-muted)", cursor: "pointer", fontSize: "1.1rem", lineHeight: 1, padding: 4 }}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
            {modalError && (
              <div style={{ padding: "0.75rem 1rem", borderRadius: 8, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#fca5a5", fontSize: "0.85rem", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <span>{modalError}</span>
                <button onClick={() => setModalError("")} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", padding: 0, opacity: 0.6 }}>✕</button>
              </div>
            )}
            {[
              { name: "nombre", label: "Nombre", required: true, type: "text", placeholder: "" },
              { name: "cif", label: "CIF/NIF", required: false, type: "text", placeholder: "B12345678" },
              { name: "telefono", label: "Teléfono", required: false, type: "text", placeholder: "" },
              { name: "email", label: "Email", required: false, type: "email", placeholder: "" },
              { name: "direccion", label: "Dirección", required: false, type: "text", placeholder: "" },
            ].map((f) => (
              <div key={f.name} style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                <label className="sw-plbl">{f.label}{f.required && <span style={{ color: "var(--sw-accent,#d4af37)", marginLeft: 2 }}>*</span>}</label>
                <input type={f.type} className="form-control sw-pinput" name={f.name} value={form[f.name]} onChange={handleChange} required={f.required} placeholder={f.placeholder} />
              </div>
            ))}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
              <label className="sw-plbl">Notas</label>
              <textarea className="form-control sw-pinput" name="notas" value={form.notas} onChange={handleChange} rows="3" />
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", padding: "1rem 1.5rem", borderTop: "1px solid var(--sw-border)", background: "var(--sw-surface-2)", borderRadius: "0 0 16px 16px" }}>
            <button type="button" onClick={onClose} style={{ padding: "0.5rem 1.25rem", borderRadius: 8, border: "1px solid var(--sw-border)", background: "transparent", color: "var(--sw-text)", cursor: "pointer", fontWeight: 600, fontSize: "0.85rem" }}>
              Cancelar
            </button>
            <button type="submit" className="sw-ent-submit-btn" disabled={saving} style={{ padding: "0.5rem 1.5rem" }}>
              {saving ? <><span style={{ width: 14, height: 14, display: "inline-flex" }}>{ICONS.spinner}</span> Guardando…</> : cliente ? "Guardar cambios" : "Crear cliente"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ========== MODAL DE COCHES POR CLIENTE ==========
const CochesClienteModal = ({ show, cliente, onClose }) => {
  const { actions } = useContext(Context);
  const [coches, setCoches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    if (show && cliente) {
      cargarCoches();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, cliente]);

  const cargarCoches = async () => {
    setLoading(true);
    try {
      const data = await actions.getCoches();
      const lista = (data || []).filter((c) => String(c.cliente_id) === String(cliente.id));
      setCoches(lista);
      actions.getClientes();
    } catch (err) {
      console.error("Error al cargar coches del cliente:", err);
      setCoches([]);
    } finally {
      setLoading(false);
    }
  };

  const handleNuevo = () => {
    setEditando(null);
    setShowFormModal(true);
  };

  const handleEditar = (coche) => {
    setEditando(coche);
    setShowFormModal(true);
  };

  const handleEliminar = async (cocheId) => {
    if (!window.confirm("¿Eliminar este coche?")) return;
    try {
      await actions.eliminarCoche(cocheId);
      await cargarCoches();
    } catch (err) {
      setDeleteError("Error al eliminar el coche");
    }
  };

  if (!show) return null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1050, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--sw-overlay-bg, rgba(0,0,0,0.5))", padding: "1rem" }}>
      <div style={{ background: "var(--sw-surface)", border: "1px solid var(--sw-border)", borderRadius: 16, width: "100%", maxWidth: 700, maxHeight: "90vh", overflowY: "auto", animation: "sw-fade-up 0.25s ease both" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--sw-border)", background: "var(--sw-surface-2)", borderRadius: "16px 16px 0 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
            <span style={{ width: 18, height: 18, display: "flex", color: "var(--sw-accent,#d4af37)" }}>{ICONS.car}</span>
            <h5 style={{ margin: 0, fontWeight: 700, color: "var(--sw-text)", fontSize: "1rem" }}>Coches de {cliente.nombre}</h5>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--sw-muted)", cursor: "pointer", fontSize: "1.1rem", lineHeight: 1, padding: 4 }}>✕</button>
        </div>

        <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
          {deleteError && (
            <div style={{ padding: "0.75rem 1rem", borderRadius: 8, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#fca5a5", fontSize: "0.85rem", display: "flex", justifyContent: "space-between" }}>
              <span>{deleteError}</span>
              <button onClick={() => setDeleteError("")} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", padding: 0, opacity: 0.6 }}>✕</button>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button className="sw-ent-submit-btn" onClick={handleNuevo} style={{ padding: "0.5rem 1.25rem" }}>
              <span style={{ width: 14, height: 14, display: "inline-flex" }}>{ICONS.plus}</span>
              Nuevo coche
            </button>
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: "2rem", color: "var(--sw-muted)" }}>
              <span style={{ width: 24, height: 24, display: "inline-flex" }}>{ICONS.spinner}</span>
            </div>
          ) : coches.length === 0 ? (
            <div style={{ padding: "1.5rem", borderRadius: 10, background: "var(--sw-surface-2)", border: "1px solid var(--sw-border)", color: "var(--sw-muted)", fontSize: "0.875rem", textAlign: "center" }}>
              Este cliente no tiene coches registrados.
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table mb-0 sw-ent-table">
                <thead>
                  <tr>
                    <th>Matrícula</th>
                    <th>Marca</th>
                    <th>Modelo</th>
                    <th>Color</th>
                    <th>Notas</th>
                    <th style={{ width: 72 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {coches.map((coche) => (
                    <tr key={coche.id}>
                      <td style={{ fontWeight: 700, color: "var(--sw-accent,#d4af37)" }}>{coche.matricula}</td>
                      <td style={{ fontSize: "0.85rem" }}>{coche.marca || "-"}</td>
                      <td style={{ fontSize: "0.85rem" }}>{coche.modelo || "-"}</td>
                      <td style={{ fontSize: "0.82rem", color: "var(--sw-muted)" }}>{coche.color || "-"}</td>
                      <td style={{ fontSize: "0.78rem", color: "var(--sw-muted)" }}>{coche.notas || "-"}</td>
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button className="sw-ent-icon-btn" title="Editar" onClick={() => handleEditar(coche)}>
                            <span style={{ width: 14, height: 14, display: "flex" }}>{ICONS.edit}</span>
                          </button>
                          <button className="sw-ent-icon-btn sw-ent-icon-btn--danger" title="Eliminar" onClick={() => handleEliminar(coche.id)}>
                            <span style={{ width: 14, height: 14, display: "flex" }}>{ICONS.trash}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", padding: "1rem 1.5rem", borderTop: "1px solid var(--sw-border)", background: "var(--sw-surface-2)", borderRadius: "0 0 16px 16px" }}>
          <button type="button" onClick={onClose} style={{ padding: "0.5rem 1.25rem", borderRadius: 8, border: "1px solid var(--sw-border)", background: "transparent", color: "var(--sw-text)", cursor: "pointer", fontWeight: 600, fontSize: "0.85rem" }}>
            Cerrar
          </button>
        </div>
      </div>

      {showFormModal && (
        <FormCocheClienteModal
          show={showFormModal}
          cliente={cliente}
          coche={editando}
          onClose={() => { setShowFormModal(false); setEditando(null); }}
          onSaved={() => { setShowFormModal(false); setEditando(null); cargarCoches(); }}
        />
      )}
    </div>
  );
};

const FormCocheClienteModal = ({ show, cliente, coche, onClose, onSaved }) => {
  const { actions } = useContext(Context);
  const [modalError, setModalError] = useState("");
  const [form, setForm] = useState({
    matricula: "",
    marca: "",
    modelo: "",
    color: "",
    notas: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (coche) {
      setForm({
        matricula: coche.matricula || "",
        marca: coche.marca || "",
        modelo: coche.modelo || "",
        color: coche.color || "",
        notas: coche.notas || "",
      });
    } else {
      setForm({
        matricula: "",
        marca: "",
        modelo: "",
        color: "",
        notas: "",
      });
    }
  }, [coche]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        matricula: (form.matricula || "").toUpperCase().trim(),
        cliente_id: cliente.id,
      };

      if (coche) {
        await actions.actualizarCoche(coche.id, payload);
      } else {
        await actions.crearCoche(payload);
      }
      onSaved();
    } catch (err) {
      setModalError("Error al guardar el coche: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!show) return null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1060, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--sw-overlay-bg-strong, rgba(0,0,0,0.75))", padding: "1rem" }}>
      <div style={{ background: "var(--sw-surface)", border: "1px solid var(--sw-border)", borderRadius: 16, width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto", animation: "sw-fade-up 0.25s ease both" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--sw-border)", background: "var(--sw-surface-2)", borderRadius: "16px 16px 0 0" }}>
          <h5 style={{ margin: 0, fontWeight: 700, color: "var(--sw-text)", fontSize: "1rem" }}>
            {coche ? "Editar coche" : `Nuevo coche — ${cliente.nombre}`}
          </h5>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--sw-muted)", cursor: "pointer", fontSize: "1.1rem", lineHeight: 1, padding: 4 }}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
            {modalError && (
              <div style={{ padding: "0.75rem 1rem", borderRadius: 8, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#fca5a5", fontSize: "0.85rem" }}>{modalError}</div>
            )}
            {[
              { name: "matricula", label: "Matrícula", required: true, placeholder: "1234ABC" },
              { name: "marca", label: "Marca", required: false, placeholder: "" },
              { name: "modelo", label: "Modelo", required: false, placeholder: "" },
              { name: "color", label: "Color", required: false, placeholder: "" },
            ].map((f) => (
              <div key={f.name} style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                <label className="sw-plbl">{f.label}{f.required && <span style={{ color: "var(--sw-accent,#d4af37)", marginLeft: 2 }}>*</span>}</label>
                <input type="text" className="form-control sw-pinput" name={f.name} value={form[f.name]} onChange={handleChange} required={f.required} placeholder={f.placeholder} />
              </div>
            ))}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
              <label className="sw-plbl">Notas</label>
              <textarea className="form-control sw-pinput" name="notas" value={form.notas} onChange={handleChange} rows="3" />
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", padding: "1rem 1.5rem", borderTop: "1px solid var(--sw-border)", background: "var(--sw-surface-2)", borderRadius: "0 0 16px 16px" }}>
            <button type="button" onClick={onClose} style={{ padding: "0.5rem 1.25rem", borderRadius: 8, border: "1px solid var(--sw-border)", background: "transparent", color: "var(--sw-text)", cursor: "pointer", fontWeight: 600, fontSize: "0.85rem" }}>
              Cancelar
            </button>
            <button type="submit" className="sw-ent-submit-btn" disabled={saving} style={{ padding: "0.5rem 1.5rem" }}>
              {saving ? <><span style={{ width: 14, height: 14, display: "inline-flex" }}>{ICONS.spinner}</span> Guardando…</> : coche ? "Guardar cambios" : "Crear coche"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ClientesPage;
