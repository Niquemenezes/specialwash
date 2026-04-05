import React, { useCallback, useEffect, useState } from "react";
import {
  listarPartesTrabajo,
  tomarParteTrabajo,
  cambiarEstadoParte,
  quitarPausa,
  crearParteTrabajo,
  crearParteInterno,
  sumarmeACoche,
  editarParteTrabajo,
  eliminarParteTrabajo,
  listarCochesParaCrearParte,
  listarCochesCatalogo,
  listarEmpleadosDisponibles,
  listarServiciosCatalogo,
  obtenerUltimaInspeccionPorCoche,
  reporteEmpleados,
  formatDate,
  formatShortDate,
  formatMinutes,
  parseHoursToMinutes,
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


function deviationBadge(desviacionMinutos) {
  if (!Number.isFinite(Number(desviacionMinutos))) return <span className="text-muted">-</span>;
  const value = Number(desviacionMinutos);
  let cls = "bg-success";
  if (value > 30) cls = "bg-danger";
  else if (value > 10) cls = "bg-warning text-dark";
  return <span className={`badge ${cls}`}>{`${value > 0 ? "+" : ""}${value} min`}</span>;
}

const TIPO_TAREA_OPTIONS = [
  { value: "pintura", label: "🎨 Pintor / Pintura" },
  { value: "detailing", label: "🚿 Detailing / Lavado" },
  { value: "tapicero", label: "🪡 Tapicero / Tapicería" },
  { value: "otro", label: "🔧 Empleado general / Otro" },
];

function normalizeTipoTarea(tipo) {
  const normalized = String(tipo || "").trim().toLowerCase();
  if (!normalized) return "";
  if (normalized === "tapiceria" || normalized === "tapicería") return "tapicero";
  if (["pintura", "detailing", "tapicero", "otro"].includes(normalized)) return normalized;
  return "";
}

function resolverTipoTareaServicio(item) {
  return (
    normalizeTipoTarea(item?.tipo_tarea) ||
    normalizeTipoTarea(item?.rol_responsable) ||
    normalizeTipoTarea(item?.rol) ||
    ""
  );
}

function getTipoTareaLabel(tipoTarea) {
  const normalized = normalizeTipoTarea(tipoTarea);
  return TIPO_TAREA_OPTIONS.find((item) => item.value === normalized)?.label || "Sin área";
}

export function AdminPartesTrabajo() {
  const [partes, setPartes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [empleadoFiltro, setEmpleadoFiltro] = useState("");
  const [cocheFiltro, setCocheFiltro] = useState("");
  const [nuevoCocheId, setNuevoCocheId] = useState("");
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
  const [serviciosRecepcionSugeridos, setServiciosRecepcionSugeridos] = useState([]);
  const [nuevoServicioManualNombre, setNuevoServicioManualNombre] = useState("");
  const [nuevoServicioManualPrecio, setNuevoServicioManualPrecio] = useState("");
  const [nuevoServicioManualHoras, setNuevoServicioManualHoras] = useState("");
  const [nuevoServicioManualTipoTarea, setNuevoServicioManualTipoTarea] = useState("");

  const [showReporte, setShowReporte] = useState(false);
  const [reporte, setReporte] = useState([]);
  const [loadingReporte, setLoadingReporte] = useState(false);
  const [reporteFechaInicio, setReporteFechaInicio] = useState("");
  const [reporteFechaFin, setReporteFechaFin] = useState("");
  const colaboracionPorCoche = Object.values(
    (reporte || []).reduce((acc, emp) => {
      const nombreEmpleado = emp?.nombre || `Empleado ${emp?.empleado_id || "?"}`;
      for (const p of emp?.partes || []) {
        if (p?.es_tarea_interna) continue;
        const key = String(p?.matricula || `#${p?.coche_id || "?"}`);
        if (!acc[key]) {
          acc[key] = {
            key,
            matricula: p?.matricula || `#${p?.coche_id || "?"}`,
            marca: p?.marca || "",
            modelo: p?.modelo || "",
            totalMinutos: 0,
            empleados: {},
          };
        }
        const mins = Number(p?.duracion_minutos || 0);
        acc[key].totalMinutos += mins;
        acc[key].empleados[nombreEmpleado] = (acc[key].empleados[nombreEmpleado] || 0) + mins;
      }
      return acc;
    }, {})
  )
    .map((item) => ({
      ...item,
      totalEmpleados: Object.keys(item.empleados).length,
      desglose: Object.entries(item.empleados)
        .map(([nombre, minutos]) => ({ nombre, minutos }))
        .sort((a, b) => b.minutos - a.minutos),
    }))
    .filter((item) => item.totalEmpleados > 1)
    .sort((a, b) => b.totalMinutos - a.totalMinutos);

  const serviciosSinTiempo = serviciosParteSeleccionados.filter(
    (s) => (Number.parseInt(s.tiempo_estimado_minutos || 0, 10) || 0) <= 0
  );
  const nombresServiciosSinTiempo = serviciosSinTiempo
    .map((s) => String(s.nombre || "").trim())
    .filter(Boolean);
  const hayServiciosSinTiempo = nombresServiciosSinTiempo.length > 0;

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
      const descripcion = [
        coche?.marca,
        coche?.modelo,
        coche?.coche_descripcion,
      ]
        .map((v) => String(v || "").trim())
        .filter(Boolean)
        .join(" ");

      const base = [coche?.matricula, descripcion].filter(Boolean).join(" · ");
      return `${base}${coche?.cliente_nombre ? ` - ${coche.cliente_nombre}` : ""}`;
    },
    [cochesDisponibles, cochesCatalogo]
  );

  const serviciosSinTipo = serviciosParteSeleccionados.filter(
    (s) => String(s.origen || "") === "manual" && !String(s.tipo_tarea || "").trim()
  );
  const hayServiciosSinTipo = serviciosSinTipo.length > 0;

  const groupByDate = (partesArray) => {
    const grupos = {};
    partesArray.forEach((p) => {
      const fecha = p.fecha_inicio ? new Date(p.fecha_inicio).toLocaleDateString("es-ES") : "Sin fecha";
      if (!grupos[fecha]) grupos[fecha] = [];
      grupos[fecha].push(p);
    });
    // Dentro de cada fecha, ordenar por coche_id para que rowSpan funcione
    return Object.entries(grupos)
      .sort((a, b) => new Date(b[0]) - new Date(a[0]))
      .map(([fecha, lista]) => [fecha, [...lista].sort((a, b) => a.coche_id - b.coche_id)]);
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

  useEffect(() => {
    const iv = setInterval(() => cargarPartes(), 30000);
    return () => clearInterval(iv);
  }, [cargarPartes]);

  const cargarReporte = useCallback(async () => {
    setLoadingReporte(true);
    try {
      const data = await reporteEmpleados({ fecha_inicio: reporteFechaInicio, fecha_fin: reporteFechaFin });
      setReporte(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e?.message || "No se pudo cargar el reporte de empleados.");
    } finally {
      setLoadingReporte(false);
    }
  }, [reporteFechaInicio, reporteFechaFin]);

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
        setServiciosRecepcionSugeridos([]);
        return;
      }

      // Al cambiar de coche, empieza sin servicios para permitir añadir solo nuevos.
      setServiciosParteSeleccionados([]);

      try {
        const inspeccion = await obtenerUltimaInspeccionPorCoche(nuevoCocheId);
        if (!active) return;

        const desdeRecepcion = Array.isArray(inspeccion?.servicios_aplicados)
          ? inspeccion.servicios_aplicados.map((s, idx) => ({
              key: `rec-${s?.servicio_catalogo_id || "x"}-${idx}`,
              nombre: String(s?.nombre || "").trim(),
              precio: Number(s?.precio || 0),
              tiempo_estimado_minutos: Number.parseInt(s?.tiempo_estimado_minutos || 0, 10) || 0,
              origen: "recepcion",
              servicio_catalogo_id: s?.servicio_catalogo_id ?? null,
              tipo_tarea: resolverTipoTareaServicio(s),
            }))
          : [];

        const limpios = desdeRecepcion.filter((s) => s.nombre);
        setServiciosRecepcionSugeridos(limpios);
      } catch {
        if (active) setServiciosRecepcionSugeridos([]);
      }
    };

    cargarServiciosDesdeInspeccion();
    return () => {
      active = false;
    };
  }, [nuevoCocheId]);

  const cargarServiciosSugeridos = () => {
    if (!Array.isArray(serviciosRecepcionSugeridos) || serviciosRecepcionSugeridos.length === 0) return;
    setServiciosParteSeleccionados((prev) => {
      const existentes = new Set(prev.map((s) => `${s.servicio_catalogo_id || "x"}-${String(s.nombre || "").toLowerCase()}`));
      const nuevos = serviciosRecepcionSugeridos.filter(
        (s) => !existentes.has(`${s.servicio_catalogo_id || "x"}-${String(s.nombre || "").toLowerCase()}`)
      );
      return [...prev, ...nuevos.map((s, idx) => ({ ...s, key: `${s.key || "rec"}-${Date.now()}-${idx}` }))];
    });
  };

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
      const tipoCatalogo = resolverTipoTareaServicio(servicioElegido);
      return [
        ...prev,
        {
          key: `extra-${servicioElegido.id}`,
          nombre,
          precio: Number(servicioElegido.precio_base || 0),
          tiempo_estimado_minutos: Number.parseInt(servicioElegido.tiempo_estimado_minutos || 0, 10) || 0,
          origen: "extra",
          servicio_catalogo_id: servicioElegido.id,
          tipo_tarea: tipoCatalogo || "otro",
        },
      ];
    });
    setNuevoServicioId("");
    setMensajeCreacion("");
  };

  const agregarServicioManual = () => {
    const nombre = String(nuevoServicioManualNombre || "").trim();
    if (!nombre) {
      setMensajeCreacion("Debes escribir el nombre del servicio manual.");
      return;
    }

    const precioRaw = String(nuevoServicioManualPrecio || "").trim();
    const precio = precioRaw === "" ? 0 : Number(precioRaw);
    if (!Number.isFinite(precio) || precio < 0) {
      setMensajeCreacion("El precio manual debe ser un número válido mayor o igual a 0.");
      return;
    }

    const tiempoEstimadoMin = parseHoursToMinutes(nuevoServicioManualHoras);
    if (tiempoEstimadoMin === null) {
      setMensajeCreacion("Las horas estimadas deben ser un número válido mayor o igual a 0.");
      return;
    }

    const tipoManual = normalizeTipoTarea(nuevoServicioManualTipoTarea);
    if (!tipoManual) {
      setMensajeCreacion("Debes indicar el rol/área para el servicio manual.");
      return;
    }

    setServiciosParteSeleccionados((prev) => {
      return [
        ...prev,
        {
          key: `manual-${Date.now()}`,
          nombre,
          precio: Math.round(precio * 100) / 100,
          tiempo_estimado_minutos: tiempoEstimadoMin,
          origen: "manual",
          servicio_catalogo_id: null,
          tipo_tarea: tipoManual,
        },
      ];
    });

    setNuevoServicioManualNombre("");
    setNuevoServicioManualPrecio("");
    setNuevoServicioManualHoras("");
    setNuevoServicioManualTipoTarea("");
    setMensajeCreacion("");
  };

  const quitarServicioSeleccionado = (key) => {
    setServiciosParteSeleccionados((prev) => prev.filter((s) => s.key !== key));
  };

  const actualizarTipoServicio = (key, tipoTarea) => {
    setServiciosParteSeleccionados((prev) => prev.map((s) => (
      s.key === key ? { ...s, tipo_tarea: tipoTarea } : s
    )));
  };

  const onCrearParte = async (e) => {
    e.preventDefault();
    setMensajeCreacion("");

    if (!nuevoCocheId) {
      setMensajeCreacion("Debes seleccionar un coche.");
      return;
    }

    if (serviciosParteSeleccionados.length === 0) {
      setMensajeCreacion("Debes añadir al menos un servicio para el parte.");
      return;
    }

    if (hayServiciosSinTipo) {
      setMensajeCreacion("Todos los servicios deben tener un rol o área asignado antes de crear el parte.");
      return;
    }

    const trabajoFinal = serviciosParteSeleccionados
      .map((s) => s.nombre)
      .filter(Boolean)
      .join(" | ");

    const tiposUnicos = Array.from(new Set(
      serviciosParteSeleccionados.map((s) => String(s.tipo_tarea || "").trim()).filter(Boolean)
    ));

    const payload = {
      coche_id: Number(nuevoCocheId),
      observaciones: trabajoFinal,
      tipo_tarea: tiposUnicos.length === 1 ? tiposUnicos[0] : null,
      tiempo_estimado_minutos: serviciosParteSeleccionados.reduce(
        (acc, s) => acc + (Number.parseInt(s.tiempo_estimado_minutos || 0, 10) || 0),
        0
      ),
      servicios: serviciosParteSeleccionados.map((s) => ({
        nombre: String(s.nombre || "").trim(),
        tiempo_estimado_minutos: Number.parseInt(s.tiempo_estimado_minutos || 0, 10) || 0,
        servicio_catalogo_id: s.servicio_catalogo_id ?? null,
        precio: Number(s.precio || 0),
        origen: s.origen || "manual",
        tipo_tarea: s.tipo_tarea || null,
      })),
    };

    try {
      await crearParteTrabajo(payload);
      setMensajeCreacion("Parte creado correctamente.");
      setNuevoCocheId("");
      setNuevoServicioId("");
      setNuevoServicioManualNombre("");
      setNuevoServicioManualPrecio("");
      setNuevoServicioManualHoras("");
      setNuevoServicioManualTipoTarea("");
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

  const onEliminarParte = async (parte) => {
    const confirmado = window.confirm(
      `Vas a eliminar el parte #${parte.id} (${parte.matricula || `coche ${parte.coche_id}`}). Esta acción no se puede deshacer.\n\n¿Deseas continuar?`
    );
    if (!confirmado) return;

    setError("");
    try {
      await eliminarParteTrabajo(parte.id);
      await cargarPartes();
    } catch (e) {
      setError(e?.message || "No se pudo eliminar el parte.");
    }
  };

  const onFinalizarGrupo = async (ids) => {
    setError("");
    try {
      for (const id of ids) await cambiarEstadoParte(id, "finalizado");
      await cargarPartes();
    } catch (e) {
      setError(e?.message || "No se pudo finalizar el grupo.");
    }
  };

  const onReanudarGrupo = async (ids) => {
    setError("");
    try {
      for (const id of ids) await quitarPausa(id);
      await cargarPartes();
    } catch (e) {
      setError(e?.message || "No se pudo reanudar el grupo.");
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
        tiempo_estimado_minutos: Number.parseInt(servicioElegido?.tiempo_estimado_minutos || 0, 10) || 0,
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
              <p className="text-muted mb-2">🚗 Coches disponibles para planificar</p>
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
              <label className="form-label">Coche *</label>
              <select
                className="form-select"
                value={nuevoCocheId}
                onChange={(e) => setNuevoCocheId(e.target.value)}
                disabled={loadingRecursos}
                required
                style={{ borderRadius: "8px" }}
              >
                <option value="">Selecciona coche...</option>
                {cochesDisponibles.map((c) => {
                  const fechaUltima = formatShortDate(c.fecha_inspeccion);
                  const metaInspeccion = c.ultima_inspeccion_id
                    ? ` · Últ. insp #${c.ultima_inspeccion_id}${fechaUltima ? ` (${fechaUltima})` : ""}`
                    : "";
                  const metaActivos = Number(c.partes_activas || 0) > 0
                    ? ` · ${c.partes_activas} parte(s) activa(s)`
                    : "";
                  return (
                    <option key={c.coche_id} value={c.coche_id}>
                      {c.matricula} {c.coche_descripcion ? ` - ${c.coche_descripcion}` : ""} {c.cliente_nombre ? ` - ${c.cliente_nombre}` : ""}{metaInspeccion}{metaActivos}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="col-12">
              <label className="form-label">Servicios del parte *</label>
              {hayServiciosSinTiempo && (
                <div className="alert alert-warning py-2" role="alert">
                  Hay servicios sin tiempo estimado: {nombresServiciosSinTiempo.join(", ")}. El parte se creará igualmente y estos servicios contarán como 0 min.
                </div>
              )}
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

              <div className="row g-2 mt-2">
                <div className="col-12 col-md-4">
                  <input
                    type="text"
                    className="form-control"
                    value={nuevoServicioManualNombre}
                    onChange={(e) => setNuevoServicioManualNombre(e.target.value)}
                    placeholder="Servicio manual (ej. Pulido de faros)"
                    style={{ borderRadius: "8px" }}
                  />
                </div>
                <div className="col-12 col-md-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-control"
                    value={nuevoServicioManualPrecio}
                    onChange={(e) => setNuevoServicioManualPrecio(e.target.value)}
                    placeholder="Precio (€)"
                    style={{ borderRadius: "8px" }}
                  />
                </div>
                <div className="col-12 col-md-2">
                  <input
                    type="number"
                    step="0.25"
                    min="0"
                    className="form-control"
                    value={nuevoServicioManualHoras}
                    onChange={(e) => setNuevoServicioManualHoras(e.target.value)}
                    placeholder="Horas"
                    style={{ borderRadius: "8px" }}
                  />
                </div>
                <div className="col-12 col-md-2">
                  <select
                    className="form-select"
                    value={nuevoServicioManualTipoTarea}
                    onChange={(e) => setNuevoServicioManualTipoTarea(e.target.value)}
                    style={{ borderRadius: "8px" }}
                  >
                    <option value="">Rol</option>
                    {TIPO_TAREA_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div className="col-12 col-md-2 d-grid">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={agregarServicioManual}
                  >
                    Añadir manual
                  </button>
                </div>
              </div>
              <small className="text-muted d-block mt-2">
                Catálogo: rol automático. Manual: indica rol y horas, luego añade.
              </small>
              {serviciosRecepcionSugeridos.length > 0 && (
                <div className="mt-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary"
                    onClick={cargarServiciosSugeridos}
                  >
                    Cargar servicios de recepción ({serviciosRecepcionSugeridos.length})
                  </button>
                </div>
              )}
              <small className="text-muted d-block mt-1">
                Al elegir coche no se cargan servicios automáticamente para que puedas añadir solo lo nuevo.
              </small>

              <div className="mt-2">
                {serviciosParteSeleccionados.length === 0 ? (
                  <div className="text-muted small">No hay servicios seleccionados todavía.</div>
                ) : (
                  <div>
                    {hayServiciosSinTipo && (
                      <div className="alert alert-warning py-2 mb-2" role="alert">
                        Hay servicios manuales sin área asignada. Selecciona un rol antes de crear.
                      </div>
                    )}
                    <div className="d-flex flex-wrap gap-2">
                      {serviciosParteSeleccionados.map((s) => (
                        <div key={s.key} className="border rounded p-2 bg-light" style={{ minWidth: "280px" }}>
                          <div className="d-flex justify-content-between align-items-start gap-2">
                            <div>
                              <div className="fw-semibold">{s.nombre}</div>
                              <div className="small text-muted">
                                {Number.isFinite(s.precio) ? `${Number(s.precio).toFixed(2)}€ · ` : ""}
                                {formatMinutes(Number.parseInt(s.tiempo_estimado_minutos || 0, 10) || 0)}
                              </div>
                            </div>
                            <button
                              type="button"
                              className="btn btn-sm btn-light py-0 px-1"
                              onClick={() => quitarServicioSeleccionado(s.key)}
                              title="Quitar servicio"
                            >
                              ×
                            </button>
                          </div>
                          {String(s.origen || "") === "manual" ? (
                            <div className="mt-2">
                              <label className="form-label small mb-1">Área de este servicio</label>
                              <select
                                className="form-select form-select-sm"
                                value={s.tipo_tarea || ""}
                                onChange={(e) => actualizarTipoServicio(s.key, e.target.value)}
                              >
                                <option value="">Selecciona área...</option>
                                {TIPO_TAREA_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                              </select>
                              <div className="small text-muted mt-1">{getTipoTareaLabel(s.tipo_tarea)}</div>
                            </div>
                          ) : (
                            <div className="small text-muted mt-2">
                              Área automática: <strong>{getTipoTareaLabel(s.tipo_tarea)}</strong>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <small className="text-muted d-block mt-2">
                      Tiempo estimado total del parte: {formatMinutes(serviciosParteSeleccionados.reduce(
                        (acc, s) => acc + (Number.parseInt(s.tiempo_estimado_minutos || 0, 10) || 0),
                        0
                      ))}
                    </small>
                  </div>
                )}
              </div>
            </div>

            <div className="col-12">
              <button
                type="submit"
                className="btn btn-dark"
                style={{ borderColor: "#d4af37" }}
                disabled={loadingRecursos || hayServiciosSinTipo}
              >
                ✅ Crear partes
              </button>
              {mensajeCreacion && <span className="ms-2 text-success">{mensajeCreacion}</span>}
            </div>

            {!loadingRecursos && cochesDisponibles.length === 0 && (
              <div className="col-12">
                <div className="alert alert-info">No hay coches disponibles para planificar en este momento.</div>
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
          {groupByDate(partes).map(([fecha, grupoPartes]) => {
            // Agrupar por coche dentro de cada fecha
            const cocheGrupos = Object.values(
              grupoPartes.reduce((acc, p) => {
                const k = p.coche_id;
                if (!acc[k]) acc[k] = { coche_id: k, partes: [] };
                acc[k].partes.push(p);
                return acc;
              }, {})
            );
            return (
              <div key={fecha} className="mb-4">
                <h5 className="mb-3" style={{ color: "#d4af37", fontWeight: "600" }}>📅 {fecha}</h5>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {cocheGrupos.map(({ coche_id, partes: cp }) => {
                    const estadoGlobal = cp.some(p => p.estado === "en_proceso") ? "en_proceso"
                      : cp.some(p => p.estado === "en_pausa") ? "en_pausa"
                      : "pendiente";
                    const ids = cp.map(p => p.id);
                    const parteRef = cp.find(p => p.fecha_inicio) || cp[0];
                    const identidad = cp.reduce(
                      (acc, p) => ({
                        matricula: acc.matricula || p?.matricula || "",
                        marca: acc.marca || p?.marca || "",
                        modelo: acc.modelo || p?.modelo || "",
                        cliente: acc.cliente || p?.cliente_nombre || "",
                      }),
                      { matricula: "", marca: "", modelo: "", cliente: "" }
                    );
                    const marcaModelo = [identidad.marca, identidad.modelo].filter(Boolean).join(" ");
                    const tituloCoche = [identidad.matricula || `#${coche_id}`, marcaModelo].filter(Boolean).join(" · ");

                    // Empleados únicos del coche
                    const empleadosUnicos = [...new Map(
                      cp.filter(p => p.empleado_id).map(p => [p.empleado_id, empleadoNombrePorId(p.empleado_id)])
                    ).values()];

                    // Tiempo estimado total
                    const estimadoTotal = cp.reduce((sum, p) => sum + (p.tiempo_estimado_minutos || 0), 0);

                    return (
                      <div key={coche_id} className="card shadow-sm" style={{ borderRadius: "10px", overflow: "hidden" }}>
                        {/* Cabecera del coche */}
                        <div className="card-header py-2">
                          <div className="d-flex justify-content-between align-items-center">
                            <div>
                              <strong>{tituloCoche}</strong>
                              {identidad.cliente && (
                                <div className="small text-muted">👤 {identidad.cliente}</div>
                              )}
                            </div>
                            <EstadoBadge estado={estadoGlobal} />
                          </div>
                          <div className="d-flex gap-3 mt-1" style={{ fontSize: "0.85rem", opacity: 0.8 }}>
                            <span>👤 {empleadosUnicos.length > 0 ? empleadosUnicos.join(", ") : <em>Sin asignar</em>}</span>
                            <span>⏱ {formatMinutes(estimadoTotal)}</span>
                            <Cronometro parte={{ ...parteRef, estado: estadoGlobal }} />
                          </div>
                        </div>
                        {/* Servicios — edición y borrado individual por servicio */}
                        <table className="table table-sm mb-0">
                          <tbody>
                            {cp.map(p => (
                              <tr key={p.id}>
                                <td className="text-muted small ps-3">#{p.id}</td>
                                <td>{p.observaciones || getTipoTareaLabel(p.tipo_tarea)}</td>
                                <td className="text-end pe-3">
                                  <div className="d-inline-flex gap-2">
                                    <button
                                      className="btn btn-sm btn-outline-secondary"
                                      onClick={() => onAbrirEditar(p)}
                                      title="Editar este servicio"
                                    >
                                      ✏️
                                    </button>
                                    <button
                                      className="btn btn-sm btn-outline-danger"
                                      onClick={() => onEliminarParte(p)}
                                      title="Borrar solo este servicio"
                                    >
                                      🗑️
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {/* Botones del coche */}
                        <div className="card-footer d-flex gap-2 py-2">
                          {estadoGlobal === "en_pausa" && (
                            <button className="btn btn-sm btn-outline-primary" onClick={() => onReanudarGrupo(ids)}>
                              ▶️ Reanudar
                            </button>
                          )}
                          <span className="ms-auto text-muted small align-self-center">Borrado individual por servicio</span>
                          <button className="btn btn-sm btn-success" onClick={() => onFinalizarGrupo(ids)}>
                            ✅ Finalizar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="card mb-4 shadow-sm" style={{ borderRadius: "12px", border: "1px solid #e0e0e0" }}>
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="card-title fw-semibold mb-0">📊 Tiempo trabajado por empleado</h5>
            <button
              className="btn btn-outline-dark btn-sm"
              onClick={() => {
                const next = !showReporte;
                setShowReporte(next);
                if (next) cargarReporte();
              }}
            >
              {showReporte ? "Ocultar" : "Ver reporte"}
            </button>
          </div>
          {showReporte && (
            <>
              <div className="row g-2 mb-3 align-items-end">
                <div className="col-md-4">
                  <label className="form-label small mb-1">Desde</label>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    value={reporteFechaInicio}
                    onChange={(e) => setReporteFechaInicio(e.target.value)}
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label small mb-1">Hasta</label>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    value={reporteFechaFin}
                    onChange={(e) => setReporteFechaFin(e.target.value)}
                  />
                </div>
                <div className="col-md-4">
                  <button
                    className="btn btn-dark btn-sm w-100"
                    onClick={cargarReporte}
                    disabled={loadingReporte}
                    style={{ borderColor: "#d4af37" }}
                  >
                    {loadingReporte ? "Cargando..." : "🔄 Actualizar"}
                  </button>
                </div>
              </div>

              {reporte.length === 0 && !loadingReporte && (
                <p className="text-muted">Sin datos para el período seleccionado.</p>
              )}

              {colaboracionPorCoche.length > 0 && (
                <div className="mb-3 p-3 rounded" style={{ background: "#eef7ff", border: "1px solid #cfe6ff" }}>
                  <div className="fw-semibold mb-2">🤝 Coches con colaboración entre empleados</div>
                  <div className="table-responsive">
                    <table className="table table-sm mb-0">
                      <thead>
                        <tr>
                          <th>Coche</th>
                          <th>Empleados</th>
                          <th>Tiempo total coche</th>
                          <th>Desglose</th>
                        </tr>
                      </thead>
                      <tbody>
                        {colaboracionPorCoche.map((c) => (
                          <tr key={c.key}>
                            <td>{[c.matricula, c.marca, c.modelo].filter(Boolean).join(" · ")}</td>
                            <td>{c.totalEmpleados}</td>
                            <td><strong>{formatMinutes(c.totalMinutos)}</strong></td>
                            <td className="small text-muted">
                              {c.desglose.map((d) => `${d.nombre}: ${formatMinutes(d.minutos)}`).join(" · ")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {reporte.map((emp) => (
                <div key={emp.empleado_id} className="mb-3 p-3 rounded" style={{ background: "#f8f9fa" }}>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <strong>👤 {emp.nombre} {emp.rol ? `· ${emp.rol}` : ""}</strong>
                    <div className="d-flex flex-column align-items-end gap-1">
                      <span className="badge bg-dark" style={{ color: "#d4af37" }}>
                        {formatMinutes(emp.total_minutos)} · {emp.total_partes} partes
                      </span>
                      <small className="text-muted">
                        🚗 Coche: {formatMinutes(emp.total_minutos_coche || 0)} · 🧹 Interno: {formatMinutes(emp.total_minutos_interno || 0)}
                      </small>
                    </div>
                  </div>
                  <div className="table-responsive">
                    <table className="table table-sm mb-0">
                      <thead>
                        <tr>
                          <th>Matrícula</th>
                          <th>Registro</th>
                          <th>Tipo</th>
                          <th>Estado</th>
                          <th>Tiempo real</th>
                          <th>Estimado</th>
                          <th>Inicio</th>
                        </tr>
                      </thead>
                      <tbody>
                        {emp.partes.map((p) => (
                          <tr key={p.parte_id}>
                            <td>{p.matricula || `#${p.coche_id}`}</td>
                            <td>
                              {p.es_tarea_interna
                                ? <span className="badge bg-secondary">Interno</span>
                                : <span className="badge bg-primary">Coche</span>}
                            </td>
                            <td>{p.tipo_tarea || "-"}</td>
                            <td><EstadoBadge estado={p.estado} /></td>
                            <td><strong>{formatMinutes(p.duracion_minutos)}</strong></td>
                            <td className="text-muted">{formatMinutes(p.tiempo_estimado_minutos)}</td>
                            <td className="small text-muted">
                              {p.fecha_inicio ? new Date(p.fecha_inicio).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

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

// ── Cronómetro en tiempo real ─────────────────────────────────────────────────
function calcularSegundos(parte) {
  if (!parte.fecha_inicio) return 0;
  const inicio = new Date(parte.fecha_inicio).getTime();
  const ahora = Date.now();
  let pausado = 0;
  if (parte.pausas) {
    try {
      const pausas = JSON.parse(parte.pausas);
      for (const p of pausas) {
        if (!p || !p[0]) continue;
        const pI = new Date(p[0]).getTime();
        const pF = p[1] ? new Date(p[1]).getTime() : ahora;
        if (pF > pI) pausado += pF - pI;
      }
    } catch { /* ignore */ }
  }
  return Math.max(0, Math.floor((ahora - inicio - pausado) / 1000));
}

function formatCrono(s) {
  const total = Math.max(0, Math.floor(s));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const ss = total % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m ${String(ss).padStart(2, "0")}s`;
  return `${String(m).padStart(2, "0")}m ${String(ss).padStart(2, "0")}s`;
}

function Cronometro({ parte }) {
  const [segs, setSegs] = useState(() => calcularSegundos(parte));

  useEffect(() => {
    setSegs(calcularSegundos(parte));
    if (parte.estado !== "en_proceso") return;
    const iv = setInterval(() => setSegs(calcularSegundos(parte)), 1000);
    return () => clearInterval(iv);
  }, [parte]);

  if (!parte.fecha_inicio) return <span className="text-muted">—</span>;

  if (parte.estado === "en_pausa") {
    return <span className="sw-timer sw-timer-paused">⏸ {formatCrono(segs)}</span>;
  }
  if (parte.estado === "en_proceso") {
    return <span className="sw-timer sw-timer-running">▶ {formatCrono(segs)}</span>;
  }
  return <span className="sw-timer sw-timer-done">✓ {formatCrono(segs)}</span>;
}

// ── Categorías de trabajo ─────────────────────────────────────────────────────

// ── Tarjeta de coche: un timer y un set de botones para todos los servicios ───
function CocheGrupoCard({ grupo, empleadoId, userRol, onIniciarGrupo, onPausarGrupo, onFinalizarGrupo, onSumarmeCoche, cargando }) {
  const { matricula, marca, modelo, cliente_nombre, partes } = grupo;
  const descCoche = [marca, modelo].filter(Boolean).join(" ");

  // Estado global del grupo: en_proceso > en_pausa > pendiente
  const estadoGlobal = partes.some(p => p.estado === "en_proceso") ? "en_proceso"
    : partes.some(p => p.estado === "en_pausa") ? "en_pausa"
    : "pendiente";

  const yoId = Number(empleadoId);
  const rolNormalizado = String(userRol || "").toLowerCase();
  const esAdmin = rolNormalizado === "administrador" || rolNormalizado === "admin" || rolNormalizado === "administrator";
  const hayOtroTrabajando = partes.some(
    (p) => (p.estado === "en_proceso" || p.estado === "en_pausa") && Number(p.empleado_id) !== yoId
  );
  const esTareaInterna = Boolean(grupo.es_tarea_interna);

  const idsGrupo = partes.map((p) => p.id);
  const idsPausables = partes
    .filter((p) => p.estado === "en_proceso" && (esAdmin || Number(p.empleado_id) === yoId))
    .map((p) => p.id);
  const idsFinalizables = partes
    .filter((p) => (p.estado === "en_proceso" || p.estado === "en_pausa") && (esAdmin || Number(p.empleado_id) === yoId))
    .map((p) => p.id);
  const aportesPorEmpleado = Object.values(
    partes.reduce((acc, p) => {
      const empleadoKey = Number(p.empleado_id) || 0;
      if (!acc[empleadoKey]) {
        acc[empleadoKey] = {
          empleado_id: empleadoKey,
          nombre: p.empleado_nombre || (empleadoKey ? `Empleado ${empleadoKey}` : "Sin asignar"),
          minutos: 0,
        };
      }
      acc[empleadoKey].minutos += Number(p.duracion_minutos || 0);
      return acc;
    }, {})
  ).sort((a, b) => b.minutos - a.minutos);
  const hayColaboracion = aportesPorEmpleado.filter((a) => a.empleado_id > 0).length > 1;
  const totalMinutosCoche = aportesPorEmpleado.reduce((sum, a) => sum + Number(a.minutos || 0), 0);
  // Para el cronómetro usamos el primer parte que tenga fecha_inicio
  const parteRef = partes.find(p => p.fecha_inicio) || { ...partes[0], estado: estadoGlobal };

  return (
    <div className={
      `sw-parte-card` +
      (estadoGlobal === "en_proceso" ? " sw-parte-card--active" : "") +
      (estadoGlobal === "en_pausa" ? " sw-parte-card--paused" : "")
    }>
      <div className="sw-parte-card__header">
        <div>
          <span className="sw-parte-card__matricula">{[matricula || `#${partes[0].coche_id}`, descCoche].filter(Boolean).join(" · ")}</span>
          {cliente_nombre && <div className="sw-parte-card__cliente">👤 {cliente_nombre}</div>}
          {hayOtroTrabajando && (
            <div className="mt-1">
              <span className="badge bg-warning text-dark">⚠ Ya hay alguien trabajando en este coche</span>
              {!esTareaInterna && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-light ms-2 py-0"
                  disabled={cargando}
                  onClick={() => onSumarmeCoche(grupo)}
                  title="Crear mi propio parte y empezar"
                >
                  ➕ Trabajar tambien
                </button>
              )}
            </div>
          )}
        </div>
        <EstadoBadge estado={estadoGlobal} />
      </div>

      {/* Lista de servicios del coche */}
      <div style={{ marginTop: "0.5rem", display: "flex", flexDirection: "column", gap: "0.45rem" }}>
        {partes.map((p) => {
          return (
            <div
              key={p.id}
              style={{
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "8px",
                padding: "0.5rem",
                background: "rgba(255,255,255,0.02)",
              }}
            >
              <div className="d-flex justify-content-between align-items-center gap-2 flex-wrap">
                <div style={{ fontSize: "0.85rem" }}>
                  <strong>#{p.id}</strong> · {getTipoTareaLabel(p.tipo_tarea)}
                  {p.observaciones ? ` — ${p.observaciones}` : ""}
                  {(p.estado === "en_proceso" || p.estado === "en_pausa") && p.empleado_nombre && (
                    <span className="text-muted"> · {p.empleado_nombre}</span>
                  )}
                </div>
                <div className="d-flex align-items-center gap-2">
                  <EstadoBadge estado={p.estado} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Timer referencia del coche */}
      <div className="sw-parte-card__footer">
        <Cronometro parte={{ ...parteRef, estado: estadoGlobal }} />
        <div className="sw-parte-card__actions">
          {!esTareaInterna && (
            <>
              <button
                className="sw-parte-btn sw-parte-btn--start"
                disabled={cargando || estadoGlobal === "en_proceso"}
                onClick={() => onIniciarGrupo(idsGrupo)}
              >
                ▶ Iniciar
              </button>
              <button
                className="sw-parte-btn sw-parte-btn--pause"
                disabled={cargando || idsPausables.length === 0}
                onClick={() => onPausarGrupo(idsPausables)}
                title={idsPausables.length === 0 ? "Solo puedes pausar servicios que iniciaste (o todos si eres admin)" : ""}
              >
                ⏸ Pausar
              </button>
              <button
                className="sw-parte-btn sw-parte-btn--finish"
                disabled={cargando || idsFinalizables.length === 0}
                onClick={() => onFinalizarGrupo(idsFinalizables)}
                title={idsFinalizables.length === 0 ? "Solo puedes finalizar servicios que iniciaste (o todos si eres admin)" : ""}
              >
                ✓ Finalizar
              </button>
            </>
          )}
        </div>
      </div>
      <div style={{ marginTop: "0.5rem", fontSize: "0.82rem", opacity: 0.9 }}>
        <div className="d-flex flex-wrap align-items-center gap-2">
          {hayColaboracion && <span className="badge bg-info text-dark">👥 Con ayuda</span>}
          <span>⏱ Total coche: <strong>{formatMinutes(totalMinutosCoche)}</strong></span>
        </div>
        {aportesPorEmpleado.length > 0 && (
          <div className="mt-1 text-muted">
            {aportesPorEmpleado.map((a) => `${a.nombre}: ${formatMinutes(a.minutos)}`).join(" · ")}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Componente principal vista empleado ───────────────────────────────────────
// Mapeo rol → tipo_tarea para que cada empleado solo vea sus partes
const ROL_TO_TIPO = {
  pintura: "pintura",
  detailing: "detailing",
  tapicero: "tapicero",
  empleado: "otro",
};

export function EmpleadoPartesTrabajo({ empleadoId, userRol = "", panelTitle, panelSubtitle }) {
  const [partes, setPartes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [accionCargando, setAccionCargando] = useState(false);
  const [error, setError] = useState("");
  const [tareaInternaTexto, setTareaInternaTexto] = useState("");
  const [tareaInternaLoading, setTareaInternaLoading] = useState(false);

  const cargarPartes = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const tipoRol = ROL_TO_TIPO[userRol?.toLowerCase()] || "";
      const [pendientes, enProceso, enPausa] = await Promise.all([
        listarPartesTrabajo({
          estado: "pendiente",
          ...(tipoRol ? { tipo_tarea: tipoRol } : {}),
        }),
        listarPartesTrabajo({ estado: "en_proceso", ...(tipoRol ? { tipo_tarea: tipoRol } : {}) }),
        listarPartesTrabajo({ estado: "en_pausa", ...(tipoRol ? { tipo_tarea: tipoRol } : {}) }),
      ]);
      const merged = [...(pendientes || []), ...(enProceso || []), ...(enPausa || [])];
      const seen = new Set();
      const dedup = [];
      for (const p of merged) {
        const id = Number(p?.id);
        if (!Number.isFinite(id) || seen.has(id)) continue;
        seen.add(id);
        dedup.push(p);
      }
      setPartes(dedup);
    } catch (e) {
      setError(e?.message || "No se pudieron cargar los trabajos.");
    } finally {
      setLoading(false);
    }
  }, [empleadoId, userRol]);

  useEffect(() => { cargarPartes(); }, [cargarPartes]);

  const onCrearTareaInterna = useCallback(async () => {
    const texto = String(tareaInternaTexto || "").trim();
    if (!texto) {
      setError("Escribe la tarea interna (ej. limpiar baño)");
      return;
    }
    setError("");
    setTareaInternaLoading(true);
    try {
      const tipo = ROL_TO_TIPO[userRol?.toLowerCase()] || "otro";
      await crearParteInterno({
        observaciones: texto,
        tipo_tarea: tipo,
        tiempo_estimado_minutos: 0,
      });
      setTareaInternaTexto("");
      await cargarPartes();
    } catch (e) {
      setError(e?.message || "No se pudo crear la tarea interna.");
    } finally {
      setTareaInternaLoading(false);
    }
  }, [cargarPartes, tareaInternaTexto, userRol]);

  const onIniciarGrupo = useCallback(async (ids) => {
    setError("");
    setAccionCargando(true);
    try {
      for (const id of ids) {
        await tomarParteTrabajo(id);
        await cambiarEstadoParte(id, "en_proceso");
      }
      await cargarPartes();
    } catch (e) {
      setError(e?.message || "No se pudo iniciar el trabajo.");
    } finally {
      setAccionCargando(false);
    }
  }, [cargarPartes]);

  const onPausarGrupo = useCallback(async (ids) => {
    if (!Array.isArray(ids) || ids.length === 0) {
      setError("Solo puedes pausar servicios que iniciaste.");
      return;
    }
    setError("");
    setAccionCargando(true);
    try {
      for (const id of ids) await cambiarEstadoParte(id, "en_pausa");
      await cargarPartes();
    } catch (e) {
      setError(e?.message || "No se pudo pausar el trabajo.");
    } finally {
      setAccionCargando(false);
    }
  }, [cargarPartes]);

  const onFinalizarGrupo = useCallback(async (ids) => {
    if (!Array.isArray(ids) || ids.length === 0) {
      setError("Solo puedes finalizar servicios que iniciaste.");
      return;
    }
    setError("");
    setAccionCargando(true);
    try {
      for (const id of ids) await cambiarEstadoParte(id, "finalizado");
      await cargarPartes();
    } catch (e) {
      setError(e?.message || "No se pudo finalizar el trabajo.");
    } finally {
      setAccionCargando(false);
    }
  }, [cargarPartes]);

  const onSumarmeCoche = useCallback(async (grupo) => {
    const cocheId = Number(grupo?.partes?.[0]?.coche_id);
    if (!Number.isFinite(cocheId)) {
      setError("No se pudo identificar el coche para crear tu parte.");
      return;
    }

    const sugerida = `Apoyo en ${getTipoTareaLabel(ROL_TO_TIPO[userRol?.toLowerCase()] || "otro")}`;
    const observaciones = window.prompt("Describe brevemente el trabajo que vas a realizar en este coche:", sugerida);
    if (observaciones === null) return;

    setError("");
    setAccionCargando(true);
    try {
      const tipo = ROL_TO_TIPO[userRol?.toLowerCase()] || "otro";
      await sumarmeACoche({
        coche_id: cocheId,
        observaciones: String(observaciones || "").trim(),
        tiempo_estimado_minutos: 0,
        tipo_tarea: tipo,
      });
      await cargarPartes();
    } catch (e) {
      setError(e?.message || "No se pudo crear tu parte en ese coche.");
    } finally {
      setAccionCargando(false);
    }
  }, [cargarPartes, userRol]);

  // Agrupar partes por coche: una tarjeta por coche con todos sus servicios
  const cochesGrupos = Object.values(
    partes.reduce((acc, p) => {
      const esInterna = Boolean(p.es_tarea_interna);
      const key = esInterna ? `interno-${p.id}` : `coche-${p.coche_id}`;
      if (!acc[key]) {
        acc[key] = {
          coche_id: key,
          matricula: esInterna ? "TAREA INTERNA" : p.matricula,
          marca: esInterna ? "INTERNO" : p.marca,
          modelo: esInterna ? "SIN COCHE" : p.modelo,
          cliente_nombre: esInterna ? "" : p.cliente_nombre,
          es_tarea_interna: esInterna,
          partes: [],
        };
      }

      // Si el primer parte llegó incompleto, completar identidad del coche con los siguientes.
      if (!esInterna) {
        if (!acc[key].matricula && p.matricula) acc[key].matricula = p.matricula;
        if (!acc[key].marca && p.marca) acc[key].marca = p.marca;
        if (!acc[key].modelo && p.modelo) acc[key].modelo = p.modelo;
        if (!acc[key].cliente_nombre && p.cliente_nombre) acc[key].cliente_nombre = p.cliente_nombre;
      }

      acc[key].partes.push(p);
      return acc;
    }, {})
  );

  return (
    <div className="sw-flujo-shell">
      <div className="sw-flujo-header">
        <div>
          <h2 className="sw-flujo-title">{panelTitle || "👨‍🔧 Mis trabajos pendientes"}</h2>
          {panelSubtitle && <p className="sw-flujo-subtitle" style={{ margin: 0, fontSize: "0.85rem", color: "#999" }}>{panelSubtitle}</p>}
        </div>
        <button className="sw-flujo-refresh" onClick={cargarPartes} disabled={loading}>
          {loading ? "⏳" : "↻"} Actualizar
        </button>
      </div>

      {error && (
        <div className="alert alert-danger mx-3 mt-2 d-flex justify-content-between align-items-center">
          {error}
          <button type="button" className="btn-close btn-close-white" onClick={() => setError("")} />
        </div>
      )}

      {loading ? (
        <div className="sw-flujo-loading">
          <div className="spinner-border text-warning" role="status" style={{ width: "2rem", height: "2rem" }} />
          <p className="mt-3 text-secondary">Cargando trabajos…</p>
        </div>
      ) : cochesGrupos.length === 0 ? (
        <div className="sw-flujo-empty">
          <p>No hay trabajos pendientes en este momento.</p>
        </div>
      ) : (
        <div className="sw-flujo-body">
          <div className="mx-3 mb-3 p-3 rounded" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="fw-semibold mb-2">🧹 Registrar tarea interna (sin coche)</div>
            <div className="d-flex gap-2 flex-wrap">
              <input
                className="form-control"
                style={{ maxWidth: "420px" }}
                placeholder="Ej: Limpiar baño, ordenar almacén, preparar materiales..."
                value={tareaInternaTexto}
                onChange={(e) => setTareaInternaTexto(e.target.value)}
              />
              <button
                className="sw-parte-btn sw-parte-btn--start"
                disabled={tareaInternaLoading}
                onClick={onCrearTareaInterna}
              >
                {tareaInternaLoading ? "⏳ Creando..." : "▶ Crear e iniciar"}
              </button>
            </div>
          </div>
          <div className="sw-flujo-cards">
            {cochesGrupos.map((grupo) => (
              <CocheGrupoCard
                key={grupo.coche_id}
                grupo={grupo}
                empleadoId={empleadoId}
                userRol={userRol}
                onIniciarGrupo={onIniciarGrupo}
                onPausarGrupo={onPausarGrupo}
                onFinalizarGrupo={onFinalizarGrupo}
                onSumarmeCoche={onSumarmeCoche}
                cargando={accionCargando}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
