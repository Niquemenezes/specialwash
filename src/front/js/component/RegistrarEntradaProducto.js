import React, { useState, useEffect } from "react";
import { useContext } from "react";
import { Context } from "../store/appContext";

const FormularioEntradaProducto = () => {
  const { actions, store } = useContext(Context);
  const [formData, setFormData] = useState({
    producto_id: "",
    proveedor_id: "",
    numero_albaran: "",
    fecha_entrada: new Date().toISOString().split("T")[0],
    cantidad: "",
    precio_sin_iva: "",
    porcentaje_iva: "21",
    descuento: "0",
    observaciones: "",
  });

  useEffect(() => {
    actions.getProductos();
    actions.getProveedores();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const calcularPrecioFinal = () => {
    const precio = parseFloat(formData.precio_sin_iva) || 0;
    const iva = parseFloat(formData.porcentaje_iva) || 0;
    const descuento = parseFloat(formData.descuento) || 0;
    const valor_iva = (precio * iva) / 100;
    const precio_con_iva = precio + valor_iva;
    return (precio_con_iva - descuento).toFixed(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const datos = {
      ...formulario,
      producto_id: parseInt(formulario.producto_id),
      proveedor_id: parseInt(formulario.proveedor_id),
      cantidad: parseFloat(formulario.cantidad),
      precio_sin_iva: parseFloat(formulario.precio_sin_iva),
      porcentaje_iva: parseFloat(formulario.porcentaje_iva),
      descuento: parseFloat(formulario.descuento || 0),
      precio_final_pagado: parseFloat(calcularPrecioFinal()),
    };
    
    const success = await actions.registrarEntradaProducto(datos);
    if (success) {
      alert("Entrada registrada correctamente");
      actions.getProductosConStock();
      actions.getEntradasProductos();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-3 border rounded">
      <h5>Registrar Entrada de Producto</h5>
      <div className="mb-2">
        <label className="form-label">Producto</label>
        <select
          name="producto_id"
          className="form-select"
          onChange={handleChange}
          value={formData.producto_id}
        >
          <option value="">Selecciona un producto</option>
          {store.productos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-2">
        <label className="form-label">Proveedor</label>
        <select
          name="proveedor_id"
          className="form-select"
          onChange={handleChange}
          value={formData.proveedor_id}
        >
          <option value="">Selecciona un proveedor</option>
          {store.proveedores.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-2">
        <label className="form-label">Número de Albarán o Factura</label>
        <input
          type="text"
          name="numero_albaran"
          className="form-control"
          value={formData.numero_albaran}
          onChange={handleChange}
        />
      </div>

      <div className="row">
        <div className="col-md-4 mb-2">
          <label className="form-label">Fecha de Entrada</label>
          <input
            type="date"
            name="fecha_entrada"
            className="form-control"
            value={formData.fecha_entrada}
            onChange={handleChange}
          />
        </div>

        <div className="col-md-4 mb-2">
          <label className="form-label">Cantidad</label>
          <input
            type="number"
            name="cantidad"
            className="form-control"
            value={formData.cantidad}
            onChange={handleChange}
            step="0.01"
          />
        </div>

        <div className="col-md-4 mb-2">
          <label className="form-label">Precio sin IVA (€)</label>
          <input
            type="number"
            name="precio_sin_iva"
            className="form-control"
            value={formData.precio_sin_iva}
            onChange={handleChange}
            step="0.01"
          />
        </div>
      </div>

      <div className="row">
        <div className="col-md-4 mb-2">
          <label className="form-label">IVA (%)</label>
          <input
            type="number"
            name="porcentaje_iva"
            className="form-control"
            value={formData.porcentaje_iva}
            onChange={handleChange}
            step="0.01"
          />
        </div>

        <div className="mb-2">
          <label className="form-label">Descuento % (opcional)</label>
          <input
            type="number"
            step="0.01"
            name="descuento"
            value={formData.descuento}
            onChange={handleChange}
            className="form-control"
          />
        </div>

        <div className="col-md-4 mb-2">
          <label className="form-label">Precio Final Pagado (€)</label>
          <input
            type="text"
            className="form-control"
            value={calcularPrecioFinal()}
            readOnly
          />
        </div>
      </div>

      <div className="mb-3">
        <label className="form-label">Observaciones</label>
        <textarea
          name="observaciones"
          className="form-control"
          value={formData.observaciones}
          onChange={handleChange}
        ></textarea>
      </div>

      <button type="submit" className="btn btn-primary w-100">
        Registrar Entrada
      </button>
    </form>
  );
};

export default FormularioEntradaProducto;
