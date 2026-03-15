import React, { useEffect, useRef, useState, useContext } from "react";
import { Context } from "../store/appContext";
import ProductoFormModal from "../component/ProductoFormModal.jsx";
import GoldSelect from "../component/GoldSelect.jsx";
import { detectBarcodeFromFile } from "../utils/barcode";

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

  const [productoId, setProductoId] = useState("");
  const [codigoBarras, setCodigoBarras] = useState("");
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [barcodeMsg, setBarcodeMsg] = useState("");
  const cameraScanRef = useRef(null);
  const galleryScanRef = useRef(null);

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
    if (isAdmin) actions.getSalidas();
    if (!store.user) actions.me();
    if (isAdmin) actions.getUsuarios();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

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

    const pid = form.producto_id || (productoId ? Number(productoId) : "");
    if (!pid) {
      alert("Debes seleccionar un producto.");
      return;
    }
    if (!form.cantidad) {
      alert("La cantidad es obligatoria");
      return;
    }
    if (isAdmin && !form.usuario_id) {
      alert("Selecciona el usuario que retira el producto");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        producto_id: Number(pid),
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

      if (isAdmin) await actions.getSalidas({}, true);
      await actions.getProductos();
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const buscarProductoPorCodigo = async (forcedCode = "") => {
    const codigo = String(forcedCode || codigoBarras || "").trim();
    if (!codigo) {
      alert("Introduce o escanea un codigo de barras.");
      return;
    }

    setBarcodeLoading(true);
    setBarcodeMsg("");
    try {
      const producto = await actions.getProductoPorCodigoBarras(codigo);
      if (!producto?.id) {
        setBarcodeMsg("No hay producto vinculado a ese codigo. Registra la salida de forma manual seleccionando el producto.");
        return;
      }
      setProductoId(String(producto.id));
      setForm((f) => ({ ...f, producto_id: Number(producto.id) }));
      setCodigoBarras(codigo);
      setBarcodeMsg(`Producto detectado: ${producto.nombre}.`);
    } catch (err) {
      setBarcodeMsg("No hay producto vinculado a ese codigo. Registra la salida de forma manual seleccionando el producto.");
    } finally {
      setBarcodeLoading(false);
    }
  };

  const escanearDesdeArchivo = async (file) => {
    if (!file) return;

    setBarcodeLoading(true);
    setBarcodeMsg("");
    try {
      const codigo = await detectBarcodeFromFile(file);
      setCodigoBarras(codigo);
      await buscarProductoPorCodigo(codigo);
    } catch (err) {
      setBarcodeMsg(err?.message || "No se pudo escanear el código.");
    } finally {
      setBarcodeLoading(false);
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
          <div className="col-12">
            <label className="form-label fw-semibold">Codigo de barras (opcional)</label>
            <input
              ref={cameraScanRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: "none" }}
              onChange={(e) => escanearDesdeArchivo(e.target.files?.[0])}
            />
            <input
              ref={galleryScanRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => escanearDesdeArchivo(e.target.files?.[0])}
            />
            <div className="d-flex gap-2 flex-wrap">
              <input
                className="form-control"
                style={{ maxWidth: "420px" }}
                value={codigoBarras}
                onChange={(e) => setCodigoBarras(e.target.value)}
                placeholder="Escanea o escribe el codigo"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    buscarProductoPorCodigo();
                  }
                }}
              />
              <button
                type="button"
                className="btn btn-outline-dark"
                onClick={buscarProductoPorCodigo}
                disabled={barcodeLoading}
              >
                {barcodeLoading ? "Buscando..." : "Buscar por codigo"}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={barcodeLoading}
                onClick={() => cameraScanRef.current?.click()}
              >
                {barcodeLoading ? "Escaneando..." : "Escanear camara"}
              </button>
              <button
                type="button"
                className="btn btn-outline-primary"
                disabled={barcodeLoading}
                onClick={() => galleryScanRef.current?.click()}
              >
                Desde foto
              </button>
            </div>
            <small className="text-muted d-block mt-1">
              Puedes registrar salida por codigo de barras o seleccionar manualmente el producto.
            </small>
            {barcodeMsg && (
              <small
                className={`d-block mt-1 ${barcodeMsg.startsWith("Producto detectado") ? "text-success" : "text-warning"}`}
                style={{ fontWeight: 600 }}
              >
                {barcodeMsg}
              </small>
            )}
          </div>

          <div className="col-md-6">
            <label className="form-label fw-semibold">Producto *</label>
            <GoldSelect
              value={productoId}
              onChange={(v) => setProductoId(v)}
              placeholder="-- Seleccione un producto --"
              options={(store.productos || []).map((p) => ({
                value: String(p.id),
                label: p.nombre + (p.categoria ? ` — ${p.categoria}` : ""),
              }))}
            />
            {!productoId && (
              <small className="text-danger">⚠ Debes seleccionar un producto antes de registrar.</small>
            )}
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
              const producto = (store.productos || []).find(p => String(p.id) === String(productoId));
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
              <GoldSelect
                value={form.usuario_id}
                onChange={(v) => setForm((f) => ({ ...f, usuario_id: v }))}
                placeholder="Selecciona…"
                options={(store.usuarios || []).map((u) => ({
                  value: u.id,
                  label: u.nombre,
                }))}
              />
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

      {isAdmin ? (
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
                {(store.salidas || []).map((s) => (
                  <tr key={s.id}>
                    <td>{fmtDateTime(s.fecha)}</td>
                    <td>{s.producto_nombre}</td>
                    <td className="text-end">{s.cantidad}</td>
                    <td>{s.usuario_nombre}</td>
                    <td className="text-center">
                      <button
                        className="btn btn-sm btn-outline-primary me-1"
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
                {(store.salidas || []).length === 0 && (
                  <tr>
                    <td colSpan="5" className="text-center text-muted py-3">
                      No hay salidas registradas
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="alert alert-info">
          Puedes registrar salidas, pero el historial y cantidades retiradas solo están visibles para administradores.
        </div>
      )}

      {showNuevo && (
        <ProductoFormModal
          show={showNuevo}
          onClose={() => setShowNuevo(false)}
          onSaved={handleNuevoSaved}
          initial={null}
        />
      )}

      {isAdmin && showEditModal && editando && (
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
                <GoldSelect
                  value={form.producto_id}
                  onChange={(v) => setForm((f) => ({ ...f, producto_id: v }))}
                  placeholder="-- Seleccione --"
                  options={productos.map((p) => ({
                    value: p.id,
                    label: p.nombre,
                  }))}
                />
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
                {saving ? "⏳ Guardando..." : "💾 Guardar"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default RegistrarSalidaPage;
