import React, {
  useEffect,
  useMemo,
  useState,
  useContext,
} from "react";
import { Context } from "../store/appContext";
import ProductoFormModal from "../component/ProductoFormModal.jsx";
import GoldSelect from "../component/GoldSelect.jsx";

/* ======================
   Utils
====================== */
const fmtDateTime = (v) => {
  if (!v) return "-";
  const d = new Date(v);
  return isNaN(d.getTime())
    ? "-"
    : d.toLocaleString("es-ES", {
        dateStyle: "short",
        timeStyle: "short",
      });
};

/* ======================
   Componente
====================== */
const Feedback = ({ msg, type, onClose }) => {
  if (!msg) return null;
  return (
    <div className={`alert alert-${type} d-flex justify-content-between align-items-start py-2 mb-3`}>
      <span>{msg}</span>
      <button className="btn-close ms-3" onClick={onClose} />
    </div>
  );
};

const RegistrarEntradaPage = () => {
  const { store, actions } = useContext(Context);

  const [feedback, setFeedback] = useState(null); // { type, msg }

  const [form, setForm] = useState({
    producto_id: "",
    proveedor_id: "",
    cantidad: "",
    tipo_documento: "albaran",
    numero_documento: "",
    precio_unitario: "",
    iva_porcentaje: "21",
    descuento_porcentaje: "0",
  });

  const [saving, setSaving] = useState(false);
  const [ocrFile, setOcrFile] = useState(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrMsg, setOcrMsg] = useState("");
  const [showNuevo, setShowNuevo] = useState(false);
  const [editando, setEditando] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

  /* ======================
     Carga inicial
  ====================== */
  useEffect(() => {
    actions.getProductos();
    actions.getProveedores();
    actions.getEntradas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Autoselección eliminada: el usuario DEBE elegir producto manualmente */

  /* ======================
     Cálculos precios
     (sin bucles)
  ====================== */
  // Cálculo de totales solo para mostrar
  const cantidad = Number(form.cantidad) || 0;
  const precioUnitario = Number(form.precio_unitario) || 0;
  const ivaPct = Number(form.iva_porcentaje) || 0;
  const descuentoPct = Number(form.descuento_porcentaje) || 0;
  const subtotal = precioUnitario * cantidad;
  const descuento = +(subtotal * (descuentoPct / 100)).toFixed(2);
  const totalSinIva = +(subtotal - descuento).toFixed(2);
  const totalIva = +(totalSinIva * (ivaPct / 100)).toFixed(2);
  const totalConIva = +(totalSinIva + totalIva).toFixed(2);

  /* ======================
     Handlers
  ====================== */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.producto_id || !form.cantidad || !form.precio_unitario) {
      setFeedback({ type: "warning", msg: "Producto, cantidad y precio unitario son obligatorios." });
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      const body = {
        producto_id: Number(form.producto_id),
        proveedor_id: form.proveedor_id ? Number(form.proveedor_id) : null,
        cantidad: Number(form.cantidad),
        precio_unitario: precioUnitario,
        porcentaje_iva: ivaPct,
        descuento_porcentaje: descuentoPct,
        numero_albaran: form.numero_documento || null,
      };

      const res = await actions.registrarEntrada(body);
      setFeedback({
        type: "success",
        msg: `✅ Entrada registrada correctamente. Stock actual: ${res?.producto?.stock_actual ?? "-"}`,
      });

      setForm((f) => ({ ...f, cantidad: "", numero_documento: "", precio_unitario: "" }));
      actions.getEntradas();
      actions.getProductos();
    } catch (err) {
      setFeedback({ type: "danger", msg: "❌ Error al registrar la entrada. Inténtalo de nuevo." });
    } finally {
      setSaving(false);
    }
  };

  const handleEditar = (entrada) => {
    setEditando(entrada);
    setShowEditModal(true);
  };

  const handleEliminar = async (entradaId) => {
    if (!window.confirm("¿Seguro que deseas eliminar esta entrada?")) return;
    
    try {
      await actions.eliminarEntrada(entradaId);
      setFeedback({ type: "success", msg: "Entrada eliminada correctamente." });
      actions.getEntradas();
      actions.getProductos();
    } catch (err) {
      setFeedback({ type: "danger", msg: "Error al eliminar la entrada." });
    }
  };

  const procesarOcrArchivo = async (file) => {
    if (!file) return;

    setOcrFile(file);
    setOcrMsg("");
    setOcrLoading(true);
    try {
      const sugerencia = await actions.sugerirEntradaOCR(file);

      const hasCantidad = sugerencia?.cantidad != null && Number.isFinite(Number(sugerencia.cantidad));
      const hasPrecio = sugerencia?.precio_unitario != null && Number.isFinite(Number(sugerencia.precio_unitario));
      const hasIva = sugerencia?.porcentaje_iva != null && Number.isFinite(Number(sugerencia.porcentaje_iva));
      const hasDescuento = sugerencia?.descuento_porcentaje != null && Number.isFinite(Number(sugerencia.descuento_porcentaje));
      const hasNumero = Boolean((sugerencia?.numero_albaran || "").trim());

      setForm((prev) => ({
        ...prev,
        cantidad: hasCantidad ? String(sugerencia.cantidad) : prev.cantidad,
        precio_unitario: hasPrecio ? String(sugerencia.precio_unitario) : prev.precio_unitario,
        iva_porcentaje: hasIva ? String(sugerencia.porcentaje_iva) : prev.iva_porcentaje,
        descuento_porcentaje: hasDescuento ? String(sugerencia.descuento_porcentaje) : prev.descuento_porcentaje,
        numero_documento: sugerencia?.numero_albaran || prev.numero_documento,
      }));

      const detectedUseful = [hasCantidad, hasPrecio, hasIva, hasDescuento].filter(Boolean).length;
      if (detectedUseful === 0 && !hasNumero) {
        setOcrMsg("⚠️ Se pudo leer la foto, pero no se detectaron cantidad/precio/IVA. Intenta otra foto más cerca, con mejor luz y encuadrando solo la tabla del albarán.");
      } else if (sugerencia?.multiple_items_detected) {
        setOcrMsg("⚠️ OCR parcial: se detectaron varios artículos. Se aplicó una sugerencia inicial, revisa los campos antes de guardar.");
      } else {
        setOcrMsg("✅ Datos detectados y completados. Revisa y confirma antes de guardar.");
      }
    } catch (err) {
      const errorMsg = err?.message || "No se pudo leer el documento.";
      setOcrMsg("❌ " + errorMsg);
      console.error("Error OCR:", err);
    } finally {
      setOcrLoading(false);
    }
  };

  /* ======================
     Entradas ordenadas
  ====================== */
  const entradasOrdenadas = useMemo(() => {
    return [...(store.entradas || [])].sort(
      (a, b) =>
        new Date(b.created_at || b.fecha) -
        new Date(a.created_at || a.fecha)
    );
  }, [store.entradas]);

  /* ======================
     RENDER
  ====================== */
  return (
    <div className="container py-4" style={{ maxWidth: "1000px" }}>
      <Feedback msg={feedback?.msg} type={feedback?.type} onClose={() => setFeedback(null)} />
      <form onSubmit={handleSubmit} className="mb-4 p-3 rounded shadow-sm bg-light">
        <div className="row g-3 align-items-end">
          <div className="col-12">
            <label className="form-label fw-semibold">📄 OCR de factura/albarán (opcional)</label>
            
            <input
              id="ocr-file-input-camera"
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={(e) => procesarOcrArchivo(e.target.files?.[0])}
            />

            <input
              id="ocr-file-input-gallery"
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => procesarOcrArchivo(e.target.files?.[0])}
            />
            
            <div className="d-grid gap-2 d-sm-flex mb-2">
              <label 
                htmlFor="ocr-file-input-camera"
                className="btn btn-primary btn-lg flex-sm-fill mb-0"
                style={{ cursor: ocrLoading ? 'not-allowed' : 'pointer', opacity: ocrLoading ? 0.6 : 1 }}
              >
                {ocrLoading ? "📄 Escaneando..." : "📷 Escanear Factura/Albarán"}
              </label>
              <label
                htmlFor="ocr-file-input-gallery"
                className="btn btn-outline-primary btn-lg flex-sm-fill mb-0"
                style={{ cursor: ocrLoading ? 'not-allowed' : 'pointer', opacity: ocrLoading ? 0.6 : 1 }}
              >
                🖼️ Seleccionar Archivo
              </label>
            </div>
            
            {ocrFile && !ocrLoading && !ocrMsg && (
              <small className="text-muted d-block mt-1">
                📎 {ocrFile.name} ({(ocrFile.size / 1024).toFixed(0)} KB)
              </small>
            )}
            {!ocrMsg && !ocrFile && (
              <small className="text-muted d-block mt-1">
                💡 Toma una foto de la factura/albarán o selecciona una imagen para extraer precio, cantidad e IVA.
              </small>
            )}
            {ocrMsg && <small className={ocrMsg.includes("❌") || ocrMsg.includes("Error") || ocrMsg.includes("No se pudo") ? "text-danger d-block mt-1" : ocrMsg.includes("⚠️") ? "text-warning d-block mt-1" : "text-success d-block mt-1"} style={{ fontWeight: '500' }}><strong>{ocrMsg}</strong></small>}
          </div>

          <div className="col-md-4">
            <label className="form-label">Producto *</label>
            <GoldSelect
              className={!form.producto_id ? "border-warning" : ""}
              value={form.producto_id}
              onChange={(v) => setForm((f) => ({ ...f, producto_id: v }))}
              placeholder="-- Seleccione un producto --"
              options={(store.productos || []).map((p) => ({
                value: p.id,
                label: p.nombre + (p.categoria ? ` — ${p.categoria}` : ""),
              }))}
            />
            {!form.producto_id && (
              <small className="text-danger">⚠ Debe seleccionar un producto</small>
            )}
          </div>
          <div className="col-md-4">
            <label className="form-label fw-semibold">Proveedor</label>
            <GoldSelect
              value={form.proveedor_id || ""}
              onChange={(v) => setForm((f) => ({ ...f, proveedor_id: v }))}
              placeholder="—"
              options={(store.proveedores || []).map((p) => ({
                value: p.id,
                label: p.nombre,
              }))}
            />
          </div>
          <div className="col-md-4">
            <label className="form-label fw-semibold">Nº Albarán/Factura</label>
            <input
              className="form-control"
              name="numero_documento"
              value={form.numero_documento}
              onChange={handleChange}
              placeholder="Opcional"
            />
          </div>
          <div className="col-md-4">
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
          </div>
          <div className="col-md-4">
            <label className="form-label fw-semibold">Precio unitario (€ sin IVA) *</label>
            <input
              type="number"
              className="form-control"
              name="precio_unitario"
              value={form.precio_unitario}
              onChange={handleChange}
              min={0}
              step="0.01"
              required
            />
          </div>
          <div className="col-md-4">
            <label className="form-label fw-semibold">% Descuento</label>
            <input
              type="number"
              className="form-control"
              name="descuento_porcentaje"
              value={form.descuento_porcentaje}
              onChange={handleChange}
              min={0}
              max={100}
              step="0.01"
            />
          </div>
          <div className="col-md-4">
            <label className="form-label fw-semibold">% IVA *</label>
            <input
              type="number"
              className="form-control"
              name="iva_porcentaje"
              value={form.iva_porcentaje}
              onChange={handleChange}
              min={0}
              step="0.01"
              required
            />
          </div>
          {/* Resumen de cálculos */}
          {cantidad > 0 && precioUnitario > 0 && (
            <div className="col-12">
              <div className="alert alert-info py-2 mb-0 mt-2">
                <strong>Subtotal:</strong> {subtotal.toFixed(2)} €
                {descuento > 0 && <> | <strong>Descuento:</strong> -{descuento.toFixed(2)} €</>}
                {" | "}<strong>Base (sin IVA):</strong> {totalSinIva.toFixed(2)} €
                {" | "}<strong>IVA ({ivaPct}%):</strong> {totalIva.toFixed(2)} €
                {" | "}<strong>Total con IVA:</strong> {totalConIva.toFixed(2)} €
              </div>
            </div>
          )}
        </div>
        <button
          className="btn sw-btn-gold w-100 mt-4"
          type="submit"
          disabled={saving}
        >
          {saving ? "Guardando..." : "Registrar entrada"}
        </button>
      </form>

      {/* ÚLTIMAS ENTRADAS */}
      <div className="card shadow-sm border-0">
        <div className="table-responsive">
          <table className="table table-hover mb-0">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Producto</th>
                <th>Proveedor</th>
                <th className="text-end">Cantidad</th>
                <th className="text-end">Total sin IVA</th>
                <th className="text-end">Total con IVA</th>
                <th>Nº Albarán</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {entradasOrdenadas.map((ent) => {
                const prod = (store.productos || []).find((p) => p.id === ent.producto_id);
                const prov = (store.proveedores || []).find((p) => p.id === ent.proveedor_id);
                return (
                  <tr key={ent.id}>
                    <td>{fmtDateTime(ent.created_at || ent.fecha)}</td>
                    <td>{prod?.nombre || ent.producto_nombre || ent.producto_id}</td>
                    <td>{prov?.nombre || ent.proveedor_nombre || "—"}</td>
                    <td className="text-end">{ent.cantidad}</td>
                    <td className="text-end">
                      {ent.precio_sin_iva != null && Number(ent.precio_sin_iva) > 0
                        ? Number(ent.precio_sin_iva).toFixed(2) + " €"
                        : "—"}
                    </td>
                    <td className="text-end">
                      {ent.precio_con_iva != null && Number(ent.precio_con_iva) > 0
                        ? Number(ent.precio_con_iva).toFixed(2) + " €"
                        : "—"}
                    </td>
                    <td>{ent.numero_albaran || ent.numero_documento || "—"}</td>
                    <td>
                      <button
                        className="btn btn-sm btn-outline-primary me-1"
                        onClick={() => handleEditar(ent)}
                      >
                        ✏️
                      </button>
                      <button
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => handleEliminar(ent.id)}
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                );
              })}
              {entradasOrdenadas.length === 0 && (
                <tr>
                  <td colSpan="8" className="text-center text-muted py-3">
                    No hay entradas registradas
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal editar */}
      {editando && (
        <EditarEntradaModal
          show={showEditModal}
          entrada={editando}
          productos={store.productos || []}
          proveedores={store.proveedores || []}
          onClose={() => {
            setShowEditModal(false);
            setEditando(null);
          }}
          onSaved={() => {
            setShowEditModal(false);
            setEditando(null);
            actions.getEntradas();
            actions.getProductos();
          }}
        />
      )}

      {/* Modal nuevo producto */}
      <ProductoFormModal
        show={showNuevo}
        onClose={() => setShowNuevo(false)}
        onSaved={() => {
          setShowNuevo(false);
          actions.getProductos();
        }}
      />
    </div>
  );
};

/* ======================
   Modal Editar Entrada
====================== */
const EditarEntradaModal = ({ show, entrada, productos, proveedores, onClose, onSaved }) => {
  const { actions } = useContext(Context);

  const precioUnitarioInicial = entrada.cantidad > 0 && entrada.precio_sin_iva > 0
    ? +(entrada.precio_sin_iva / entrada.cantidad).toFixed(4)
    : "";

  const [form, setForm] = useState({
    producto_id: entrada.producto_id || "",
    proveedor_id: entrada.proveedor_id || "",
    cantidad: entrada.cantidad || "",
    numero_documento: entrada.numero_documento || "",
    precio_unitario: precioUnitarioInicial,
    descuento_porcentaje: "0",
    iva_porcentaje: entrada.porcentaje_iva || "21",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  // Cálculos en tiempo real
  const cantidad = Number(form.cantidad) || 0;
  const precioUnitario = Number(form.precio_unitario) || 0;
  const ivaPct = Number(form.iva_porcentaje) || 0;
  const descuentoPct = Number(form.descuento_porcentaje) || 0;
  const subtotal = precioUnitario * cantidad;
  const descuento = +(subtotal * (descuentoPct / 100)).toFixed(2);
  const totalSinIva = +(subtotal - descuento).toFixed(2);
  const totalIva = +(totalSinIva * (ivaPct / 100)).toFixed(2);
  const totalConIva = +(totalSinIva + totalIva).toFixed(2);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.producto_id || !form.cantidad || !form.precio_unitario) {
      setErr("Producto, cantidad y precio unitario son obligatorios.");
      return;
    }
    setSaving(true);
    setErr("");
    try {
      await actions.actualizarEntrada(entrada.id, {
        producto_id: Number(form.producto_id),
        proveedor_id: form.proveedor_id ? Number(form.proveedor_id) : null,
        cantidad: Number(form.cantidad),
        numero_albaran: form.numero_documento || null,
        precio_unitario: precioUnitario,
        porcentaje_iva: ivaPct,
        descuento_porcentaje: descuentoPct,
      });
      onSaved();
    } catch {
      setErr("Error al actualizar la entrada.");
    } finally {
      setSaving(false);
    }
  };

  if (!show) return null;

  return (
    <div className="modal d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
      <div className="modal-dialog modal-lg modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Editar Entrada</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              {err && <div className="alert alert-danger py-2 mb-3">{err}</div>}
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Producto *</label>
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

                <div className="col-md-6">
                  <label className="form-label">Proveedor</label>
                  <GoldSelect
                    value={form.proveedor_id || ""}
                    onChange={(v) => setForm((f) => ({ ...f, proveedor_id: v }))}
                    placeholder="—"
                    options={proveedores.map((p) => ({
                      value: p.id,
                      label: p.nombre,
                    }))}
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label">Nº Albarán/Factura</label>
                  <input
                    className="form-control"
                    name="numero_documento"
                    value={form.numero_documento}
                    onChange={handleChange}
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label">Cantidad *</label>
                  <input
                    type="number"
                    min="1"
                    className="form-control"
                    name="cantidad"
                    value={form.cantidad}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="col-md-4">
                  <label className="form-label">Precio unitario (€ sin IVA) *</label>
                  <input
                    type="number"
                    className="form-control"
                    name="precio_unitario"
                    value={form.precio_unitario}
                    onChange={handleChange}
                    min={0}
                    step="0.01"
                    required
                  />
                </div>

                <div className="col-md-4">
                  <label className="form-label">% Descuento</label>
                  <input
                    type="number"
                    className="form-control"
                    name="descuento_porcentaje"
                    value={form.descuento_porcentaje}
                    onChange={handleChange}
                    min={0}
                    max={100}
                    step="0.01"
                  />
                </div>

                <div className="col-md-4">
                  <label className="form-label">% IVA *</label>
                  <input
                    type="number"
                    className="form-control"
                    name="iva_porcentaje"
                    value={form.iva_porcentaje}
                    onChange={handleChange}
                    min={0}
                    step="0.01"
                    required
                  />
                </div>
              </div>

              {/* Resumen de cálculos */}
              {cantidad > 0 && precioUnitario > 0 && (
                <div className="alert alert-info py-2 mt-3 mb-0">
                  <strong>Subtotal:</strong> {subtotal.toFixed(2)} €
                  {descuento > 0 && <> | <strong>Desc:</strong> -{descuento.toFixed(2)} €</>}
                  {" | "}<strong>Base sin IVA:</strong> {totalSinIva.toFixed(2)} €
                  {" | "}<strong>IVA ({ivaPct}%):</strong> {totalIva.toFixed(2)} €
                  {" | "}<strong>Total:</strong> {totalConIva.toFixed(2)} €
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
                Cancelar
              </button>
              <button
                type="submit"
                className="btn btn-sm sw-btn-gold"
                disabled={saving}
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

export default RegistrarEntradaPage;
