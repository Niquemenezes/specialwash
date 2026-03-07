import React, { useEffect, useState, useContext } from "react";
import { Context } from "../store/appContext";

const ClientesPage = () => {
  const { store, actions } = useContext(Context);
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [showServiciosModal, setShowServiciosModal] = useState(false);
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [showCochesModal, setShowCochesModal] = useState(false);
  const [clienteCochesSeleccionado, setClienteCochesSeleccionado] = useState(null);

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
    <div className="container py-4" style={{ maxWidth: "1000px" }}>
      <div
        className="d-flex justify-content-between align-items-center mb-4 p-3 rounded shadow-sm"
        style={{ background: "#0f0f0f", color: "white" }}
      >
        <h2 className="fw-bold mb-0" style={{ color: "#d4af37" }}>
          👥 Clientes
        </h2>
        <button
          className="btn"
          onClick={handleNuevo}
          style={{ background: "#d4af37", color: "black", fontWeight: "600", borderRadius: "8px" }}
        >
          ➕ Nuevo Cliente
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
                    className="btn btn-sm btn-outline-primary me-2"
                    onClick={() => handleGestionarCoches(c)}
                    title="Ver coches"
                  >
                    🚗
                  </button>
                  <button
                    className="btn btn-sm btn-outline-warning me-2"
                    onClick={() => handleGestionarServicios(c)}
                    title="Tarifas Personalizadas"
                  >
                    💲
                  </button>
                  <button
                    className="btn btn-sm btn-outline-warning me-2"
                    onClick={() => handleEditar(c)}
                    title="Editar"
                  >
                    ✏️
                  </button>
                  <button
                    className="btn btn-sm btn-outline-danger"
                    onClick={() => handleEliminar(c.id)}
                    title="Eliminar"
                  >
                    🗑️
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
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={onClose}
                style={{ borderRadius: "8px" }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn btn-sm"
                disabled={saving}
                style={{ background: "#d4af37", color: "black", fontWeight: "600", borderRadius: "8px" }}
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
              <button
                className="btn btn-sm"
                onClick={handleNuevo}
                style={{ background: "#d4af37", color: "black", fontWeight: "600", borderRadius: "8px" }}
              >
                ➕ Nueva Tarifa
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
                      <th>Desc. %</th>
                      <th>Precio final</th>
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
                        <td>{(s.descuento_porcentaje ?? 0).toFixed(2)}%</td>
                        <td><strong>{(s.precio_final ?? s.precio ?? 0).toFixed(2)} €</strong></td>
                        <td>{s.descripcion || "-"}</td>
                        <td>
                          <span className={`badge ${s.activo ? 'bg-success' : 'bg-secondary'}`}>
                            {s.activo ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="text-center">
                          <button
                            className="btn btn-sm btn-outline-warning me-1"
                            onClick={() => handleEditar(s)}
                            title="Editar"
                          >
                            ✏️
                          </button>
                          <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => handleEliminar(s.id)}
                            title="Eliminar"
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
              className="btn btn-sm btn-outline-secondary"
              onClick={onClose}
              style={{ borderRadius: "8px" }}
            >
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
    descuento_porcentaje: "0",
    descripcion: "",
    activo: true,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (servicio) {
      setForm({
        nombre: servicio.nombre || "",
        precio: servicio.precio || "",
        descuento_porcentaje: (servicio.descuento_porcentaje ?? 0).toString(),
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
                <label className="form-label">Descuento (%)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  className="form-control"
                  name="descuento_porcentaje"
                  value={form.descuento_porcentaje}
                  onChange={handleChange}
                  placeholder="0"
                />
                <small className="text-muted">0 a 100. Este descuento se aplica sobre el precio de la tarifa.</small>
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
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={onClose}
                style={{ borderRadius: "8px" }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn btn-sm"
                disabled={saving}
                style={{ background: "#d4af37", color: "black", fontWeight: "600", borderRadius: "8px" }}
              >
                {saving ? "⏳ Guardando..." : servicio ? "💾 Guardar" : "✅ Crear"}
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
      alert("Coche eliminado");
    } catch (err) {
      alert("Error al eliminar el coche");
    }
  };

  if (!show) return null;

  return (
    <div className="modal d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
      <div className="modal-dialog modal-lg modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">🚗 Coches de {cliente.nombre}</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>

          <div className="modal-body">
            <div className="d-flex justify-content-end mb-3">
              <button
                className="btn btn-sm"
                onClick={handleNuevo}
                style={{ background: "#d4af37", color: "black", fontWeight: "600", borderRadius: "8px" }}
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
              className="btn btn-sm btn-outline-secondary"
              onClick={onClose}
              style={{ borderRadius: "8px" }}
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
        alert("Coche actualizado");
      } else {
        await actions.crearCoche(payload);
        alert("Coche creado");
      }
      onSaved();
    } catch (err) {
      alert("Error al guardar el coche: " + err.message);
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
              {coche ? "Editar coche" : `Nuevo coche para ${cliente.nombre}`}
            </h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
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
                className="btn btn-sm btn-outline-secondary"
                onClick={onClose}
                style={{ borderRadius: "8px" }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn btn-sm"
                disabled={saving}
                style={{ background: "#d4af37", color: "black", fontWeight: "600", borderRadius: "8px" }}
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
