import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Context } from "../store/appContext";
import CochesPendientesEntrega from "./CochesPendientesEntrega";
import CochesEntregadosPage from "./CochesEntregadosPage";
import { getApiBase } from "../utils/apiBase";
import "../styles/inspeccion-responsive.css";

const getStoredToken = () =>
  (typeof sessionStorage !== "undefined" && sessionStorage.getItem("token")) ||
  (typeof localStorage !== "undefined" && localStorage.getItem("token")) || "";

/**
 * Devuelve la URL reproducible de un item de vídeo.
 * Soporta:
 *  - Entradas nuevas (IONOS local): { filename, ... }
 *  - Entradas legado (Cloudinary): { url, ... } o string
 */
const getVideoUrl = (item, inspeccionId) => {
  if (!item) return "";
  if (typeof item === "string") return item; // legado string
  if (item.filename) {
    // Video local en IONOS: necesita token JWT en query param para el tag <video>
    const base = getApiBase();
    const token = getStoredToken();
    return `${base}/api/inspeccion-recepcion/${inspeccionId}/video-file/${item.filename}?token=${encodeURIComponent(token)}`;
  }
  return item.url || ""; // legado Cloudinary
};

/**
 * Devuelve la URL mostrable de un item de foto.
 *  - Fotos Cloudinary nuevas: { url, public_id, ... }
 *  - Fotos locales IONOS (fallback sin Cloudinary): { filename, ... }
 *  - Legado string o { url }
 */
const getFotoUrl = (item, inspeccionId) => {
  if (!item) return "";
  if (typeof item === "string") return item;
  if (item.filename) {
    const base = getApiBase();
    const token = getStoredToken();
    return `${base}/api/inspeccion-recepcion/${inspeccionId}/foto-file/${item.filename}?token=${encodeURIComponent(token)}`;
  }
  return item.url || "";
};

const phoneToDigits = (value) => (value || "").replace(/\D/g, "");

const ESTADO_FILTERS = [
  { key: "todos", label: "Todos" },
  { key: "en_proceso", label: "En trabajo" },
  { key: "en_pausa", label: "En pausa" },
  { key: "en_repaso", label: "En repaso" },
  { key: "listo_entrega", label: "Listo entrega" },
  { key: "esperando_parte", label: "Sin parte" },
];

