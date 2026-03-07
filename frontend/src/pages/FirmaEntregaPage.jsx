import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Context } from "../store/appContext";

const formatFecha = (value) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("es-ES");
};

const FirmaEntregaPage = () => {
  const { actions } = useContext(Context);
  const navigate = useNavigate();
  const [inspecciones, setInspecciones] = useState([]);
  const [loading, setLoading] = useState(true);

  const cargarPendientes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await actions.getPendientesEntrega();
      setInspecciones(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, [actions]);

  useEffect(() => {
    cargarPendientes();
  }, [cargarPendientes]);

  const pendientes = useMemo(() => {
    return inspecciones
      .sort((a, b) => new Date(b.fecha_inspeccion || 0) - new Date(a.fecha_inspeccion || 0));
  }, [inspecciones]);

  const volver = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/", { replace: true });
  };

  return (
    <div className="container py-4" style={{ maxWidth: "1000px" }}>
      <div className="card shadow-sm border-0">
        <div className="card-header py-3" style={{ background: "#d4af37", fontWeight: 600 }}>
          <div className="d-flex justify-content-between align-items-center">
            <span>Firma de Entrega</span>
            <div className="d-flex gap-2">
              <button className="btn btn-outline-secondary btn-sm" onClick={volver}>
                Volver
              </button>
              <button className="btn btn-outline-dark btn-sm" onClick={cargarPendientes}>
                Actualizar
              </button>
            </div>
          </div>
        </div>
        <div className="card-body p-4">
          <p className="text-muted">
            Esta vista esta pensada para que el personal de entrega pueda firmar y cerrar el coche cuando el acta ya este preparada.
          </p>

          {loading && <p className="text-muted mb-0">Cargando pendientes...</p>}

          {!loading && pendientes.length === 0 && (
            <p className="text-muted mb-0">No hay coches pendientes de entrega.</p>
          )}

          {!loading && pendientes.length > 0 && (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>#</th>
                    <th>Cliente</th>
                    <th>Coche</th>
                    <th>Matricula</th>
                    <th>Fecha inspeccion</th>
                    <th>Estado acta</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {pendientes.map((item) => {
                    const actaLista = Boolean((item.trabajos_realizados || "").trim());
                    return (
                      <tr key={item.id}>
                        <td>{item.id}</td>
                        <td>{item.cliente_nombre || "-"}</td>
                        <td>{item.coche_descripcion || "-"}</td>
                        <td>{item.matricula || "-"}</td>
                        <td>{formatFecha(item.fecha_inspeccion)}</td>
                        <td>
                          {actaLista ? (
                            <span className="badge bg-success">Lista para firmar</span>
                          ) : (
                            <span className="badge bg-secondary">Acta pendiente</span>
                          )}
                        </td>
                        <td>
                          {actaLista ? (
                            <Link className="btn btn-outline-success btn-sm" to={`/acta-entrega/${item.id}`}>
                              Firmar entrega
                            </Link>
                          ) : (
                            <button className="btn btn-outline-secondary btn-sm" disabled>
                              Esperando acta
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FirmaEntregaPage;
