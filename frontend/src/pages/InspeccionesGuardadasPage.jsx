import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Context } from "../store/appContext";

const getMediaUrl = (item) => (typeof item === "string" ? item : item?.url || "");
const phoneToDigits = (value) => (value || "").replace(/\D/g, "");

const InspeccionesGuardadasPage = () => {
  const { actions } = useContext(Context);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [inspecciones, setInspecciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detalle, setDetalle] = useState(null);
  const focoAbiertoRef = useRef(null);

  const cargarInspecciones = useCallback(async () => {
    setLoading(true);
    try {
      const data = await actions.getMisInspecciones();
      setInspecciones(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error al cargar inspecciones:", error);
      setInspecciones([]);
    } finally {
      setLoading(false);
    }
  }, [actions]);

  useEffect(() => {
    cargarInspecciones();
  }, [cargarInspecciones]);

  const verDetalle = useCallback(async (id) => {
    try {
      const data = await actions.getInspeccion(id);
      setDetalle(data || null);
    } catch (error) {
      console.error("Error al cargar detalle:", error);
      alert(`No se pudo cargar el detalle: ${error.message}`);
    }
  }, [actions]);

  useEffect(() => {
    if (loading) return;

    const focusIdRaw = searchParams.get("focusId");
    const focusId = Number(focusIdRaw);
    if (!Number.isInteger(focusId) || focusId <= 0) return;
    if (focoAbiertoRef.current === focusId) return;

    const existe = inspecciones.some((insp) => insp.id === focusId);
    if (!existe) return;

    focoAbiertoRef.current = focusId;
    void verDetalle(focusId);

    const next = new URLSearchParams(searchParams);
    next.delete("focusId");
    setSearchParams(next, { replace: true });
  }, [loading, inspecciones, searchParams, setSearchParams, verDetalle]);

  const eliminarInspeccion = async (id) => {
    if (!window.confirm("¿Seguro que quieres eliminar esta inspección?")) return;

    try {
      await actions.eliminarInspeccion(id);
      await cargarInspecciones();
      if (detalle?.id === id) setDetalle(null);
      alert("Inspección eliminada correctamente");
    } catch (error) {
      console.error("Error al eliminar inspección:", error);
      alert(`No se pudo eliminar: ${error.message}`);
    }
  };

  const irAEditar = (id) => {
    setDetalle(null);
    navigate(`/inspeccion-recepcion?editId=${id}`);
  };

  const volver = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/", { replace: true });
  };

  return (
    <div className="container py-4">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2 mb-3">
        <h2 className="mb-0">Inspecciones Guardadas</h2>
        <div className="d-flex gap-2">
          <button className="btn btn-outline-secondary" onClick={volver}>
            Volver
          </button>
          <button className="btn btn-outline-dark" onClick={cargarInspecciones}>
            Recargar
          </button>
        </div>
      </div>

      <p className="text-muted">
        Esta vista centraliza los datos guardados de inspección. Acceso exclusivo para administradores.
      </p>

      <div className="card shadow-sm border-0 mb-4">
        <div className="card-body p-0">
          {loading ? (
            <div className="p-4 text-center text-muted">Cargando inspecciones...</div>
          ) : inspecciones.length === 0 ? (
            <div className="p-4 text-center text-muted">No hay inspecciones registradas.</div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>ID</th>
                    <th>Fecha</th>
                    <th>Cliente</th>
                    <th>Coche</th>
                    <th>Matrícula</th>
                    <th>Fotos</th>
                    <th>Videos</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {inspecciones.map((insp) => (
                    <tr key={insp.id}>
                      <td>#{insp.id}</td>
                      <td>{new Date(insp.fecha_inspeccion).toLocaleString("es-ES")}</td>
                      <td>{insp.cliente_nombre}</td>
                      <td>{insp.coche_descripcion}</td>
                      <td><span className="badge bg-dark">{insp.matricula}</span></td>
                      <td>{insp.fotos_cloudinary?.length || 0}</td>
                      <td>{insp.videos_cloudinary?.length || 0}</td>
                      <td>
                        {insp.entregado ? (
                          <span className="badge bg-success">Entregado</span>
                        ) : (
                          <span className="badge bg-warning text-dark">Pendiente</span>
                        )}
                      </td>
                      <td>
                        <div className="btn-group btn-group-sm" role="group">
                          <button className="btn btn-outline-primary" onClick={() => verDetalle(insp.id)} title="Ver detalle">
                            👁️
                          </button>
                          <button className="btn btn-outline-warning" onClick={() => irAEditar(insp.id)} title="Editar">
                            ✏️
                          </button>
                          {phoneToDigits(insp.cliente_telefono) && (
                            <a
                              href={`https://wa.me/${phoneToDigits(insp.cliente_telefono)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-sm"
                              style={{ background: "#25D366", color: "white", border: "none" }}
                              title={`WhatsApp ${insp.cliente_nombre}`}
                            >
                              📱
                            </a>
                          )}
                          <button className="btn btn-outline-danger" onClick={() => eliminarInspeccion(insp.id)} title="Eliminar">
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {detalle && (
        <div className="modal show d-block" style={{ backgroundColor: "rgba(0,0,0,0.75)" }}>
          <div className="modal-dialog modal-xl modal-dialog-scrollable modal-fullscreen-md-down">
            <div className="modal-content">
              <div className="modal-header py-3" style={{ background: "#0f0f0f", color: "#d4af37" }}>
                <h5 className="modal-title fw-bold fs-6 fs-md-5">
                  🚗 #{detalle.id} - {detalle.matricula}
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setDetalle(null)}
                  aria-label="Cerrar"
                ></button>
              </div>

              <div className="modal-body p-3">
                <div className="card mb-3">
                  <div className="card-header py-2" style={{ background: "#d4af37", fontWeight: "600" }}>
                    👤 Datos del Cliente
                  </div>
                  <div className="card-body p-3">
                    <div className="row g-2">
                      <div className="col-12 col-md-6">
                        <strong>Nombre:</strong> {detalle.cliente_nombre}
                      </div>
                      <div className="col-12 col-md-6">
                        <strong>Teléfono:</strong> {detalle.cliente_telefono}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card mb-3">
                  <div className="card-header py-2" style={{ background: "#d4af37", fontWeight: "600" }}>
                    🚗 Datos del Vehículo
                  </div>
                  <div className="card-body p-3">
                    <div className="row g-2">
                      <div className="col-12 col-md-6">
                        <strong>Coche:</strong> {detalle.coche_descripcion}
                      </div>
                      <div className="col-12 col-md-6">
                        <strong>Matrícula:</strong> <span className="badge bg-dark">{detalle.matricula}</span>
                      </div>
                      <div className="col-12 col-md-6">
                        <strong>Kilómetros:</strong> {Number.isFinite(detalle.kilometros) ? detalle.kilometros.toLocaleString("es-ES") : "-"} km
                      </div>
                      <div className="col-12 col-md-6">
                        <strong>Fecha:</strong> {new Date(detalle.fecha_inspeccion).toLocaleString("es-ES")}
                      </div>
                    </div>
                  </div>
                </div>

                {(detalle.firma_cliente_recepcion || detalle.firma_empleado_recepcion) && (
                  <div className="card mb-3">
                    <div className="card-header py-2" style={{ background: "#d4af37", fontWeight: "600" }}>
                      ✍️ Firmas de Recepción
                    </div>
                    <div className="card-body p-3">
                      <div className="row g-3">
                        {detalle.firma_cliente_recepcion && (
                          <div className="col-12 col-md-6">
                            <p className="mb-1 fw-bold">Cliente</p>
                            <img
                              src={detalle.firma_cliente_recepcion}
                              alt="Firma cliente recepcion"
                              className="img-fluid border rounded"
                              style={{ background: "#fff", maxHeight: "180px", width: "100%", objectFit: "contain" }}
                            />
                          </div>
                        )}
                        {detalle.firma_empleado_recepcion && (
                          <div className="col-12 col-md-6">
                            <p className="mb-1 fw-bold">Empleado</p>
                            <img
                              src={detalle.firma_empleado_recepcion}
                              alt="Firma empleado recepcion"
                              className="img-fluid border rounded"
                              style={{ background: "#fff", maxHeight: "180px", width: "100%", objectFit: "contain" }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="card mb-3">
                  <div className="card-header py-2" style={{ background: "#d4af37", fontWeight: "600" }}>
                    🔧 Observaciones y Averías
                  </div>
                  <div className="card-body p-3">
                    <p className="mb-0" style={{ whiteSpace: "pre-wrap" }}>
                      {detalle.averias_notas || "Sin observaciones"}
                    </p>
                  </div>
                </div>

                {Array.isArray(detalle.fotos_cloudinary) && detalle.fotos_cloudinary.length > 0 && (
                  <div className="card mb-3">
                    <div className="card-header py-2" style={{ background: "#d4af37", fontWeight: "600" }}>
                      📸 Fotos del Vehículo ({detalle.fotos_cloudinary.length})
                    </div>
                    <div className="card-body p-2 p-md-3">
                      <div className="row g-3">
                        {detalle.fotos_cloudinary.map((foto, index) => {
                          const url = getMediaUrl(foto);
                          if (!url) return null;
                          return (
                            <div key={index} className="col-6 col-sm-6 col-md-4">
                              <div className="border rounded p-2">
                                <a href={url} target="_blank" rel="noopener noreferrer">
                                  <img
                                    src={url}
                                    alt={`Foto ${index + 1}`}
                                    className="img-fluid rounded"
                                    style={{ width: "100%", height: "180px", objectFit: "cover", cursor: "pointer" }}
                                  />
                                </a>
                                <p className="text-center mt-2 mb-0 small text-muted d-none d-md-block">
                                  Foto #{index + 1} - Click para ampliar
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {Array.isArray(detalle.videos_cloudinary) && detalle.videos_cloudinary.length > 0 && (
                  <div className="card mb-3">
                    <div className="card-header py-2" style={{ background: "#d4af37", fontWeight: "600" }}>
                      🎥 Videos del Vehículo ({detalle.videos_cloudinary.length})
                    </div>
                    <div className="card-body p-2 p-md-3">
                      <div className="row g-3">
                        {detalle.videos_cloudinary.map((video, index) => {
                          const url = getMediaUrl(video);
                          if (!url) return null;
                          return (
                            <div key={index} className="col-12 col-sm-6">
                              <div className="border rounded p-2">
                                <video src={url} controls className="w-100 rounded" style={{ maxHeight: "400px" }}>
                                  Tu navegador no soporta el elemento de video.
                                </video>
                                <p className="text-center mt-2 mb-0 small text-muted">Video #{index + 1}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {(!detalle.fotos_cloudinary || detalle.fotos_cloudinary.length === 0) &&
                  (!detalle.videos_cloudinary || detalle.videos_cloudinary.length === 0) && (
                    <div className="alert alert-info mb-0">
                      ℹ️ Esta inspección no tiene fotos ni videos guardados.
                    </div>
                  )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setDetalle(null)}>
                  Cerrar
                </button>
                <button type="button" className="btn btn-outline-warning" onClick={() => irAEditar(detalle.id)}>
                  ✏️ Editar inspección
                </button>
                {phoneToDigits(detalle.cliente_telefono) && (
                  <a
                    href={`https://wa.me/${phoneToDigits(detalle.cliente_telefono)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn"
                    style={{ background: "#25D366", color: "white" }}
                  >
                    📱 WhatsApp Cliente
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InspeccionesGuardadasPage;
