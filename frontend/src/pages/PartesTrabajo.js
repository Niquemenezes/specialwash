import React, { useCallback, useEffect, useState } from "react";
import {
  listarPartesTrabajo,
  cambiarEstadoParte,
  quitarPausa,
  crearParteTrabajo,
  editarParteTrabajo,
  listarCochesParaCrearParte,
  listarCochesCatalogo,
  listarEmpleadosDisponibles,
  listarServiciosCatalogo,
  obtenerUltimaInspeccionPorCoche,
} from "../utils/parteTrabajoApi";

function EstadoBadge({ estado }) {
  const config = {
    pendiente: { label: "Pendiente", color: "danger" },
    en_proceso: { label: "En proceso", color: "warning" },
    en_pausa: { label: "En pausa", color: "info" },
    finalizado: { label: "Finalizado", color: "success" },
  };

  const { label, color } = config[estado] || { label: estado, color: "secondary" };
  return <span className={`badge bg-${color}`}>{label}</span>;
}

function formatDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString();
}

export function AdminPartesTrabajo() {
  const [partes, setPartes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [empleadoFiltro, setEmpleadoFiltro] = useState("");
  const [cocheFiltro, setCocheFiltro] = useState("");
  const [nuevoCocheId, setNuevoCocheId] = useState("");
  const [nuevoEmpleadoId, setNuevoEmpleadoId] = useState("");
  const [nuevoTrabajoARealizar, setNuevoTrabajoARealizar] = useState("");
  const [mensajeCreacion, setMensajeCreacion] = useState("");
  const [cochesDisponibles, setCochesDisponibles] = useState([]);
  const [cochesCatalogo, setCochesCatalogo] = useState([]);
  const [empleadosDisponibles, setEmpleadosDisponibles] = useState([]);
  const [loadingRecursos, setLoadingRecursos] = useState(true);
  const [editandoId, setEditandoId] = useState(null);
  const [editEmpleadoId, setEditEmpleadoId] = useState("");
  const [editServicioId, setEditServicioId] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [serviciosCatalogo, setServiciosCatalogo] = useState([]);
  const [nuevoServicioId, setNuevoServicioId] = useState("");
  const [serviciosParteSeleccionados, setServiciosParteSeleccionados] = useState([]);

  const empleadoNombrePorId = useCallback(
    (id) => {
      const emp = empleadosDisponibles.find((u) => Number(u.id) === Number(id));
      return emp ? emp.nombre : `ID ${id}`;
    },
    [empleadosDisponibles]
  );

  const cocheTextoPorId = useCallback(
    (id) => {
      const coche = [...cochesDisponibles, ...cochesCatalogo].find(
        (c) => Number(c.coche_id) === Number(id)
      );
      if (!coche) return `ID ${id}`;
      return `${coche.matricula}${coche.cliente_nombre ? ` - ${coche.cliente_nombre}` : ""}`;
    },
    [cochesDisponibles, cochesCatalogo]
  );

  const groupByDate = (partesArray) => {
    const grupos = {};
    partesArray.forEach((p) => {
      const fecha = p.fecha_inicio ? new Date(p.fecha_inicio).toLocaleDateString("es-ES") : "Sin fecha";
      if (!grupos[fecha]) grupos[fecha] = [];
      grupos[fecha].push(p);
    });
    return Object.entries(grupos).sort((a, b) => new Date(b[0]) - new Date(a[0]));
  };

  const cargarPartes = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const todasLosPartes = await listarPartesTrabajo({
        empleado_id: empleadoFiltro,
        coche_id: cocheFiltro,
      });
      const activos = (Array.isArray(todasLosPartes) ? todasLosPartes : []).filter(
        (p) => p.estado !== "finalizado"
      );
      setPartes(activos);
    } catch (e) {
      setError(e?.message || "No se pudieron cargar los partes.");
      setPartes([]);
    } finally {
      setLoading(false);
    }
  }, [empleadoFiltro, cocheFiltro]);

  useEffect(() => {
    cargarPartes();
  }, [cargarPartes]);

  const cargarRecursos = useCallback(async () => {
    setLoadingRecursos(true);
    setError("");
    try {
      const [coches, cochesAll, empleados, catalogo] = await Promise.all([
        listarCochesParaCrearParte(),
        listarCochesCatalogo(),
        listarEmpleadosDisponibles(),
        listarServiciosCatalogo(true),
      ]);
      setCochesDisponibles(Array.isArray(coches) ? coches : []);
      setCochesCatalogo(Array.isArray(cochesAll) ? cochesAll : []);
      setEmpleadosDisponibles(Array.isArray(empleados) ? empleados : []);
      setServiciosCatalogo(Array.isArray(catalogo) ? catalogo : []);
    } catch (e) {
      setError(e?.message || "No se pudieron cargar coches/empleados para asignación.");
      setCochesDisponibles([]);
      setCochesCatalogo([]);
      setEmpleadosDisponibles([]);
      setServiciosCatalogo([]);
    } finally {
      setLoadingRecursos(false);
    }
  }, []);

  useEffect(() => {
    cargarRecursos();
  }, [cargarRecursos]);

  useEffect(() => {
    let active = true;

    const cargarServiciosDesdeInspeccion = async () => {
      if (!nuevoCocheId) {
        setServiciosParteSeleccionados([]);
        return;
      }

      try {
        const inspeccion = await obtenerUltimaInspeccionPorCoche(nuevoCocheId);
        if (!active) return;

        const desdeRecepcion = Array.isArray(inspeccion?.servicios_aplicados)
          ? inspeccion.servicios_aplicados.map((s, idx) => ({
              key: `rec-${s?.servicio_catalogo_id || "x"}-${idx}`,
              nombre: String(s?.nombre || "").trim(),
              precio: Number(s?.precio || 0),
              origen: "recepcion",
              servicio_catalogo_id: s?.servicio_catalogo_id ?? null,
            }))
          : [];

        const limpios = desdeRecepcion.filter((s) => s.nombre);
        setServiciosParteSeleccionados(limpios);
      } catch {
        if (active) setServiciosParteSeleccionados([]);
      }
    };

    cargarServiciosDesdeInspeccion();
    return () => {
      active = false;
    };
  }, [nuevoCocheId]);

  const agregarServicioExtra = () => {
    if (!nuevoServicioId) {
      setMensajeCreacion("Debes seleccionar un servicio del catálogo.");
      return;
    }

    const servicioElegido = serviciosCatalogo.find((s) => Number(s.id) === Number(nuevoServicioId));
    if (!servicioElegido) {
      setMensajeCreacion("Servicio no válido.");
      return;
    }

    const nombre = String(servicioElegido.nombre || "").trim();
    if (!nombre) return;

    setServiciosParteSeleccionados((prev) => {
      const yaExiste = prev.some((s) => s.nombre.toLowerCase() === nombre.toLowerCase());
      if (yaExiste) return prev;
      return [
        ...prev,
        {
          key: `extra-${servicioElegido.id}`,
          nombre,
          precio: Number(servicioElegido.precio_base || 0),
          origen: "extra",
          servicio_catalogo_id: servicioElegido.id,
        },
      ];
    });
    setNuevoServicioId("");
    setMensajeCreacion("");
  };

  const quitarServicioSeleccionado = (key) => {
    setServiciosParteSeleccionados((prev) => prev.filter((s) => s.key !== key));
  };

  const onCrearParte = async (e) => {
    e.preventDefault();
    setMensajeCreacion("");

    if (!nuevoCocheId || !nuevoEmpleadoId) {
      setMensajeCreacion("Debes indicar Coche ID y Empleado ID.");
      return;
    }

    if (!nuevoServicioId) {
      setMensajeCreacion("Debes seleccionar al menos un servicio para el parte.");
      return;
    }

    if (serviciosParteSeleccionados.length === 0) {
      setMensajeCreacion("Debes añadir al menos un servicio para el parte.");
      return;
    }

    const trabajoFinal = serviciosParteSeleccionados
      .map((s) => s.nombre)
      .filter(Boolean)
      .join(" | ");

    const payload = {
      coche_id: Number(nuevoCocheId),
      empleado_id: Number(nuevoEmpleadoId),
      observaciones: trabajoFinal,
    };

    try {
      await crearParteTrabajo(payload);
      setMensajeCreacion("Parte creado correctamente.");
      setNuevoCocheId("");
      setNuevoEmpleadoId("");
      setNuevoTrabajoARealizar("");
      setNuevoServicioId("");
      setServiciosParteSeleccionados([]);
      await Promise.all([cargarPartes(), cargarRecursos()]);
    } catch (e) {
      setMensajeCreacion(e?.message || "Error al crear el parte.");
    }
  };

  const onQuitarPausa = async (id) => {
    setError("");
    try {
      await quitarPausa(id);
      await cargarPartes();
    } catch (e) {
      setError(e?.message || "No se pudo quitar la pausa.");
    }
  };

  const onFinalizar = async (id) => {
    setError("");
    try {
      await cambiarEstadoParte(id, "finalizado");
      await cargarPartes();
    } catch (e) {
      setError(e?.message || "No se pudo finalizar el parte.");
    }
  };

  const onAbrirEditar = (parte) => {
    setEditandoId(parte.id);
    setEditEmpleadoId(parte.empleado_id || "");
    const observacionActual = String(parte.observaciones || "").trim().toLowerCase();
    const servicioActual = serviciosCatalogo.find(
      (s) => String(s.nombre || "").trim().toLowerCase() === observacionActual
    );
    setEditServicioId(servicioActual ? String(servicioActual.id) : "");
  };

  const onCancelarEditar = () => {
    setEditandoId(null);
    setEditEmpleadoId("");
    setEditServicioId("");
  };

  const onGuardarEdicion = async () => {
    if (!editEmpleadoId) {
      setError("Debes seleccionar un empleado.");
      return;
    }

    if (!editServicioId) {
      setError("Debes seleccionar un servicio.");
      return;
    }

    const servicioElegido = serviciosCatalogo.find((s) => Number(s.id) === Number(editServicioId));
    const trabajo = String(servicioElegido?.nombre || "").trim();
    if (!trabajo) {
      setError("Servicio no válido. Selecciona uno de la lista.");
      return;
    }

    setEditLoading(true);
    setError("");
    try {
      await editarParteTrabajo(editandoId, {
        empleado_id: Number(editEmpleadoId),
        observaciones: trabajo,
      });
      await cargarPartes();
      onCancelarEditar();
    } catch (e) {
      setError(e?.message || "No se pudo editar el parte.");
    } finally {
      setEditLoading(false);
    }
  };

  return (
    <div className="container py-4" style={{ maxWidth: "1200px" }}>
      {/* HEADER PREMIUM */}
      <div
        className="d-flex justify-content-between align-items-center p-3 mb-4 shadow-sm"
        style={{
          background: "#0f0f0f",
          borderRadius: "12px",
          color: "white",
        }}
      >
        <h2 className="fw-bold m-0" style={{ color: "#d4af37", fontSize: "clamp(1.2rem, 4vw, 1.75rem)" }}>
          🧰 Partes de Trabajo
        </h2>
        <p className="m-0 d-none d-md-block" style={{ fontSize: "0.85rem", color: "#aaa" }}>
          Panel de asignación, seguimiento y finalización
        </p>
      </div>

      {/* STATS CARDS */}
      <div className="row g-3 mb-4">
        <div className="col-md-4">
          <div className="card shadow-sm" style={{ borderRadius: "12px", border: "1px solid #e0e0e0" }}>
            <div className="card-body">
              <p className="text-muted mb-2">📋 Total partes visibles</p>
              <h4 className="fw-bold" style={{ color: "#d4af37" }}>{partes.length}</h4>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card shadow-sm" style={{ borderRadius: "12px", border: "1px solid #e0e0e0" }}>
            <div className="card-body">
              <p className="text-muted mb-2">🚗 Coches sin parte activa</p>
              <h4 className="fw-bold" style={{ color: "#d4af37" }}>{cochesDisponibles.length}</h4>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card shadow-sm" style={{ borderRadius: "12px", border: "1px solid #e0e0e0" }}>
            <div className="card-body">
              <p className="text-muted mb-2">👷 Empleados disponibles</p>
              <h4 className="fw-bold" style={{ color: "#d4af37" }}>{empleadosDisponibles.length}</h4>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger alert-dismissible fade show" role="alert">
          <strong>Error:</strong> {error}
          <button type="button" className="btn-close" onClick={() => setError("")}></button>
        </div>
      )}

      {/* FORM CREAR PARTE */}
      <div className="card mb-4 shadow-sm" style={{ borderRadius: "12px", border: "1px solid #e0e0e0" }}>
        <div className="card-body">
          <h5 className="card-title fw-semibold mb-3">📝 Crear parte</h5>
          <form onSubmit={onCrearParte} className="row g-3">
            <div className="col-md-6">
              <label className="form-label">Coche sin parte activa *</label>
              <select
                className="form-select"
                value={nuevoCocheId}
                onChange={(e) => setNuevoCocheId(e.target.value)}
                disabled={loadingRecursos}
                required
                style={{ borderRadius: "8px" }}
              >
                <option value="">Selecciona coche...</option>
                {cochesDisponibles.map((c) => (
                  <option key={c.coche_id} value={c.coche_id}>
                    {c.matricula} {c.coche_descripcion ? ` - ${c.coche_descripcion}` : ""} {c.cliente_nombre ? ` - ${c.cliente_nombre}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-6">
              <label className="form-label">Empleado *</label>
              <select
                className="form-select"
                value={nuevoEmpleadoId}
                onChange={(e) => setNuevoEmpleadoId(e.target.value)}
                disabled={loadingRecursos}
                required
                style={{ borderRadius: "8px" }}
              >
                <option value="">Selecciona empleado...</option>
                {empleadosDisponibles.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre} ({u.rol})
                  </option>
                ))}
              </select>
            </div>

            <div className="col-12">
              <label className="form-label">Servicios del parte *</label>
              {serviciosCatalogo.length === 0 ? (
                <p className="text-muted">
                  No hay servicios en el catálogo. <a href="/catalogo-servicios" target="_blank" rel="noopener noreferrer">Crear servicios</a>
                </p>
              ) : (
                <div className="row g-2">
                  <div className="col-12 col-md-8">
                    <select
                      className="form-select"
                      value={nuevoServicioId}
                      onChange={(e) => setNuevoServicioId(e.target.value)}
                      style={{ borderRadius: "8px" }}
                    >
                      <option value="">Añadir servicio extra desde catálogo...</option>
                      {serviciosCatalogo.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nombre} {s.precio_base != null ? `(${Number(s.precio_base).toFixed(2)}€)` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-12 col-md-4 d-grid">
                    <button
                      type="button"
                      className="btn btn-outline-dark"
                      onClick={agregarServicioExtra}
                    >
                      Añadir servicio extra
                    </button>
                  </div>
                </div>
              )}
              <small className="text-muted d-block mt-2">
                Al elegir coche, se cargan automáticamente los servicios acordados en recepción (última inspección).
              </small>

              <div className="mt-2">
                {serviciosParteSeleccionados.length === 0 ? (
                  <div className="text-muted small">No hay servicios seleccionados todavía.</div>
                ) : (
                  <div className="d-flex flex-wrap gap-2">
                    {serviciosParteSeleccionados.map((s) => (
                      <span key={s.key} className="badge bg-secondary d-flex align-items-center gap-2 p-2">
                        {s.nombre} {Number.isFinite(s.precio) ? `· ${Number(s.precio).toFixed(2)}€` : ""}
                        <button
                          type="button"
                          className="btn btn-sm btn-light py-0 px-1"
                          onClick={() => quitarServicioSeleccionado(s.key)}
                          title="Quitar servicio"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="col-12">
              <button type="submit" className="btn btn-dark" style={{ borderColor: "#d4af37" }} disabled={loadingRecursos}>
                ✅ Crear parte
              </button>
              {mensajeCreacion && <span className="ms-2 text-success">{mensajeCreacion}</span>}
            </div>

            {!loadingRecursos && cochesDisponibles.length === 0 && (
              <div className="col-12">
                <div className="alert alert-info">No hay coches disponibles para crear parte en este momento.</div>
              </div>
            )}
          </form>
        </div>
      </div>

      {/* FILTERS */}
      <div className="card mb-4 shadow-sm" style={{ borderRadius: "12px", border: "1px solid #e0e0e0" }}>
        <div className="card-body">
          <h5 className="card-title fw-semibold mb-3">🔎 Filtros</h5>
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label">Empleado</label>
              <select
                className="form-select"
                value={empleadoFiltro}
                onChange={(e) => setEmpleadoFiltro(e.target.value)}
                style={{ borderRadius: "8px" }}
              >
                <option value="">Todos</option>
                {empleadosDisponibles.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre} ({u.rol})
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-6">
              <label className="form-label">Coche</label>
              <select
                className="form-select"
                value={cocheFiltro}
                onChange={(e) => setCocheFiltro(e.target.value)}
                style={{ borderRadius: "8px" }}
              >
                <option value="">Todos</option>
                {cochesCatalogo.map((c) => (
                  <option key={c.coche_id} value={c.coche_id}>
                    {c.matricula} {c.coche_descripcion ? ` - ${c.coche_descripcion}` : ""} {c.cliente_nombre ? ` - ${c.cliente_nombre}` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* LISTA PARTES */}
      {loading ? (
        <div className="text-center py-5">
          <p className="text-muted">Cargando partes activos...</p>
        </div>
      ) : partes.length === 0 ? (
        <div className="alert alert-info">✅ No hay partes pendientes. ¡Todos los trabajos están finalizados!</div>
      ) : (
        <div>
          {groupByDate(partes).map(([fecha, grupoPartes]) => (
            <div key={fecha} className="mb-4">
              <h5 className="mb-3" style={{ color: "#d4af37", fontWeight: "600" }}>📅 {fecha}</h5>
              <div className="table-responsive">
                <table className="table table-hover" style={{ borderRadius: "12px", overflow: "hidden" }}>
                  <thead style={{ background: "#f8f9fa" }}>
                    <tr>
                      <th>ID</th>
                      <th>Coche</th>
                      <th>Empleado</th>
                      <th>Estado</th>
                      <th>Trabajo</th>
                      <th>Inicio</th>
                      <th>Fin</th>
                      <th>Duración (h)</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grupoPartes.map((p) => (
                      <tr key={p.id}>
                        <td>#{p.id}</td>
                        <td>{cocheTextoPorId(p.coche_id)}</td>
                        <td>{empleadoNombrePorId(p.empleado_id)}</td>
                        <td><EstadoBadge estado={p.estado} /></td>
                        <td>{p.observaciones || "-"}</td>
                        <td className="small">{formatDate(p.fecha_inicio)}</td>
                        <td className="small">{formatDate(p.fecha_fin)}</td>
                        <td>{typeof p.duracion_horas === "number" ? p.duracion_horas.toFixed(2) : "-"}</td>
                        <td>
                          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                            {p.estado === "en_pausa" && (
                              <button className="btn btn-sm btn-outline-primary" onClick={() => onQuitarPausa(p.id)}>
                                ▶️ Reanudar
                              </button>
                            )}
                            {p.estado !== "finalizado" && (
                              <>
                                <button className="btn btn-sm btn-outline-secondary" onClick={() => onAbrirEditar(p)}>
                                  ✏️ Editar
                                </button>
                                <button className="btn btn-sm btn-success" onClick={() => onFinalizar(p.id)}>
                                  ✅ Finalizar
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL EDITAR */}
      {editandoId && (
        <div className="modal d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-fullscreen-sm-down">
            <div className="modal-content">
              <div className="modal-header" style={{ background: "#0f0f0f", color: "#d4af37", borderBottom: "none" }}>
                <h5 className="modal-title fw-bold">✏️ Editar Parte #{editandoId}</h5>
                <button type="button" className="btn-close btn-close-white" onClick={onCancelarEditar}></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Empleado</label>
                  <select
                    className="form-select"
                    value={editEmpleadoId}
                    onChange={(e) => setEditEmpleadoId(e.target.value)}
                    disabled={editLoading}
                    style={{ borderRadius: "8px" }}
                  >
                    <option value="">Selecciona empleado...</option>
                    {empleadosDisponibles.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.nombre} ({u.rol})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-3">
                  <label className="form-label">Servicio *</label>
                  <select
                    className="form-select"
                    value={editServicioId}
                    onChange={(e) => setEditServicioId(e.target.value)}
                    disabled={editLoading}
                    style={{ borderRadius: "8px" }}
                  >
                    <option value="">Selecciona servicio...</option>
                    {serviciosCatalogo.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nombre} {s.precio_base != null ? `(${Number(s.precio_base).toFixed(2)}€)` : ""}
                      </option>
                    ))}
                  </select>
                  {serviciosCatalogo.length === 0 && (
                    <div className="form-text text-muted">
                      No hay servicios en el catálogo. Crea servicios antes de editar el parte.
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={onCancelarEditar} disabled={editLoading}>
                  Cancelar
                </button>
                <button type="button" className="btn btn-dark" style={{ borderColor: "#d4af37" }} onClick={onGuardarEdicion} disabled={editLoading}>
                  {editLoading ? "Guardando..." : "✅ Guardar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function EmpleadoPartesTrabajo({ empleadoId }) {
  const [partes, setPartes] = useState([]);
  const [cochesCatalogo, setCochesCatalogo] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const cocheTextoPorId = useCallback(
    (id) => {
      const coche = cochesCatalogo.find((c) => Number(c.coche_id) === Number(id));
      if (!coche) return `ID ${id}`;
      return `${coche.matricula}${coche.cliente_nombre ? ` - ${coche.cliente_nombre}` : ""}`;
    },
    [cochesCatalogo]
  );

  const cargarCochesCatalogo = useCallback(async () => {
    try {
      const coches = await listarCochesCatalogo();
      setCochesCatalogo(Array.isArray(coches) ? coches : []);
    } catch {
      setCochesCatalogo([]);
    }
  }, []);

  const cargarPartes = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const pendientes = await listarPartesTrabajo({ empleado_id: empleadoId, estado: "pendiente" });
      const enProceso = await listarPartesTrabajo({ empleado_id: empleadoId, estado: "en_proceso" });
      const enPausa = await listarPartesTrabajo({ empleado_id: empleadoId, estado: "en_pausa" });
      setPartes([...(pendientes || []), ...(enProceso || []), ...(enPausa || [])]);
    } catch (e) {
      setError(e?.message || "No se pudieron cargar tus partes.");
      setPartes([]);
    } finally {
      setLoading(false);
    }
  }, [empleadoId]);

  useEffect(() => {
    cargarPartes();
  }, [cargarPartes]);

  useEffect(() => {
    cargarCochesCatalogo();
  }, [cargarCochesCatalogo]);

  const onCambioEstado = async (parteId, estado) => {
    setError("");
    try {
      await cambiarEstadoParte(parteId, estado);
      await cargarPartes();
    } catch (e) {
      setError(e?.message || "No se pudo actualizar el estado.");
    }
  };

  const onQuitarPausa = async (parteId) => {
    setError("");
    try {
      await quitarPausa(parteId);
      await cargarPartes();
    } catch (e) {
      setError(e?.message || "No se pudo quitar la pausa.");
    }
  };

  return (
    <div className="container py-4" style={{ maxWidth: "1200px" }}>
      {/* HEADER PREMIUM */}
      <div
        className="d-flex justify-content-between align-items-center p-3 mb-4 shadow-sm"
        style={{
          background: "#0f0f0f",
          borderRadius: "12px",
          color: "white",
        }}
      >
        <h2 className="fw-bold m-0" style={{ color: "#d4af37", fontSize: "clamp(1.2rem, 4vw, 1.75rem)" }}>
          👨‍🔧 Mis Partes Asignados
        </h2>
        <p className="m-0 d-none d-md-block" style={{ fontSize: "0.85rem", color: "#aaa" }}>
          Gestiona el avance de los trabajos asignados
        </p>
      </div>

      {error && (
        <div className="alert alert-danger alert-dismissible fade show" role="alert">
          <strong>Error:</strong> {error}
          <button type="button" className="btn-close" onClick={() => setError("")}></button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-5">
          <p className="text-muted">Cargando partes...</p>
        </div>
      ) : partes.length === 0 ? (
        <div className="alert alert-info">ℹ️ No tienes partes de trabajo asignados en este momento.</div>
      ) : (
        <>
          {/* TARJETAS en móvil */}
          <div className="d-md-none">
            {partes.map((p) => (
              <div key={p.id} className="card mb-3 shadow-sm" style={{ borderRadius: "12px", borderLeft: "4px solid #d4af37" }}>
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <h6 className="fw-bold mb-0">🚗 {cocheTextoPorId(p.coche_id)}</h6>
                    <EstadoBadge estado={p.estado} />
                  </div>
                  <p className="text-muted small mb-2">
                    {p.observaciones || "Sin descripción"}</p>
                  <p className="text-muted small mb-3">
                    🕐 Inicio: {formatDate(p.fecha_inicio)}
                  </p>
                  <div className="d-flex gap-2 flex-wrap">
                    {p.estado === "pendiente" && (
                      <button className="btn btn-success btn-sm w-100" onClick={() => onCambioEstado(p.id, "en_proceso")}>
                        ▶️ Empezar
                      </button>
                    )}
                    {p.estado === "en_proceso" && (
                      <>
                        <button className="btn btn-warning btn-sm flex-fill" onClick={() => onCambioEstado(p.id, "en_pausa")}>
                          ⏸️ Pausar
                        </button>
                        <button className="btn btn-success btn-sm flex-fill" onClick={() => onCambioEstado(p.id, "finalizado")}>
                          ✅ Finalizar
                        </button>
                      </>
                    )}
                    {p.estado === "en_pausa" && (
                      <button className="btn btn-outline-primary btn-sm w-100" onClick={() => onQuitarPausa(p.id)}>
                        ▶️ Reanudar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* TABLA en desktop */}
          <div className="d-none d-md-block table-responsive">
            <table className="table table-hover" style={{ borderRadius: "12px", overflow: "hidden" }}>
              <thead style={{ background: "#f8f9fa" }}>
                <tr>
                  <th>ID</th>
                  <th>Coche</th>
                  <th>Estado</th>
                  <th>Trabajo</th>
                  <th>Inicio</th>
                  <th>Duración (h)</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {partes.map((p) => (
                  <tr key={p.id}>
                    <td>#{p.id}</td>
                    <td>{cocheTextoPorId(p.coche_id)}</td>
                    <td><EstadoBadge estado={p.estado} /></td>
                    <td>{p.observaciones || "-"}</td>
                    <td className="small">{formatDate(p.fecha_inicio)}</td>
                    <td>{typeof p.duracion_horas === "number" ? p.duracion_horas.toFixed(2) : "-"}</td>
                    <td>
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                        {p.estado === "pendiente" && (
                          <button className="btn btn-sm btn-success" onClick={() => onCambioEstado(p.id, "en_proceso")}>
                            ▶️ Empezar
                          </button>
                        )}
                        {p.estado === "en_proceso" && (
                          <>
                            <button className="btn btn-sm btn-warning" onClick={() => onCambioEstado(p.id, "en_pausa")}>
                              ⏸️ Pausar
                            </button>
                            <button className="btn btn-sm btn-success" onClick={() => onCambioEstado(p.id, "finalizado")}>
                              ✅ Finalizar
                            </button>
                          </>
                        )}
                        {p.estado === "en_pausa" && (
                          <button className="btn btn-sm btn-outline-primary" onClick={() => onQuitarPausa(p.id)}>
                            ▶️ Reanudar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
