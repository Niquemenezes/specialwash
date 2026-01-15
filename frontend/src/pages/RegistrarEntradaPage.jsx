import React, {
  useEffect,
  useMemo,
  useState,
  useContext,
} from "react";
import { Context } from "../store/appContext";
import ProductoFormModal from "../component/ProductoFormModal.jsx";

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

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : "";
};

/* ======================
   Componente
====================== */
const RegistrarEntradaPage = () => {
  const { store, actions } = useContext(Context);

  const [filtro, setFiltro] = useState("");
  const [productoId, setProductoId] = useState("");

  const [form, setForm] = useState({
    producto_id: "",
    proveedor_id: "",
    cantidad: "",
    tipo_documento: "albaran",
    numero_documento: "",
    precio_bruto_sin_iva: "",
    descuento_porcentaje: "",
    descuento_importe: "",
    precio_sin_iva: "",
    iva_porcentaje: "21",
    precio_con_iva: "",
  });

  const [saving, setSaving] = useState(false);
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

  /* ======================
     Productos filtrados
  ====================== */
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

  /* ======================
     Autoselección producto
  ====================== */
  useEffect(() => {
    if (!productoId && productosFiltrados.length > 0) {
      setProductoId(String(productosFiltrados[0].id));
    }
  }, [productoId, productosFiltrados]);

  /* ======================
     Sync producto_id
  ====================== */
  useEffect(() => {
    setForm((f) => ({
      ...f,
      producto_id: productoId ? Number(productoId) : "",
    }));
  }, [productoId]);

  /* ======================
     Cálculos precios
     (sin bucles)
  ====================== */
  useEffect(() => {
    const bruto = Number(form.precio_bruto_sin_iva) || 0;
    const descPct = Number(form.descuento_porcentaje) || 0;
    const ivaPct = Number(form.iva_porcentaje) || 0;

    const descImp = +(bruto * (descPct / 100)).toFixed(2);
    const neto = +(bruto - descImp).toFixed(2);
    const conIva = +(neto * (1 + ivaPct / 100)).toFixed(2);

    setForm((f) => ({
      ...f,
      descuento_importe: descImp || "",
      precio_sin_iva: neto || "",
      precio_con_iva: conIva || "",
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    form.precio_bruto_sin_iva,
    form.descuento_porcentaje,
    form.iva_porcentaje,
  ]);

  /* ======================
     Handlers
  ====================== */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.producto_id || !form.cantidad) {
      alert("Producto y cantidad son obligatorios");
      return;
    }

    setSaving(true);
    try {
      const body = {
        ...form,
        producto_id: Number(form.producto_id),
        proveedor_id: form.proveedor_id
          ? Number(form.proveedor_id)
          : null,
        cantidad: Number(form.cantidad),
        precio_bruto_sin_iva: toNum(form.precio_bruto_sin_iva),
        descuento_porcentaje: toNum(form.descuento_porcentaje),
        descuento_importe: toNum(form.descuento_importe),
        precio_sin_iva: toNum(form.precio_sin_iva),
        iva_porcentaje: toNum(form.iva_porcentaje),
        precio_con_iva: toNum(form.precio_con_iva),
        numero_albaran: form.numero_documento || null,
      };

      const res = await actions.registrarEntrada(body);
      alert(
        "Entrada registrada. Stock actual: " +
          (res?.producto?.stock_actual ?? "-")
      );

      setForm((f) => ({
        ...f,
        cantidad: "",
        numero_documento: "",
        precio_bruto_sin_iva: "",
        descuento_porcentaje: "",
        descuento_importe: "",
        precio_sin_iva: "",
        precio_con_iva: "",
      }));

      actions.getEntradas();
      actions.getProductos();
    } catch (err) {
      alert("Error al registrar la entrada");
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
      alert("Entrada eliminada");
      actions.getEntradas();
      actions.getProductos();
    } catch (err) {
      alert("Error al eliminar la entrada");
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
      {/* CABECERA */}
      <div
        className="d-flex justify-content-between align-items-center mb-4 p-3 rounded shadow-sm"
        style={{ background: "#0f0f0f", color: "white" }}
      >
        <h2 className="fw-bold mb-0" style={{ color: "#d4af37" }}>
          📥 Registrar entrada
        </h2>

        <button
          className="btn"
          style={{
            background: "#d4af37",
            color: "#000",
            fontWeight: "600",
          }}
          onClick={() => setShowNuevo(true)}
        >
          + Nuevo producto
        </button>
      </div>

      {/* BUSCADOR */}
      <div className="card mb-4 shadow-sm border-0">
        <div className="card-body">
          <label className="form-label fw-semibold">
            Buscar producto
          </label>
          <input
            className="form-control"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
          />
        </div>
      </div>

      {/* FORMULARIO */}
      <form onSubmit={handleSubmit}>
        <div className="card shadow-sm border-0 mb-4">
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label fw-semibold">
                  Producto
                </label>
                <select
                  className="form-select"
                  value={productoId}
                  onChange={(e) =>
                    setProductoId(e.target.value)
                  }
                  required
                >
                  {productosFiltrados.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                      {p.categoria ? ` — ${p.categoria}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-md-6">
                <label className="form-label fw-semibold">
                  Proveedor
                </label>
                <select
                  className="form-select"
                  name="proveedor_id"
                  value={form.proveedor_id || ""}
                  onChange={handleChange}
                >
                  <option value="">—</option>
                  {(store.proveedores || []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </div>

               <div className="col-md-4">
                <label className="form-label fw-semibold">
                  Nº Albarán/Factura
                </label>
                <input
                  className="form-control"
                  name="numero_documento"
                  value={form.numero_documento}
                  onChange={handleChange}
                  placeholder="Opcional"
                />
              </div>

              <div className="col-md-4">
                <label className="form-label fw-semibold">
                  Cantidad *
                </label>
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
                <label className="form-label fw-semibold">
                  Precio bruto sin IVA
                </label>
                <input
                  className="form-control"
                  name="precio_bruto_sin_iva"
                  value={form.precio_bruto_sin_iva}
                  onChange={handleChange}
                />
              </div>

              <div className="col-md-4">
                <label className="form-label fw-semibold">
                  % Descuento
                </label>
                <input
                  className="form-control"
                  name="descuento_porcentaje"
                  value={form.descuento_porcentaje}
                  onChange={handleChange}
                />
              </div>

              <div className="col-md-4">
                <label className="form-label fw-semibold">
                  Precio sin IVA
                </label>
                <input
                  className="form-control"
                  value={form.precio_sin_iva}
                  readOnly
                />
              </div>

              <div className="col-md-4">
                <label className="form-label fw-semibold">
                  % IVA
                </label>
                <input
                  className="form-control"
                  name="iva_porcentaje"
                  value={form.iva_porcentaje}
                  onChange={handleChange}
                />
              </div>

              <div className="col-md-4">
                <label className="form-label fw-semibold">
                  Precio con IVA
                </label>
                <input
                  className="form-control"
                  value={form.precio_con_iva}
                  readOnly
                />
              </div>
            </div>

            <button
              className="btn w-100 mt-4"
              type="submit"
              disabled={saving}
              style={{
                background: "#d4af37",
                fontWeight: "600",
              }}
            >
              {saving ? "Guardando..." : "Registrar entrada"}
            </button>
          </div>
        </div>
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
                <th className="text-end">Precio sin IVA</th>
                <th className="text-end">Precio con IVA</th>
                <th>Nº Albarán</th>
                <th className="text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {entradasOrdenadas.map((e) => (
                <tr key={e.id}>
                  <td>{fmtDateTime(e.created_at || e.fecha)}</td>
                  <td>
                    {e.producto?.nombre ||
                      e.producto_nombre ||
                      `#${e.producto_id}`}
                  </td>
                  <td>{e.proveedor_nombre || "-"}</td>
                  <td className="text-end">{e.cantidad}</td>
                  <td className="text-end">
                    {e.precio_sin_iva
                      ? parseFloat(e.precio_sin_iva).toFixed(2) + " €"
                      : "-"}
                  </td>
                  <td className="text-end">
                    {e.precio_con_iva
                      ? parseFloat(e.precio_con_iva).toFixed(2) + " €"
                      : "-"}
                  </td>
                  <td>{e.numero_documento || "-"}</td>
                  <td className="text-center">
                    <button
                      className="btn btn-sm btn-outline-primary me-2"
                      onClick={() => handleEditar(e)}
                      title="Editar"
                    >
                      <i className="fas fa-edit"></i>
                    </button>
                    <button
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => handleEliminar(e.id)}
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
      </div>

      {showNuevo && (
        <ProductoFormModal
          show={showNuevo}
          onClose={() => setShowNuevo(false)}
          onSaved={() => actions.getProductos()}
        />
      )}

      {showEditModal && editando && (
        <EditarEntradaModal
          show={showEditModal}
          entrada={editando}
          productos={store.productos}
          proveedores={store.proveedores}
          onClose={() => {
            setShowEditModal(false);
            setEditando(null);
          }}
          onSaved={() => {
            actions.getEntradas();
            actions.getProductos();
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
const EditarEntradaModal = ({ show, entrada, productos, proveedores, onClose, onSaved }) => {
  const { actions } = useContext(Context);
  const [form, setForm] = useState({
    producto_id: entrada.producto_id || "",
    proveedor_id: entrada.proveedor_id || "",
    cantidad: entrada.cantidad || "",
    numero_documento: entrada.numero_documento || "",
    precio_sin_iva: entrada.precio_sin_iva || "",
    porcentaje_iva: entrada.porcentaje_iva || "21",
    precio_con_iva: entrada.precio_con_iva || "",
  });
  const [saving, setSaving] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Si cambia precio_sin_iva o porcentaje_iva, recalcular
    if (name === "precio_sin_iva" || name === "porcentaje_iva") {
      const nuevoForm = { ...form, [name]: value };
      const sinIva = Number(nuevoForm.precio_sin_iva) || 0;
      const pctIva = Number(nuevoForm.porcentaje_iva) || 0;
      const conIva = sinIva > 0 ? +(sinIva * (1 + pctIva / 100)).toFixed(2) : "";
      setForm({ ...nuevoForm, precio_con_iva: conIva });
    } else {
      setForm((f) => ({ ...f, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await actions.actualizarEntrada(entrada.id, {
        producto_id: Number(form.producto_id),
        proveedor_id: form.proveedor_id ? Number(form.proveedor_id) : null,
        cantidad: Number(form.cantidad),
        numero_albaran: form.numero_documento || null,
        precio_sin_iva: toNum(form.precio_sin_iva),
        porcentaje_iva: toNum(form.porcentaje_iva),
        precio_con_iva: toNum(form.precio_con_iva),
      });
      alert("Entrada actualizada");
      onSaved();
    } catch (err) {
      alert("Error al actualizar la entrada");
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
            <h5 className="modal-title">Editar Entrada</h5>
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
                <label className="form-label">Proveedor</label>
                <select
                  className="form-select"
                  name="proveedor_id"
                  value={form.proveedor_id || ""}
                  onChange={handleChange}
                >
                  <option value="">—</option>
                  {proveedores.map((p) => (
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
                />
              </div>

              <div className="mb-3">
                <label className="form-label">Nº Albarán/Factura</label>
                <input
                  className="form-control"
                  name="numero_documento"
                  value={form.numero_documento}
                  onChange={handleChange}
                />
              </div>

              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label">Precio sin IVA</label>
                  <input
                    className="form-control"
                    name="precio_sin_iva"
                    value={form.precio_sin_iva}
                    onChange={handleChange}
                  />
                </div>

                <div className="col-md-6 mb-3">
                  <label className="form-label">% IVA</label>
                  <input
                    className="form-control"
                    name="porcentaje_iva"
                    value={form.porcentaje_iva}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label">Precio con IVA</label>
                <input
                  className="form-control"
                  value={form.precio_con_iva}
                  readOnly
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

export default RegistrarEntradaPage;
