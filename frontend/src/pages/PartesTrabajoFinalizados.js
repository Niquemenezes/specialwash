import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  listarPartesTrabajo,
  listarCochesCatalogo,
  listarEmpleadosDisponibles,
} from "../utils/parteTrabajoApi";

function formatDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString();
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
    const grupos = {};
    partesArray.forEach((p) => {
      const fecha = p.fecha_fin ? new Date(p.fecha_fin).toLocaleDateString("es-ES") : "Sin fecha";
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
      const [cochesAll, empleados] = await Promise.all([
        listarCochesCatalogo(),
        listarEmpleadosDisponibles(),
      ]);
      setCochesCatalogo(Array.isArray(cochesAll) ? cochesAll : []);
      setEmpleadosDisponibles(Array.isArray(empleados) ? empleados : []);
    } catch (e) {
      setError(e?.message || "No se pudieron cargar coches/empleados.");
      setCochesCatalogo([]);
      setEmpleadosDisponibles([]);
    }
  }, []);

  useEffect(() => {
    cargarRecursos();
  }, [cargarRecursos]);

  const calcularTiempoTotal = () => {
    return partes.reduce((sum, p) => sum + (typeof p.duracion_horas === "number" ? p.duracion_horas : 0), 0);
  };

  const analisisEmpleados = useMemo(() => {
    const mapa = new Map();

    for (const p of partes) {
      const empleadoId = Number(p.empleado_id);
      const empleado = empleadosDisponibles.find((u) => Number(u.id) === empleadoId);
      const nombre = empleado?.nombre || `ID ${p.empleado_id}`;
      const horas = typeof p.duracion_horas === "number" ? p.duracion_horas : 0;
      const fecha = p.fecha_fin ? new Date(p.fecha_fin).toLocaleDateString("es-ES") : "Sin fecha";

      if (!mapa.has(empleadoId)) {
        mapa.set(empleadoId, {
          empleado_id: empleadoId,
          nombre,
          total_horas: 0,
          total_partes: 0,
          por_dia: {},
        });
      }

      const fila = mapa.get(empleadoId);
      fila.total_horas += horas;
      fila.total_partes += 1;
      fila.por_dia[fecha] = (fila.por_dia[fecha] || 0) + horas;
    }

    return Array.from(mapa.values())
      .map((row) => ({
        ...row,
        promedio_horas: row.total_partes > 0 ? row.total_horas / row.total_partes : 0,
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
          ✅ Partes Finalizados
        </h2>
        <p className="m-0 d-none d-md-block" style={{ fontSize: "0.85rem", color: "#aaa" }}>
          Historial de trabajos completados y entregas finales
        </p>
      </div>

      {/* STATS CARDS */}
      <div className="row g-3 mb-4">
        <div className="col-md-4">
          <div className="card shadow-sm" style={{ borderRadius: "12px", border: "1px solid #e0e0e0" }}>
            <div className="card-body">
              <p className="text-muted mb-2">📦 Total finalizados</p>
              <h4 className="fw-bold" style={{ color: "#d4af37" }}>{partes.length}</h4>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card shadow-sm" style={{ borderRadius: "12px", border: "1px solid #e0e0e0" }}>
            <div className="card-body">
              <p className="text-muted mb-2">⏱️ Tiempo total (h)</p>
              <h4 className="fw-bold" style={{ color: "#d4af37" }}>{calcularTiempoTotal().toFixed(2)}</h4>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card shadow-sm" style={{ borderRadius: "12px", border: "1px solid #e0e0e0" }}>
            <div className="card-body">
              <p className="text-muted mb-2">👥 Empleados</p>
              <h4 className="fw-bold" style={{ color: "#d4af37" }}>{new Set(partes.map((p) => p.empleado_id)).size}</h4>
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
                    {u.nombre}
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
            <div className="col-md-6">
              <label className="form-label">Fecha desde</label>
              <input
                type="date"
                className="form-control"
                value={fechaInicioFiltro}
                onChange={(e) => setFechaInicioFiltro(e.target.value)}
                style={{ borderRadius: "8px" }}
              />
            </div>
            <div className="col-md-6">
              <label className="form-label">Fecha hasta</label>
              <input
                type="date"
                className="form-control"
                value={fechaFinFiltro}
                onChange={(e) => setFechaFinFiltro(e.target.value)}
                style={{ borderRadius: "8px" }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* PERFORMANCE ANALYSIS */}
      {!loading && analisisEmpleados.length > 0 && (
        <div className="card mb-4 shadow-sm" style={{ borderRadius: "12px", border: "1px solid #e0e0e0" }}>
          <div className="card-body">
            <h5 className="card-title fw-semibold mb-3">📊 Análisis de rendimiento</h5>

            <div className="row g-3 mb-4">
              <div className="col-md-6">
                <div className="p-3" style={{ background: "#f0f8f5", borderRadius: "8px" }}>
                  <p className="text-muted mb-1">⚡ Más rápido</p>
                  <h6 className="fw-bold">{ranking.rapido?.nombre || "-"}</h6>
                  <small className="text-muted">{ranking.rapido ? `${ranking.rapido.promedio_horas.toFixed(2)} h/parte` : "-"}</small>
                </div>
              </div>
              <div className="col-md-6">
                <div className="p-3" style={{ background: "#fff5f5", borderRadius: "8px" }}>
                  <p className="text-muted mb-1">🐢 Más lento</p>
                  <h6 className="fw-bold">{ranking.lento?.nombre || "-"}</h6>
                  <small className="text-muted">{ranking.lento ? `${ranking.lento.promedio_horas.toFixed(2)} h/parte` : "-"}</small>
                </div>
              </div>
            </div>

            {analisisEmpleados.map((row) => (
              <div key={row.empleado_id} className="mb-3">
                <div className="d-flex justify-content-between mb-1">
                  <strong>{row.nombre}</strong>
                  <small className="text-muted">{row.total_partes} partes · {row.total_horas.toFixed(2)} h</small>
                </div>
                <div className="progress" style={{ height: "6px" }}>
                  <div
                    className="progress-bar"
                    role="progressbar"
                    style={{
                      width: `${scoreRapidez(row.promedio_horas)}%`,
                      background: "#d4af37",
                    }}
                  />
                </div>
                <small className="text-muted">Promedio: {row.promedio_horas.toFixed(2)} h/parte</small>
              </div>
            ))}

            <hr />

            <h6 className="fw-semibold mt-3 mb-3">Detalle por día</h6>
            <div className="table-responsive">
              <table className="table table-sm table-hover">
                <thead style={{ background: "#f8f9fa" }}>
                  <tr>
                    <th>Empleado</th>
                    <th>Fecha</th>
                    <th>Horas ese día</th>
                  </tr>
                </thead>
                <tbody>
                  {filasPorDia.map((fila, idx) => (
                    <tr key={`${fila.empleado}-${fila.fecha}-${idx}`}>
                      <td>{fila.empleado}</td>
                      <td className="small">{fila.fecha}</td>
                      <td className="fw-semibold">{fila.horas.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* LISTA FINALIZADOS */}
      {loading ? (
        <div className="text-center py-5">
          <p className="text-muted">Cargando partes finalizados...</p>
        </div>
      ) : partes.length === 0 ? (
        <div className="alert alert-info">📭 No hay partes finalizados aún. ¡Completa trabajos para verlos aquí!</div>
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
                      <th>Trabajo</th>
                      <th>Inicio</th>
                      <th>Fin</th>
                      <th>Duración (h)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grupoPartes.map((p) => (
                      <tr key={p.id}>
                        <td>#{p.id}</td>
                        <td>{cocheTextoPorId(p.coche_id)}</td>
                        <td>{empleadoNombrePorId(p.empleado_id)}</td>
                        <td>{p.observaciones || "-"}</td>
                        <td className="small">{formatDate(p.fecha_inicio)}</td>
                        <td className="small">{formatDate(p.fecha_fin)}</td>
                        <td>{typeof p.duracion_horas === "number" ? p.duracion_horas.toFixed(2) : "-"}</td>
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
  );
}
