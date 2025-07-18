import React, { useContext, useEffect } from "react";
import { Context } from "../store/appContext";

const HistorialSalidas = () => {
  const { store, actions } = useContext(Context);
  const { historial_salidas } = store;

  useEffect(() => {
    actions.historialSalidas();
  }, []);

  return (
    <div className="container mt-4">
      <h2>Historial de Salidas</h2>
      <table className="table table-bordered table-striped mt-3">
        <thead>
          <tr>
            <th>Producto</th>
            <th>Cantidad</th>
            <th>Fecha</th>
            <th>Responsable</th>
            <th>Observaciones</th>
          </tr>
        </thead>
        <tbody>
          {store.historial_salidas.length === 0 ? (
            <tr>
              <td colSpan="5" className="text-center">No hay registros</td>
            </tr>
          ) : (
            store.historial_salidas.map((item, index) => (
              <tr key={index}>
                <td>{s.producto?.nombre || "—"}</td>
                <td>{s.cantidad}</td>
                <td>{new Date(s.fecha).toLocaleDateString()}</td>
                <td>{s.usuario?.nombre || "—"}</td>
                <td>{s.observaciones || "—"}</td>

              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default HistorialSalidas;
