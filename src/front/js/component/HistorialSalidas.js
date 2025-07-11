import React, { useEffect, useState, useContext } from "react";
import { Context } from "../store/appContext";
import * as XLSX from "xlsx";

const HistorialSalidas = () => {
  const { store, actions } = useContext(Context);
  const [filtro, setFiltro] = useState({ desde: "", hasta: "" });
  const [salidasFiltradas, setSalidasFiltradas] = useState([]);

  useEffect(() => {
    actions.getSalidasProductos();
  }, []);

  useEffect(() => {
    aplicarFiltro();
  }, [store.salidas_productos, filtro]);

  const aplicarFiltro = () => {
    const { desde, hasta } = filtro;
    const salidas = store.salidas_productos || [];

    const filtradas = salidas.filter((s) => {
      const fecha = new Date(s.fecha_salida);
      const desdeFecha = desde ? new Date(desde) : null;
      const hastaFecha = hasta ? new Date(hasta) : null;

      return (
        (!desdeFecha || fecha >= desdeFecha) &&
        (!hastaFecha || fecha <= hastaFecha)
      );
    });

    setSalidasFiltradas(filtradas);
  };

  const exportarExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(salidasFiltradas);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Salidas");

    XLSX.writeFile(workbook, "historial_salidas.xlsx");
  };

  return (
    <div className="container mt-4">
      <div className="card shadow p-4">
        <h4 className="text-primary mb-4 text-center">Historial de Salidas</h4>

        <div className="row g-3 mb-4">
          <div className="col-md-4">
            <label>Desde</label>
            <input
              type="date"
              className="form-control"
              value={filtro.desde}
              onChange={(e) => setFiltro({ ...filtro, desde: e.target.value })}
            />
          </div>
          <div className="col-md-4">
            <label>Hasta</label>
            <input
              type="date"
              className="form-control"
              value={filtro.hasta}
              onChange={(e) => setFiltro({ ...filtro, hasta: e.target.value })}
            />
          </div>
          <div className="col-md-4 d-flex align-items-end">
            <button
              className="btn btn-success w-100"
              onClick={exportarExcel}
              disabled={salidasFiltradas.length === 0}
            >
              <i className="fas fa-file-excel me-2"></i> Exportar a Excel
            </button>
          </div>
        </div>

        <div className="table-responsive">
          <table className="table table-striped table-bordered">
            <thead className="table-light">
              <tr>
                <th>Producto</th>
                <th>Cantidad</th>
                <th>Fecha</th>
                <th>Empleado</th>
                <th>Observaciones</th>
              </tr>
            </thead>
            <tbody>
              {salidasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan="4" className="text-center text-muted">
                    No hay salidas registradas en el periodo seleccionado.
                  </td>
                </tr>
              ) : (
                salidasFiltradas.map((s, i) => (
                  <tr key={i}>
                    <td>{s.producto?.detalle || "Sin nombre"}</td>
                    <td>{s.cantidad}</td>
                    <td>{s.fecha_salida}</td>
                    <td>{s.empleado || "-"}</td>
                    <td>{s.observaciones || "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default HistorialSalidas;
