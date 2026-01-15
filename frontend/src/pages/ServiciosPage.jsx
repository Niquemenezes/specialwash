import React, { useEffect, useState, useContext } from "react";
import { Context } from "../store/appContext";
import { useSearchParams } from "react-router-dom";

const fmtDateTime = (s) => {
  if (!s) return "-";
  const d = new Date(s);
  return isNaN(d.getTime())
    ? "-"
    : d.toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" });
};

const ServiciosPage = () => {
  const { store, actions } = useContext(Context);
  const [searchParams] = useSearchParams();
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [cocheFilter, setCocheFilter] = useState("");

  useEffect(() => {
    // Obtener coche_id de la URL si existe
    const cocheIdFromUrl = searchParams.get("coche_id");
    if (cocheIdFromUrl) {
      setCocheFilter(cocheIdFromUrl);
    }
    
    actions.getServicios();
    actions.getCoches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleNuevo = () => {
    setEditando(null);
    setShowModal(true);
  };

  const handleEditar = (servicio) => {
    setEditando(servicio);
    setShowModal(true);
  };

  const handleEliminar = async (id) => {
    if (!window.confirm("¿Eliminar este servicio?")) return;
    try {
      await actions.eliminarServicio(id);
      actions.getServicios();
    } catch (err) {
      alert("Error al eliminar el servicio");
    }
  };

  const serviciosFiltrados = (store.servicios || []).filter((s) => {
    const matchBusqueda = !busqueda || 
      s.coche_matricula?.toLowerCase().includes(busqueda.toLowerCase()) ||
      s.cliente_nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
      s.tipo_servicio?.toLowerCase().includes(busqueda.toLowerCase());
    
    const matchCoche = !cocheFilter || s.coche_id === Number(cocheFilter);
    
    return matchBusqueda && matchCoche;
  });

  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Servicios</h2>
        <button className="btn btn-primary" onClick={handleNuevo}>
          <i className="fas fa-plus me-2"></i>Nuevo Servicio
        </button>
      </div>

      <div className="row mb-3">
        <div className="col-md-8">
          <input
            type="text"
            className="form-control"
            placeholder="Buscar por matrícula, cliente o tipo de servicio..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        <div className="col-md-4">
          <select
            className="form-select"
            value={cocheFilter}
            onChange={(e) => setCocheFilter(e.target.value)}
          >
            <option value="">Todos los coches</option>
            {(store.coches || []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.matricula} - {c.cliente_nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="table-responsive">
        <table className="table table-striped table-hover">
          <thead className="table-dark">
            <tr>
              <th>Fecha</th>
              <th>Matrícula</th>
              <th>Marca/Modelo</th>
              <th>Cliente</th>
              <th>Tipo Servicio</th>
              <th className="text-end">Precio</th>
              <th>Usuario</th>
              <th className="text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {serviciosFiltrados.map((s) => (
              <tr key={s.id}>
                <td>{fmtDateTime(s.fecha)}</td>
                <td><strong>{s.coche_matricula}</strong></td>
                <td>{s.coche_marca} {s.coche_modelo}</td>
                <td>{s.cliente_nombre}</td>
                <td>{s.tipo_servicio || "-"}</td>
                <td className="text-end">{s.precio ? `${s.precio.toFixed(2)}€` : "-"}</td>
                <td>{s.usuario_nombre || "-"}</td>
                <td className="text-center">
                  <button
                    className="btn btn-sm btn-outline-primary me-2"
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

        {serviciosFiltrados.length === 0 && (
          <div className="text-center text-muted py-4">
            No hay servicios registrados
          </div>
        )}
      </div>

      {showModal && (
        <ServicioModal
          show={showModal}
          servicio={editando}
          coches={store.coches || []}
          onClose={() => {
            setShowModal(false);
            setEditando(null);
          }}
          onSaved={() => {
            actions.getServicios();
            setShowModal(false);
            setEditando(null);
          }}
        />
      )}
    </div>
  );
};

const ServicioModal = ({ show, servicio, coches, onClose, onSaved }) => {
  const { actions } = useContext(Context);
  const [form, setForm] = useState({
    coche_id: "",
    tipo_servicio: "",
    precio: "",
    observaciones: "",
  });
  const [saving, setSaving] = useState(false);
  const [tarifasCliente, setTarifasCliente] = useState([]);
  const [loadingTarifas, setLoadingTarifas] = useState(false);
  const [clienteId, setClienteId] = useState(null);

  const tiposServicio = [
    "Lavado Básico",
    "Lavado Premium",
    "Encerado",
    "Pulido",
    "Limpieza Interior",
    "Limpieza Completa",
    "Tratamiento Cerámico",
    "Otro"
  ];

  useEffect(() => {
    if (servicio) {
      setForm({
        coche_id: servicio.coche_id || "",
        tipo_servicio: servicio.tipo_servicio || "",
        precio: servicio.precio || "",
        observaciones: servicio.observaciones || "",
      });
    }
  }, [servicio]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    
    // Si cambia el coche, cargar las tarifas personalizadas del cliente
    if (name === "coche_id" && value) {
      const cocheSeleccionado = coches.find(c => c.id === Number(value));
      if (cocheSeleccionado && cocheSeleccionado.cliente_id) {
        cargarTarifasCliente(cocheSeleccionado.cliente_id);
        setClienteId(cocheSeleccionado.cliente_id);
      } else {
        setTarifasCliente([]);
        setClienteId(null);
      }
    }
  };

  const cargarTarifasCliente = async (clienteId) => {
    setLoadingTarifas(true);
    try {
      const tarifas = await actions.getServiciosCliente(clienteId);
      // Solo mostrar tarifas activas
      setTarifasCliente(tarifas.filter(t => t.activo));
    } catch (err) {
      console.error("Error al cargar tarifas:", err);
      setTarifasCliente([]);
    } finally {
      setLoadingTarifas(false);
    }
  };

  const handleSeleccionarTarifa = (tarifa) => {
    setForm(f => ({
      ...f,
      tipo_servicio: tarifa.nombre,
      precio: tarifa.precio
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        coche_id: Number(form.coche_id),
        tipo_servicio: form.tipo_servicio,
        precio: form.precio ? Number(form.precio) : 0,
        observaciones: form.observaciones,
      };
      
      if (servicio) {
        await actions.actualizarServicio(servicio.id, payload);
      } else {
        await actions.crearServicio(payload);
      }
      alert(servicio ? "Servicio actualizado" : "Servicio registrado");
      onSaved();
    } catch (err) {
      alert("Error al guardar el servicio");
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
              {servicio ? "Editar Servicio" : "Nuevo Servicio"}
            </h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <div className="mb-3">
                <label className="form-label">Coche *</label>
                <select
                  className="form-select"
                  name="coche_id"
                  value={form.coche_id}
                  onChange={handleChange}
                  required
                >
                  <option value="">Seleccionar...</option>
                  {coches.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.matricula} - {c.marca} {c.modelo} ({c.cliente_nombre})
                    </option>
                  ))}
                </select>
              </div>

              {/* Mostrar tarifas personalizadas del cliente */}
              {form.coche_id && tarifasCliente.length > 0 && (
                <div className="mb-3">
                  <label className="form-label">
                    <i className="fas fa-star text-warning me-2"></i>
                    Tarifas Personalizadas del Cliente
                  </label>
                  <div className="list-group">
                    {tarifasCliente.map((tarifa) => (
                      <button
                        key={tarifa.id}
                        type="button"
                        className="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
                        onClick={() => handleSeleccionarTarifa(tarifa)}
                      >
                        <div>
                          <strong>{tarifa.nombre}</strong>
                          {tarifa.descripcion && (
                            <small className="d-block text-muted">{tarifa.descripcion}</small>
                          )}
                        </div>
                        <span className="badge bg-primary rounded-pill">
                          {tarifa.precio.toFixed(2)}€
                        </span>
                      </button>
                    ))}
                  </div>
                  <small className="text-muted">
                    Haz clic en una tarifa para aplicarla automáticamente
                  </small>
                </div>
              )}

              {form.coche_id && loadingTarifas && (
                <div className="text-center mb-3">
                  <div className="spinner-border spinner-border-sm" role="status">
                    <span className="visually-hidden">Cargando tarifas...</span>
                  </div>
                </div>
              )}

              <div className="mb-3">
                <label className="form-label">Tipo de Servicio *</label>
                <input
                  type="text"
                  list="servicios-datalist"
                  className="form-control"
                  name="tipo_servicio"
                  value={form.tipo_servicio}
                  onChange={handleChange}
                  required
                  placeholder="Selecciona o escribe un servicio..."
                />
                <datalist id="servicios-datalist">
                  {tiposServicio.map((tipo) => (
                    <option key={tipo} value={tipo} />
                  ))}
                </datalist>
                <small className="text-muted">
                  Puedes seleccionar de la lista o escribir un servicio nuevo
                </small>
              </div>

              <div className="mb-3">
                <label className="form-label">Precio (€)</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-control"
                  name="precio"
                  value={form.precio}
                  onChange={handleChange}
                  min="0"
                />
              </div>

              <div className="mb-3">
                <label className="form-label">Observaciones</label>
                <textarea
                  className="form-control"
                  name="observaciones"
                  value={form.observaciones}
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

export default ServiciosPage;
