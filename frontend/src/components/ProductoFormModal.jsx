// src/front/js/pages/ProductoFormModal.jsx
import React, { useContext, useEffect, useRef, useState } from "react";
import { Context } from "../store/appContext";
import { detectBarcodeFromFile } from "../utils/barcode";
import { toast } from "../utils/toast";

export default function ProductoFormModal({ show, onClose, onSaved, initial, suggestedBarcode = "" }) {
  const { actions } = useContext(Context);
  const isEdit = !!initial;

  const [saving, setSaving] = useState(false);
  const [scanMsg, setScanMsg] = useState("");
  const [scanLoading, setScanLoading] = useState(false);
  const barcodeCameraRef = useRef(null);
  const barcodeGalleryRef = useRef(null);
  const cleanedSuggestedBarcode = String(suggestedBarcode || "").trim();
  const [form, setForm] = useState({
    nombre: "",
    categoria: "",
    codigo_barras: "",
    codigos_barras_text: "",
    stock_minimo: 0,
    stock_actual: 0,
  });

  const parseCodigosAlternativos = (rawValue, codigoPrincipal = "") => {
    const principal = String(codigoPrincipal || "").trim();
    return Array.from(
      new Set(
        String(rawValue || "")
          .split(/[\n,;]+/)
          .map((v) => v.trim())
          .filter(Boolean)
      )
    ).filter((codigo) => codigo !== principal);
  };

  const buildFormState = (producto = null) => {
    const principalActual = String(producto?.codigo_barras || "").trim();
    const alternativos = parseCodigosAlternativos(
      (producto?.codigos_barras || []).map((c) => c?.codigo_barras).join("\n"),
      principalActual
    );

    let codigoPrincipal = principalActual;
    const codigosAlternativos = [...alternativos];

    if (cleanedSuggestedBarcode) {
      if (!codigoPrincipal) {
        codigoPrincipal = cleanedSuggestedBarcode;
      } else if (
        cleanedSuggestedBarcode !== codigoPrincipal &&
        !codigosAlternativos.includes(cleanedSuggestedBarcode)
      ) {
        codigosAlternativos.push(cleanedSuggestedBarcode);
      }
    }

    return {
      nombre: producto?.nombre || "",
      categoria: producto?.categoria || "",
      codigo_barras: codigoPrincipal,
      codigos_barras_text: codigosAlternativos.join("\n"),
      stock_minimo: Number(producto?.stock_minimo ?? 0),
      stock_actual: Number(producto?.stock_actual ?? 0),
    };
  };

  useEffect(() => {
    setForm(buildFormState(isEdit ? initial : null));
    setScanMsg(
      cleanedSuggestedBarcode
        ? "Se ha rellenado el código detectado. Puedes guardarlo o borrarlo; no es obligatorio."
        : ""
    );
  }, [isEdit, initial, cleanedSuggestedBarcode]);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({
      ...f,
      [name]:
        name === "stock_minimo" || name === "stock_actual"
          ? (value === "" ? "" : Number(value))
          : value,
    }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.nombre.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    if (form.stock_minimo < 0 || form.stock_actual < 0) {
      toast.error("Los valores de stock no pueden ser negativos");
      return;
    }

    setSaving(true);
    try {
      const codigoPrincipal = String(form.codigo_barras || "").trim();
      const codigos = parseCodigosAlternativos(
        form.codigos_barras_text,
        codigoPrincipal
      ).map((codigo) => ({ codigo_barras: codigo }));

      const payload = {
        ...form,
        codigo_barras: codigoPrincipal,
        codigos_barras: codigos,
      };

      if (isEdit) {
        await actions.updateProducto(initial.id, payload);
      } else {
        await actions.createProducto(payload);
      }
      toast.success(isEdit ? "Producto actualizado" : "Producto creado");
      onSaved && onSaved();
      onClose && onClose();
    } catch (err) {
      toast.error(err?.message || "Error guardando el producto");
    } finally {
      setSaving(false);
    }
  };

  const anexarCodigoAlternativo = (codigo) => {
    const existing = parseCodigosAlternativos(
      form.codigos_barras_text,
      form.codigo_barras
    );
    if (!existing.includes(codigo)) {
      existing.push(codigo);
    }
    setForm((f) => ({ ...f, codigos_barras_text: existing.join("\n") }));
  };

  const escanearCodigoProducto = async (file) => {
    if (!file) return;
    setScanLoading(true);
    setScanMsg("");
    try {
      const codigo = await detectBarcodeFromFile(file);
      const principalActual = String(form.codigo_barras || "").trim();
      if (!principalActual) {
        setForm((prev) => ({ ...prev, codigo_barras: codigo }));
        setScanMsg(`Codigo escaneado como principal: ${codigo}`);
      } else {
        if (principalActual !== codigo) anexarCodigoAlternativo(codigo);
        setScanMsg(`Codigo escaneado añadido a alternativos: ${codigo}`);
      }
    } catch (err) {
      setScanMsg(err?.message || "No se pudo escanear el código.");
    } finally {
      setScanLoading(false);
    }
  };

  if (!show) return null;

  return (
    <div
      className="modal d-block"
      tabIndex="-1"
      role="dialog"
      style={{ background: "rgba(0,0,0,.4)" }}
    >
      <div className="modal-dialog">
        <div className="modal-content">
          <form onSubmit={onSubmit}>
            <div className="modal-header">
              <h5 className="modal-title">
                {isEdit ? "Editar producto" : "Nuevo producto"}
              </h5>
              <button type="button" className="btn-close" onClick={onClose} />
            </div>

            <div className="modal-body">
              <div className="mb-3">
                <label className="form-label">Nombre</label>
                <input
                  className="form-control"
                  name="nombre"
                  value={form.nombre}
                  onChange={onChange}
                  required
                />
              </div>

              <div className="mb-3">
                <label className="form-label">Categoría</label>
                <input
                  className="form-control"
                  name="categoria"
                  value={form.categoria}
                  onChange={onChange}
                  placeholder="Opcional"
                />
              </div>

              <div className="mb-3">
                <label className="form-label">Código de barras</label>
                <input
                  ref={barcodeCameraRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  style={{ display: "none" }}
                  onChange={(e) => escanearCodigoProducto(e.target.files?.[0])}
                />
                <input
                  ref={barcodeGalleryRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) => escanearCodigoProducto(e.target.files?.[0])}
                />
                <input
                  className="form-control"
                  name="codigo_barras"
                  value={form.codigo_barras}
                  onChange={onChange}
                  placeholder="Ej: 8410000001234"
                />
                <div className="d-flex gap-2 flex-wrap mt-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    disabled={scanLoading}
                    onClick={() => barcodeCameraRef.current?.click()}
                  >
                    {scanLoading ? "Escaneando..." : "Escanear camara"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary"
                    disabled={scanLoading}
                    onClick={() => barcodeGalleryRef.current?.click()}
                  >
                    Desde foto
                  </button>
                </div>
                <small className="text-muted">
                  Código principal del fabricante. Es opcional: puedes guardarlo ahora o dejarlo vacío.
                </small>
                {scanMsg && (
                  <small className={`d-block mt-1 ${scanMsg.includes("No se pudo") || scanMsg.includes("no soporta") ? "text-warning" : "text-success"}`}>
                    {scanMsg}
                  </small>
                )}
              </div>

              <div className="mb-3">
                <label className="form-label">Códigos alternativos</label>
                <textarea
                  className="form-control"
                  name="codigos_barras_text"
                  value={form.codigos_barras_text}
                  onChange={onChange}
                  rows={3}
                  placeholder="Uno por linea o separados por coma"
                />
                <small className="text-muted">
                  Usa esto cuando el mismo producto llegue con codigos distintos segun marca/lote.
                </small>
              </div>

              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Stock mínimo</label>
                  <input
                    type="number"
                    min="0"
                    className="form-control"
                    name="stock_minimo"
                    value={form.stock_minimo}
                    onChange={onChange}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Stock actual</label>
                  <input
                    type="number"
                    min="0"
                    className="form-control"
                    name="stock_actual"
                    value={form.stock_actual}
                    onChange={onChange}
                  />
                </div>
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
                style={{
                  background: "#d4af37",
                  color: "black",
                  fontWeight: "600",
                  borderRadius: "8px",
                }}
              >
                {saving ? "Guardando..." : isEdit ? "💾 Guardar" : "✅ Crear"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}