const InspeccionesGuardadasPage = () => {
  const { actions } = useContext(Context);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [inspecciones, setInspecciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detalle, setDetalle] = useState(null);
  const [actionError, setActionError] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("todos");
  const focoAbiertoRef = useRef(null);
  const activeTab = searchParams.get("tab") || "guardadas";
  const inspeccionesGuardadas = inspecciones.filter((insp) => !insp?.entregado);

  const conteoPorEstado = useMemo(() => {
    const acc = { todos: inspeccionesGuardadas.length };
    for (const insp of inspeccionesGuardadas) {
      const estado = insp?.estado_coche?.estado || "sin_estado";
      acc[estado] = (acc[estado] || 0) + 1;
    }
    return acc;
  }, [inspeccionesGuardadas]);

  const inspeccionesFiltradas = useMemo(() => {
    if (estadoFiltro === "todos") return inspeccionesGuardadas;
    return inspeccionesGuardadas.filter((insp) => insp?.estado_coche?.estado === estadoFiltro);
  }, [inspeccionesGuardadas, estadoFiltro]);

  const switchTab = (tab) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", tab);
    setSearchParams(next, { replace: true });
  };

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
      setActionError(`No se pudo cargar el detalle: ${error.message}`);
    }
  }, [actions]);

  useEffect(() => {
    if (loading) return;

    const focusIdRaw = searchParams.get("focusId");
    const focusId = Number(focusIdRaw);
    if (!Number.isInteger(focusId) || focusId <= 0) return;
    if (focoAbiertoRef.current === focusId) return;

    const existe = inspeccionesGuardadas.some((insp) => insp.id === focusId);
    if (!existe) return;

    focoAbiertoRef.current = focusId;
    void verDetalle(focusId);

    const next = new URLSearchParams(searchParams);
    next.delete("focusId");
    setSearchParams(next, { replace: true });
  }, [loading, inspeccionesGuardadas, searchParams, setSearchParams, verDetalle]);

  const eliminarInspeccion = async (id) => {
    if (!window.confirm("¿Seguro que quieres eliminar esta inspección?")) return;

    try {
      await actions.eliminarInspeccion(id);
      await cargarInspecciones();
      if (detalle?.id === id) setDetalle(null);
    } catch (error) {
      console.error("Error al eliminar inspección:", error);
      setActionError(`No se pudo eliminar: ${error.message}`);
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
    <div className="container py-4 sw-page-shell sw-inspecciones-page sw-view-stack">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2 mb-3">
        <h2 className="mb-0">Inspecciones y Pendientes</h2>
        <button className="btn btn-outline-secondary" onClick={volver}>
          Volver
        </button>
      </div>

      <ul className="nav nav-tabs mb-3 sw-tabs-wrap">
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link ${activeTab === "guardadas" ? "active" : ""}`}
            onClick={() => switchTab("guardadas")}
          >
            📋 Inspecciones guardadas
          </button>
        </li>
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link ${activeTab === "pendientes" ? "active" : ""}`}
            onClick={() => switchTab("pendientes")}
          >
            🚗 Pendientes / Hoja de intervencion
          </button>
        </li>
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link ${activeTab === "entregados" ? "active" : ""}`}
            onClick={() => switchTab("entregados")}
          >
            ✅ Entregados
          </button>
        </li>
      </ul>

      {activeTab === "guardadas" && (
        <>
          {actionError && (
            <div className="alert alert-danger d-flex justify-content-between align-items-start py-2 mb-3">
              <span>{actionError}</span>
              <button className="btn-close ms-3" onClick={() => setActionError("")} />
            </div>
          )}
          <div className="d-flex justify-content-end mb-2">
            <button className="btn btn-outline-dark btn-sm" onClick={cargarInspecciones}>
              Recargar
            </button>
          </div>
          <div className="d-flex flex-wrap gap-2 mb-3">
            {ESTADO_FILTERS.map((f) => {
              const total = conteoPorEstado[f.key] || 0;
              const active = estadoFiltro === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  className={`btn btn-sm ${active ? "btn-dark" : "btn-outline-secondary"}`}
                  onClick={() => setEstadoFiltro(f.key)}
                >
                  {f.label} ({total})
                </button>
              );
            })}
          </div>
          <p className="text-muted">
            Esta vista centraliza los datos guardados de inspección. Acceso exclusivo para administradores.
          </p>

      <div className="card shadow-sm border-0 mb-4">
        <div className="card-body p-0">
          {loading ? (
            <div className="p-4 text-center text-muted">Cargando inspecciones...</div>
          ) : inspeccionesFiltradas.length === 0 ? (
            <div className="p-4 text-center text-muted">
              {inspeccionesGuardadas.length === 0
                ? "No hay inspecciones pendientes registradas."
                : "No hay inspecciones para el estado seleccionado."}
            </div>
          ) : (
            <div className="table-responsive sw-inspecciones-table">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>ID</th>
                    <th>Fecha</th>
                    <th>Cliente</th>
                    <th>Coche</th>
                    <th>Matrícula</th>
                    <th>Hecho por</th>
                    <th>Fotos</th>
                    <th>Videos</th>
                    <th>Estado</th>
                    <th>Cobro</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {inspeccionesFiltradas.map((insp) => {
                    const estado = insp?.estado_coche || null;
                    const nombresServicios = Array.isArray(insp?.servicios_aplicados)
                      ? insp.servicios_aplicados
                          .map((s) => String(s?.nombre || "").trim())
                          .filter(Boolean)
                      : [];
                    return (
                    <tr key={insp.id}>
                      <td>#{insp.id}</td>
                      <td>{new Date(insp.fecha_inspeccion).toLocaleString("es-ES")}</td>
                      <td>{insp.cliente_nombre}</td>
                      <td>{insp.coche_descripcion}</td>
                      <td><span className="badge bg-dark">{insp.matricula}</span></td>
                      <td>{insp.usuario_nombre || "-"}</td>
                      <td>{insp.fotos_cloudinary?.length || 0}</td>
                      <td>{insp.videos_cloudinary?.length || 0}</td>
                      <td style={{ minWidth: "160px" }}>
                        {estado ? (
                          <div>
                            <span
                              className="badge"
                              style={{
                                backgroundColor: estado.color,
                                color: estado.color === "#ffc107" || estado.color === "#adb5bd" ? "#000" : "#fff",
                              }}
                            >
                              {estado.label}
                            </span>
                            {nombresServicios.length > 0 && (
                              <div className="small text-muted mt-1" style={{ maxWidth: "220px", whiteSpace: "normal", lineHeight: "1.2" }}>
                                {nombresServicios.map((nombre) => `${nombre}: ${estado.label}`).join(" | ")}
                              </div>
                            )}
                          </div>
                        ) : insp.entregado ? (
                          <span className="badge bg-success">Entregado</span>
                        ) : (
                          <span className="badge bg-warning text-dark">Pendiente</span>
                        )}
                      </td>
                      <td>
                        {insp.cobro ? (
                          <div>
                            <span
                              className="badge"
                              style={{
                                backgroundColor: insp.cobro.color,
                                color: insp.cobro.color === "#ffc107" || insp.cobro.color === "#adb5bd" ? "#000" : "#fff",
                              }}
                            >
                              {insp.cobro.label}
                            </span>
                            <div className="small text-muted mt-1">
                              {Number(insp.cobro.importe_pagado || 0).toFixed(2)} / {Number(insp.cobro.importe_total || 0).toFixed(2)} EUR
                            </div>
                            <div className="small mt-1">
                              <span className="badge bg-light text-dark border">
                                Metodo: {insp.cobro.metodo || "-"}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted small">-</span>
                        )}
                      </td>
                      <td>
                        <div className="btn-group btn-group-sm sw-action-group" role="group">
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
                    );
                  })}
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
              <div className="modal-header py-3 sw-modal-header-dark">
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
                  <div className="card-header sw-modal-header-dark">
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
                  <div className="card-header sw-modal-header-dark">
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

                {detalle.estado_coche && (
                  <div className="card mb-3">
                    <div className="card-header sw-modal-header-dark">
                      📍 Paso actual del coche
                    </div>
                    <div className="card-body p-3 d-flex align-items-start gap-3">
                      {(() => {
                        const nombresServicios = Array.isArray(detalle.servicios_aplicados)
                          ? detalle.servicios_aplicados
                              .map((s) => String(s?.nombre || "").trim())
                              .filter(Boolean)
                          : [];
                        return (
                          <>
                      <span
                        className="badge fs-6"
                        style={{
                          backgroundColor: detalle.estado_coche.color,
                          color: detalle.estado_coche.color === "#ffc107" || detalle.estado_coche.color === "#adb5bd" ? "#000" : "#fff",
                        }}
                      >
                        {detalle.estado_coche.label}
                      </span>
                      {nombresServicios.length > 0 && (
                        <span className="text-muted small" style={{ paddingTop: "4px" }}>
                          {nombresServicios.map((nombre) => `${nombre}: ${detalle.estado_coche.label}`).join(" | ")}
                        </span>
                      )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {detalle.cobro && (
                  <div className="card mb-3">
                    <div className="card-header sw-modal-header-dark">
                      💶 Estado de cobro
                    </div>
                    <div className="card-body p-3">
                      <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                        <span
                          className="badge"
                          style={{
                            backgroundColor: detalle.cobro.color,
                            color: detalle.cobro.color === "#ffc107" || detalle.cobro.color === "#adb5bd" ? "#000" : "#fff",
                          }}
                        >
                          {detalle.cobro.label}
                        </span>
                        <span className="small text-muted">
                          Total {Number(detalle.cobro.importe_total || 0).toFixed(2)} EUR | Pagado {" "}
                          {Number(detalle.cobro.importe_pagado || 0).toFixed(2)} EUR | Pendiente {" "}
                          {Number(detalle.cobro.importe_pendiente || 0).toFixed(2)} EUR
                        </span>
                      </div>
                      <div className="small text-muted mb-3">
                        Metodo: {detalle.cobro.metodo || "-"} | Referencia: {detalle.cobro.referencia || "-"}
                      </div>
                      {!detalle.es_concesionario && (
                        <div className="small text-muted">
                          El cobro se registra durante la firma de entrega del cliente.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {(detalle.firma_cliente_recepcion || detalle.firma_empleado_recepcion) && (
                  <div className="card mb-3">
                    <div className="card-header sw-modal-header-dark">
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
                  <div className="card-header sw-modal-header-dark">
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
                    <div className="card-header sw-modal-header-dark">
                      📸 Fotos del Vehículo ({detalle.fotos_cloudinary.length})
                    </div>
                    <div className="card-body p-2 p-md-3">
                      <div className="row g-3">
                        {detalle.fotos_cloudinary.map((foto, index) => {
                          const url = getFotoUrl(foto, detalle.id);
                          if (!url) return null;
                          const fotoExpira = foto?.expires_at
                            ? new Date(foto.expires_at).toLocaleDateString("es-ES")
                            : null;
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
                                {fotoExpira && (
                                  <p className="text-center mb-0 small text-warning">
                                    ⏳ Caduca: {fotoExpira}
                                  </p>
                                )}
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
                    <div className="card-header sw-modal-header-dark">
                      🎥 Videos del Vehículo ({detalle.videos_cloudinary.length})
                    </div>
                    <div className="card-body p-2 p-md-3">
                      <div className="row g-3">
                        {detalle.videos_cloudinary.map((video, index) => {
                          const url = getVideoUrl(video, detalle.id);
                          if (!url) return null;
                          const expiresAt = video?.expires_at
                            ? new Date(video.expires_at).toLocaleDateString("es-ES")
                            : null;
                          return (
                            <div key={index} className="col-12 col-sm-6">
                              <div className="border rounded p-2">
                                <video src={url} controls className="w-100 rounded" style={{ maxHeight: "400px" }}>
                                  Tu navegador no soporta el elemento de video.
                                </video>
                                <p className="text-center mt-2 mb-0 small text-muted">
                                  Video #{index + 1}
                                  {video?.original_name && ` · ${video.original_name}`}
                                </p>
                                {expiresAt && (
                                  <p className="text-center mb-0 small text-warning">
                                    ⏳ Caduca: {expiresAt}
                                  </p>
                                )}
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
        </>
      )}

      {activeTab === "pendientes" && <CochesPendientesEntrega />}
      {activeTab === "entregados" && <CochesEntregadosPage />}
    </div>
  );
};

export default InspeccionesGuardadasPage;
