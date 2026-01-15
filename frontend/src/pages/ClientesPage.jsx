import React, { useEffect, useState, useContext } from "react";
import { Context } from "../store/appContext";

const ClientesPage = () => {
  const { store, actions } = useContext(Context);
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [showServiciosModal, setShowServiciosModal] = useState(false);
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);

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

  const handleEliminar = async (id) => {
    if (!window.confirm("¿Eliminar este cliente?")) return;
    try {
      await actions.eliminarCliente(id);
      actions.getClientes();
    } catch (err) {
      alert("Error al eliminar el cliente");
    }
  };

  const handleGestionarServicios = (cliente) => {
    setClienteSeleccionado(cliente);
    setShowServiciosModal(true);
  };

  const clientesFiltrados = (store.clientes || []).filter((c) =>
    c.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
    c.telefono?.includes(busqueda) ||
    c.email?.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Clientes</h2>
        <button className="btn btn-primary" onClick={handleNuevo}>
          <i className="fas fa-plus me-2"></i>Nuevo Cliente
        </button>
      </div>

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
        <table className="table table-striped table-hover">
          <thead className="table-dark">
            <tr>
              <th>Nombre</th>
              <th>CIF/NIF</th>
              <th>Teléfono</th>
              <th>Email</th>
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
                <td>{c.direccion || "-"}</td>
                <td className="text-center">
                  <button
                    className="btn btn-sm btn-outline-info me-2"
                    onClick={() => handleGestionarServicios(c)}
                    title="Tarifas Personalizadas"
                  >
                    <i className="fas fa-dollar-sign"></i>
                  </button>
                  <button
                    className="btn btn-sm btn-outline-primary me-2"
                    onClick={() => handleEditar(c)}
                    title="Editar"
                  >
                    <i className="fas fa-edit"></i>
                  </button>
                  <button
                    className="btn btn-sm btn-outline-danger"
                    onClick={() => handleEliminar(c.id)}
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

      {showServiciosModal && clienteSeleccionado && (
        <ServiciosClienteModal
          show={showServiciosModal}
          cliente={clienteSeleccionado}
          onClose={() => {
            setShowServiciosModal(false);
            setClienteSeleccionado(null);
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
      alert(cliente ? "Cliente actualizado" : "Cliente creado");
      onSaved();
    } catch (err) {
      alert("Error al guardar el cliente");
    } finally {
      setSaving(false);
    }
  };

  if (!show) return null;

  return (
    <div className="modal d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
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
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// ========== MODAL DE SERVICIOS PERSONALIZADOS ==========
const ServiciosClienteModal = ({ show, cliente, onClose }) => {
  const { actions } = useContext(Context);
  const [servicios, setServicios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editando, setEditando] = useState(null);

  useEffect(() => {
    if (show && cliente) {
      cargarServicios();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, cliente]);

  const cargarServicios = async () => {
    setLoading(true);
    try {
      const data = await actions.getServiciosCliente(cliente.id);
      setServicios(data);
    } catch (err) {
      console.error("Error al cargar servicios:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleNuevo = () => {
    setEditando(null);
    setShowFormModal(true);
  };

  const handleEditar = (servicio) => {
    setEditando(servicio);
    setShowFormModal(true);
  };

  const handleEliminar = async (servicioId) => {
    if (!window.confirm("¿Eliminar este servicio?")) return;
    try {
      await actions.deleteServicioCliente(cliente.id, servicioId);
      alert("Servicio eliminado");
      cargarServicios();
    } catch (err) {
      alert("Error al eliminar el servicio");
    }
  };

  if (!show) return null;

  return (
    <div className="modal d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
      <div className="modal-dialog modal-lg modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              Tarifas Personalizadas - {cliente.nombre}
            </h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body">
            <div className="d-flex justify-content-end mb-3">
              <button className="btn btn-primary btn-sm" onClick={handleNuevo}>
                <i className="fas fa-plus me-2"></i>Nueva Tarifa
              </button>
            </div>

            {loading ? (
              <div className="text-center py-4">
                <div className="spinner-border" role="status">
                  <span className="visually-hidden">Cargando...</span>
                </div>
              </div>
            ) : servicios.length === 0 ? (
              <div className="alert alert-info">
                No hay tarifas personalizadas para este cliente.
                <br />Haz clic en "Nueva Tarifa" para crear una.
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-sm table-hover">
                  <thead>
                    <tr>
                      <th>Servicio / Tarifa</th>
                      <th>Precio</th>
                      <th>Descripción</th>
                      <th>Estado</th>
                      <th className="text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {servicios.map((s) => (
                      <tr key={s.id}>
                        <td><strong>{s.nombre}</strong></td>
                        <td>{s.precio?.toFixed(2)} €</td>
                        <td>{s.descripcion || "-"}</td>
                        <td>
                          <span className={`badge ${s.activo ? 'bg-success' : 'bg-secondary'}`}>
                            {s.activo ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="text-center">
                          <button
                            className="btn btn-sm btn-outline-primary me-1"
                            onClick={() => handleEditar(s)}
                            title="Editar"
                          >
                            <i className="fas fa-edit"></i>
                          </button>
                          <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => handleEliminar(s.id)}
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
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cerrar
            </button>
          </div>
        </div>
      </div>

      {showFormModal && (
        <FormServicioClienteModal
          show={showFormModal}
          cliente={cliente}
          servicio={editando}
          onClose={() => {
            setShowFormModal(false);
            setEditando(null);
          }}
          onSaved={() => {
            setShowFormModal(false);
            setEditando(null);
            cargarServicios();
          }}
        />
      )}
    </div>
  );
};

// ========== MODAL DE FORMULARIO DE SERVICIO ==========
const FormServicioClienteModal = ({ show, cliente, servicio, onClose, onSaved }) => {
  const { actions } = useContext(Context);
  const [form, setForm] = useState({
    nombre: "",
    precio: "",
    descripcion: "",
    activo: true,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (servicio) {
      setForm({
        nombre: servicio.nombre || "",
        precio: servicio.precio || "",
        descripcion: servicio.descripcion || "",
        activo: servicio.activo !== false,
      });
    }
  }, [servicio]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ 
      ...f, 
      [name]: type === "checkbox" ? checked : value 
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (servicio) {
        await actions.updateServicioCliente(cliente.id, servicio.id, form);
        alert("Servicio actualizado");
      } else {
        await actions.createServicioCliente(cliente.id, form);
        alert("Servicio creado");
      }
      onSaved();
    } catch (err) {
      alert("Error al guardar el servicio: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!show) return null;

  return (
    <div className="modal d-block" style={{ backgroundColor: "rgba(0,0,0,0.7)", zIndex: 1060 }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              {servicio ? "Editar Tarifa" : "Nueva Tarifa Personalizada"}
            </h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <div className="mb-3">
                <label className="form-label">Nombre del Servicio / Tarifa *</label>
                <input
                  type="text"
                  className="form-control"
                  name="nombre"
                  value={form.nombre}
                  onChange={handleChange}
                  required
                  placeholder="Ej: Lavado Completo Premium"
                />
              </div>

              <div className="mb-3">
                <label className="form-label">Precio (€) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="form-control"
                  name="precio"
                  value={form.precio}
                  onChange={handleChange}
                  required
                  placeholder="0.00"
                />
              </div>

              <div className="mb-3">
                <label className="form-label">Descripción</label>
                <textarea
                  className="form-control"
                  name="descripcion"
                  value={form.descripcion}
                  onChange={handleChange}
                  rows="3"
                  placeholder="Detalles del servicio..."
                />
              </div>

              <div className="form-check">
                <input
                  className="form-check-input"
                  type="checkbox"
                  name="activo"
                  checked={form.activo}
                  onChange={handleChange}
                  id="activoCheck"
                />
                <label className="form-check-label" htmlFor="activoCheck">
                  Servicio activo
                </label>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ClientesPage;
