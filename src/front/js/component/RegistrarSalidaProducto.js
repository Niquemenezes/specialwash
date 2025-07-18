import React, { useState, useEffect, useContext } from "react";
import { Context } from "../store/appContext";
import { useNavigate } from "react-router-dom";
import HistorialSalidas from "./HistorialSalidas";

const RegistrarSalidaProducto = () => {
  const { store, actions } = useContext(Context);
  const navigate = useNavigate();
  const user = JSON.parse(sessionStorage.getItem("user") || "null");

  const [formData, setFormData] = useState({
    producto_id: "",
    cantidad: "",
    fecha_salida: "",
    observaciones: "",
    empleado: "",
  });

  useEffect(() => {
  actions.getProductos();
  actions.getTodosLosUsuarios();

  actions.getSalidasProductos(); 
}, []);


  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.producto_id || !formData.cantidad || !formData.fecha_salida || !formData.empleado) {
      alert("Todos los campos marcados son obligatorios.");
      return;
    }

    const exito = await actions.registrarSalidaProducto(formData);

     if (exito) {
      await actions.getSalidasProductos();
      setFormData({
        producto_id: "",
        cantidad: "",
        fecha_salida: "",
        empleado: "",
        observaciones: "",
      });
       navigate("/historial-salidas");
    }
  };

  return (
    <>
    <div className="container mt-4">
      <div className="card shadow p-4">
        <h4 className="mb-4 text-primary text-center">
          Registrar Salida de Producto
        </h4>

        <form onSubmit={handleSubmit}>
          {/* Producto */}
          <div className="mb-3">
            <label htmlFor="producto_id">Producto <span className="text-danger">*</span></label>
            <select
              id="producto_id"
              className="form-select"
              name="producto_id"
              value={formData.producto_id}
              onChange={handleChange}
              required
            >
              <option value="">Selecciona un producto</option>
              {store.productos.map((prod) => {
                const stock = prod.cantidad !== undefined ? prod.cantidad : prod.cantidad_comprada;
                return (
                  <option
                    key={prod.id}
                    value={prod.id}
                    className={stock <= 0 ? "text-danger" : ""}
                  >
                    {prod.detalle} - Stock: {stock}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Cantidad */}
          <div className="mb-3">
            <label htmlFor="cantidad">Cantidad <span className="text-danger">*</span></label>
            <input
              id="cantidad"
              type="number"
              name="cantidad"
              className="form-control"
              value={formData.cantidad}
              onChange={handleChange}
              min="1"
              required
            />
          </div>

          {/* Fecha de salida */}
          <div className="mb-3">
            <label htmlFor="fecha_salida">Fecha de salida <span className="text-danger">*</span></label>
            <input
              id="fecha_salida"
              type="date"
              name="fecha_salida"
              className="form-control"
              value={formData.fecha_salida}
              onChange={handleChange}
              required
            />
          </div>

          {/* Empleado */}
          <div className="mb-3">
            <label htmlFor="empleado">Empleado que retira <span className="text-danger">*</span></label>
            <select
              id="empleado"
              className="form-select"
              name="empleado"
              value={formData.empleado}
              onChange={handleChange}
              required
            >
              <option value="">Selecciona un empleado</option>
              {store.empleados && store.empleados.map((emp) => (
                <option key={emp.id} value={emp.nombre}>
                  {emp.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Observaciones */}
          <div className="mb-3">
            <label htmlFor="observaciones">Observaciones</label>
            <textarea
              id="observaciones"
              name="observaciones"
              className="form-control"
              value={formData.observaciones}
              onChange={handleChange}
              rows="3"
            />
          </div>

          <div className="text-center">
            <button className="btn btn-primary" type="submit">
              Registrar salida
            </button>
          </div>
        </form>
      </div>
    </div>
    <HistorialSalidas />
    </>
  );
};

export default RegistrarSalidaProducto;
