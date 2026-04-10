import React, { useCallback, useEffect, useMemo, useState } from "react";
import { confirmar } from "../utils/confirmar";
import {
  listarPartesTrabajo,
  listarCochesCatalogo,
  listarEmpleadosDisponibles,
  listarServiciosCatalogo,
  editarParteTrabajo,
  eliminarParteTrabajo,
  formatDate,
  formatMinutes,
} from "../utils/parteTrabajoApi";

function deviationBadge(desviacionMinutos) {
  if (!Number.isFinite(Number(desviacionMinutos))) return <span className="text-muted">-</span>;
  const value = Number(desviacionMinutos);
  let cls = "bg-success";
  if (value > 30) cls = "bg-danger";
  else if (value > 10) cls = "bg-warning text-dark";
  return <span className={`badge ${cls}`}>{`${value > 0 ? "+" : ""}${value} min`}</span>;
}

export function AdminPartesTrabajoFinalizados() {
  const [partes, setPartes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [empleadoFiltro, setEmpleadoFiltro] = useState("");
  const [cocheFiltro, setCocheFiltro] = useState("");
  const [fechaInicioFiltro, setFechaInicioFiltro] = useState("");
  const [fechaFinFiltro, setFechaFinFiltro] = useState("");
  const [cochesCatalogo, setCochesCatalogo] = useState([]);
  const [empleadosDisponibles, setEmpleadosDisponibles] = useState([]);
  const [serviciosCatalogo, setServiciosCatalogo] = useState([]);
  const [costeHoraInterno, setCosteHoraInterno] = useState("");
  const [editandoId, setEditandoId] = useState(null);
  const [editEmpleadoId, setEditEmpleadoId] = useState("");
  const [editServicioId, setEditServicioId] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  const empleadoNombrePorId = useCallback(
    (id) => {
      const emp = empleadosDisponibles.find((u) => Number(u.id) === Number(id));
      return emp ? emp.nombre : `ID ${id}`;
    },
    [empleadosDisponibles]
  );

  const cocheTextoPorId = useCallback(
    (id) => {
      const coche = cochesCatalogo.find((c) => Number(c.coche_id) === Number(id));
      if (!coche) return `ID ${id}`;
      return `${coche.matricula}${coche.cliente_nombre ? ` - ${coche.cliente_nombre}` : ""}`;
    },
    [cochesCatalogo]
  );

  const groupByDate = (partesArray) => {
    const grupos = new Map();

    partesArray.forEach((p) => {
      const fechaFin = p?.fecha_fin ? new Date(p.fecha_fin) : null;
      const esValida = fechaFin && !Number.isNaN(fechaFin.getTime());
      const key = esValida ? fechaFin.toISOString().slice(0, 10) : "sin-fecha";
      const label = esValida ? fechaFin.toLocaleDateString("es-ES") : "Sin fecha";

      if (!grupos.has(key)) {
        grupos.set(key, { label, partes: [] });
      }
      grupos.get(key).partes.push(p);
    });

    return Array.from(grupos.entries())
      .sort(([aKey], [bKey]) => {
        if (aKey === "sin-fecha") return 1;
        if (bKey === "sin-fecha") return -1;
        return bKey.localeCompare(aKey);
      })
      .map(([, group]) => [
        group.label,
        group.partes.sort((a, b) => {
          const aTime = a?.fecha_fin ? new Date(a.fecha_fin).getTime() : 0;
          const bTime = b?.fecha_fin ? new Date(b.fecha_fin).getTime() : 0;
          return bTime - aTime;
        }),
      ]);
  };

  const cargarPartes = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const todasLosPartes = await listarPartesTrabajo({
        empleado_id: empleadoFiltro,
        coche_id: cocheFiltro,
      });
      const inicio = fechaInicioFiltro ? new Date(`${fechaInicioFiltro}T00:00:00`) : null;
      const fin = fechaFinFiltro ? new Date(`${fechaFinFiltro}T23:59:59`) : null;

      const finalizados = (Array.isArray(todasLosPartes) ? todasLosPartes : [])
        .filter((p) => p.estado === "finalizado")
        .filter((p) => {
          if (!p.fecha_fin) return false;
          const fechaFinParte = new Date(p.fecha_fin);
          if (Number.isNaN(fechaFinParte.getTime())) return false;
          if (inicio && fechaFinParte < inicio) return false;
          if (fin && fechaFinParte > fin) return false;
          return true;
        });

      setPartes(finalizados);
    } catch (e) {
      setError(e?.message || "No se pudieron cargar los partes finalizados.");
      setPartes([]);
    } finally {
      setLoading(false);
    }
  }, [empleadoFiltro, cocheFiltro, fechaInicioFiltro, fechaFinFiltro]);

  useEffect(() => {
    cargarPartes();
  }, [cargarPartes]);

  const cargarRecursos = useCallback(async () => {
    setError("");
    try {
      const [cochesAll, empleados, catalogo] = await Promise.all([
        listarCochesCatalogo(),
        listarEmpleadosDisponibles(),
        listarServiciosCatalogo(true),
      ]);
      setCochesCatalogo(Array.isArray(cochesAll) ? cochesAll : []);
      setEmpleadosDisponibles(Array.isArray(empleados) ? empleados : []);
      setServiciosCatalogo(Array.isArray(catalogo) ? catalogo : []);
    } catch (e) {
      setError(e?.message || "No se pudieron cargar coches/empleados.");
      setCochesCatalogo([]);
      setEmpleadosDisponibles([]);
      setServiciosCatalogo([]);
    }
  }, []);

  useEffect(() => {
    cargarRecursos();
  }, [cargarRecursos]);

  const calcularTiempoTotal = () => {
    return partes.reduce((sum, p) => sum + (typeof p.duracion_horas === "number" ? p.duracion_horas : 0), 0);
  };

  const calcularEstimadoTotalMin = () => {
    return partes.reduce((sum, p) => sum + (Number.parseInt(p.tiempo_estimado_minutos || 0, 10) || 0), 0);
  };

  const calcularRealTotalMin = () => {
    return partes.reduce((sum, p) => {
      const real = Number.parseInt(p.duracion_minutos || Math.round((Number(p.duracion_horas) || 0) * 60), 10) || 0;
      return sum + real;
    }, 0);
  };

  const costeHora = Number.parseFloat(String(costeHoraInterno || "0").replace(",", "."));
  const costeHoraSeguro = Number.isFinite(costeHora) && costeHora >= 0 ? costeHora : 0;
  const costeEstimado = (calcularEstimadoTotalMin() / 60) * costeHoraSeguro;
  const costeReal = (calcularRealTotalMin() / 60) * costeHoraSeguro;

  const analisisEmpleados = useMemo(() => {
    const mapa = new Map();

    for (const p of partes) {
      const empleadoId = Number(p.empleado_id);
      const empleado = empleadosDisponibles.find((u) => Number(u.id) === empleadoId);
      const nombre = empleado?.nombre || `ID ${p.empleado_id}`;
      const horas = typeof p.duracion_horas === "number" ? p.duracion_horas : 0;
      const estimadoMin = Number.parseInt(p.tiempo_estimado_minutos || 0, 10) || 0;
      const realMin = Number.parseInt(p.duracion_minutos || Math.round(horas * 60), 10) || 0;
      const fecha = p.fecha_fin ? new Date(p.fecha_fin).toLocaleDateString("es-ES") : "Sin fecha";

      if (!mapa.has(empleadoId)) {
        mapa.set(empleadoId, {
          empleado_id: empleadoId,
          nombre,
          total_horas: 0,
          total_estimado_minutos: 0,
          total_real_minutos: 0,
          total_partes: 0,
          por_dia: {},
        });
      }

      const fila = mapa.get(empleadoId);
      fila.total_horas += horas;
      fila.total_estimado_minutos += estimadoMin;
      fila.total_real_minutos += realMin;
      fila.total_partes += 1;
      fila.por_dia[fecha] = (fila.por_dia[fecha] || 0) + horas;
    }

    return Array.from(mapa.values())
      .map((row) => ({
        ...row,
        promedio_horas: row.total_partes > 0 ? row.total_horas / row.total_partes : 0,
        desviacion_minutos: row.total_real_minutos - row.total_estimado_minutos,
      }))
      .sort((a, b) => a.promedio_horas - b.promedio_horas);
  }, [partes, empleadosDisponibles]);

  const ranking = useMemo(() => {
    if (!analisisEmpleados.length) return { rapido: null, lento: null, maxPromedio: 0, minPromedio: 0 };
    const rapido = analisisEmpleados[0];
    const lento = analisisEmpleados[analisisEmpleados.length - 1];
    const promedios = analisisEmpleados.map((x) => x.promedio_horas);
    return {
      rapido,
      lento,
      maxPromedio: Math.max(...promedios),
      minPromedio: Math.min(...promedios),
    };
  }, [analisisEmpleados]);

  const filasPorDia = useMemo(() => {
    const filas = [];
    for (const empleado of analisisEmpleados) {
      for (const [fecha, horas] of Object.entries(empleado.por_dia)) {
        filas.push({
          empleado: empleado.nombre,
          fecha,
          horas,
        });
      }
    }
    return filas.sort((a, b) => {
      if (a.fecha === b.fecha) return a.empleado.localeCompare(b.empleado);
      return new Date(b.fecha) - new Date(a.fecha);
    });
  }, [analisisEmpleados]);

  const scoreRapidez = (promedio) => {
    if (!Number.isFinite(promedio)) return 0;
    if (ranking.maxPromedio === ranking.minPromedio) return 60;
    const score = ((ranking.maxPromedio - promedio) / (ranking.maxPromedio - ranking.minPromedio)) * 100;
    return Math.max(10, Math.min(100, score));
  };

  const onAbrirEditar = (parte) => {
    setEditandoId(parte.id);
    setEditEmpleadoId(parte.empleado_id ? String(parte.empleado_id) : "");
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

  const onEliminarParte = async (parte) => {
    const confirmado = await confirmar(
      `Vas a eliminar el parte #${parte.id} (${cocheTextoPorId(parte.coche_id)}). Esta acción no se puede deshacer.`
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

  /* ── SVG icons ── */
  const ICONS = {
    check:    (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>),
    refresh:  (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4v5h5M20 20v-5h-5M4 9a9 9 0 0115.454-3.454M20 15a9 9 0 01-15.454 3.454"/></svg>),
    search:   (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>),
    pen:      (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>),
    trash:    (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>),
    clock:    (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>),
    close:    (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>),
    save:     (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>),
    bolt:     (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>),
    chart:    (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>),
    euro:     (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 10h12M4 14h12M19.5 8A7.5 7.5 0 1 0 19.5 16"/></svg>),
    calendar: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>),
  };

  const desvioColor = (costeReal - costeEstimado) > 0 ? "#ef4444" : "#22c55e";

  return (
    <div className="sw-ent-wrapper">

      {/* ── Hero ── */}
      <div className="sw-veh-hero">
        <div className="sw-veh-hero-inner container">
          <div className="sw-veh-hero-body">
            <div className="sw-veh-hero-icon">
              <span style={{ width: 24, height: 24, display: "flex" }}>{ICONS.check}</span>
            </div>
            <div style={{ flex: 1 }}>
              <p className="sw-home-eyebrow" style={{ marginBottom: "0.2rem" }}>Taller · Historial</p>
              <h1 className="sw-veh-hero-title">Partes Finalizados</h1>
              <p className="sw-veh-hero-sub">Historial de trabajos completados y análisis de rendimiento</p>
            </div>
            <button
              className="sw-ent-submit-btn"
              onClick={cargarPartes}
              style={{ padding: "0.6rem 1.4rem", display: "flex", alignItems: "center", gap: "0.45rem" }}
            >
              <span style={{ width: 16, height: 16, display: "inline-flex" }}>{ICONS.refresh}</span>
              Actualizar
            </button>
          </div>
        </div>
      </div>

      <div className="container sw-ent-content" style={{ maxWidth: 1200 }}>

        {/* ── Error ── */}
        {error && (
          <div style={{
            background: "color-mix(in srgb,var(--sw-danger,#ef4444) 12%,transparent)",
            border: "1px solid color-mix(in srgb,var(--sw-danger,#ef4444) 30%,transparent)",
            color: "var(--sw-danger,#ef4444)", borderRadius: 12, padding: "0.75rem 1rem",
            display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.9rem",
          }}>
            {error}
            <button onClick={() => setError("")} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", display: "flex" }}>
              <span style={{ width: 18, height: 18, display: "flex" }}>{ICONS.close}</span>
            </button>
          </div>
        )}

        {/* ── Stats ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: "1rem" }}>
          {[
            { label: "Total finalizados",  value: partes.length,                              color: "var(--sw-accent,#d4af37)" },
            { label: "Tiempo real (h)",    value: calcularTiempoTotal().toFixed(2),            color: "#38bdf8" },
            { label: "Estimado total",     value: formatMinutes(calcularEstimadoTotalMin()),   color: "#a78bfa" },
            { label: "Coste real",         value: costeHoraSeguro > 0 ? `${costeReal.toFixed(2)} €` : "—", color: "#22c55e" },
          ].map((item) => (
            <div key={item.label} style={{
              background: "var(--sw-surface)", border: "1px solid var(--sw-border)",
              borderRadius: 14, padding: "1rem 1.25rem", display: "flex", flexDirection: "column", gap: "0.25rem",
            }}>
              <span style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--sw-muted)" }}>{item.label}</span>
              <span style={{ fontSize: "1.35rem", fontWeight: 800, color: item.color, lineHeight: 1.2 }}>{item.value}</span>
            </div>
          ))}
        </div>

        {/* ── Coste interno ── */}
        <div className="sw-ent-card">
          <div className="sw-ent-card-header">
            <div className="sw-ent-card-header-icon" style={{ background: "rgba(212,175,55,0.1)", border: "1px solid rgba(212,175,55,0.22)", color: "var(--sw-accent,#d4af37)" }}>
              <span style={{ width: 18, height: 18, display: "flex" }}>{ICONS.euro}</span>
            </div>
            <div>
              <p className="sw-ent-card-eyebrow">Gestión interna</p>
              <h2 className="sw-ent-card-title">Coste por hora</h2>
            </div>
          </div>
          <div className="sw-ent-card-body">
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
              <input
                type="number"
                min="0"
                step="0.01"
                className="form-control sw-pinput"
                style={{ maxWidth: 180 }}
                value={costeHoraInterno}
                onChange={(e) => setCosteHoraInterno(e.target.value)}
                placeholder="€/hora (ej. 18)"
              />
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                {[
                  { label: "Estimado", value: `${costeEstimado.toFixed(2)} €`, color: "var(--sw-muted)" },
                  { label: "Real",     value: `${costeReal.toFixed(2)} €`,     color: "#38bdf8" },
                  { label: "Desvío",   value: `${(costeReal - costeEstimado) > 0 ? "+" : ""}${(costeReal - costeEstimado).toFixed(2)} €`, color: desvioColor },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{
                    background: "var(--sw-surface-2)", border: "1px solid var(--sw-border)",
                    borderRadius: 10, padding: "0.45rem 0.9rem", display: "flex", flexDirection: "column", gap: "0.1rem",
                  }}>
                    <span style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--sw-muted)" }}>{label}</span>
                    <span style={{ fontWeight: 800, color, fontSize: "1rem" }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Filtros ── */}
        <div className="sw-ent-card">
          <div className="sw-ent-card-header">
            <div className="sw-ent-card-header-icon" style={{ background: "rgba(212,175,55,0.1)", border: "1px solid rgba(212,175,55,0.22)", color: "var(--sw-accent,#d4af37)" }}>
              <span style={{ width: 18, height: 18, display: "flex" }}>{ICONS.search}</span>
            </div>
            <div>
              <p className="sw-ent-card-eyebrow">Búsqueda</p>
              <h2 className="sw-ent-card-title">Filtrar partes</h2>
            </div>
          </div>
          <div className="sw-ent-card-body">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: "0.75rem" }}>
              {/* Empleado */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                <span style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--sw-muted)" }}>Empleado</span>
                <select className="form-select sw-pinput" value={empleadoFiltro} onChange={(e) => setEmpleadoFiltro(e.target.value)}>
                  <option value="">Todos</option>
                  {empleadosDisponibles.map((u) => (
                    <option key={u.id} value={u.id}>{u.nombre}</option>
                  ))}
                </select>
              </div>
              {/* Coche */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                <span style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--sw-muted)" }}>Coche</span>
                <select className="form-select sw-pinput" value={cocheFiltro} onChange={(e) => setCocheFiltro(e.target.value)}>
                  <option value="">Todos</option>
                  {cochesCatalogo.map((c) => (
                    <option key={c.coche_id} value={c.coche_id}>
                      {c.matricula}{c.coche_descripcion ? ` - ${c.coche_descripcion}` : ""}{c.cliente_nombre ? ` - ${c.cliente_nombre}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              {/* Desde */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                <span style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--sw-muted)" }}>Desde</span>
                <input type="date" className="form-control sw-pinput" value={fechaInicioFiltro} onChange={(e) => setFechaInicioFiltro(e.target.value)} />
              </div>
              {/* Hasta */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                <span style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--sw-muted)" }}>Hasta</span>
                <input type="date" className="form-control sw-pinput" value={fechaFinFiltro} onChange={(e) => setFechaFinFiltro(e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        {/* ── Análisis rendimiento ── */}
        {!loading && analisisEmpleados.length > 0 && (
          <div className="sw-ent-card">
            <div className="sw-ent-card-header">
              <div className="sw-ent-card-header-icon" style={{ background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.22)", color: "#38bdf8" }}>
                <span style={{ width: 18, height: 18, display: "flex" }}>{ICONS.chart}</span>
              </div>
              <div>
                <p className="sw-ent-card-eyebrow">Estadísticas</p>
                <h2 className="sw-ent-card-title">Análisis de rendimiento</h2>
              </div>
            </div>
            <div className="sw-ent-card-body" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

              {/* Ranking rápido/lento */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: "0.75rem" }}>
                <div style={{ background: "color-mix(in srgb,#22c55e 10%,transparent)", border: "1px solid color-mix(in srgb,#22c55e 25%,transparent)", borderRadius: 12, padding: "1rem 1.25rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem" }}>
                    <span style={{ width: 14, height: 14, display: "flex", color: "#22c55e" }}>{ICONS.bolt}</span>
                    <span style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "#22c55e" }}>Más rápido</span>
                  </div>
                  <p style={{ margin: 0, fontWeight: 700, color: "var(--sw-text)", fontSize: "1rem" }}>{ranking.rapido?.nombre || "—"}</p>
                  <p style={{ margin: 0, color: "var(--sw-muted)", fontSize: "0.82rem" }}>{ranking.rapido ? `${ranking.rapido.promedio_horas.toFixed(2)} h/parte` : "—"}</p>
                </div>
                <div style={{ background: "color-mix(in srgb,#ef4444 10%,transparent)", border: "1px solid color-mix(in srgb,#ef4444 25%,transparent)", borderRadius: 12, padding: "1rem 1.25rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem" }}>
                    <span style={{ width: 14, height: 14, display: "flex", color: "#ef4444" }}>{ICONS.clock}</span>
                    <span style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "#ef4444" }}>Más lento</span>
                  </div>
                  <p style={{ margin: 0, fontWeight: 700, color: "var(--sw-text)", fontSize: "1rem" }}>{ranking.lento?.nombre || "—"}</p>
                  <p style={{ margin: 0, color: "var(--sw-muted)", fontSize: "0.82rem" }}>{ranking.lento ? `${ranking.lento.promedio_horas.toFixed(2)} h/parte` : "—"}</p>
                </div>
              </div>

              {/* Barras por empleado */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {analisisEmpleados.map((row) => (
                  <div key={row.empleado_id}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.3rem" }}>
                      <span style={{ fontWeight: 700, color: "var(--sw-text)", fontSize: "0.9rem" }}>{row.nombre}</span>
                      <span style={{ color: "var(--sw-muted)", fontSize: "0.78rem" }}>{row.total_partes} partes · {row.total_horas.toFixed(2)} h</span>
                    </div>
                    <div style={{ height: 6, background: "var(--sw-border)", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${scoreRapidez(row.promedio_horas)}%`, background: "var(--sw-accent,#d4af37)", borderRadius: 4, transition: "width 0.4s ease" }} />
                    </div>
                    <div style={{ marginTop: "0.25rem", fontSize: "0.75rem", color: "var(--sw-muted)" }}>
                      Promedio: {row.promedio_horas.toFixed(2)} h/parte · Desvío: {deviationBadge(row.desviacion_minutos)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Detalle por día */}
              <div>
                <p style={{ margin: "0 0 0.6rem", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--sw-accent,#d4af37)" }}>
                  Detalle por día
                </p>
                <div style={{ background: "var(--sw-surface)", border: "1px solid var(--sw-border)", borderRadius: 12, overflow: "hidden" }}>
                  <div className="table-responsive">
                    <table className="table align-middle mb-0" style={{ color: "var(--sw-text)" }}>
                      <thead>
                        <tr style={{ background: "var(--sw-surface-2)", borderBottom: "2px solid var(--sw-border)" }}>
                          {["Empleado", "Fecha", "Horas"].map((h) => (
                            <th key={h} style={{ padding: "0.7rem 1rem", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--sw-muted)", border: "none" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filasPorDia.map((fila, idx) => (
                          <tr key={`${fila.empleado}-${fila.fecha}-${idx}`}
                            style={{ borderBottom: "1px solid var(--sw-border)" }}
                            onMouseEnter={e => e.currentTarget.style.background = "color-mix(in srgb,var(--sw-accent,#d4af37) 5%,transparent)"}
                            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                          >
                            <td style={{ padding: "0.7rem 1rem", fontWeight: 600 }}>{fila.empleado}</td>
                            <td style={{ padding: "0.7rem 1rem", color: "var(--sw-muted)", fontSize: "0.85rem" }}>{fila.fecha}</td>
                            <td style={{ padding: "0.7rem 1rem", fontWeight: 700, color: "var(--sw-accent,#d4af37)" }}>{fila.horas.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ── Lista partes finalizados ── */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "4rem", color: "var(--sw-muted)" }}>
            <div className="spinner-border spinner-border-sm me-2" style={{ color: "var(--sw-accent,#d4af37)" }} />
            Cargando partes finalizados…
          </div>
        ) : partes.length === 0 ? (
          <div style={{
            background: "var(--sw-surface)", border: "1px solid var(--sw-border)",
            borderRadius: 14, padding: "3rem", textAlign: "center", color: "var(--sw-muted)", fontSize: "0.9rem",
          }}>
            No hay partes finalizados aún.
          </div>
        ) : (
          groupByDate(partes).map(([fecha, grupoPartes]) => (
            <div key={fecha}>
              {/* Cabecera de grupo fecha */}
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.75rem" }}>
                <span style={{ width: 16, height: 16, display: "flex", color: "var(--sw-accent,#d4af37)" }}>{ICONS.calendar}</span>
                <span style={{ fontSize: "0.78rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--sw-accent,#d4af37)" }}>{fecha}</span>
                <span style={{ fontSize: "0.72rem", color: "var(--sw-muted)", fontWeight: 500 }}>({grupoPartes.length} partes)</span>
              </div>

              <div style={{
                background: "var(--sw-surface)", border: "1px solid var(--sw-border)",
                borderRadius: 16, overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.18)",
                marginBottom: "1.5rem",
              }}>
                <div className="table-responsive">
                  <table className="table align-middle mb-0" style={{ color: "var(--sw-text)" }}>
                    <thead>
                      <tr style={{ background: "var(--sw-surface-2)", borderBottom: "2px solid var(--sw-border)" }}>
                        {["#", "Coche", "Empleado", "Trabajo", "Inicio", "Fin", "Estimado", "Real (h)", "Desvío", ""].map((h) => (
                          <th key={h} style={{
                            padding: "0.85rem 1rem", fontSize: "0.65rem", fontWeight: 700,
                            letterSpacing: "0.08em", textTransform: "uppercase",
                            color: "var(--sw-muted)", border: "none",
                            textAlign: h === "" ? "right" : "left",
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {grupoPartes.map((p) => (
                        <tr key={p.id}
                          style={{ borderBottom: "1px solid var(--sw-border)", transition: "background 0.15s" }}
                          onMouseEnter={e => e.currentTarget.style.background = "color-mix(in srgb,var(--sw-accent,#d4af37) 5%,transparent)"}
                          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                        >
                          <td style={{ padding: "0.85rem 1rem", color: "var(--sw-muted)", fontSize: "0.78rem", fontWeight: 600 }}>#{p.id}</td>
                          <td style={{ padding: "0.85rem 1rem", fontWeight: 700, color: "var(--sw-text)", fontSize: "0.88rem" }}>{cocheTextoPorId(p.coche_id)}</td>
                          <td style={{ padding: "0.85rem 1rem", color: "var(--sw-muted)", fontSize: "0.85rem" }}>{empleadoNombrePorId(p.empleado_id)}</td>
                          <td style={{ padding: "0.85rem 1rem" }}>
                            <span style={{ fontWeight: 600, color: "var(--sw-text)", fontSize: "0.88rem" }}>{p.observaciones || "—"}</span>
                          </td>
                          <td style={{ padding: "0.85rem 1rem", color: "var(--sw-muted)", fontSize: "0.78rem" }}>{formatDate(p.fecha_inicio)}</td>
                          <td style={{ padding: "0.85rem 1rem", color: "var(--sw-muted)", fontSize: "0.78rem" }}>{formatDate(p.fecha_fin)}</td>
                          <td style={{ padding: "0.85rem 1rem", color: "var(--sw-muted)", fontSize: "0.82rem" }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                              <span style={{ width: 12, height: 12, display: "inline-flex", opacity: 0.6 }}>{ICONS.clock}</span>
                              {formatMinutes(p.tiempo_estimado_minutos || 0)}
                            </span>
                          </td>
                          <td style={{ padding: "0.85rem 1rem", fontWeight: 700, color: "var(--sw-accent,#d4af37)" }}>
                            {typeof p.duracion_horas === "number" ? p.duracion_horas.toFixed(2) : "—"}
                          </td>
                          <td style={{ padding: "0.85rem 1rem" }}>{deviationBadge(p.desviacion_minutos)}</td>
                          <td style={{ padding: "0.85rem 1rem", textAlign: "right" }}>
                            <div style={{ display: "flex", gap: "0.4rem", justifyContent: "flex-end" }}>
                              <button
                                onClick={() => onAbrirEditar(p)}
                                title="Editar"
                                style={{
                                  background: "color-mix(in srgb,var(--sw-accent,#d4af37) 12%,transparent)",
                                  border: "1px solid color-mix(in srgb,var(--sw-accent,#d4af37) 30%,transparent)",
                                  color: "var(--sw-accent,#d4af37)", borderRadius: 8,
                                  padding: "0.35rem 0.55rem", cursor: "pointer", display: "flex", alignItems: "center",
                                }}
                              >
                                <span style={{ width: 14, height: 14, display: "flex" }}>{ICONS.pen}</span>
                              </button>
                              <button
                                onClick={() => onEliminarParte(p)}
                                title="Eliminar"
                                style={{
                                  background: "color-mix(in srgb,var(--sw-danger,#ef4444) 10%,transparent)",
                                  border: "1px solid color-mix(in srgb,var(--sw-danger,#ef4444) 28%,transparent)",
                                  color: "var(--sw-danger,#ef4444)", borderRadius: 8,
                                  padding: "0.35rem 0.55rem", cursor: "pointer", display: "flex", alignItems: "center",
                                }}
                              >
                                <span style={{ width: 14, height: 14, display: "flex" }}>{ICONS.trash}</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ))
        )}

      </div>

      {/* ── Modal editar ── */}
      {editandoId && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 1050,
            background: "var(--sw-overlay-bg,rgba(0,0,0,0.6))",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "1rem", backdropFilter: "blur(4px)",
          }}
          onClick={(e) => { if (e.target === e.currentTarget) onCancelarEditar(); }}
        >
          <div style={{
            background: "var(--sw-surface)", border: "1px solid var(--sw-border)",
            borderRadius: 20, width: "100%", maxWidth: 520,
            boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
            animation: "sw-fade-up 0.22s ease both",
          }}>
            {/* Header */}
            <div style={{
              padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--sw-border)",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <span style={{
                  width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
                  background: "color-mix(in srgb,var(--sw-accent,#d4af37) 14%,transparent)",
                  border: "1px solid color-mix(in srgb,var(--sw-accent,#d4af37) 28%,transparent)",
                  color: "var(--sw-accent,#d4af37)",
                }}>
                  <span style={{ width: 18, height: 18, display: "flex" }}>{ICONS.pen}</span>
                </span>
                <div>
                  <p style={{ margin: 0, fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--sw-muted)" }}>Modificar parte</p>
                  <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "var(--sw-text)" }}>Editar Parte #{editandoId}</h3>
                </div>
              </div>
              <button onClick={onCancelarEditar} style={{ background: "none", border: "none", color: "var(--sw-muted)", cursor: "pointer", padding: "0.25rem", borderRadius: 6, display: "flex" }}>
                <span style={{ width: 20, height: 20, display: "flex" }}>{ICONS.close}</span>
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                <span style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--sw-muted)" }}>Empleado</span>
                <select
                  className="form-select sw-pinput"
                  value={editEmpleadoId}
                  onChange={(e) => setEditEmpleadoId(e.target.value)}
                  disabled={editLoading}
                >
                  <option value="">Selecciona empleado…</option>
                  {empleadosDisponibles.map((u) => (
                    <option key={u.id} value={u.id}>{u.nombre} ({u.rol})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                <span style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--sw-muted)" }}>Servicio</span>
                <select
                  className="form-select sw-pinput"
                  value={editServicioId}
                  onChange={(e) => setEditServicioId(e.target.value)}
                  disabled={editLoading}
                >
                  <option value="">Selecciona servicio…</option>
                  {serviciosCatalogo.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}{s.precio_base != null ? ` (${Number(s.precio_base).toFixed(2)} €)` : ""}
                    </option>
                  ))}
                </select>
                {serviciosCatalogo.length === 0 && (
                  <span style={{ fontSize: "0.8rem", color: "var(--sw-muted)" }}>No hay servicios en el catálogo.</span>
                )}
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: "1rem 1.5rem", borderTop: "1px solid var(--sw-border)", display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
              <button
                onClick={onCancelarEditar}
                disabled={editLoading}
                style={{
                  background: "var(--sw-surface-2)", border: "1px solid var(--sw-border)",
                  color: "var(--sw-muted)", borderRadius: 10, padding: "0.6rem 1.2rem",
                  fontWeight: 600, fontSize: "0.85rem", cursor: "pointer",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={onGuardarEdicion}
                disabled={editLoading}
                style={{
                  background: "var(--sw-accent,#d4af37)", border: "none",
                  color: "#000", borderRadius: 10, padding: "0.6rem 1.4rem",
                  fontWeight: 700, fontSize: "0.85rem", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: "0.4rem",
                  opacity: editLoading ? 0.6 : 1,
                }}
              >
                <span style={{ width: 14, height: 14, display: "flex" }}>{ICONS.save}</span>
                {editLoading ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
