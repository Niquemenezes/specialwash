import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Context } from "../store/appContext";
import { confirmar } from "../utils/confirmar";
import { normalizeRol, getStoredRol } from "../utils/authSession";
import "../styles/inspeccion-responsive.css";

const formatFecha = (value) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("es-ES");
};

const isProfesional = (item) => {
  if (!item || typeof item !== "object") return false;
  if (Boolean(item.es_concesionario)) return true;
  if (Boolean(item?.cobro?.es_concesionario)) return true;
  return Boolean((item?.cliente?.cif || "").trim());
};

const FirmaEntregaPage = () => {
  const { actions } = useContext(Context);
  const navigate = useNavigate();
  const [inspecciones, setInspecciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const rol = normalizeRol(getStoredRol() || "");
  const isAdmin = rol === "administrador";

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

  const editarInspeccion = (id) => {
    navigate(`/inspeccion-recepcion?editId=${id}`);
  };

  const eliminarInspeccion = useCallback(async (item) => {
    const ok = await confirmar(
      `¿Eliminar la hoja / firma del coche ${item?.matricula || "sin matrícula"}? Esta acción borrará la inspección asociada.`,
      { titulo: "Eliminar inspección", labelConfirmar: "Eliminar", danger: true }
    );
    if (!ok) return;

    setActionLoadingId(item.id);
    try {
      await actions.eliminarInspeccion(item.id);
      await cargarPendientes();
    } finally {
      setActionLoadingId(null);
    }
  }, [actions, cargarPendientes]);

  return (
    <div className="container py-4" style={{ maxWidth: "1000px" }}>
      <div className="card shadow-sm border-0">
        <div className="card-header py-3 sw-modal-header-dark">
          <div className="d-flex justify-content-between align-items-center">
            <span>Hoja de intervención / firma</span>
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
        <div className="card-body p-3">
          <p className="text-muted mb-3" style={{ fontSize: "0.95rem" }}>
            Aquí puedes abrir la hoja de intervención desde el sidebar, prepararla si está pendiente y completar la firma o cierre de entrega.
          </p>

          {loading && <p className="text-muted mb-0">Cargando pendientes...</p>}

          {!loading && pendientes.length === 0 && (
            <p className="text-muted mb-0">No hay coches pendientes de entrega.</p>
          )}

          {!loading && pendientes.length > 0 && (
            <div className="d-flex flex-column gap-3">
              {pendientes.map((item) => {
                const esConcesionario = isProfesional(item);
                const actaLista = esConcesionario || Boolean((item.trabajos_realizados || "").trim());
                return (
                  <div key={item.id} className="sw-firma-card">
                    <div>
                      <div className="fw-bold" style={{ fontSize: "1.05rem" }}>
                        {item.matricula || "-"}
                        {esConcesionario && (
                          <span className="badge bg-info text-dark ms-2" style={{ fontSize: "0.75rem" }}>Profesional</span>
                        )}
                      </div>
                      <div>{item.cliente_nombre || "-"}</div>
                      <div className="text-muted small">{item.coche_descripcion || "-"}</div>
                      <div className="text-muted small">{formatFecha(item.fecha_inspeccion)}</div>
                    </div>
                    <div>
                      <div className="d-flex gap-2 flex-wrap justify-content-end">
                        {actaLista ? (
                          <Link
                            className="btn btn-success sw-firma-btn"
                            to={`/acta-entrega/${item.id}`}
                          >
                            {esConcesionario ? "💼 Cerrar entrega" : "📝 Abrir hoja / firmar"}
                          </Link>
                        ) : (
                          <Link
                            className="btn btn-outline-warning sw-firma-btn"
                            to={`/hoja-tecnica/${item.id}`}
                          >
                            🛠️ Preparar hoja pendiente
                          </Link>
                        )}

                        {isAdmin && (
                          <>
                            <button
                              type="button"
                              className="btn btn-outline-secondary sw-firma-btn"
                              onClick={() => editarInspeccion(item.id)}
                              disabled={actionLoadingId === item.id}
                            >
                              ✏️ Editar
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline-danger sw-firma-btn"
                              onClick={() => eliminarInspeccion(item)}
                              disabled={actionLoadingId === item.id}
                            >
                              {actionLoadingId === item.id ? "Eliminando..." : "🗑️ Eliminar"}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FirmaEntregaPage;
