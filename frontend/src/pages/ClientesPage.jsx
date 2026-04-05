import React, { useEffect, useState, useContext } from "react";
import { Context } from "../store/appContext";

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
    <div className="container py-4" style={{ maxWidth: "var(--sw-max-width)" }}>
      <div
        className="d-flex justify-content-between align-items-center mb-4 p-3 rounded shadow-sm sw-header-dark"
      >
        <h2 className="fw-bold mb-0 sw-accent-text">
          👥 Clientes
        </h2>
        <button
          className="btn sw-btn-accent-gold fw-semibold"
          onClick={handleNuevo}
        >
          ➕ Nuevo Cliente
        </button>
      </div>

      {deleteError && (
        <div className="alert alert-danger d-flex justify-content-between align-items-start py-2 mb-3">
          <span>{deleteError}</span>
          <button className="btn-close ms-3" onClick={() => setDeleteError("")} />
        </div>
      )}

      <div className="mb-3">
        <input
          type="text"
          className="form-control"
          placeholder="Buscar por nombre, teléfono o email..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      <div className="table-responsive">
        <table className="table table-hover">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>CIF/NIF</th>
              <th>Teléfono</th>
              <th>Email</th>
              <th>Coches</th>
              <th>Dirección</th>
              <th className="text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {clientesFiltrados.map((c) => (
              <tr key={c.id}>
                <td>{c.nombre}</td>
                <td>{c.cif || "-"}</td>
                <td>{c.telefono || "-"}</td>
                <td>{c.email || "-"}</td>
                <td>{c.total_coches ?? 0}</td>
                <td>{c.direccion || "-"}</td>
                <td className="text-center">
                  <button
                    className="btn btn-sm btn-outline-secondary me-2"
                    onClick={() => handleGestionarCoches(c)}
                    title="Ver coches"
                  >
                    <i className="fas fa-car"></i>
                  </button>
                  <button
                    className="btn btn-sm btn-outline-secondary me-2"
                    onClick={() => handleEditar(c)}
                    title="Editar"
                  >
                    <i className="fas fa-pencil-alt"></i>
                  </button>
                  <button
                    className="btn btn-sm btn-outline-danger"
                    onClick={() => handleEliminar(c)}
                    title="Eliminar"
                  >
                    <i className="fas fa-trash"></i>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <ClienteModal
          show={showModal}
          cliente={editando}
          onClose={() => {
            setShowModal(false);
            setEditando(null);
          }}
          onSaved={() => {
            actions.getClientes();
            setShowModal(false);
            setEditando(null);
          }}
        />
      )}

      {showCochesModal && clienteCochesSeleccionado && (
        <CochesClienteModal
          show={showCochesModal}
          cliente={clienteCochesSeleccionado}
          onClose={() => {
            setShowCochesModal(false);
            setClienteCochesSeleccionado(null);
          }}
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
    <div className="modal d-block sw-modal-overlay">
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              {cliente ? "Editar Cliente" : "Nuevo Cliente"}
            </h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              {modalError && (
                <div className="alert alert-danger d-flex justify-content-between align-items-start py-2 mb-3">
                  <span>{modalError}</span>
                  <button className="btn-close ms-3" onClick={() => setModalError("")} />
                </div>
              )}
              <div className="mb-3">
                <label className="form-label">Nombre *</label>
                <input
                  type="text"
                  className="form-control"
                  name="nombre"
                  value={form.nombre}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="mb-3">
                <label className="form-label">CIF/NIF</label>
                <input
                  type="text"
                  className="form-control"
                  name="cif"
                  value={form.cif}
                  onChange={handleChange}
                  placeholder="B12345678"
                />
              </div>

              <div className="mb-3">
                <label className="form-label">Teléfono</label>
                <input
                  type="text"
                  className="form-control"
                  name="telefono"
                  value={form.telefono}
                  onChange={handleChange}
                />
              </div>

              <div className="mb-3">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  className="form-control"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                />
              </div>

              <div className="mb-3">
                <label className="form-label">Dirección</label>
                <input
                  type="text"
                  className="form-control"
                  name="direccion"
                  value={form.direccion}
                  onChange={handleChange}
                />
              </div>

              <div className="mb-3">
                <label className="form-label">Notas</label>
                <textarea
                  className="form-control"
                  name="notas"
                  value={form.notas}
                  onChange={handleChange}
                  rows="3"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary rounded"
                onClick={onClose}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn btn-sm sw-btn-accent-gold fw-semibold"
                disabled={saving}
              >
                {saving ? "⏳ Guardando..." : cliente ? "💾 Guardar" : "✅ Crear"}
              </button>
            </div>
          </form>
        </div>
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
    <div className="modal d-block sw-modal-overlay">
      <div className="modal-dialog modal-lg modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">🚗 Coches de {cliente.nombre}</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>

          <div className="modal-body">
            {deleteError && (
              <div className="alert alert-danger d-flex justify-content-between align-items-start py-2 mb-3">
                <span>{deleteError}</span>
                <button className="btn-close ms-3" onClick={() => setDeleteError("")} />
              </div>
            )}
            <div className="d-flex justify-content-end mb-3">
              <button
                className="btn btn-sm sw-btn-accent-gold fw-semibold"
                onClick={handleNuevo}
              >
                ➕ Nuevo coche
              </button>
            </div>

            {loading ? (
              <div className="text-center py-4">
                <div className="spinner-border" role="status">
                  <span className="visually-hidden">Cargando...</span>
                </div>
              </div>
            ) : coches.length === 0 ? (
              <div className="alert alert-info mb-0">
                Este cliente no tiene coches registrados.
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-sm table-hover">
                  <thead>
                    <tr>
                      <th>Matrícula</th>
                      <th>Marca</th>
                      <th>Modelo</th>
                      <th>Color</th>
                      <th>Notas</th>
                      <th className="text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coches.map((coche) => (
                      <tr key={coche.id}>
                        <td><strong>{coche.matricula}</strong></td>
                        <td>{coche.marca || "-"}</td>
                        <td>{coche.modelo || "-"}</td>
                        <td>{coche.color || "-"}</td>
                        <td>{coche.notas || "-"}</td>
                        <td className="text-center">
                          <button
                            className="btn btn-sm btn-outline-warning me-1"
                            onClick={() => handleEditar(coche)}
                            title="Editar coche"
                          >
                            ✏️
                          </button>
                          <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => handleEliminar(coche.id)}
                            title="Eliminar coche"
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary rounded"
              onClick={onClose}
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>

      {showFormModal && (
        <FormCocheClienteModal
          show={showFormModal}
          cliente={cliente}
          coche={editando}
          onClose={() => {
            setShowFormModal(false);
            setEditando(null);
          }}
          onSaved={() => {
            setShowFormModal(false);
            setEditando(null);
            cargarCoches();
          }}
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
    <div className="modal d-block sw-modal-overlay-strong" style={{ zIndex: 1060 }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              {coche ? "Editar coche" : `Nuevo coche para ${cliente.nombre}`}
            </h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              {modalError && (
                <div className="alert alert-danger d-flex justify-content-between align-items-start py-2 mb-3">
                  <span>{modalError}</span>
                  <button className="btn-close ms-3" onClick={() => setModalError("")} />
                </div>
              )}
              <div className="mb-3">
                <label className="form-label">Matrícula *</label>
                <input
                  type="text"
                  className="form-control"
                  name="matricula"
                  value={form.matricula}
                  onChange={handleChange}
                  required
                  placeholder="1234ABC"
                />
              </div>

              <div className="mb-3">
                <label className="form-label">Marca</label>
                <input
                  type="text"
                  className="form-control"
                  name="marca"
                  value={form.marca}
                  onChange={handleChange}
                />
              </div>

              <div className="mb-3">
                <label className="form-label">Modelo</label>
                <input
                  type="text"
                  className="form-control"
                  name="modelo"
                  value={form.modelo}
                  onChange={handleChange}
                />
              </div>

              <div className="mb-3">
                <label className="form-label">Color</label>
                <input
                  type="text"
                  className="form-control"
                  name="color"
                  value={form.color}
                  onChange={handleChange}
                />
              </div>

              <div className="mb-3">
                <label className="form-label">Notas</label>
                <textarea
                  className="form-control"
                  name="notas"
                  value={form.notas}
                  onChange={handleChange}
                  rows="3"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary rounded"
                onClick={onClose}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn btn-sm sw-btn-accent-gold fw-semibold"
                disabled={saving}
              >
                {saving ? "⏳ Guardando..." : coche ? "💾 Guardar" : "✅ Crear"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ClientesPage;
