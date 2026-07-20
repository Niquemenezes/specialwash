import React, { useEffect, useState, useCallback } from "react";
import { obtenerMensual, obtenerAusencias, obtenerEmpleadosActivos, obtenerSelfieBlobUrl, editarRegistro, sincronizarAsistencia } from "../utils/horarioApi";

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

function formatMinutesShort(totalMinutes) {
  const total = Number.isFinite(Number(totalMinutes)) ? Math.max(0, Number(totalMinutes)) : 0;
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

function getPausas(r) {
  if (Array.isArray(r?.pausas) && r.pausas.length > 0) {
    return r.pausas.filter((pausa) => Array.isArray(pausa) && pausa[0]);
  }
  if (r?.inicio_comida) return [[r.inicio_comida, r.fin_comida || null]];
  return [];
}

function formatDescansoTotal(r) {
  const descansoMin = Number(r?.descanso_total_minutos || 0);
  return descansoMin > 0 ? formatMinutesShort(descansoMin) : "";
}

function calcularHoras(r) {
  if (!r.entrada || !r.salida) return null;
  const entrada = new Date(r.entrada);
  const salida = new Date(r.salida);
  let totalMs = salida - entrada;
  const descansoMin = Number(r.descanso_total_minutos || 0);
  if (descansoMin > 0) {
    totalMs -= descansoMin * 60000;
  } else if (r.inicio_comida && r.fin_comida) {
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

export default function HorariosAdminPage() {
  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [dia, setDia] = useState(hoy.getDate());
  const [empleadoId, setEmpleadoId] = useState("");
  const [empleados, setEmpleados] = useState([]);
  const [registros, setRegistros] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [fotoLoadingKey, setFotoLoadingKey] = useState("");
  const [fotoPreview, setFotoPreview] = useState({ abierta: false, url: "", titulo: "" });
  const [editando, setEditando] = useState(null);
  const [formHoras, setFormHoras] = useState({ entrada: "", inicio_comida: "", fin_comida: "", salida: "" });
  const [guardando, setGuardando] = useState(false);
  const [ausenciasHoy, setAusenciasHoy] = useState([]);
  const [ausenciasEmpleado, setAusenciasEmpleado] = useState([]);
  const [sincronizando, setSincronizando] = useState(false);

  const hoyISO = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;

  useEffect(() => {
    obtenerEmpleadosActivos()
      .then(setEmpleados)
      .catch(() => setEmpleados([]));
    // Cargar ausencias de hoy siempre, independientemente del panel
    obtenerAusencias({ fecha: hoyISO, periodo: "dia" })
      .then(setAusenciasHoy)
      .catch(() => setAusenciasHoy([]));
  }, [hoyISO]);

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

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Cargar ausencias del empleado seleccionado para colorear filas
  useEffect(() => {
    if (!empleadoId) { setAusenciasEmpleado([]); return; }
    obtenerAusencias({ anio, mes, empleado_id: empleadoId })
      .then(setAusenciasEmpleado)
      .catch(() => setAusenciasEmpleado([]));
  }, [anio, mes, empleadoId]);

  useEffect(() => {
    return () => {
      if (fotoPreview.url) URL.revokeObjectURL(fotoPreview.url);
    };
  }, [fotoPreview.url]);

  const handleSincronizarAsistencia = async () => {
    setSincronizando(true);
    setError("");
    try {
      const res = await sincronizarAsistencia({ anio, mes });
      window.alert(`Hoja de asistencia de ${MESES[mes - 1]} sincronizada (${res.empleados} empleados).`);
    } catch (e) {
      setError(e.message || "Error al sincronizar con la hoja de asistencia.");
    } finally {
      setSincronizando(false);
    }
  };

  const handleImprimir = (filas) => {
    const datos = filas || registrosVisibles;
    const titulo = `SW AUTO SPA — Horarios — ${periodoLabel}${empleadoNombre ? " — " + empleadoNombre : ""}`;

    const filaHtml = (r) => {
      const horas = calcularHoras(r);
      const incompleto = !r.entrada || !r.salida;
      const pausas = getPausas(r);
      const bg = incompleto ? "#fff8e1" : "#ffffff";
      return `<tr style="background:${bg}">
        <td>${formatFecha(r.fecha)}</td>
        <td>${r.empleado_nombre || ""}</td>
        <td>${formatHora(r.entrada)}</td>
        <td>${pausas.length > 0 ? pausas.map(p => formatHora(p[0])).join("<br>") : "--:--"}</td>
        <td>${pausas.length > 0 ? pausas.map(p => p[1] ? formatHora(p[1]) : "en curso").join("<br>") : "--:--"}</td>
        <td>${formatHora(r.salida)}</td>
        <td style="font-weight:600">${horas || "—"}</td>
      </tr>`;
    };

    // Resumen de totales
    const totales = {};
    datos.forEach(r => {
      if (!totales[r.empleado_nombre]) totales[r.empleado_nombre] = 0;
      if (r.entrada && r.salida) {
        let ms = new Date(r.salida) - new Date(r.entrada);
        const desc = Number(r.descanso_total_minutos || 0);
        if (desc > 0) ms -= desc * 60000;
        else if (r.inicio_comida && r.fin_comida) {
          const p = new Date(r.fin_comida) - new Date(r.inicio_comida);
          if (p > 0) ms -= p;
        }
        if (ms > 0) totales[r.empleado_nombre] += ms;
      }
    });
    const resumenHtml = Object.entries(totales).map(([nombre, ms]) => {
      const min = Math.round(ms / 60000);
      return `<tr><td>${nombre}</td><td style="font-weight:600">${Math.floor(min/60)}h ${String(min%60).padStart(2,"0")}m</td></tr>`;
    }).join("");

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${titulo}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 11px; color: #000; background: #fff; margin: 12mm; }
    h2 { font-size: 14px; margin: 0 0 2px; }
    p  { font-size: 11px; color: #555; margin: 0 0 12px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th { background: #f0f0f0; font-weight: 700; text-align: left; padding: 5px 7px; border: 1px solid #ccc; font-size: 10px; }
    td { padding: 4px 7px; border: 1px solid #ccc; vertical-align: top; }
    .resumen th, .resumen td { width: auto; }
    h3 { font-size: 12px; margin: 16px 0 4px; }
    @page { size: A4 landscape; margin: 12mm; }
  </style>
</head>
<body>
  <h2>SW AUTO SPA — Control de horarios</h2>
  <p>${titulo.replace("SW AUTO SPA — Horarios — ", "")}</p>
  <table>
    <thead><tr>
      <th>Fecha</th><th>Empleado</th><th>Entrada</th>
      <th>Inicio descanso</th><th>Fin descanso</th>
      <th>Salida</th><th>Horas trabajadas</th>
    </tr></thead>
    <tbody>${datos.map(filaHtml).join("")}</tbody>
  </table>
  <h3>Resumen</h3>
  <table class="resumen" style="max-width:320px">
    <thead><tr><th>Empleado</th><th>Total horas</th></tr></thead>
    <tbody>${resumenHtml}</tbody>
  </table>
</body>
</html>`;

    const win = window.open("", "_blank", "width=900,height=700");
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 400);
  };

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

  const cerrarPreviewFoto = useCallback(() => {
    if (fotoPreview.url) URL.revokeObjectURL(fotoPreview.url);
    setFotoPreview({ abierta: false, url: "", titulo: "" });
  }, [fotoPreview.url]);

  useEffect(() => {
    if (!fotoPreview.abierta) return undefined;
    const onKeyDown = (event) => { if (event.key === "Escape") cerrarPreviewFoto(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fotoPreview.abierta, cerrarPreviewFoto]);

  const empleadoNombre = empleados.find(e => String(e.id) === String(empleadoId))?.nombre || "";
  const diasDelMes = Array.from({ length: new Date(anio, mes, 0).getDate() }, (_, idx) => idx + 1);
  const registrosVisibles = dia
    ? registros.filter((r) => Number(String(r.fecha || "").slice(8, 10)) === Number(dia))
    : registros;
  const periodoLabel = `${dia ? `${String(dia).padStart(2, "0")} de ` : ""}${MESES[mes - 1]} ${anio}`;

  const AUSENCIA_STYLE = {
    vacaciones: { bg: "#d1fae5", border: "#6ee7b7", label: "Vacaciones", icon: "fa-umbrella-beach" },
    falta:      { bg: "#fee2e2", border: "#fca5a5", label: "Falta",       icon: "fa-circle-xmark"   },
    permiso:    { bg: "#fef9c3", border: "#fde047", label: "Permiso",     icon: "fa-clock"          },
  };

  // Helper: ausencia activa para una fecha
  const ausenciaDeFecha = (fechaISO) =>
    ausenciasEmpleado.find(
      (a) => a.estado !== "rechazado" && fechaISO >= a.fecha_inicio && fechaISO <= a.fecha_fin
    ) || null;

  // Cuando hay empleado seleccionado, añadir filas sintéticas para días de ausencia sin fichaje
  const filasVisibles = (() => {
    if (!empleadoId || ausenciasEmpleado.length === 0) return registrosVisibles;

    const fechasConRegistro = new Set(registrosVisibles.map((r) => r.fecha));
    const primeroDeMes = new Date(anio, mes - 1, 1);
    const ultimoDeMes = new Date(anio, mes, 0);
    const filasExtra = [];

    ausenciasEmpleado.forEach((aus) => {
      if (aus.estado === "rechazado") return;
      const inicio = new Date(aus.fecha_inicio + "T00:00:00");
      const fin = new Date(aus.fecha_fin + "T00:00:00");
      const desde = inicio < primeroDeMes ? primeroDeMes : inicio;
      const hasta = fin > ultimoDeMes ? ultimoDeMes : fin;

      for (let d = new Date(desde); d <= hasta; d.setDate(d.getDate() + 1)) {
        const fechaISO = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        if (dia && Number(fechaISO.slice(8)) !== Number(dia)) continue;
        if (!fechasConRegistro.has(fechaISO)) {
          filasExtra.push({
            id: `aus-${aus.id}-${fechaISO}`,
            fecha: fechaISO,
            empleado_id: aus.empleado_id,
            empleado_nombre: aus.empleado_nombre || empleadoNombre,
            entrada: null, salida: null,
            _ausencia: aus,
          });
        }
      }
    });

    return [...registrosVisibles, ...filasExtra].sort((a, b) => a.fecha.localeCompare(b.fecha));
  })();

  useEffect(() => {
    if (dia && Number(dia) > diasDelMes.length) setDia("");
  }, [dia, diasDelMes.length]);

  // Resumen de totales por empleado (solo filas reales, no sintéticas)
  const totalesPorEmpleado = {};
  filasVisibles.forEach(r => {
    if (r._ausencia) return;
    if (!totalesPorEmpleado[r.empleado_nombre]) totalesPorEmpleado[r.empleado_nombre] = 0;
    if (r.entrada && r.salida) {
      let ms = new Date(r.salida) - new Date(r.entrada);
      const descansoMin = Number(r.descanso_total_minutos || 0);
      if (descansoMin > 0) {
        ms -= descansoMin * 60000;
      } else if (r.inicio_comida && r.fin_comida) {
        const pausaMs = new Date(r.fin_comida) - new Date(r.inicio_comida);
        if (pausaMs > 0) ms -= pausaMs;
      }
      if (ms > 0) totalesPorEmpleado[r.empleado_nombre] += ms;
    }
  });

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 12mm; }
          html, body {
            width: 100%;
            min-height: auto;
            background: #fff !important;
            color: #000 !important;
          }
          body { margin: 0; }
          .no-print { display: none !important; }
          .horario-print-header { display: block !important; }
          .horarios-admin-table,
          .horarios-admin-table thead,
          .horarios-admin-table tbody,
          .horarios-admin-table tr,
          .horarios-admin-table th,
          .horarios-admin-table td {
            page-break-inside: avoid !important;
            page-break-after: auto !important;
          }
          .horarios-admin-table th,
          .horarios-admin-table td {
            border-color: #aaa !important;
          }
          .horarios-admin-table thead th {
            background: #eceff4 !important;
          }
          .table-responsive { overflow: visible !important; }
          .horario-print-header {
            padding: 0 0 10px;
            border-bottom: 1px solid #ddd;
            margin-bottom: 10px;
          }
        }
        .horario-print-header { display: none; }

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
            <select className="form-select form-select-sm" value={anio} onChange={e => setAnio(Number(e.target.value))} style={{ width: 90 }}>
              {[hoy.getFullYear() - 1, hoy.getFullYear(), hoy.getFullYear() + 1].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label small mb-1">Mes</label>
            <select className="form-select form-select-sm" value={mes} onChange={e => setMes(Number(e.target.value))} style={{ width: 130 }}>
              {MESES.map((m, i) => (
                <option key={i + 1} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label small mb-1">Día</label>
            <select className="form-select form-select-sm" value={dia} onChange={e => setDia(e.target.value)} style={{ width: 100 }}>
              <option value="">Todos</option>
              {diasDelMes.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label small mb-1">Empleado</label>
            <select className="form-select form-select-sm" value={empleadoId} onChange={e => setEmpleadoId(e.target.value)} style={{ width: 180 }}>
              <option value="">Todos</option>
              {empleados.map(e => (
                <option key={e.id} value={e.id}>{e.nombre}</option>
              ))}
            </select>
          </div>
          <button className="btn btn-outline-secondary btn-sm" onClick={cargar} disabled={cargando}>
            <i className="fa-solid fa-rotate-right me-1" />Actualizar
          </button>

          <button
            className="btn btn-outline-success btn-sm"
            onClick={handleSincronizarAsistencia}
            disabled={sincronizando}
            title="Rellena la hoja de asistencia de Google Sheets con los fichajes y ausencias de este mes"
          >
            <i className="fa-solid fa-file-excel me-1" />
            {sincronizando ? "Sincronizando..." : "Sincronizar con Excel"}
          </button>

          <button
            className="btn btn-outline-primary btn-sm ms-auto"
            onClick={() => handleImprimir()}
            title="Generar vista para imprimir o guardar como PDF"
          >
            <i className="fa-solid fa-file-pdf me-1" />
            {empleadoNombre ? `Exportar PDF — ${empleadoNombre}` : "Exportar PDF"}
          </button>
        </div>

        {/* Cabecera visible solo en impresión */}
        <div className="horario-print-header mb-3">
          <strong style={{ fontSize: 15 }}>SW AUTO SPA — Control de horarios</strong>
          <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>
            {periodoLabel}{empleadoNombre ? ` — ${empleadoNombre}` : ""}
          </div>
        </div>

        <h4 className="mb-1 fw-bold no-print">Control de horarios</h4>
        <p className="text-muted small mb-3 no-print">
          {periodoLabel}{empleadoNombre ? ` — ${empleadoNombre}` : ""}
        </p>

        {/* Estado del equipo hoy */}
        {empleados.length > 0 && (
          <div className="no-print mb-4 p-3 rounded border" style={{ background: "var(--sw-surface-2, #f8fafc)" }}>
            <div className="fw-semibold small mb-2 text-muted text-uppercase" style={{ letterSpacing: "0.05em" }}>
              <i className="fa-solid fa-users me-2" />Estado del equipo hoy — {formatFecha(hoyISO)}
            </div>
            <div className="d-flex flex-wrap gap-2">
              {empleados.map((emp) => {
                const aus = ausenciasHoy.find(
                  (a) => a.empleado_id === emp.id && a.estado !== "rechazado"
                );
                const color = aus
                  ? aus.tipo === "vacaciones" ? "#198754"
                  : aus.tipo === "falta"      ? "#dc3545"
                  : "#f59e0b"
                  : "#6c757d";
                const etiqueta = aus
                  ? aus.tipo === "vacaciones" ? "Vacaciones"
                  : aus.tipo === "falta"      ? "Falta"
                  : "Permiso"
                  : "Trabajando";
                return (
                  <span
                    key={emp.id}
                    title={aus?.motivo || etiqueta}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      background: color + "22", border: `1px solid ${color}55`,
                      color, borderRadius: 20, padding: "3px 12px", fontSize: 13, fontWeight: 500,
                    }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />
                    {emp.nombre}
                    {aus && <span style={{ opacity: 0.75, fontSize: 11 }}>({etiqueta})</span>}
                  </span>
                );
              })}
            </div>
          </div>
        )}

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
                  <button className="btn btn-secondary btn-sm" onClick={() => setEditando(null)} disabled={guardando}>Cancelar</button>
                  <button className="btn btn-primary btn-sm" onClick={guardarEdicion} disabled={guardando}>
                    {guardando ? <><span className="spinner-border spinner-border-sm me-1" />Guardando...</> : "Guardar"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal foto */}
        {fotoPreview.abierta && (
          <div className="modal show d-block no-print" style={{ background: "rgba(0,0,0,0.72)" }} onMouseDown={cerrarPreviewFoto}>
            <div className="modal-dialog modal-lg modal-dialog-centered" onMouseDown={(e) => e.stopPropagation()}>
              <div className="modal-content">
                <div className="modal-header">
                  <h6 className="modal-title">{fotoPreview.titulo}</h6>
                  <button className="btn-close" onClick={cerrarPreviewFoto} />
                </div>
                <div className="modal-body text-center">
                  <img src={fotoPreview.url} alt={fotoPreview.titulo} style={{ maxWidth: "100%", maxHeight: "70vh", borderRadius: 8 }} />
                </div>
                <div className="modal-footer justify-content-center">
                  <button type="button" className="btn btn-secondary" onClick={cerrarPreviewFoto}>Salir de la foto</button>
                </div>
              </div>
            </div>
          </div>
        )}
        {cargando ? (
          <div className="text-center py-5 no-print">
            <span className="spinner-border spinner-border-sm me-2" />Cargando...
          </div>
        ) : filasVisibles.length === 0 ? (
          <div className="text-muted text-center py-5">No hay registros para este período.</div>
        ) : (
          <>
            <div className="table-responsive">
              <table className="table table-sm table-bordered table-hover align-middle horarios-admin-table">
                <thead className="table-light">
                  <tr>
                    <th>Fecha</th>
                    <th>Empleado</th>
                    <th>Entrada</th>
                    <th>Inicio descanso</th>
                    <th>Fin descanso</th>
                    <th>Salida</th>
                    <th>Horas trabajadas</th>
                    <th className="no-print">Fotos</th>
                    <th className="no-print">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filasVisibles.map((r) => {
                    const esSintetica = Boolean(r._ausencia);
                    const aus = esSintetica ? r._ausencia : (empleadoId ? ausenciaDeFecha(r.fecha) : null);
                    const ausStyle = aus ? AUSENCIA_STYLE[aus.tipo] : null;
                    const horas = esSintetica ? null : calcularHoras(r);
                    const incompleto = !esSintetica && (!r.entrada || !r.salida);
                    const trStyle = ausStyle
                      ? { background: ausStyle.bg, borderLeft: `4px solid ${ausStyle.border}` }
                      : {};
                    return (
                      <tr key={r.id} className={!aus && incompleto ? "horario-row-incompleto" : ""} style={trStyle}>
                        <td className="text-nowrap">
                          {formatFecha(r.fecha)}
                          {ausStyle && (
                            <span className="ms-2 badge" style={{ background: ausStyle.border, color: "#111", fontSize: 10 }}>
                              <i className={`fa-solid ${ausStyle.icon} me-1`} />{ausStyle.label}
                            </span>
                          )}
                        </td>
                        <td>{r.empleado_nombre}</td>
                        <td className="text-nowrap">{esSintetica ? <span className="text-muted">—</span> : formatHora(r.entrada)}</td>
                        <td className="text-nowrap">
                          {!esSintetica && getPausas(r).length > 0 ? getPausas(r).map((pausa, idx) => (
                            <div key={`${r.id}-inicio-${idx}`}>{formatHora(pausa[0])}</div>
                          )) : <span className="text-muted">—</span>}
                        </td>
                        <td className="text-nowrap">
                          {!esSintetica && getPausas(r).length > 0 ? (
                            <>
                              {getPausas(r).map((pausa, idx) => (
                                <div key={`${r.id}-fin-${idx}`}>{pausa[1] ? formatHora(pausa[1]) : "en curso"}</div>
                              ))}
                              {formatDescansoTotal(r) && <small className="text-muted">Total: {formatDescansoTotal(r)}</small>}
                            </>
                          ) : <span className="text-muted">—</span>}
                        </td>
                        <td className="text-nowrap">{esSintetica ? <span className="text-muted">—</span> : formatHora(r.salida)}</td>
                        <td className="fw-semibold text-nowrap">
                          {esSintetica
                            ? <span className="text-muted" style={{ fontWeight: 400 }}>No fichó</span>
                            : horas || <span className="text-muted">—</span>
                          }
                        </td>
                        <td className="no-print" style={{ minWidth: 220 }}>
                          {esSintetica ? <span className="text-muted small">—</span> : (
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
                          )}
                        </td>
                        <td className="no-print text-nowrap" style={{ minWidth: 120 }}>
                          {esSintetica ? <span className="text-muted small">—</span> : (
                            <button
                              type="button"
                              className={`btn btn-sm ${incompleto ? "btn-editar-pendiente" : "btn-primary"}`}
                              onClick={() => abrirEdicion(r)}
                            >
                              Editar
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Resumen totales */}
            <div className="mt-4">
              <h6 className="fw-semibold">Resumen {empleadoNombre ? `— ${empleadoNombre}` : "mensual"}</h6>
              <table className="table table-sm table-bordered" style={{ maxWidth: 400 }}>
                <thead className="table-light">
                  <tr>
                    <th>Empleado</th>
                    <th>Total horas</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(totalesPorEmpleado).map(([nombre, ms]) => {
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
          </>
        )}
      </div>
    </>
  );
}
