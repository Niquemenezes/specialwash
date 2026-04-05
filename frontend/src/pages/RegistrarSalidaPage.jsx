import React, { useEffect, useRef, useState, useContext } from "react";
import { Context } from "../store/appContext";
import ProductoFormModal from "../component/ProductoFormModal.jsx";
import GoldSelect from "../component/GoldSelect.jsx";
import { detectBarcodeFromFile, renderBarcodeToElement } from "../utils/barcode";
import { useBarcodeScanner } from "../hooks/useBarcodeScanner";
import { getStoredRol, normalizeRol } from "../utils/authSession";

const fmtDateTime = (s) => {
  if (!s) return "-";
  const d = new Date(s);
  return isNaN(d.getTime()) ? "-" : d.toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" });
};

const Feedback = ({ msg, type, onClose }) => {
  if (!msg) return null;
  return (
    <div className={`alert alert-${type} d-flex justify-content-between align-items-start py-2 mb-3`}>
      <span>{msg}</span>
      <button className="btn-close ms-3" onClick={onClose} />
    </div>
  );
};

const RegistrarSalidaPage = () => {
  const { store, actions } = useContext(Context);

  const rol = normalizeRol(getStoredRol());
  const isAdmin = rol === "administrador";

  const [form, setForm] = useState({
    producto_id: "",
    cantidad: "",
    observaciones: "",
    usuario_id: "",
  });
  const [codigoBarras, setCodigoBarras] = useState("");
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [barcodeMsg, setBarcodeMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type, msg }
  const [showNuevo, setShowNuevo] = useState(false);
  const [editando, setEditando] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const cameraScanRef = useRef(null);
  const galleryScanRef = useRef(null);
  const barcodeContainerRef = useRef(null);

  useEffect(() => {
    actions.getProductos();
    if (isAdmin) { actions.getSalidas(); actions.getUsuarios(); }
    if (!store.user) actions.me();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useBarcodeScanner(
    (codigo) => { if (codigo) { setCodigoBarras(codigo); buscarProductoPorCodigo(codigo); } },
    { debounceTime: 100, enabled: true }
  );

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: name === "cantidad" ? Number(value) : value }));
  };

  const setProducto = (id) => setForm((f) => ({ ...f, producto_id: id }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.producto_id) { setFeedback({ type: "warning", msg: "Debes seleccionar un producto." }); return; }
    if (!form.cantidad)    { setFeedback({ type: "warning", msg: "La cantidad es obligatoria." }); return; }
    if (isAdmin && !form.usuario_id) { setFeedback({ type: "warning", msg: "Selecciona el usuario que retira el producto." }); return; }

    setSaving(true);
    setFeedback(null);
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

      setFeedback({
        type: "success",
        msg: `✅ Salida registrada — Operario: ${oper} · Producto: ${p?.nombre || "Producto"} · Cantidad: ${form.cantidad} · Stock restante: ${p?.stock_actual ?? "—"}`,
      });

      setForm((f) => ({ ...f, cantidad: "", observaciones: "", producto_id: "" }));
      setCodigoBarras("");

      if (isAdmin) await actions.getSalidas({}, true);
      await actions.getProductos();
    } catch (err) {
      const msg = err?.message || "Error desconocido";
      if (msg.includes("Stock insuficiente")) {
        setFeedback({ type: "warning", msg: `⚠️ Stock insuficiente. ${msg}` });
      } else {
        setFeedback({ type: "danger", msg: `❌ Error: ${msg}` });
      }
    } finally {
      setSaving(false);
    }
  };

  const buscarProductoPorCodigo = async (forcedCode = "") => {
    const codigo = String(forcedCode || codigoBarras || "").trim();
    if (!codigo) { setBarcodeMsg("Introduce o escanea un código de barras."); return; }

    setBarcodeLoading(true);
    setBarcodeMsg("");
    try {
      const producto = await actions.getProductoPorCodigoBarras(codigo);
      if (!producto?.id) {
        setBarcodeMsg("No hay producto vinculado a ese código. Selecciona el producto manualmente.");
        return;
      }
      setProducto(String(producto.id));
      setCodigoBarras(codigo);
      setBarcodeMsg(`Producto detectado: ${producto.nombre}.`);
      if (barcodeContainerRef.current) renderBarcodeToElement(codigo, barcodeContainerRef.current);
    } catch {
      setBarcodeMsg("No hay producto vinculado a ese código. Selecciona el producto manualmente.");
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

  const handleEliminar = async (salidaId) => {
    if (!window.confirm("¿Seguro que deseas eliminar esta salida?")) return;
    try {
      await actions.eliminarSalida(salidaId);
      await actions.getSalidas({}, true);
      await actions.getProductos();
    } catch {
      setFeedback({ type: "danger", msg: "Error al eliminar la salida." });
    }
  };

  const productoSeleccionado = (store.productos || []).find(
    (p) => String(p.id) === String(form.producto_id)
  );
  const stockActual = productoSeleccionado?.stock_actual ?? 0;
  const cantidadSolicitada = Number(form.cantidad) || 0;
  const stockRestante = stockActual - cantidadSolicitada;
  const stockInsuficiente = cantidadSolicitada > 0 && cantidadSolicitada > stockActual;

  return (
    <div className="container py-4" style={{ maxWidth: "1000px" }}>
      {/* Encabezado */}
      <div className="d-flex justify-content-between align-items-center mb-4 p-4 rounded shadow-sm"
        style={{ background: "#0f0f0f", color: "white" }}>
        <div>
          <h2 className="fw-bold mb-1" style={{ color: "#d4af37" }}>📤 Registrar salida</h2>
          <p className="mb-0 text-light" style={{ fontSize: "14px" }}>Baja automática de inventario</p>
        </div>
        {isAdmin && (
          <button className="btn sw-btn-gold" onClick={() => setShowNuevo(true)}>
            + Nuevo producto
          </button>
        )}
      </div>

      <Feedback msg={feedback?.msg} type={feedback?.type} onClose={() => setFeedback(null)} />

      <form className="card border-0 shadow-sm p-4 mb-4" style={{ borderRadius: "12px" }} onSubmit={handleSubmit}>
        <div className="row g-3">
          {/* Código de barras */}
          <div className="col-12">
            <label className="form-label fw-semibold">Código de barras (opcional)</label>
            <input ref={cameraScanRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }}
              onChange={(e) => escanearDesdeArchivo(e.target.files?.[0])} />
            <input ref={galleryScanRef} type="file" accept="image/*" style={{ display: "none" }}
              onChange={(e) => escanearDesdeArchivo(e.target.files?.[0])} />

            <div className="d-flex gap-2 flex-wrap">
              <input
                className="form-control"
                style={{ maxWidth: "420px" }}
                value={codigoBarras}
                onChange={(e) => setCodigoBarras(e.target.value)}
                placeholder="Escanea o escribe el código"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); buscarProductoPorCodigo(); } }}
              />
              <button type="button" className="btn btn-outline-dark" onClick={() => buscarProductoPorCodigo()} disabled={barcodeLoading}>
                {barcodeLoading ? "Buscando..." : "Buscar"}
              </button>
              <button type="button" className="btn btn-primary" disabled={barcodeLoading} onClick={() => cameraScanRef.current?.click()}>
                📷 Cámara
              </button>
              <button type="button" className="btn btn-outline-primary" disabled={barcodeLoading} onClick={() => galleryScanRef.current?.click()}>
                🖼️ Foto
              </button>
            </div>

            {barcodeMsg && (
              <small className={`d-block mt-1 fw-semibold ${barcodeMsg.startsWith("Producto detectado") ? "text-success" : "text-warning"}`}>
                {barcodeMsg}
              </small>
            )}
            {codigoBarras && (
              <div ref={barcodeContainerRef} className="mt-3 p-2 bg-light rounded text-center" style={{ minHeight: "120px", display: "flex", alignItems: "center", justifyContent: "center" }} />
            )}
          </div>

          {/* Producto */}
          <div className="col-md-6">
            <label className="form-label fw-semibold">Producto *</label>
            <GoldSelect
              value={String(form.producto_id || "")}
              onChange={setProducto}
              placeholder="-- Seleccione un producto --"
              options={(store.productos || []).map((p) => ({
                value: String(p.id),
                label: p.nombre + (p.categoria ? ` — ${p.categoria}` : ""),
              }))}
            />
            {!form.producto_id && <small className="text-danger">⚠ Selecciona un producto antes de registrar.</small>}
          </div>

          {/* Cantidad + indicador stock */}
          <div className="col-md-3">
            <label className="form-label fw-semibold">Cantidad *</label>
            <input
              type="number" min="1" className="form-control"
              name="cantidad" value={form.cantidad} onChange={handleChange}
              required placeholder="0"
            />
            {productoSeleccionado && (
              <div className="mt-2 p-2 rounded" style={{
                fontSize: "13px",
                background: stockInsuficiente ? "#fff3cd" : stockActual < 10 ? "#f8f9fa" : "#e8f5e9",
                borderLeft: `4px solid ${stockInsuficiente ? "#ffc107" : stockActual < 10 ? "#ff9800" : "#4caf50"}`,
              }}>
                <div><strong>Disponible:</strong> {stockActual} uds.</div>
                {cantidadSolicitada > 0 && (
                  <div style={{ marginTop: 4 }}>
                    <strong>Quedará:</strong>{" "}
                    <strong style={{ color: stockInsuficiente ? "#d32f2f" : "inherit" }}>{stockRestante}</strong>
                    {stockInsuficiente && <div className="text-danger fw-bold mt-1">⚠️ Stock insuficiente</div>}
                    {!stockInsuficiente && stockRestante < 5 && (
                      <div className="text-warning mt-1" style={{ fontSize: "12px" }}>⚡ Considera pedir pronto</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Usuario (solo admin) */}
          {isAdmin && (
            <div className="col-md-6">
              <label className="form-label fw-semibold">Usuario que retira</label>
              <GoldSelect
                value={form.usuario_id}
                onChange={(v) => setForm((f) => ({ ...f, usuario_id: v }))}
                placeholder="Selecciona…"
                options={(store.usuarios || []).map((u) => ({ value: u.id, label: u.nombre }))}
              />
            </div>
          )}

          {/* Observaciones */}
          <div className="col-12">
            <label className="form-label fw-semibold">Observaciones</label>
            <input className="form-control" name="observaciones" value={form.observaciones} onChange={handleChange} />
          </div>

          {/* Botón submit */}
          <div className="col-12 mt-2">
            <button
              type="submit"
              className="btn sw-btn-gold w-100"
              disabled={saving || !form.producto_id || !form.cantidad}
              style={{ padding: "14px", fontSize: "16px", fontWeight: "700", borderRadius: "8px" }}
            >
              {saving ? (
                <><span className="spinner-border spinner-border-sm me-2"></span>Registrando…</>
              ) : "✅ Registrar salida"}
            </button>
            <small className="d-block mt-2 text-muted text-center">El stock se actualizará automáticamente</small>
          </div>
        </div>
      </form>

      {/* Historial (solo admin) */}
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
                      <button className="btn btn-sm btn-outline-primary me-1" onClick={() => { setEditando(s); setShowEditModal(true); }}>✏️</button>
                      <button className="btn btn-sm btn-outline-danger" onClick={() => handleEliminar(s.id)}>🗑️</button>
                    </td>
                  </tr>
                ))}
                {!(store.salidas || []).length && (
                  <tr><td colSpan="5" className="text-center text-muted py-3">No hay salidas registradas</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="alert alert-info">
          Puedes registrar salidas. El historial completo está disponible para administradores.
        </div>
      )}

      {showNuevo && (
        <ProductoFormModal show onClose={() => setShowNuevo(false)}
          onSaved={async () => { setShowNuevo(false); await actions.getProductos(); }} />
      )}

      {isAdmin && showEditModal && editando && (
        <EditarSalidaModal
          show={showEditModal}
          salida={editando}
          productos={store.productos || []}
          onClose={() => { setShowEditModal(false); setEditando(null); }}
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

/* ─── Modal editar salida ────────────────────────────────────────────────── */
const EditarSalidaModal = ({ show, salida, productos, onClose, onSaved }) => {
  const { actions } = useContext(Context);
  const [form, setForm] = useState({
    producto_id: salida.producto_id || "",
    cantidad: salida.cantidad || "",
    precio_unitario: salida.precio_unitario || "",
    observaciones: salida.observaciones || "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const precioTotal =
    Number(form.cantidad) > 0 && Number(form.precio_unitario) > 0
      ? +(Number(form.cantidad) * Number(form.precio_unitario)).toFixed(2)
      : null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErr("");
    try {
      await actions.actualizarSalida(salida.id, {
        producto_id: Number(form.producto_id),
        cantidad: Number(form.cantidad),
        precio_unitario: form.precio_unitario ? Number(form.precio_unitario) : null,
        observaciones: form.observaciones || null,
      });
      onSaved();
    } catch {
      setErr("Error al actualizar la salida.");
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
              {err && <div className="alert alert-danger py-2">{err}</div>}
              <div className="mb-3">
                <label className="form-label">Producto</label>
                <GoldSelect
                  value={form.producto_id}
                  onChange={(v) => setForm((f) => ({ ...f, producto_id: v }))}
                  placeholder="-- Seleccione --"
                  options={productos.map((p) => ({ value: p.id, label: p.nombre }))}
                />
              </div>
              <div className="mb-3">
                <label className="form-label">Cantidad</label>
                <input type="number" className="form-control" name="cantidad" value={form.cantidad} onChange={handleChange} required min="1" />
              </div>
              <div className="mb-3">
                <label className="form-label">Precio Unitario (€)</label>
                <input type="number" step="0.01" className="form-control" name="precio_unitario" value={form.precio_unitario} onChange={handleChange} />
              </div>
              {precioTotal !== null && (
                <div className="mb-3">
                  <label className="form-label">Precio Total (€)</label>
                  <input type="number" className="form-control" value={precioTotal} readOnly disabled style={{ backgroundColor: "#e9ecef" }} />
                </div>
              )}
              <div className="mb-3">
                <label className="form-label">Observaciones</label>
                <textarea className="form-control" name="observaciones" value={form.observaciones} onChange={handleChange} rows="3" />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onClose}>Cancelar</button>
              <button type="submit" className="btn btn-sm sw-btn-gold" disabled={saving}>
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
