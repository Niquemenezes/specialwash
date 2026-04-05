import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Context } from "../store/appContext";
import { normalizeRol } from "../utils/authSession";

const ESTADOS = [
  { key: "todos", label: "Todos" },
  { key: "en_proceso", label: "En trabajo" },
  { key: "en_pausa", label: "En pausa" },
  { key: "parte_pendiente", label: "Parte asignado" },
  { key: "en_repaso", label: "En repaso" },
  { key: "listo_entrega", label: "Listo entrega" },
  { key: "esperando_parte", label: "Sin parte" },
];

const fmtFecha = (value) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("es-ES");
};

const ROL_LABEL = {
  detailing: "Detailing",
  pintura: "Pintura",
  tapicero: "Tapiceria",
  calidad: "Calidad",
  otro: "General",
};

const fmtRol = (rol) => ROL_LABEL[String(rol || "").toLowerCase()] || "General";

export default function EstadoCochesPage() {
  const { actions } = useContext(Context);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [q, setQ] = useState("");

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await actions.getPendientesEntrega();
      setRows(Array.isArray(data) ? data : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [actions]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const conteoPorEstado = useMemo(() => {
    const out = { todos: rows.length };
    for (const r of rows) {
      const k = r?.estado_coche?.estado || "sin_estado";
      out[k] = (out[k] || 0) + 1;
    }
    return out;
  }, [rows]);

  const filtradas = useMemo(() => {
    const texto = q.trim().toLowerCase();
    return rows.filter((r) => {
      const estadoOk = filtroEstado === "todos" || (r?.estado_coche?.estado === filtroEstado);
      if (!estadoOk) return false;

      if (!texto) return true;

      const bag = [
        r?.matricula,
        r?.cliente_nombre,
        r?.coche_descripcion,
        r?.estado_coche?.label,
        r?.estado_coche?.parte_empleado_nombre,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return bag.includes(texto);
    });
  }, [rows, filtroEstado, q]);

  return (
    <div className="container py-4">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2 mb-3">
        <h2 className="mb-0">Dónde está cada coche</h2>
        <button className="btn btn-outline-dark btn-sm" onClick={cargar}>Recargar</button>
      </div>

      <p className="text-muted mb-3">
        Seguimiento operativo de vehículos pendientes de entrega y su estado actual en taller.
      </p>

      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body d-flex flex-column gap-3">
          <input
            className="form-control"
            placeholder="Buscar por matrícula, cliente, coche, estado o empleado..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          <div className="d-flex flex-wrap gap-2">
            {ESTADOS.map((e) => {
              const active = filtroEstado === e.key;
              const total = conteoPorEstado[e.key] || 0;
              return (
                <button
                  key={e.key}
                  type="button"
                  className={`btn btn-sm ${active ? "btn-dark" : "btn-outline-secondary"}`}
                  onClick={() => setFiltroEstado(e.key)}
                >
                  {e.label} ({total})
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="card border-0 shadow-sm">
        <div className="card-body p-0">
          {loading ? (
            <div className="p-4 text-center text-muted">Cargando coches...</div>
          ) : filtradas.length === 0 ? (
            <div className="p-4 text-center text-muted">No hay coches para los filtros seleccionados.</div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Matrícula</th>
                    <th>Cliente</th>
                    <th>Coche</th>
                    <th>Estado actual</th>
                    <th>Empleado</th>
                    <th>Parte</th>
                    <th>Última inspección</th>
                  </tr>
                </thead>
                <tbody>
                  {filtradas.map((r) => {
                    const estado = r?.estado_coche || null;
                    const empleadosActivos = Array.isArray(estado?.partes_activas_empleados)
                      ? estado.partes_activas_empleados
                      : [];
                    const partesActivasIds = Array.isArray(estado?.partes_activas_ids)
                      ? estado.partes_activas_ids
                      : [];
                    const partesActivasDetalle = Array.isArray(estado?.partes_activas_detalle)
                      ? estado.partes_activas_detalle
                      : [];
                    const rolesTodos = Array.isArray(estado?.partes_roles_todos)
                      ? estado.partes_roles_todos
                      : [];
                    const rolesDesdeServicios = Array.isArray(r?.servicios_aplicados)
                      ? [...new Set(
                          r.servicios_aplicados
                            .map((s) => normalizeRol(s?.tipo_tarea || s?.rol || s?.rol_responsable))
                            .filter(Boolean)
                        )]
                      : [];
                    const rolesAsignados = rolesTodos.length > 0
                      ? rolesTodos
                      : [...new Set(partesActivasDetalle.map((p) => normalizeRol(p?.tipo_tarea)).filter(Boolean))];
                    const rolesAsignadosFinal = rolesAsignados.length > 0 ? rolesAsignados : rolesDesdeServicios;
                    const totalTrabajos = Math.max(
                      Number(estado?.partes_activas_count || 0),
                      partesActivasIds.length
                    );
                    const estadoLabel = estado?.label || "Sin estado";
                    const estadoConConteo = totalTrabajos > 1
                      ? `${estadoLabel} (${totalTrabajos})`
                      : estadoLabel;
                    return (
                      <tr key={r.id}>
                        <td><span className="badge bg-dark">{r?.matricula || "-"}</span></td>
                        <td>{r?.cliente_nombre || "-"}</td>
                        <td>{r?.coche_descripcion || "-"}</td>
                        <td>
                          {estado ? (
                            <span
                              className="badge"
                              style={{
                                backgroundColor: estado.color,
                                color: estado.color === "#ffc107" || estado.color === "#adb5bd" ? "#000" : "#fff",
                              }}
                            >
                              {estadoConConteo}
                            </span>
                          ) : (
                            <span className="badge bg-secondary">Sin estado</span>
                          )}
                        </td>
                        <td>
                          {empleadosActivos.length > 0
                            ? empleadosActivos.join(", ")
                            : (estado?.parte_empleado_nombre || "-")}
                        </td>
                        <td>
                          {partesActivasDetalle.length > 0
                            ? partesActivasDetalle
                                .map((p) => `#${p.id} (${fmtRol(p.tipo_tarea)})`)
                                .join(", ")
                            : partesActivasIds.length > 0
                              ? partesActivasIds.map((id) => `#${id}`).join(", ")
                              : (estado?.parte_id ? `#${estado.parte_id}` : "-")}
                          {totalTrabajos > 1 && (
                            <span className="badge bg-warning text-dark ms-2">{totalTrabajos} trabajos</span>
                          )}
                          <div className="small mt-1">
                            <span className="text-muted">Rol asignado:</span>{" "}
                            <strong>{rolesAsignadosFinal.length > 0 ? rolesAsignadosFinal.map((rol) => fmtRol(rol)).join(" / ") : "Sin rol"}</strong>
                          </div>
                        </td>
                        <td>{fmtFecha(r?.fecha_inspeccion)}</td>
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
}
