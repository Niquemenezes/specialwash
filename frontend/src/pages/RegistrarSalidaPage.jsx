import React, { useEffect, useMemo, useState, useContext } from "react";
import { Context } from "../store/appContext";
import ProductoFormModal from "../component/ProductoFormModal.jsx";

const fmtDateTime = (s) => {
  if (!s) return "-";
  const d = new Date(s);
  return isNaN(d.getTime())
    ? "-"
    : d.toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" });
};

const getRolFromStorage = () =>
  (sessionStorage.getItem("rol") || localStorage.getItem("rol") || "").toLowerCase();

const isAdminRol = (r) => r === "administrador" || r === "admin";

const RegistrarSalidaPage = () => {
  const { store, actions } = useContext(Context);

  const rol = getRolFromStorage();
  const isAdmin = isAdminRol(rol);

  const [filtro, setFiltro] = useState("");
  const [productoId, setProductoId] = useState("");

  const [form, setForm] = useState({
    producto_id: "",
    cantidad: "",
    observaciones: "",
    usuario_id: "",
  });

  const [saving, setSaving] = useState(false);
  const [showNuevo, setShowNuevo] = useState(false);
  const [editando, setEditando] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    actions.getProductos();
    actions.getSalidas();
    if (!store.user) actions.me();
    if (isAdmin) actions.getUsuarios();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const productosFiltrados = useMemo(() => {
    const term = filtro.trim().toLowerCase();
    const list = store.productos || [];
    if (!term) return list;
    return list.filter(
      (p) =>
        (p.nombre || "").toLowerCase().includes(term) ||
        (p.categoria || "").toLowerCase().includes(term)
    );
  }, [store.productos, filtro]);

  useEffect(() => {
    if (!productoId && productosFiltrados.length > 0) {
      setProductoId(String(productosFiltrados[0].id));
    }
  }, [productoId, productosFiltrados]);

  useEffect(() => {
    setForm((f) => ({
      ...f,
      producto_id: productoId ? Number(productoId) : "",
    }));
  }, [productoId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({
      ...f,
      [name]: name === "cantidad" ? Number(value) : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.producto_id || !form.cantidad) {
      alert("Producto y cantidad son obligatorios");
      return;
    }
    if (isAdmin && !form.usuario_id) {
      alert("Selecciona el usuario que retira el producto");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        producto_id: Number(form.producto_id),
        cantidad: Number(form.cantidad),
        observaciones: form.observaciones,
      };

      if (isAdmin) payload.usuario_id = Number(form.usuario_id);

      const res = await actions.registrarSalida(payload);

      const p = res?.producto;
      const oper = res?.usuario_nombre || store.user?.nombre || "—";
      const stock = p?.stock_actual ?? "—";

      alert(`Salida registrada por ${oper}. Stock actual: ${stock}`);

      setForm((f) => ({
        ...f,
        cantidad: "",
        observaciones: "",
      }));

      await actions.getSalidas({}, true);
      await actions.getProductos();
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEditar = (salida) => {
    setEditando(salida);
    setShowEditModal(true);
  };

  const handleEliminar = async (salidaId) => {
    if (!window.confirm("¿Seguro que deseas eliminar esta salida?")) return;
    
    try {
      await actions.eliminarSalida(salidaId);
      alert("Salida eliminada");
      await actions.getSalidas({}, true);
      await actions.getProductos();
    } catch (err) {
      alert("Error al eliminar la salida");
    }
  };

  const handleNuevoSaved = async () => {
    setShowNuevo(false);
    await actions.getProductos();
  };

  return (
    <div className="container py-4" style={{ maxWidth: "1000px" }}>
      <div
        className="d-flex justify-content-between align-items-center mb-4 p-3 rounded shadow-sm"
        style={{ background: "#0f0f0f", color: "white" }}
      >
        <h2 className="fw-bold mb-0" style={{ color: "#d4af37" }}>
          📤 Registrar salida
        </h2>

        {isAdmin && (
          <button
            className="btn"
            style={{
              background: "#d4af37",
              color: "black",
              fontWeight: "600",
              borderRadius: "8px",
            }}
            onClick={() => setShowNuevo(true)}
          >
            + Nuevo producto
          </button>
        )}
      </div>

      <form
        className="card border-0 shadow-sm p-4 mb-4"
        style={{ borderRadius: "12px" }}
        onSubmit={handleSubmit}
      >
        <div className="row g-3">
          <div className="col-md-6">
            <label className="form-label fw-semibold">Buscar producto</label>
            <input
              type="text"
              className="form-control"
              placeholder="Nombre o categoría..."
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
            />
          </div>

          <div className="col-md-6">
            <label className="form-label fw-semibold">Producto</label>
            <select
              className="form-select"
              value={productoId}
              onChange={(e) => setProductoId(e.target.value)}
              required
            >
              {productosFiltrados.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="col-md-3">
            <label className="form-label fw-semibold">Cantidad *</label>
            <input
              type="number"
              min="1"
              className="form-control"
              name="cantidad"
              value={form.cantidad}
              onChange={handleChange}
              required
              placeholder="Ingrese cantidad"
            />
            {productoId && (() => {
              const producto = productosFiltrados.find(p => String(p.id) === String(productoId));
              return producto ? (
                <small className="text-muted">
                  Stock disponible: <strong>{producto.stock_actual || 0}</strong> unidades
                </small>
              ) : null;
            })()}
          </div>

          {isAdmin && (
            <div className="col-md-6">
              <label className="form-label fw-semibold">
                Usuario que retira
              </label>
              <select
                className="form-select"
                name="usuario_id"
                value={form.usuario_id}
                onChange={handleChange}
                required
              >
                <option value="">Selecciona…</option>
                {(store.usuarios || []).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="col-md-12">
            <label className="form-label fw-semibold">Observaciones</label>
            <input
              className="form-control"
              name="observaciones"
              value={form.observaciones}
              onChange={handleChange}
            />
          </div>

          <div className="col-md-12 mt-3">
            <button
              className="btn w-100"
              disabled={saving}
              style={{
                background: "#d4af37",
                color: "black",
                fontWeight: "600",
                padding: "12px",
              }}
            >
              {saving ? "Guardando…" : "Registrar salida"}
            </button>
          </div>
        </div>
      </form>

      <div className="card border-0 shadow-sm">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Producto</th>
                <th className="text-end">Cantidad</th>
                <th>Usuario</th>
                <th className="text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                console.log("🔍 SALIDAS EN STORE:", store.salidas);
                console.log("🔍 CANTIDAD:", (store.salidas || []).length);
                return (store.salidas || []).map((s) => (
                <tr key={s.id}>
                  <td>{fmtDateTime(s.fecha)}</td>
                  <td>{s.producto_nombre}</td>
                  <td className="text-end">{s.cantidad}</td>
                  <td>{s.usuario_nombre}</td>
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
              ))})()}
            </tbody>
          </table>
        </div>
      </div>

      {showNuevo && (
        <ProductoFormModal
          show={showNuevo}
          onClose={() => setShowNuevo(false)}
          onSaved={handleNuevoSaved}
          initial={null}
        />
      )}

      {showEditModal && editando && (
        <EditarSalidaModal
          show={showEditModal}
          salida={editando}
          productos={store.productos}
          onClose={() => {
            setShowEditModal(false);
            setEditando(null);
          }}
          onSaved={async () => {
            await actions.getSalidas({}, true);
            await actions.getProductos();
            setShowEditModal(false);
            setEditando(null);
          }}
        />
      )}
    </div>
  );
};

/* ======================
   Modal de Edición
====================== */
const EditarSalidaModal = ({ show, salida, productos, onClose, onSaved }) => {
  const { actions } = useContext(Context);
  const [form, setForm] = useState({
    producto_id: salida.producto_id || "",
    cantidad: salida.cantidad || "",
    precio_unitario: salida.precio_unitario || "",
    observaciones: salida.observaciones || "",
  });
  const [saving, setSaving] = useState(false);

  // Actualizar formulario cuando cambia la salida
  useEffect(() => {
    const cantidad = salida.cantidad || "";
    const precioUnit = salida.precio_unitario || "";
    const precioTotal = cantidad && precioUnit ? +(cantidad * precioUnit).toFixed(2) : "";
    
    setForm({
      producto_id: salida.producto_id || "",
      cantidad: cantidad,
      precio_unitario: precioUnit,
      precio_total: precioTotal,
      observaciones: salida.observaciones || "",
    });
  }, [salida]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Si cambia cantidad o precio unitario, recalcular precio total
    if (name === "cantidad" || name === "precio_unitario") {
      const nuevoForm = { ...form, [name]: value };
      const cantidad = Number(nuevoForm.cantidad) || 0;
      const precioUnit = Number(nuevoForm.precio_unitario) || 0;
      const precioTotal = cantidad > 0 && precioUnit > 0 ? +(cantidad * precioUnit).toFixed(2) : "";
      setForm({ ...nuevoForm, precio_total: precioTotal });
    } else {
      setForm((f) => ({ ...f, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await actions.actualizarSalida(salida.id, {
        producto_id: Number(form.producto_id),
        cantidad: Number(form.cantidad),
        precio_unitario: form.precio_unitario ? Number(form.precio_unitario) : null,
        observaciones: form.observaciones || null,
      });
      alert("Salida actualizada");
      onSaved();
    } catch (err) {
      alert("Error al actualizar la salida");
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
            <h5 className="modal-title">Editar Salida</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <div className="mb-3">
                <label className="form-label">Producto</label>
                <select
                  className="form-select"
                  name="producto_id"
                  value={form.producto_id}
                  onChange={handleChange}
                  required
                >
                  {productos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-3">
                <label className="form-label">Cantidad</label>
                <input
                  type="number"
                  className="form-control"
                  name="cantidad"
                  value={form.cantidad}
                  onChange={handleChange}
                  required
                  min="1"
                />
              </div>

              <div className="mb-3">
                <label className="form-label">Precio Unitario (€)</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-control"
                  name="precio_unitario"
                  value={form.precio_unitario}
                  onChange={handleChange}
                />
              </div>

              {form.precio_total !== "" && (
                <div className="mb-3">
                  <label className="form-label">Precio Total (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control"
                    value={form.precio_total}
                    readOnly
                    disabled
                    style={{ backgroundColor: "#e9ecef" }}
                  />
                </div>
              )}

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
              <button
                type="submit"
                className="btn"
                disabled={saving}
                style={{ background: "#d4af37", fontWeight: "600" }}
              >
                {saving ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default RegistrarSalidaPage;
