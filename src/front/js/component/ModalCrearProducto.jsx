import React, { useState, useContext, useEffect } from "react";
import { Context } from "../store/appContext";

const ModalCrearProducto = ({ onClose, onSave }) => {
  const { store, actions } = useContext(Context);

  const [formData, setFormData] = useState({
    nombre: "",
    detalle: "",
    precio_unitario: "",
    proveedor_id: "",
    cantidad_comprada: "",
    unidad: "",
    categoria: "",
    stock_minimo: ""
  });

  useEffect(() => {
    actions.getProveedores(); // Asegúrate de tener proveedores cargados
  }, []);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const exito = await onSave(formData);
    if (exito) setFormData({});
  };

  return (
    <div className="modal show d-block" tabIndex="-1" role="dialog" style={{ backgroundColor: "#00000080" }}>
      <div className="modal-dialog modal-lg" role="document">
        <div className="modal-content border-0 shadow">
          <div className="modal-header">
            <h5 className="modal-title">Crear nuevo producto</h5>
            <button type="button" className="close btn" onClick={onClose}>
              <span>&times;</span>
            </button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <div className="row">
                <div className="form-group col-md-6">
                  <label>Nombre</label>
                  <input type="text" className="form-control" name="nombre" value={formData.nombre} onChange={handleChange} required />
                </div>
                <div className="form-group col-md-6">
                  <label>Detalle</label>
                  <input type="text" className="form-control" name="detalle" value={formData.detalle} onChange={handleChange} />
                </div>
                <div className="form-group col-md-6">
                  <label>Precio unitario</label>
                  <input type="number" step="0.01" className="form-control" name="precio_unitario" value={formData.precio_unitario} onChange={handleChange} />
                </div>
                <div className="form-group col-md-6">
                  <label>Proveedor</label>
                  <select className="form-control" name="proveedor_id" value={formData.proveedor_id} onChange={handleChange} required>
                    <option value="">Selecciona un proveedor</option>
                    {store.proveedores?.map((p) => (
                      <option key={p.id} value={p.id}>{p.nombre}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group col-md-6">
                  <label>Cantidad comprada</label>
                  <input type="number" className="form-control" name="cantidad_comprada" value={formData.cantidad_comprada} onChange={handleChange} />
                </div>
                <div className="form-group col-md-6">
                  <label>Unidad</label>
                  <input type="text" className="form-control" name="unidad" value={formData.unidad} onChange={handleChange} />
                </div>
                <div className="form-group col-md-6">
                  <label>Categoría</label>
                  <input type="text" className="form-control" name="categoria" value={formData.categoria} onChange={handleChange} />
                </div>
                <div className="form-group col-md-6">
                  <label>Stock mínimo</label>
                  <input type="number" className="form-control" name="stock_minimo" value={formData.stock_minimo} onChange={handleChange} />
                </div>
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
