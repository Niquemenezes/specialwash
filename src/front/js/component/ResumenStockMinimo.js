import React, { useEffect, useState, useContext } from "react";
import { Context } from "../store/appContext";

const ResumenStockMinimo = () => {
  const { store, actions } = useContext(Context);
  const [productosBajoStock, setProductosBajoStock] = useState([]);

  useEffect(() => {
    actions.getProductos(); // cargar productos
  }, []);

  useEffect(() => {
    const filtrados = store.productos.filter(
      (p) => p.cantidad_comprada <= p.stock_minimo
    );
    setProductosBajoStock(filtrados);
  }, [store.productos]);

  const imprimir = () => {
    window.print();
  };

  const exportarCSV = () => {
    const cabecera = [
      "Detalle",
      "Categoría",
      "Proveedor",
      "Cantidad",
      "StockMinimo",
      "Precio Unitario (€)",
    ];
    const filas = productosBajoStock.map((p) => [
      p.detalle,
      p.categoria,
      p.proveedor_nombre || p.proveedor || "",
      p.cantidad_comprada,
      p.stock_minimo,
      p.precio_unitario,
    ]);

    const contenido = [cabecera, ...filas]
      .map((fila) => fila.join(";"))
      .join("\n");

    const blob = new Blob(["\uFEFF" + contenido], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = `productos_bajo_stock_${new Date().toLocaleDateString()}.csv`;
    enlace.click();
  };

  return (
    <div className="container mt-4">
      <h2>Resumen de productos bajo StockMinimo</h2>

      <div className="mb-3 d-flex gap-2 flex-wrap">
        <button className="btn btn-primary" onClick={imprimir}>
          <i className="fas fa-print me-2"></i> Imprimir
        </button>
        <button className="btn btn-success" onClick={exportarCSV}>
          <i className="fas fa-file-excel me-2"></i> Exportar a Excel
        </button>
      </div>

      <table className="table table-bordered table-striped">
        <thead className="table-dark">
          <tr>
            <th>Detalle</th>
            <th>Categoría</th>
            <th>Proveedor</th>
            <th>Cantidad</th>
            <th>StockMinimo</th>
            <th>Precio Unitario (€)</th>
          </tr>
        </thead>
        <tbody>
          {productosBajoStock.map((p) => (
            <tr key={p.id}>
              <td>{p.detalle}</td>
              <td>{p.categoria}</td>
              <td>{p.proveedor_nombre || p.proveedor}</td>
              <td>{p.cantidad_comprada}</td>
              <td>{p.stock_minimo}</td>
              <td>{p.precio_unitario}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {productosBajoStock.length === 0 && (
        <div className="alert alert-success mt-3">🎉 No hay productos por debajo del StockMinimo</div>
      )}
    </div>
  );
};

export default ResumenStockMinimo;
