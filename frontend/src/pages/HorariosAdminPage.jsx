import React, { useEffect, useState, useCallback } from "react";
import { obtenerMensual, obtenerEmpleadosActivos, obtenerSelfieBlobUrl, editarRegistro } from "../utils/horarioApi";

const MESES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];

const TIPOS_FOTO = ["entrada", "inicio_comida", "fin_comida", "salida"];

function formatHora(isoStr) {
  if (!isoStr) return "--:--";
  const d = new Date(isoStr);
  return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

function calcularHoras(r) {
  if (!r.entrada || !r.salida) return null;
  const entrada = new Date(r.entrada);
  const salida = new Date(r.salida);
  let totalMs = salida - entrada;

  if (r.inicio_comida && r.fin_comida) {
    const ic = new Date(r.inicio_comida);
    const fc = new Date(r.fin_comida);
    if (fc > ic) totalMs -= (fc - ic);
  }

  if (totalMs < 0) return null;
  const totalMin = Math.round(totalMs / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

function formatFecha(isoStr) {
  if (!isoStr) return "";
  const [y, m, d] = isoStr.split("-");
  return `${d}/${m}/${y}`;
}

function diasEnMes(anio, mes) {
  return new Date(anio, mes, 0).getDate();
}

export default function HorariosAdminPage() {
  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [empleadoId, setEmpleadoId] = useState("");
  const [empleados, setEmpleados] = useState([]);
  const [registros, setRegistros] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [fotoLoadingKey, setFotoLoadingKey] = useState("");
  const [fotoPreview, setFotoPreview] = useState({ abierta: false, url: "", titulo: "" });
  const [editando, setEditando] = useState(null); // registro completo
  const [formHoras, setFormHoras] = useState({ entrada: "", inicio_comida: "", fin_comida: "", salida: "" });
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    obtenerEmpleadosActivos()
      .then(setEmpleados)
      .catch(() => setEmpleados([]));
  }, []);

  useEffect(() => {
    return () => {
      if (fotoPreview.url) URL.revokeObjectURL(fotoPreview.url);
    };
  }, [fotoPreview.url]);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError("");
    try {
      const data = await obtenerMensual({ anio, mes, empleado_id: empleadoId || undefined });
      setRegistros(data || []);
    } catch (e) {
      setError(e.message || "Error al cargar los horarios.");
    } finally {
      setCargando(false);
    }
  }, [anio, mes, empleadoId]);

  useEffect(() => { cargar(); }, [cargar]);

  const handleImprimir = () => window.print();

  const isoToHHMM = (isoStr) => {
    if (!isoStr) return "";
    const d = new Date(isoStr);
    return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", hour12: false });
  };

  const abrirEdicion = (r) => {
    setEditando(r);
    setFormHoras({
      entrada: isoToHHMM(r.entrada),
      inicio_comida: isoToHHMM(r.inicio_comida),
      fin_comida: isoToHHMM(r.fin_comida),
      salida: isoToHHMM(r.salida),
    });
    setError("");
  };

  const guardarEdicion = async () => {
    setGuardando(true);
    setError("");
    try {
      const result = await editarRegistro(editando.id, formHoras);
      setRegistros(prev => prev.map(r => r.id === editando.id ? result.registro : r));
      setEditando(null);
    } catch (e) {
      setError(e.message || "Error al guardar.");
    } finally {
      setGuardando(false);
    }
  };

  const verSelfie = async (registro, tipo) => {
    const tieneFoto = registro?.[`tiene_foto_${tipo}`];
    if (!tieneFoto) return;

    const key = `${registro.id}-${tipo}`;
    setFotoLoadingKey(key);
    try {
      const blobUrl = await obtenerSelfieBlobUrl({
        empleado_id: registro.empleado_id,
        tipo,
        fecha: registro.fecha,
      });
      if (fotoPreview.url) URL.revokeObjectURL(fotoPreview.url);
      setFotoPreview({
        abierta: true,
        url: blobUrl,
        titulo: `${registro.empleado_nombre} · ${formatFecha(registro.fecha)} · ${tipo.replace("_", " ")}`,
      });
    } catch (e) {
      setError(e.message || "No se pudo cargar la foto del fichaje.");
    } finally {
      setFotoLoadingKey("");
    }
  };

  const cerrarPreviewFoto = () => {
    if (fotoPreview.url) URL.revokeObjectURL(fotoPreview.url);
    setFotoPreview({ abierta: false, url: "", titulo: "" });
  };

  useEffect(() => {
    if (!fotoPreview.abierta) return undefined;

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        cerrarPreviewFoto();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fotoPreview.abierta, fotoPreview.url]);

  // Group by empleado_nombre for display
  const empleadoNombre = empleados.find(e => String(e.id) === String(empleadoId))?.nombre || "";

  return (
    <>
      {/* Estilos de impresión */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { font-size: 11px; }
          .table { font-size: 11px; }
          h4 { font-size: 14px; }
        }

        .horarios-admin-table thead th {
          background: var(--sw-surface-2, #f5f7fb) !important;
          color: var(--sw-text, #0f172a) !important;
        }

        .horarios-admin-table .horario-row-incompleto > * {
          background: color-mix(in srgb, var(--sw-warning, #f59e0b) 18%, var(--sw-surface, #fff)) !important;
          color: var(--sw-text, #0f172a) !important;
        }

        .horarios-admin-table .btn-foto-on {
          border-color: color-mix(in srgb, var(--sw-accent, #d4af37) 55%, var(--sw-border, #cbd5e1));
          color: var(--sw-text, #0f172a);
        }

        .horarios-admin-table .btn-foto-on:hover {
          background: color-mix(in srgb, var(--sw-accent, #d4af37) 15%, transparent);
          color: var(--sw-text, #0f172a);
        }

        .horarios-admin-table .btn-editar-pendiente {
          background: color-mix(in srgb, var(--sw-warning, #f59e0b) 80%, #fff) !important;
          border-color: color-mix(in srgb, var(--sw-warning, #f59e0b) 85%, #000) !important;
          color: #111 !important;
          font-weight: 700;
        }
      `}</style>

      <div className="container-fluid py-4">
        {/* Filtros */}
        <div className="no-print d-flex flex-wrap align-items-end gap-3 mb-4">
          <div>
            <label className="form-label small mb-1">Año</label>
            <select
              className="form-select form-select-sm"
              value={anio}
              onChange={e => setAnio(Number(e.target.value))}
              style={{ width: 90 }}
            >
              {[hoy.getFullYear() - 1, hoy.getFullYear(), hoy.getFullYear() + 1].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label small mb-1">Mes</label>
            <select
              className="form-select form-select-sm"
              value={mes}
              onChange={e => setMes(Number(e.target.value))}
              style={{ width: 130 }}
            >
              {MESES.map((m, i) => (
                <option key={i + 1} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label small mb-1">Empleado</label>
            <select
              className="form-select form-select-sm"
              value={empleadoId}
              onChange={e => setEmpleadoId(e.target.value)}
              style={{ width: 180 }}
            >
              <option value="">Todos</option>
              {empleados.map(e => (
                <option key={e.id} value={e.id}>{e.nombre}</option>
              ))}
            </select>
          </div>
          <button className="btn btn-outline-secondary btn-sm" onClick={cargar} disabled={cargando}>
            <i className="fa-solid fa-rotate-right me-1" />Actualizar
          </button>
          <button className="btn btn-outline-primary btn-sm ms-auto" onClick={handleImprimir}>
            <i className="fa-solid fa-print me-1" />Imprimir
          </button>
        </div>

        {/* Cabecera impresión */}
        <div className="d-none d-print-block mb-3">
          <h5 className="mb-0">SpecialWash — Control de horarios</h5>
          <p className="mb-0 text-muted">
            {MESES[mes - 1]} {anio}
            {empleadoNombre ? ` — ${empleadoNombre}` : ""}
          </p>
        </div>

        <h4 className="mb-1 fw-bold no-print">Control de horarios</h4>
        <p className="text-muted small mb-4 no-print">
          {MESES[mes - 1]} {anio}
          {empleadoNombre ? ` — ${empleadoNombre}` : ""}
        </p>

        {error && <div className="alert alert-danger no-print">{error}</div>}

        {/* Modal edición */}
        {editando && (
          <div className="modal show d-block" style={{ background: "rgba(0,0,0,0.5)" }}>
            <div className="modal-dialog modal-sm">
              <div className="modal-content">
                <div className="modal-header">
                  <h6 className="modal-title">
                    Editar horario — {formatFecha(editando.fecha)}<br />
                    <small className="text-muted fw-normal">{editando.empleado_nombre}</small>
                  </h6>
                  <button className="btn-close" onClick={() => setEditando(null)} disabled={guardando} />
                </div>
                <div className="modal-body">
                  {[
                    { key: "entrada", label: "Entrada" },
                    { key: "inicio_comida", label: "Inicio comida" },
                    { key: "fin_comida", label: "Fin comida" },
                    { key: "salida", label: "Salida" },
                  ].map(({ key, label }) => (
                    <div className="mb-2" key={key}>
                      <label className="form-label small mb-1">{label}</label>
                      <input
                        type="time"
                        className="form-control form-control-sm"
                        value={formHoras[key]}
                        onChange={e => setFormHoras(prev => ({ ...prev, [key]: e.target.value }))}
                      />
                    </div>
                  ))}
                </div>
                <div className="modal-footer">
                  <button className="btn btn-secondary btn-sm" onClick={() => setEditando(null)} disabled={guardando}>
                    Cancelar
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={guardarEdicion} disabled={guardando}>
                    {guardando ? <><span className="spinner-border spinner-border-sm me-1" />Guardando...</> : "Guardar"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {fotoPreview.abierta && (
          <div
            className="modal show d-block no-print"
            style={{ background: "rgba(0,0,0,0.72)" }}
            onMouseDown={cerrarPreviewFoto}
          >
            <div
              className="modal-dialog modal-lg modal-dialog-centered"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="modal-content">
                <div className="modal-header">
                  <h6 className="modal-title">{fotoPreview.titulo}</h6>
                  <button className="btn-close" onClick={cerrarPreviewFoto} />
                </div>
                <div className="modal-body text-center">
                  <img
                    src={fotoPreview.url}
                    alt={fotoPreview.titulo}
                    style={{ maxWidth: "100%", maxHeight: "70vh", borderRadius: 8 }}
                  />
                </div>
                <div className="modal-footer justify-content-center">
                  <button type="button" className="btn btn-secondary" onClick={cerrarPreviewFoto}>
                    Salir de la foto
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {cargando ? (
          <div className="text-center py-5 no-print">
            <span className="spinner-border spinner-border-sm me-2" />Cargando...
          </div>
        ) : registros.length === 0 ? (
          <div className="text-muted text-center py-5">No hay registros para este período.</div>
        ) : (
          <div className="table-responsive">
            <table className="table table-sm table-bordered table-hover align-middle horarios-admin-table">
              <thead className="table-light">
                <tr>
                  <th>Fecha</th>
                  <th>Empleado</th>
                  <th>Entrada</th>
                  <th>Inicio comida</th>
                  <th>Fin comida</th>
                  <th>Salida</th>
                  <th>Horas trabajadas</th>
                  <th className="no-print">Fotos</th>
                  <th className="no-print">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {registros.map((r) => {
                  const horas = calcularHoras(r);
                  const incompleto = !r.entrada || !r.salida;
                  return (
                    <tr key={r.id} className={incompleto ? "horario-row-incompleto" : ""}>
                      <td className="text-nowrap">{formatFecha(r.fecha)}</td>
                      <td>{r.empleado_nombre}</td>
                      <td className="text-nowrap">{formatHora(r.entrada)}</td>
                      <td className="text-nowrap">{formatHora(r.inicio_comida)}</td>
                      <td className="text-nowrap">{formatHora(r.fin_comida)}</td>
                      <td className="text-nowrap">{formatHora(r.salida)}</td>
                      <td className="fw-semibold text-nowrap">
                        {horas || <span className="text-muted">—</span>}
                      </td>
                      <td className="no-print" style={{ minWidth: 220 }}>
                        <div className="d-flex flex-wrap gap-1">
                          {TIPOS_FOTO.map((tipo) => {
                            const key = `${r.id}-${tipo}`;
                            const tieneFoto = Boolean(r[`tiene_foto_${tipo}`]);
                            return (
                              <button
                                key={tipo}
                                type="button"
                                className={`btn btn-sm ${tieneFoto ? "btn-foto-on" : "btn-outline-secondary"}`}
                                disabled={!tieneFoto || fotoLoadingKey === key}
                                onClick={() => verSelfie(r, tipo)}
                              >
                                {fotoLoadingKey === key ? "..." : `Foto ${tipo}`}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                      <td className="no-print text-nowrap" style={{ minWidth: 120 }}>
                        <button
                          type="button"
                          className={`btn btn-sm ${incompleto ? "btn-editar-pendiente" : "btn-primary"}`}
                          onClick={() => abrirEdicion(r)}
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Resumen totales por empleado */}
        {registros.length > 0 && (() => {
          const totales = {};
          registros.forEach(r => {
            if (!totales[r.empleado_nombre]) totales[r.empleado_nombre] = 0;
            if (r.entrada && r.salida) {
              let ms = new Date(r.salida) - new Date(r.entrada);
              const descansoMin = Number(r.descanso_total_minutos || 0);
              if (descansoMin > 0) {
                ms -= descansoMin * 60000;
              } else if (r.inicio_comida && r.fin_comida) {
                const pausaMs = new Date(r.fin_comida) - new Date(r.inicio_comida);
                if (pausaMs > 0) ms -= pausaMs;
              }
              if (ms > 0) totales[r.empleado_nombre] += ms;
            }
          });

          return (
            <div className="mt-4">
              <h6 className="fw-semibold">Resumen mensual</h6>
              <table className="table table-sm table-bordered" style={{ maxWidth: 400 }}>
                <thead className="table-light">
                  <tr>
                    <th>Empleado</th>
                    <th>Total horas</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(totales).map(([nombre, ms]) => {
                    const totalMin = Math.round(ms / 60000);
                    const h = Math.floor(totalMin / 60);
                    const m = totalMin % 60;
                    return (
                      <tr key={nombre}>
                        <td>{nombre}</td>
                        <td className="fw-semibold">{h}h {m.toString().padStart(2, "0")}m</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })()}
      </div>
    </>
  );
}
