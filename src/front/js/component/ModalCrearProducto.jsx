import React, { useState } from "react";

const ModalCrearProducto = ({ onClose, onSave }) => {
  const [formData, setFormData] = useState({
    nombre: "",
    detalle: "",
    categoria: "",
    stock_minimo: ""
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const exito = await onSave({
      ...formData,
      stock_minimo: parseInt(formData.stock_minimo || 0)
    });

    if (exito) {
      setFormData({
        nombre: "",
        detalle: "",
        categoria: "",
        stock_minimo: ""
      });
      onClose(); // cerrar modal si fue exitoso
    }
  };

  return (
    <div className="modal show d-block" tabIndex="-1" role="dialog" style={{ backgroundColor: "#00000080" }}>
      <div className="modal-dialog" role="document">
        <div className="modal-content border-0 shadow">
          <div className="modal-header">
            <h5 className="modal-title">Crear nuevo producto</h5>
            <button type="button" className="close btn" onClick={onClose}>
              <span>&times;</span>
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <div className="form-group">
                <label>Nombre</label>
                <input
                  type="text"
                  className="form-control"
                  name="nombre"
                  value={formData.nombre}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>Detalle</label>
                <input
                  type="text"
                  className="form-control"
                  name="detalle"
                  value={formData.detalle}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label>Categoría</label>
                <input
                  type="text"
                  className="form-control"
                  name="categoria"
                  value={formData.categoria}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>Stock mínimo</label>
                <input
                  type="number"
                  className="form-control"
                  name="stock_minimo"
                  value={formData.stock_minimo}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button type="submit" className="btn btn-success">Guardar</button>
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ModalCrearProducto;
