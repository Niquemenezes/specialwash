// src/front/js/pages/ProductoFormModal.jsx
import React, { useContext, useEffect, useState } from "react";
import { Context } from "../store/appContext";

export default function ProductoFormModal({ show, onClose, onSaved, initial }) {
  const { actions } = useContext(Context);
  const isEdit = !!initial;

  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nombre: "",
    categoria: "",
    stock_minimo: 0,
    stock_actual: 0,
  });

  useEffect(() => {
    if (isEdit) {
      setForm({
        nombre: initial?.nombre || "",
        categoria: initial?.categoria || "",
        stock_minimo: Number(initial?.stock_minimo ?? 0),
        stock_actual: Number(initial?.stock_actual ?? 0),
      });
    } else {
      setForm({ nombre: "", categoria: "", stock_minimo: 0, stock_actual: 0 });
    }
  }, [isEdit, initial]);

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
      alert("El nombre es obligatorio");
      return;
    }
    if (form.stock_minimo < 0 || form.stock_actual < 0) {
      alert("Los valores de stock no pueden ser negativos");
      return;
    }

    setSaving(true);
    try {
      if (isEdit) {
        await actions.updateProducto(initial.id, form);
      } else {
        await actions.createProducto(form);
      }
      onSaved && onSaved();
      onClose && onClose();
    } catch (err) {
      alert(err?.message || "Error guardando el producto");
    } finally {
      setSaving(false);
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
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancelar
              </button>
              <button
                type="submit"
                className="btn"
                disabled={saving}
                style={{
                  background: "#d4af37",
                  color: "black",
                  fontWeight: "600",
                  borderRadius: "8px",
                }}
              >
                {saving ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}