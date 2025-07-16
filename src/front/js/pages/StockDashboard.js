import React, { useEffect, useState, useContext } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Context } from "../store/appContext";
import "../../styles/specialwash-theme.css";

import * as XLSX from "xlsx";

const StockDashboard = () => {
  const { store, actions } = useContext(Context);
  const navigate = useNavigate();
  const [filtroBajoStock, setFiltroBajoStock] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [campoBusqueda, setCampoBusqueda] = useState("detalle");

  useEffect(() => {
    actions.getProductos();
  }, []);

  const mostrarTodos = () => {
    actions.getProductos();
    setFiltroBajoStock(false);
  };

  const mostrarSoloBajoStock = () => {
    actions.getProductosBajoStock();
    setFiltroBajoStock(true);
  };

  const imprimir = () => {
    window.print();
  };

  const exportarExcel = () => {
    const data = productosFiltrados.map((producto) => ({
      Producto: producto.detalle,
      Categoría: producto.categoria,
      Proveedor: producto.proveedor || producto.proveedor_nombre,
      "Precio Unitario": producto.precio_unitario,
      Cantidad: producto.cantidad_comprada,
      StockMinimo: producto.stock_minimo,
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Stock");

    XLSX.writeFile(workbook, "stock.xlsx");
  };

  const productosFiltrados = store.productos.filter((producto) => {
    const valorCampo =
      (producto[campoBusqueda] || producto.proveedor_nombre || "").toString().toLowerCase();
    return valorCampo.includes(busqueda.toLowerCase());
  });

  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap">
        <h2 className="fw-bold white">Gestión de Stock</h2>
        <div className="d-flex flex-wrap gap-2">
          {filtroBajoStock ? (
            <button className="btn btn-secondary" onClick={mostrarTodos}>
              Ver todos los productos
            </button>
          ) : (
            <button className="btn btn-outline-danger" onClick={mostrarSoloBajoStock}>
              Ver solo bajo stock
            </button>
          )}
          <button className="btn btn-outline-primary" onClick={imprimir}>
            <i className="fas fa-print me-2"></i> Imprimir
          </button>
          <button className="btn btn-outline-success" onClick={exportarExcel}>
            <i className="fas fa-file-excel me-2"></i> Exportar Excel
          </button>
          <Link to="/resumen-stockminimo" className="btn btn-outline-danger">
            <i className="fas fa-exclamation-triangle me-2"></i> Ver productos bajo StockMinimo
          </Link>
        </div>
      </div>

      <div className="mb-3 row">
        <div className="col-md-3">
          <select
            className="form-select"
            value={campoBusqueda}
            onChange={(e) => setCampoBusqueda(e.target.value)}
          >
            <option value="detalle">Buscar por nombre</option>
            <option value="categoria">Buscar por categoría</option>
            <option value="proveedor_nombre">Buscar por proveedor</option>
          </select>
        </div>
        <div className="col-md-9">
          <input
            type="text"
            className="form-control"
            placeholder="Buscar..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
      </div>

      <table className="table table-hover table-striped rounded shadow-sm">
        <thead className="table-dark">
          <tr>
            <th>Producto</th>
            <th>Categoría</th>
            <th>Cantidad</th>
            <th>StockMinimo</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {Array.isArray(productosFiltrados) &&
            productosFiltrados.map((producto) => {
              const bajoStock = producto.cantidad_comprada <= producto.stock_minimo;
              return (
                <tr key={producto.id} className={bajoStock ? "table-danger" : ""}>
                  <td>{producto.detalle}</td>
                  <td>{producto.categoria}</td>
                                   <td>
                    {producto.cantidad_comprada}
                    {bajoStock && (
                      <span className="badge bg-danger ms-2">¡Bajo stock!</span>
                    )}
                  </td>
                  <td>{producto.stock_minimo}</td>
                  <td>
                    <button
                      className="btn btn-sm btn-warning me-2"
                      onClick={() => navigate(`/stock/editar/${producto.id}`)}
                    >
                      <i className="fas fa-edit"></i>
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => {
                        if (window.confirm("¿Estás segura de que quieres eliminar este producto?")) {
                          actions.eliminarProducto(producto.id);
                        }
                      }}
                    >
                      <i className="fas fa-trash-alt"></i>
                    </button>
                  </td>
                </tr>
              );
            })}
        </tbody>
      </table>
    </div>
  );
};

export default StockDashboard;
