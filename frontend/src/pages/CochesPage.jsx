import React, { useEffect, useState, useContext } from "react";
import { Context } from "../store/appContext";
import GoldSelect from "../component/GoldSelect.jsx";

const CochesPage = () => {
  const { store, actions } = useContext(Context);
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [busqueda, setBusqueda] = useState("");

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
    if (!window.confirm("¿Eliminar este coche?")) return;
    try {
      await actions.eliminarCoche(id);
      actions.getCoches();
    } catch (err) {
      alert("Error al eliminar el coche");
    }
  };

  const cochesFiltrados = (store.coches || []).filter((c) =>
    c.matricula?.toLowerCase().includes(busqueda.toLowerCase()) ||
    c.marca?.toLowerCase().includes(busqueda.toLowerCase()) ||
    c.modelo?.toLowerCase().includes(busqueda.toLowerCase()) ||
    c.cliente_nombre?.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="container py-4" style={{ maxWidth: "1000px" }}>
      <div
        className="d-flex justify-content-between align-items-center mb-4 p-3 rounded shadow-sm"
        style={{ background: "#0f0f0f", color: "white" }}
      >
        <h2 className="fw-bold mb-0" style={{ color: "#d4af37" }}>
          🚗 Coches
        </h2>
        <button
          className="btn"
          onClick={handleNuevo}
          style={{ background: "#d4af37", color: "black", fontWeight: "600", borderRadius: "8px" }}
        >
          ➕ Nuevo Coche
        </button>
      </div>

      <div className="mb-3">
        <input
          type="text"
          className="form-control"
          placeholder="Buscar por matrícula, marca, modelo o cliente..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      <div className="table-responsive">
        <table className="table table-striped table-hover">
          <thead className="table-dark">
            <tr>
              <th>Matrícula</th>
              <th>Marca</th>
              <th>Modelo</th>
              <th>Color</th>
              <th>Cliente</th>
              <th className="text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {cochesFiltrados.map((c) => (
              <tr key={c.id}>
                <td><strong>{c.matricula}</strong></td>
                <td>{c.marca || "-"}</td>
                <td>{c.modelo || "-"}</td>
                <td>{c.color || "-"}</td>
                <td>{c.cliente_nombre || "-"}</td>
                <td className="text-center">
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
        <CocheModal
          show={showModal}
          coche={editando}
          clientes={store.clientes || []}
          onClose={() => {
            setShowModal(false);
            setEditando(null);
          }}
          onSaved={() => {
            actions.getCoches();
            setShowModal(false);
            setEditando(null);
          }}
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
    }
  }, [coche]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.cliente_id) {
      alert("Selecciona un cliente");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        matricula: form.matricula.toUpperCase(),
        cliente_id: Number(form.cliente_id),
      };
      
      if (coche) {
        await actions.actualizarCoche(coche.id, payload);
      } else {
        await actions.crearCoche(payload);
      }
      alert(coche ? "Coche actualizado" : "Coche creado");
      onSaved();
    } catch (err) {
      alert("Error al guardar el coche");
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
              {coche ? "Editar Coche" : "Nuevo Coche"}
            </h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <div className="mb-3">
                <label className="form-label">Matrícula *</label>
                <input
                  type="text"
                  className="form-control text-uppercase"
                  name="matricula"
                  value={form.matricula}
                  onChange={handleChange}
                  required
                  placeholder="1234ABC"
                />
              </div>

              <div className="mb-3">
                <label className="form-label">Cliente *</label>
                <GoldSelect
                  value={form.cliente_id}
                  onChange={(v) => setForm((f) => ({ ...f, cliente_id: v }))}
                  placeholder="Seleccionar..."
                  options={clientes.map((c) => ({
                    value: c.id,
                    label: c.nombre,
                  }))}
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

export default CochesPage;
