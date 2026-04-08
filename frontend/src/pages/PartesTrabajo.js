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
} from "../utils/parteTrabajoApi";
import { normalizeRol } from "../utils/authSession";

function EstadoBadge({ estado }) {
  const config = {
    pendiente:  { label: "Pendiente",  color: "#9ca3af", bg: "rgba(156,163,175,0.12)", border: "rgba(156,163,175,0.28)" },
    en_proceso: { label: "En proceso", color: "#f59e0b", bg: "rgba(245,158,11,0.12)",  border: "rgba(245,158,11,0.32)" },
    en_pausa:   { label: "En pausa",   color: "#818cf8", bg: "rgba(129,140,248,0.12)", border: "rgba(129,140,248,0.3)" },
    finalizado: { label: "Finalizado", color: "#4ade80", bg: "rgba(34,197,94,0.12)",   border: "rgba(34,197,94,0.28)" },
  };
  const { label, color, bg, border } = config[estado] || { label: estado, color: "#9ca3af", bg: "rgba(156,163,175,0.1)", border: "rgba(156,163,175,0.2)" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "0.35rem",
      padding: "0.2rem 0.65rem", borderRadius: "999px",
      fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.05em",
      background: bg, border: `1px solid ${border}`, color,
      whiteSpace: "nowrap",
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: color, flexShrink: 0 }} />
      {label}
    </span>
  );
}

function formatDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString();
}

function formatShortDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMinutes(minutes) {
  const total = Number.isFinite(Number(minutes)) ? Math.max(0, Number(minutes)) : 0;
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

function parseHoursToMinutes(hoursValue) {
  const raw = String(hoursValue ?? "").trim();
  if (!raw) return 0;
  const hours = Number(raw.replace(",", "."));
  if (!Number.isFinite(hours) || hours < 0) return null;
  return Math.round(hours * 60);
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
  { value: "pintura", label: "Pintor / Pintura" },
  { value: "detailing", label: "Detailing / Lavado" },
  { value: "tapicero", label: "Tapicero / Tapicería" },
  { value: "otro", label: "Empleado general / Otro" },
];

function getTipoTareaLabel(tipoTarea) {
  const normalized = tipoTarea === "tapiceria" ? "tapicero" : tipoTarea;
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
  const [nuevoServicioManualNombre, setNuevoServicioManualNombre] = useState("");
  const [nuevoServicioManualPrecio, setNuevoServicioManualPrecio] = useState("");
  const [nuevoServicioManualHoras, setNuevoServicioManualHoras] = useState("");
  const [nuevoServicioManualTipoTarea, setNuevoServicioManualTipoTarea] = useState("");

  const [showReporte, setShowReporte] = useState(false);
  const [reporte, setReporte] = useState([]);
  const [loadingReporte, setLoadingReporte] = useState(false);
  const [reporteFechaInicio, setReporteFechaInicio] = useState("");
  const [reporteFechaFin, setReporteFechaFin] = useState("");

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
      return `${coche.matricula}${coche.cliente_nombre ? ` - ${coche.cliente_nombre}` : ""}`;
    },
    [cochesDisponibles, cochesCatalogo]
  );

  const serviciosSinTipo = serviciosParteSeleccionados.filter(
    (s) => !String(s.tipo_tarea || "").trim()
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
              tiempo_estimado_minutos: Number.parseInt(s?.tiempo_estimado_minutos || 0, 10) || 0,
              origen: "recepcion",
              servicio_catalogo_id: s?.servicio_catalogo_id ?? null,
              tipo_tarea: s?.tipo_tarea || "",
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
      return [
        ...prev,
        {
          key: `extra-${servicioElegido.id}`,
          nombre,
          precio: Number(servicioElegido.precio_base || 0),
          tiempo_estimado_minutos: Number.parseInt(servicioElegido.tiempo_estimado_minutos || 0, 10) || 0,
          origen: "extra",
          servicio_catalogo_id: servicioElegido.id,
          tipo_tarea: normalizeRol(servicioElegido.rol_responsable || "") || "",
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

    const tipoTarea = String(nuevoServicioManualTipoTarea || "").trim();
    if (!tipoTarea) {
      setMensajeCreacion("En servicio manual debes indicar el área/rol en el desplegable.");
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
          tipo_tarea: tipoTarea,
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

  const onBorrarGrupo = async (partes) => {
    const matricula = partes[0]?.matricula || `coche ${partes[0]?.coche_id}`;
    const confirmado = window.confirm(
      `Vas a eliminar los ${partes.length} parte(s) de ${matricula}. Esta acción no se puede deshacer.\n\n¿Deseas continuar?`
    );
    if (!confirmado) return;
    setError("");
    try {
      for (const p of partes) await eliminarParteTrabajo(p.id);
      await cargarPartes();
    } catch (e) {
      setError(e?.message || "No se pudo eliminar el grupo.");
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
    <div className="sw-page-bg" style={{ minHeight: "calc(100vh - 56px)" }}>

      {/* ── HERO ─────────────────────────────────────────── */}
      <div style={{ borderBottom: "1px solid color-mix(in srgb, var(--sw-accent) 15%, var(--sw-border))", padding: "1.75rem 0 1.5rem", animation: "sw-fade-up 0.4s ease both" }}>
        <div className="container" style={{ maxWidth: "1100px" }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "1.5rem", flexWrap: "wrap" }}>
            <div>
              <p style={{ fontSize: "0.73rem", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--sw-accent)", opacity: 0.85, marginBottom: "0.4rem" }}>
                Panel de gestión · SpecialWash
              </p>
              <h1 style={{ fontSize: "clamp(1.4rem, 3vw, 2rem)", fontWeight: 700, color: "var(--sw-text)", margin: 0, letterSpacing: "-0.01em" }}>
                Partes de Trabajo
              </h1>
              <p style={{ fontSize: "0.85rem", color: "var(--sw-muted)", marginTop: "0.35rem", marginBottom: 0 }}>
                Asignación, seguimiento y finalización de servicios
              </p>
            </div>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem", padding: "0.3rem 0.85rem 0.3rem 0.65rem", borderRadius: "999px", fontSize: "0.76rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", border: "1px solid rgba(34,197,94,0.4)", background: "rgba(34,197,94,0.07)", color: "#6ee7b7", whiteSpace: "nowrap" }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", animation: "sw-pulse-dot 2s ease-in-out infinite", flexShrink: 0 }} />
              {partes.filter(p => p.estado === "en_proceso").length} en proceso
            </span>
          </div>
        </div>
      </div>

      {/* ── CONTENT ──────────────────────────────────────── */}
      <div className="container py-4" style={{ maxWidth: "1100px" }}>

        {/* STATS */}
        <div className="row g-3 mb-4" style={{ animation: "sw-fade-up 0.45s ease 0.05s both" }}>
          {[
            { icon: "📋", label: "Partes activos", value: partes.length, color: "var(--sw-accent)" },
            { icon: "🚗", label: "Coches disponibles", value: cochesDisponibles.length, color: "#6366f1" },
            { icon: "👷", label: "Empleados", value: empleadosDisponibles.length, color: "#22c55e" },
          ].map((stat) => (
            <div key={stat.label} className="col-md-4">
              <div style={{ background: "var(--sw-surface)", border: "1px solid var(--sw-border)", borderTop: `3px solid ${stat.color}`, borderRadius: "16px", padding: "1.1rem 1.25rem" }}>
                <p style={{ fontSize: "0.76rem", color: "var(--sw-muted)", marginBottom: "0.5rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {stat.icon} {stat.label}
                </p>
                <h3 style={{ fontSize: "2rem", fontWeight: 800, color: stat.color, margin: 0 }}>{stat.value}</h3>
              </div>
            </div>
          ))}
        </div>

        {error && (
          <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "10px", padding: "0.85rem 1rem", marginBottom: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center", color: "#fca5a5", animation: "sw-fade-up 0.3s ease both" }}>
            <span><strong>Error:</strong> {error}</span>
            <button type="button" className="btn-close btn-close-white btn-sm" onClick={() => setError("")} />
          </div>
        )}

        {/* FORM CREAR PARTE */}
        <div style={{ background: "var(--sw-surface)", border: "1px solid var(--sw-border)", borderTop: "3px solid #d4af37", borderRadius: "18px", marginBottom: "1.5rem", animation: "sw-fade-up 0.45s ease 0.1s both", overflow: "hidden" }}>
          <div style={{ padding: "1.1rem 1.25rem", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <h5 style={{ fontWeight: 700, color: "var(--sw-text)", margin: 0, fontSize: "0.95rem" }}>
              <span style={{ color: "var(--sw-accent)", marginRight: "0.5rem" }}>✦</span>
              Crear nuevo parte
            </h5>
          </div>
          <div style={{ padding: "1.25rem" }}>
            <form onSubmit={onCrearParte} className="row g-3">
              <div className="col-md-6">
                <label style={{ color: "var(--sw-muted)", fontSize: "0.78rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "0.4rem" }}>Coche *</label>
                <select
                  className="form-select"
                  value={nuevoCocheId}
                  onChange={(e) => setNuevoCocheId(e.target.value)}
                  disabled={loadingRecursos}
                  required
                  style={{ background: "var(--sw-surface-2)", border: "1px solid var(--sw-border)", color: "var(--sw-text)", borderRadius: "10px" }}
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
                <label style={{ color: "var(--sw-muted)", fontSize: "0.78rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "0.4rem" }}>Servicios del parte *</label>
                {hayServiciosSinTiempo && (
                  <div style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: "8px", padding: "0.65rem 1rem", marginBottom: "0.75rem", color: "#fbbf24", fontSize: "0.83rem" }}>
                    ⚠ Servicios sin tiempo estimado: {nombresServiciosSinTiempo.join(", ")}. Se contarán como 0 min.
                  </div>
                )}
                {serviciosCatalogo.length === 0 ? (
                  <p style={{ color: "var(--sw-muted)", fontSize: "0.85rem" }}>
                    No hay servicios en el catálogo. <a href="/catalogo-servicios" target="_blank" rel="noopener noreferrer" style={{ color: "var(--sw-accent)" }}>Crear servicios</a>
                  </p>
                ) : (
                  <div className="row g-2">
                    <div className="col-12 col-md-8">
                      <select
                        className="form-select"
                        value={nuevoServicioId}
                        onChange={(e) => setNuevoServicioId(e.target.value)}
                        style={{ background: "var(--sw-surface-2)", border: "1px solid var(--sw-border)", color: "var(--sw-text)", borderRadius: "10px" }}
                      >
                        <option value="">Añadir servicio del catálogo...</option>
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
                        onClick={agregarServicioExtra}
                        style={{ background: "rgba(212,175,55,0.1)", border: "1px solid rgba(212,175,55,0.3)", color: "var(--sw-accent)", borderRadius: "10px", fontWeight: 600, fontSize: "0.85rem", cursor: "pointer", minHeight: "42px" }}
                      >
                        + Del catálogo
                      </button>
                    </div>
                  </div>
                )}

                <div className="row g-2 mt-2">
                  <div className="col-12 col-md-5">
                    <input
                      type="text"
                      className="form-control"
                      value={nuevoServicioManualNombre}
                      onChange={(e) => setNuevoServicioManualNombre(e.target.value)}
                      placeholder="Servicio manual (ej. Pulido de faros)"
                      style={{ background: "var(--sw-surface-2)", border: "1px solid var(--sw-border)", color: "var(--sw-text)", borderRadius: "10px" }}
                    />
                  </div>
                  <div className="col-12 col-md-2">
                    <input
                      type="number" step="0.01" min="0"
                      className="form-control"
                      value={nuevoServicioManualPrecio}
                      onChange={(e) => setNuevoServicioManualPrecio(e.target.value)}
                      placeholder="Precio (€)"
                      style={{ background: "var(--sw-surface-2)", border: "1px solid var(--sw-border)", color: "var(--sw-text)", borderRadius: "10px" }}
                    />
                  </div>
                  <div className="col-12 col-md-2">
                    <input
                      type="number" step="0.25" min="0"
                      className="form-control"
                      value={nuevoServicioManualHoras}
                      onChange={(e) => setNuevoServicioManualHoras(e.target.value)}
                      placeholder="Horas"
                      style={{ background: "var(--sw-surface-2)", border: "1px solid var(--sw-border)", color: "var(--sw-text)", borderRadius: "10px" }}
                    />
                  </div>
                  <div className="col-12 col-md-2">
                    <select
                      className="form-select"
                      value={nuevoServicioManualTipoTarea}
                      onChange={(e) => setNuevoServicioManualTipoTarea(e.target.value)}
                      style={{ background: "var(--sw-surface-2)", border: "1px solid var(--sw-border)", color: "var(--sw-text)", borderRadius: "10px" }}
                    >
                      <option value="">Área...</option>
                      {TIPO_TAREA_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-12 col-md-1 d-grid">
                    <button
                      type="button"
                      onClick={agregarServicioManual}
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--sw-border)", color: "var(--sw-text)", borderRadius: "10px", fontWeight: 600, fontSize: "0.82rem", cursor: "pointer", minHeight: "42px" }}
                    >
                      + Manual
                    </button>
                  </div>
                </div>

                <p style={{ fontSize: "0.75rem", color: "var(--sw-muted)", marginTop: "0.6rem", marginBottom: 0 }}>
                  Al elegir coche se cargan servicios de la última inspección · Horas (ej. 1.5) se convierten a minutos automáticamente · Puedes mezclar varias áreas
                </p>

                {/* Servicios seleccionados */}
                <div className="mt-3">
                  {serviciosParteSeleccionados.length === 0 ? (
                    <div style={{ color: "var(--sw-muted)", fontSize: "0.83rem", borderRadius: "10px", padding: "0.9rem 1rem", border: "1px dashed rgba(255,255,255,0.07)", textAlign: "center" }}>
                      No hay servicios seleccionados todavía
                    </div>
                  ) : (
                    <>
                      {hayServiciosSinTipo && (
                        <div style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: "8px", padding: "0.6rem 1rem", marginBottom: "0.75rem", color: "#fbbf24", fontSize: "0.82rem" }}>
                          ⚠ Hay servicios sin área asignada. Selecciona un rol para cada uno.
                        </div>
                      )}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
                        {serviciosParteSeleccionados.map((s) => (
                          <div key={s.key} style={{ background: "var(--sw-surface-2)", border: "1px solid var(--sw-border)", borderRadius: "12px", padding: "0.75rem 1rem", minWidth: "240px", flex: "1 1 240px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
                              <div>
                                <div style={{ fontWeight: 600, color: "var(--sw-text)", fontSize: "0.88rem" }}>{s.nombre}</div>
                                <div style={{ fontSize: "0.75rem", color: "var(--sw-muted)", marginTop: "0.2rem" }}>
                                  {Number.isFinite(s.precio) ? `${Number(s.precio).toFixed(2)}€ · ` : ""}
                                  {formatMinutes(Number.parseInt(s.tiempo_estimado_minutos || 0, 10) || 0)}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => quitarServicioSeleccionado(s.key)}
                                style={{ background: "transparent", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171", borderRadius: "6px", width: "24px", height: "24px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem", flexShrink: 0 }}
                              >
                                ×
                              </button>
                            </div>
                            <div style={{ marginTop: "0.6rem" }}>
                              <select
                                className="form-select form-select-sm"
                                value={s.tipo_tarea || ""}
                                onChange={(e) => actualizarTipoServicio(s.key, e.target.value)}
                                style={{ background: "var(--sw-surface-2)", border: "1px solid var(--sw-border)", color: "var(--sw-text)", borderRadius: "8px", fontSize: "0.8rem" }}
                              >
                                <option value="">Selecciona área...</option>
                                {TIPO_TAREA_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        ))}
                      </div>
                      <p style={{ fontSize: "0.78rem", color: "var(--sw-muted)", marginTop: "0.75rem", marginBottom: 0 }}>
                        Tiempo total estimado: <strong style={{ color: "var(--sw-accent)" }}>{formatMinutes(serviciosParteSeleccionados.reduce((acc, s) => acc + (Number.parseInt(s.tiempo_estimado_minutos || 0, 10) || 0), 0))}</strong>
                      </p>
                    </>
                  )}
                </div>
              </div>

              <div className="col-12 d-flex align-items-center gap-3 flex-wrap">
                <button
                  type="submit"
                  disabled={loadingRecursos || hayServiciosSinTipo}
                  style={{ background: "linear-gradient(135deg, #f5e19a, #d4af37)", border: "none", color: "#0a0b0e", fontWeight: 700, fontSize: "0.85rem", padding: "0.6rem 1.6rem", borderRadius: "10px", cursor: loadingRecursos || hayServiciosSinTipo ? "not-allowed" : "pointer", opacity: loadingRecursos || hayServiciosSinTipo ? 0.5 : 1, letterSpacing: "0.03em", minHeight: "42px" }}
                >
                  ✦ Crear partes
                </button>
                {mensajeCreacion && (
                  <span style={{ color: "#6ee7b7", fontSize: "0.85rem", fontWeight: 500 }}>{mensajeCreacion}</span>
                )}
              </div>

              {!loadingRecursos && cochesDisponibles.length === 0 && (
                <div className="col-12">
                  <div style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.22)", borderRadius: "10px", padding: "0.75rem 1rem", color: "#a5b4fc", fontSize: "0.85rem" }}>
                    No hay coches disponibles para planificar en este momento.
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>

        {/* FILTROS */}
        <div style={{ background: "var(--sw-surface)", border: "1px solid var(--sw-border)", borderTop: "3px solid rgba(212,175,55,0.3)", borderRadius: "18px", marginBottom: "1.5rem", animation: "sw-fade-up 0.45s ease 0.15s both", overflow: "hidden" }}>
          <div style={{ padding: "1.1rem 1.25rem", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <h5 style={{ fontWeight: 700, color: "var(--sw-text)", margin: 0, fontSize: "0.95rem" }}>
              <span style={{ color: "var(--sw-accent)", marginRight: "0.5rem" }}>⊞</span>
              Filtros
            </h5>
          </div>
          <div style={{ padding: "1.25rem" }}>
            <div className="row g-3">
              <div className="col-md-6">
                <label style={{ color: "var(--sw-muted)", fontSize: "0.78rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "0.4rem" }}>Empleado</label>
                <select
                  className="form-select"
                  value={empleadoFiltro}
                  onChange={(e) => setEmpleadoFiltro(e.target.value)}
                  style={{ background: "var(--sw-surface-2)", border: "1px solid var(--sw-border)", color: "var(--sw-text)", borderRadius: "10px" }}
                >
                  <option value="">Todos</option>
                  {empleadosDisponibles.map((u) => (
                    <option key={u.id} value={u.id}>{u.nombre} ({u.rol})</option>
                  ))}
                </select>
              </div>
              <div className="col-md-6">
                <label style={{ color: "var(--sw-muted)", fontSize: "0.78rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "0.4rem" }}>Coche</label>
                <select
                  className="form-select"
                  value={cocheFiltro}
                  onChange={(e) => setCocheFiltro(e.target.value)}
                  style={{ background: "var(--sw-surface-2)", border: "1px solid var(--sw-border)", color: "var(--sw-text)", borderRadius: "10px" }}
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
        <div style={{ textAlign: "center", padding: "3rem 0" }}>
          <div className="spinner-border" style={{ color: "var(--sw-accent)", width: "2rem", height: "2rem" }} role="status" />
          <p style={{ color: "var(--sw-muted)", marginTop: "1rem", fontSize: "0.88rem" }}>Cargando partes activos…</p>
        </div>
      ) : partes.length === 0 ? (
        <div style={{ background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: "14px", padding: "1.25rem 1.5rem", color: "#6ee7b7", fontSize: "0.9rem", marginBottom: "1.5rem", animation: "sw-fade-up 0.35s ease both" }}>
          ✦ No hay partes pendientes — todos los trabajos están finalizados
        </div>
      ) : (
        <div style={{ animation: "sw-fade-up 0.45s ease 0.2s both" }}>
          {groupByDate(partes).map(([fecha, grupoPartes]) => {
            const cocheGrupos = Object.values(
              grupoPartes.reduce((acc, p) => {
                const k = p.coche_id;
                if (!acc[k]) acc[k] = { coche_id: k, partes: [] };
                acc[k].partes.push(p);
                return acc;
              }, {})
            );
            return (
              <div key={fecha} style={{ marginBottom: "2rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.85rem" }}>
                  <span style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--sw-accent)", opacity: 0.75 }}>📅 {fecha}</span>
                  <div style={{ flex: 1, height: "1px", background: "rgba(212,175,55,0.12)" }} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                  {cocheGrupos.map(({ coche_id, partes: cp }) => {
                    const estadoGlobal = cp.some(p => p.estado === "en_proceso") ? "en_proceso"
                      : cp.some(p => p.estado === "en_pausa") ? "en_pausa"
                      : "pendiente";
                    const ids = cp.map(p => p.id);
                    const parteRef = cp.find(p => p.fecha_inicio) || cp[0];
                    const empleadosUnicos = [...new Map(
                      cp.filter(p => p.empleado_id).map(p => [p.empleado_id, empleadoNombrePorId(p.empleado_id)])
                    ).values()];
                    const estimadoTotal = cp.reduce((sum, p) => sum + (p.tiempo_estimado_minutos || 0), 0);
                    const accentColor = estadoGlobal === "en_proceso" ? "#22c55e" : estadoGlobal === "en_pausa" ? "#f59e0b" : "rgba(212,175,55,0.4)";

                    // Datos del coche directamente desde el parte (el API ya los devuelve)
                    const refParte = cp[0] || {};
                    const matricula = refParte.matricula || cocheTextoPorId(coche_id);
                    const marcaModelo = [refParte.marca, refParte.modelo].filter(Boolean).join(" ");
                    const clienteNombre = refParte.cliente_nombre;

                    return (
                      <div key={coche_id} style={{ background: "var(--sw-surface)", border: `1px solid rgba(255,255,255,0.07)`, borderLeft: `3px solid ${accentColor}`, borderRadius: "14px", overflow: "hidden" }}>
                        {/* Cabecera */}
                        <div style={{ padding: "0.85rem 1.1rem", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
                          <div>
                            {/* Matrícula principal */}
                            <div style={{ display: "flex", alignItems: "center", gap: "0.55rem", flexWrap: "wrap" }}>
                              <span style={{
                                fontFamily: "monospace", fontWeight: 800, fontSize: "1rem",
                                color: "var(--sw-accent)", letterSpacing: "0.08em",
                                background: "color-mix(in srgb, var(--sw-accent) 8%, transparent)",
                                border: "1px solid color-mix(in srgb, var(--sw-accent) 22%, transparent)",
                                borderRadius: "6px", padding: "0.1rem 0.6rem",
                              }}>
                                {matricula}
                              </span>
                              {marcaModelo && (
                                <span style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--sw-text)" }}>
                                  {marcaModelo}
                                </span>
                              )}
                              {clienteNombre && (
                                <span style={{ fontSize: "0.78rem", color: "var(--sw-muted)" }}>
                                  · {clienteNombre}
                                </span>
                              )}
                            </div>
                            <div style={{ display: "flex", gap: "1rem", marginTop: "0.35rem", fontSize: "0.78rem", color: "var(--sw-muted)", flexWrap: "wrap" }}>
                              <span>👤 {empleadosUnicos.length > 0 ? empleadosUnicos.join(", ") : <em>Sin asignar</em>}</span>
                              <span>⏱ est. {formatMinutes(estimadoTotal)}</span>
                            </div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                            <Cronometro parte={{ ...parteRef, estado: estadoGlobal }} />
                            <EstadoBadge estado={estadoGlobal} />
                          </div>
                        </div>
                        {/* Servicios */}
                        <div style={{ padding: "0.5rem 0" }}>
                          {cp.map(p => (
                            <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.5rem 1.1rem", borderBottom: "1px solid rgba(255,255,255,0.03)", gap: "0.75rem" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flex: 1, minWidth: 0 }}>
                                <span style={{ fontSize: "0.7rem", color: "var(--sw-muted)", fontFamily: "monospace", flexShrink: 0 }}>#{p.id}</span>
                                <span style={{ fontSize: "0.87rem", color: "var(--sw-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {p.observaciones || getTipoTareaLabel(p.tipo_tarea)}
                                </span>
                              </div>
                              <button
                                onClick={() => onAbrirEditar(p)}
                                style={{ background: "var(--sw-surface-2)", border: "1px solid var(--sw-border)", color: "var(--sw-muted)", borderRadius: "7px", padding: "0.25rem 0.6rem", fontSize: "0.78rem", cursor: "pointer", flexShrink: 0 }}
                              >
                                ✏️
                              </button>
                            </div>
                          ))}
                        </div>
                        {/* Acciones */}
                        <div style={{ padding: "0.65rem 1.1rem", display: "flex", gap: "0.5rem", justifyContent: "flex-end", flexWrap: "wrap" }}>
                          {estadoGlobal === "en_pausa" && (
                            <button
                              onClick={() => onReanudarGrupo(ids)}
                              style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.35)", color: "#a5b4fc", borderRadius: "8px", padding: "0.35rem 0.9rem", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer" }}
                            >
                              ▶ Reanudar
                            </button>
                          )}
                          <button
                            onClick={() => onBorrarGrupo(cp)}
                            style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171", borderRadius: "8px", padding: "0.35rem 0.9rem", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer" }}
                          >
                            🗑 Borrar
                          </button>
                          <button
                            onClick={() => onFinalizarGrupo(ids)}
                            style={{ background: "linear-gradient(135deg,#16a34a,#15803d)", border: "none", color: "var(--sw-text)", borderRadius: "8px", padding: "0.35rem 1rem", fontSize: "0.82rem", fontWeight: 700, cursor: "pointer" }}
                          >
                            ✦ Finalizar
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

      {/* REPORTE */}
      <div style={{ background: "var(--sw-surface)", border: "1px solid var(--sw-border)", borderTop: "3px solid rgba(99,102,241,0.5)", borderRadius: "18px", marginBottom: "1.5rem", overflow: "hidden", animation: "sw-fade-up 0.45s ease 0.25s both" }}>
        <div style={{ padding: "1.1rem 1.25rem", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h5 style={{ fontWeight: 700, color: "var(--sw-text)", margin: 0, fontSize: "0.95rem" }}>
            <span style={{ color: "#a5b4fc", marginRight: "0.5rem" }}>📊</span>
            Tiempo trabajado por empleado
          </h5>
          <button
            onClick={() => { const next = !showReporte; setShowReporte(next); if (next) cargarReporte(); }}
            style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.3)", color: "#a5b4fc", borderRadius: "8px", padding: "0.3rem 0.85rem", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer" }}
          >
            {showReporte ? "Ocultar" : "Ver reporte"}
          </button>
        </div>
        {showReporte && (
          <div style={{ padding: "1.25rem" }}>
            <div className="row g-2 mb-3 align-items-end">
              <div className="col-md-4">
                <label style={{ color: "var(--sw-muted)", fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "0.35rem" }}>Desde</label>
                <input type="date" className="form-control" value={reporteFechaInicio} onChange={(e) => setReporteFechaInicio(e.target.value)}
                  style={{ background: "var(--sw-surface-2)", border: "1px solid var(--sw-border)", color: "var(--sw-text)", borderRadius: "9px" }} />
              </div>
              <div className="col-md-4">
                <label style={{ color: "var(--sw-muted)", fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "0.35rem" }}>Hasta</label>
                <input type="date" className="form-control" value={reporteFechaFin} onChange={(e) => setReporteFechaFin(e.target.value)}
                  style={{ background: "var(--sw-surface-2)", border: "1px solid var(--sw-border)", color: "var(--sw-text)", borderRadius: "9px" }} />
              </div>
              <div className="col-md-4">
                <button onClick={cargarReporte} disabled={loadingReporte}
                  style={{ background: "linear-gradient(135deg,#f5e19a,#d4af37)", border: "none", color: "#0a0b0e", fontWeight: 700, borderRadius: "9px", padding: "0.5rem 1rem", width: "100%", cursor: loadingReporte ? "not-allowed" : "pointer", opacity: loadingReporte ? 0.6 : 1, fontSize: "0.85rem" }}
                >
                  {loadingReporte ? "Cargando…" : "↻ Actualizar"}
                </button>
              </div>
            </div>

            {reporte.length === 0 && !loadingReporte && (
              <p style={{ color: "var(--sw-muted)", fontSize: "0.85rem" }}>Sin datos para el período seleccionado.</p>
            )}

            {reporte.map((emp) => (
              <div key={emp.empleado_id} style={{ background: "var(--sw-surface-2)", border: "1px solid var(--sw-border)", borderRadius: "12px", marginBottom: "1rem", overflow: "hidden" }}>
                <div style={{ padding: "0.85rem 1rem", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem" }}>
                  <strong style={{ color: "var(--sw-text)", fontSize: "0.9rem" }}>👤 {emp.nombre}{emp.rol ? <span style={{ color: "var(--sw-muted)", fontWeight: 400 }}> · {emp.rol}</span> : ""}</strong>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.2rem" }}>
                    <span style={{ background: "rgba(212,175,55,0.12)", border: "1px solid rgba(212,175,55,0.25)", color: "var(--sw-accent)", borderRadius: "6px", padding: "0.15rem 0.6rem", fontSize: "0.78rem", fontWeight: 700 }}>
                      {formatMinutes(emp.total_minutos)} · {emp.total_partes} partes
                    </span>
                    <small style={{ color: "var(--sw-muted)", fontSize: "0.72rem" }}>
                      🚗 {formatMinutes(emp.total_minutos_coche || 0)} · 🧹 {formatMinutes(emp.total_minutos_interno || 0)}
                    </small>
                  </div>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                    <thead>
                      <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                        {["Matrícula","Registro","Tipo","Estado","Real","Est.","Inicio"].map(h => (
                          <th key={h} style={{ padding: "0.5rem 0.75rem", color: "var(--sw-muted)", fontWeight: 600, textTransform: "uppercase", fontSize: "0.68rem", letterSpacing: "0.07em", borderBottom: "1px solid rgba(255,255,255,0.05)", whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {emp.partes.map((p) => (
                        <tr key={p.parte_id} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                          <td style={{ padding: "0.45rem 0.75rem", color: "var(--sw-text)", fontWeight: 600 }}>{p.matricula || `#${p.coche_id}`}</td>
                          <td style={{ padding: "0.45rem 0.75rem" }}>
                            {p.es_tarea_interna
                              ? <span style={{ background: "rgba(107,114,128,0.2)", color: "#9ca3af", borderRadius: "5px", padding: "0.1rem 0.5rem", fontSize: "0.72rem" }}>Interno</span>
                              : <span style={{ background: "rgba(99,102,241,0.15)", color: "#a5b4fc", borderRadius: "5px", padding: "0.1rem 0.5rem", fontSize: "0.72rem" }}>Coche</span>}
                          </td>
                          <td style={{ padding: "0.45rem 0.75rem", color: "var(--sw-muted)" }}>{p.tipo_tarea || "—"}</td>
                          <td style={{ padding: "0.45rem 0.75rem" }}><EstadoBadge estado={p.estado} /></td>
                          <td style={{ padding: "0.45rem 0.75rem", color: "var(--sw-accent)", fontWeight: 700 }}>{formatMinutes(p.duracion_minutos)}</td>
                          <td style={{ padding: "0.45rem 0.75rem", color: "var(--sw-muted)" }}>{formatMinutes(p.tiempo_estimado_minutos)}</td>
                          <td style={{ padding: "0.45rem 0.75rem", color: "var(--sw-muted)", fontSize: "0.75rem", whiteSpace: "nowrap" }}>
                            {p.fecha_inicio ? new Date(p.fecha_inicio).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}
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
      </div>

      {/* MODAL EDITAR */}
      {editandoId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 1050, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", backdropFilter: "blur(4px)" }}>
          <div style={{ background: "var(--sw-surface)", border: "1px solid var(--sw-border)", borderTop: "3px solid #d4af37", borderRadius: "18px", width: "100%", maxWidth: "480px", boxShadow: "0 24px 64px rgba(0,0,0,0.7)", animation: "sw-fade-up 0.25s ease both" }}>
            <div style={{ padding: "1.1rem 1.25rem", borderBottom: "1px solid var(--sw-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h5 style={{ fontWeight: 700, color: "var(--sw-text)", margin: 0, fontSize: "0.95rem" }}>
                <span style={{ color: "var(--sw-accent)", marginRight: "0.5rem" }}>✏️</span>
                Editar Parte #{editandoId}
              </h5>
              <button onClick={onCancelarEditar} style={{ background: "transparent", border: "none", color: "var(--sw-muted)", fontSize: "1.2rem", cursor: "pointer", lineHeight: 1 }}>×</button>
            </div>
            <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label style={{ color: "var(--sw-muted)", fontSize: "0.76rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: "0.4rem" }}>Empleado</label>
                <select className="form-select" value={editEmpleadoId} onChange={(e) => setEditEmpleadoId(e.target.value)} disabled={editLoading}
                  style={{ background: "var(--sw-surface-2)", border: "1px solid var(--sw-border)", color: "var(--sw-text)", borderRadius: "10px" }}>
                  <option value="">Selecciona empleado…</option>
                  {empleadosDisponibles.map((u) => (
                    <option key={u.id} value={u.id}>{u.nombre} ({u.rol})</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ color: "var(--sw-muted)", fontSize: "0.76rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: "0.4rem" }}>Servicio *</label>
                <select className="form-select" value={editServicioId} onChange={(e) => setEditServicioId(e.target.value)} disabled={editLoading}
                  style={{ background: "var(--sw-surface-2)", border: "1px solid var(--sw-border)", color: "var(--sw-text)", borderRadius: "10px" }}>
                  <option value="">Selecciona servicio…</option>
                  {serviciosCatalogo.map((s) => (
                    <option key={s.id} value={s.id}>{s.nombre} {s.precio_base != null ? `(${Number(s.precio_base).toFixed(2)}€)` : ""}</option>
                  ))}
                </select>
                {serviciosCatalogo.length === 0 && (
                  <p style={{ color: "var(--sw-muted)", fontSize: "0.75rem", marginTop: "0.4rem", marginBottom: 0 }}>No hay servicios en el catálogo.</p>
                )}
              </div>
            </div>
            <div style={{ padding: "1rem 1.25rem", borderTop: "1px solid var(--sw-border)", display: "flex", gap: "0.6rem", justifyContent: "flex-end" }}>
              <button onClick={onCancelarEditar} disabled={editLoading}
                style={{ background: "var(--sw-surface-2)", border: "1px solid var(--sw-border)", color: "var(--sw-muted)", borderRadius: "9px", padding: "0.45rem 1rem", fontSize: "0.84rem", cursor: "pointer" }}>
                Cancelar
              </button>
              <button onClick={onGuardarEdicion} disabled={editLoading}
                style={{ background: "linear-gradient(135deg,#f5e19a,#d4af37)", border: "none", color: "#0a0b0e", fontWeight: 700, borderRadius: "9px", padding: "0.45rem 1.2rem", fontSize: "0.84rem", cursor: editLoading ? "not-allowed" : "pointer", opacity: editLoading ? 0.6 : 1 }}>
                {editLoading ? "Guardando…" : "✦ Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
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

  const estimadoSegs = Number(parte.tiempo_estimado_minutos || 0) * 60;
  const porcentaje = estimadoSegs > 0 ? segs / estimadoSegs : null;

  // Color según porcentaje del tiempo estimado consumido
  let timerClass = "sw-timer";
  let alerta = null;
  if (parte.estado === "en_pausa") {
    timerClass += " sw-timer-paused";
  } else if (parte.estado === "en_proceso") {
    timerClass += " sw-timer-running";
    if (porcentaje !== null) {
      if (porcentaje >= 1) {
        timerClass += " sw-timer--over";   // rojo: pasado el tiempo
        alerta = "⚠ Tiempo superado";
      } else if (porcentaje >= 0.8) {
        timerClass += " sw-timer--warn";   // naranja: >80%
      }
    }
  } else {
    timerClass += " sw-timer-done";
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
      <span className={timerClass}>
        {parte.estado === "en_pausa" ? "⏸" : parte.estado === "en_proceso" ? "▶" : "✓"} {formatCrono(segs)}
      </span>
      {estimadoSegs > 0 && (
        <div style={{ fontSize: "0.72rem", color: "var(--sw-muted)", display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <span>Est. {formatMinutes(parte.tiempo_estimado_minutos)}</span>
          {porcentaje !== null && parte.estado !== "finalizado" && (
            <div style={{ width: "60px", height: "5px", background: "rgba(255,255,255,0.1)", borderRadius: "3px", overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: `${Math.min(100, Math.round(porcentaje * 100))}%`,
                background: porcentaje >= 1 ? "#dc3545" : porcentaje >= 0.8 ? "#fd7e14" : "#20c997",
                borderRadius: "3px",
                transition: "width 1s linear",
              }} />
            </div>
          )}
          {alerta && <span style={{ color: "#dc3545", fontWeight: 600 }}>{alerta}</span>}
        </div>
      )}
    </div>
  );
}

// ── Categorías de trabajo ─────────────────────────────────────────────────────

// ── Tarjeta de coche: un timer y un set de botones para todos los servicios ───
function CocheGrupoCard({ grupo, empleadoId, onAccionParte, onSumarmeCoche, cargando }) {
  const { matricula, marca, modelo, cliente_nombre, partes } = grupo;
  const descCoche = [marca, modelo].filter(Boolean).join(" ");

  // Estado global del grupo: en_proceso > en_pausa > pendiente
  const estadoGlobal = partes.some(p => p.estado === "en_proceso") ? "en_proceso"
    : partes.some(p => p.estado === "en_pausa") ? "en_pausa"
    : "pendiente";

  const yoId = Number(empleadoId);
  const hayOtroTrabajando = partes.some(
    (p) => (p.estado === "en_proceso" || p.estado === "en_pausa") && Number(p.empleado_id) !== yoId
  );
  const esTareaInterna = Boolean(grupo.es_tarea_interna);

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
          <span className="sw-parte-card__matricula">{matricula || `#${partes[0].coche_id}`}</span>
          {descCoche && <span className="sw-parte-card__desc"> · {descCoche}</span>}
          {cliente_nombre && <span className="sw-parte-card__cliente"> · {cliente_nombre}</span>}
          {hayOtroTrabajando && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.4rem", flexWrap: "wrap" }}>
              <span style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.35)", color: "#fbbf24", borderRadius: "6px", padding: "0.15rem 0.6rem", fontSize: "0.72rem", fontWeight: 600 }}>⚠ Ya hay alguien trabajando</span>
              {!esTareaInterna && (
                <button
                  type="button"
                  disabled={cargando}
                  onClick={() => onSumarmeCoche(grupo)}
                  style={{ background: "rgba(212,175,55,0.1)", border: "1px solid rgba(212,175,55,0.3)", color: "var(--sw-accent)", borderRadius: "7px", padding: "0.15rem 0.65rem", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer" }}
                >
                  ➕ Sumarme
                </button>
              )}
            </div>
          )}
        </div>
        <EstadoBadge estado={estadoGlobal} />
      </div>

      {/* Lista de servicios con acción individual por parte */}
      <div style={{ marginTop: "0.5rem", display: "flex", flexDirection: "column", gap: "0.45rem" }}>
        {partes.map((p) => {
          const esMio = Number(p.empleado_id) === yoId;
          return (
            <div
              key={p.id}
              style={{
                border: "1px solid var(--sw-border)",
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
                    <span style={{ color: "var(--sw-muted)" }}> · {p.empleado_nombre}</span>
                  )}
                </div>
                <div className="d-flex align-items-center gap-2">
                  <EstadoBadge estado={p.estado} />
                  {p.estado === "pendiente" && (
                    <button
                      className="sw-parte-btn sw-parte-btn--start"
                      disabled={cargando}
                      onClick={() => onAccionParte(p.id, "tomar_e_iniciar")}
                    >
                      ▶ Iniciar
                    </button>
                  )}
                  {p.estado === "en_proceso" && esMio && (
                    <>
                      <button
                        className="sw-parte-btn sw-parte-btn--pause"
                        disabled={cargando}
                        onClick={() => onAccionParte(p.id, "en_pausa")}
                      >
                        ⏸ Pausar
                      </button>
                      <button
                        className="sw-parte-btn sw-parte-btn--finish"
                        disabled={cargando}
                        onClick={() => onAccionParte(p.id, "finalizado")}
                      >
                        ✓ Finalizar
                      </button>
                    </>
                  )}
                  {p.estado === "en_pausa" && esMio && (
                    <>
                      <button
                        className="sw-parte-btn sw-parte-btn--resume"
                        disabled={cargando}
                        onClick={() => onAccionParte(p.id, "quitar_pausa")}
                      >
                        ▶ Reanudar
                      </button>
                      <button
                        className="sw-parte-btn sw-parte-btn--finish"
                        disabled={cargando}
                        onClick={() => onAccionParte(p.id, "finalizado")}
                      >
                        ✓ Finalizar
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Timer referencia del coche */}
      <div className="sw-parte-card__footer">
        <Cronometro parte={{ ...parteRef, estado: estadoGlobal }} />
        <div className="sw-parte-card__actions" />
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
  empleado: "detailing",
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
      const rolNormalizado = normalizeRol(userRol);
      const tipoRol = ROL_TO_TIPO[rolNormalizado] || rolNormalizado || "";
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

  // Actúa sobre un parte individual para permitir colaboración en el mismo coche.
  const onAccionParte = useCallback(async (parteId, accion) => {
    setError("");
    setAccionCargando(true);
    try {
      if (accion === "tomar_e_iniciar") {
        await tomarParteTrabajo(parteId);
        await cambiarEstadoParte(parteId, "en_proceso");
      } else if (accion === "quitar_pausa") {
        await quitarPausa(parteId);
      } else {
        await cambiarEstadoParte(parteId, accion);
      }
      await cargarPartes();
    } catch (e) {
      setError(e?.message || "No se pudo realizar la acción.");
    } finally {
      setAccionCargando(false);
    }
  }, [cargarPartes]);

  const onCrearTareaInterna = useCallback(async () => {
    const texto = String(tareaInternaTexto || "").trim();
    if (!texto) {
      setError("Escribe la tarea interna (ej. limpiar baño)");
      return;
    }
    setError("");
    setTareaInternaLoading(true);
    try {
      const rolNormalizado = normalizeRol(userRol);
      const tipo = ROL_TO_TIPO[rolNormalizado] || rolNormalizado || "otro";
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

  const onSumarmeCoche = useCallback(async (grupo) => {
    const cocheId = Number(grupo?.partes?.[0]?.coche_id);
    if (!Number.isFinite(cocheId)) {
      setError("No se pudo identificar el coche para crear tu parte.");
      return;
    }

    const rolNormalizado = normalizeRol(userRol);
    const tipoNormalizado = ROL_TO_TIPO[rolNormalizado] || rolNormalizado || "otro";
    const sugerida = `Apoyo en ${getTipoTareaLabel(tipoNormalizado)}`;
    const observaciones = window.prompt("Describe brevemente el trabajo que vas a realizar en este coche:", sugerida);
    if (observaciones === null) return;

    setError("");
    setAccionCargando(true);
    try {
      const tipo = tipoNormalizado;
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
        <div style={{ margin: "0.75rem 1rem 0", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "10px", padding: "0.75rem 1rem", display: "flex", justifyContent: "space-between", alignItems: "center", color: "#fca5a5", fontSize: "0.85rem" }}>
          <span>{error}</span>
          <button type="button" className="btn-close btn-close-white btn-sm" onClick={() => setError("")} />
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
          <div style={{ margin: "0 1rem 1rem", background: "var(--sw-surface)", border: "1px solid var(--sw-border)", borderTop: "2px solid rgba(212,175,55,0.3)", borderRadius: "14px", padding: "1rem 1.1rem" }}>
            <p style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(212,175,55,0.7)", margin: "0 0 0.6rem" }}>🧹 Tarea interna (sin coche)</p>
            <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
              <input
                className="form-control"
                style={{ maxWidth: "420px", background: "var(--sw-surface-2)", border: "1px solid var(--sw-border)", color: "var(--sw-text)", borderRadius: "9px" }}
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
                onAccionParte={onAccionParte}
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
