import React, { useEffect, useState, useContext } from "react";
import { Context } from "../store/appContext";
import * as XLSX from "xlsx";

const HistorialSalidas = () => {
  const { store, actions } = useContext(Context);
  const [filtro, setFiltro] = useState({ desde: "", hasta: "", producto: "" });
  const [salidasFiltradas, setSalidasFiltradas] = useState([]);

  useEffect(() => {
    actions.getSalidasProductos();
    actions.getProductos();
  }, []);

  useEffect(() => {
    aplicarFiltro();
  }, [store.salidas_productos, filtro]);

  const aplicarFiltro = () => {
    const { desde, hasta, producto } = filtro;

    const salidas = Array.isArray(store.salidas_productos)
      ? store.salidas_productos
      : [];

    const filtradas = salidas.filter((s) => {
      const fecha = new Date(s.fecha_salida);
      const desdeFecha = desde ? new Date(desde) : null;
      const hastaFecha = hasta ? new Date(hasta) : null;
      const cumpleProducto = producto ? s.producto?.id === parseInt(producto) : true;

      return (
        (!desdeFecha || fecha >= desdeFecha) &&
        (!hastaFecha || fecha <= hastaFecha) &&
        cumpleProducto
      );
    });

    setSalidasFiltradas(filtradas);
  };

  const totalGastado = salidasFiltradas.reduce((acc, s) => {
    const precio = parseFloat(s.producto?.precio_unitario || 0);
    const cantidad = parseFloat(s.cantidad || 0);
    return acc + precio * cantidad;
  }, 0);

  const exportarExcel = () => {
    const data = salidasFiltradas.map(s => ({
      producto: s.producto?.detalle || "Sin nombre",
      cantidad: s.cantidad,
      fecha: new Date(s.fecha_salida).toLocaleDateString(),
      empleado: s.responsable || "-",
      observaciones: s.observaciones || "-",
      costo: (s.cantidad * (s.producto?.precio_unitario || 0)).toFixed(2)
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Salidas");

    XLSX.writeFile(workbook, "historial_salidas.xlsx");
  };

  return (
    <div className="container mt-4">
      <div className="card shadow p-4">
        <h4 className="text-primary mb-4 text-center">Historial de Salidas</h4>

        <div className="row g-3 mb-4">
          <div className="col-md-3">
            <label>Desde</label>
            <input
              type="date"
              className="form-control"
              value={filtro.desde}
              onChange={(e) => setFiltro({ ...filtro, desde: e.target.value })}
            />
          </div>
          <div className="col-md-3">
            <label>Hasta</label>
            <input
              type="date"
              className="form-control"
              value={filtro.hasta}
              onChange={(e) => setFiltro({ ...filtro, hasta: e.target.value })}
            />
          </div>
          <div className="col-md-4">
            <label>Producto</label>
            <select
              className="form-select"
              value={filtro.producto}
              onChange={(e) => setFiltro({ ...filtro, producto: e.target.value })}
            >
              <option value="">Todos</option>
              {(store.productos || []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-2 d-flex align-items-end">
            <button
              className="btn btn-success w-100"
              onClick={exportarExcel}
              disabled={salidasFiltradas.length === 0}
            >
              <i className="fas fa-file-excel me-2"></i> Exportar
            </button>
          </div>
        </div>

        <div className="table-responsive">
          <table className="table table-striped table-bordered">
            <thead className="table-light text-center">
              <tr>
                <th>Producto</th>
                <th>Cantidad</th>
                <th>Fecha</th>
                <th>Empleado</th>
                <th>Costo (€)</th>
                <th>Observaciones</th>
              </tr>
            </thead>
            <tbody>
              {salidasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center text-muted">
                    No hay salidas registradas en el periodo seleccionado.
                  </td>
                </tr>
              ) : (
                salidasFiltradas.map((s, i) => (
                  <tr key={i}>
                    <td>{s.producto?.detalle || "Sin nombre"}</td>
                    <td className="text-center">{s.cantidad}</td>
                    <td className="text-center">{new Date(s.fecha_salida).toLocaleDateString()}</td>
                    <td className="text-center">{s.responsable || "-"}</td>
                    <td className="text-end">
                      {(
                        parseFloat(s.cantidad || 0) *
                        parseFloat(s.producto?.precio_unitario || 0)
                      ).toFixed(2)}
                    </td>
                    <td>{s.observaciones || "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-3 text-end">
          <strong>Total gastado:</strong> € {totalGastado.toFixed(2)}
        </div>
      </div>
    </div>
  );
};

export default HistorialSalidas;
