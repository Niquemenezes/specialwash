import React, { useEffect, useState, useCallback } from "react";
import * as XLSX from "xlsx";
import {
  obtenerAusencias,
  crearAusencia,
  editarAusencia,
  eliminarAusencia,
  obtenerEmpleadosActivos,
} from "../utils/horarioApi";

const MESES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];

const TIPO_LABEL = { vacaciones: "Vacaciones", falta: "Falta", permiso: "Permiso" };
const ESTADO_BADGE = {
  pendiente:  "warning",
  aprobado:   "success",
  rechazado:  "danger",
};

const HOY = new Date();

function formatFecha(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function calcularDias(inicio, fin) {
  if (!inicio || !fin) return "";
  const d1 = new Date(inicio);
  const d2 = new Date(fin);
  const diff = Math.round((d2 - d1) / 86400000) + 1;
  return diff > 0 ? diff : "";
}

const FORM_VACIO = {
  empleado_id: "",
  tipo: "vacaciones",
  estado: "pendiente",
  fecha_inicio: "",
  fecha_fin: "",
  motivo: "",
};

const HOY_ISO = HOY.toISOString().slice(0, 10);

function exportarExcelCompleto({ ausenciasAnio, empleados, anio }) {
  const DIAS_SEMANA = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const wb = XLSX.utils.book_new();

  // Una pestaña por mes
  MESES.forEach((nombreMes, mesIdx) => {
    const mes = mesIdx + 1;
    const diasEnMes = new Date(anio, mes, 0).getDate();

    // Ausencias que solapan con este mes
    const ausenciasMes = ausenciasAnio.filter((a) => {
      if (!a.fecha_inicio || !a.fecha_fin) return false;
      if (a.estado === "rechazado") return false;
      const inicio = new Date(a.fecha_inicio + "T00:00:00");
      const fin = new Date(a.fecha_fin + "T00:00:00");
      const primero = new Date(anio, mesIdx, 1);
      const ultimo = new Date(anio, mesIdx, diasEnMes);
      return inicio <= ultimo && fin >= primero;
    });

    // Cabecera: Día | Semana | Emp1 | Emp2 | ...
    const header = ["Día", "Semana", ...empleados.map((e) => e.nombre)];
    const filas = [];

    const totalesTrabajados = new Array(empleados.length).fill(0);
    const totalesVacaciones = new Array(empleados.length).fill(0);
    const totalesFaltas = new Array(empleados.length).fill(0);

    for (let dia = 1; dia <= diasEnMes; dia++) {
      const fecha = new Date(anio, mesIdx, dia);
      const fechaISO = `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
      const diaSemana = fecha.getDay(); // 0=dom, 6=sab
      const esFinde = diaSemana === 0 || diaSemana === 6;

      const fila = [dia, DIAS_SEMANA[diaSemana]];

      empleados.forEach((emp, idx) => {
        const aus = ausenciasMes.find(
          (a) => a.empleado_id === emp.id && fechaISO >= a.fecha_inicio && fechaISO <= a.fecha_fin
        );
        if (esFinde) {
          fila.push("Fin de semana");
        } else if (aus) {
          const etiq = aus.tipo === "vacaciones" ? "Vacaciones" : aus.tipo === "falta" ? "Falta" : "Permiso";
          fila.push(etiq);
          if (aus.tipo === "vacaciones") totalesVacaciones[idx]++;
          else totalesFaltas[idx]++;
        } else {
          fila.push("Trabajó");
          totalesTrabajados[idx]++;
        }
      });

      filas.push(fila);
    }

    // Fila de totales
    filas.push([]);
    filas.push(["RESUMEN", "", ...empleados.map((_, i) => empleados[i].nombre)]);
    filas.push(["Días trabajados", "", ...totalesTrabajados]);
    filas.push(["Días vacaciones", "", ...totalesVacaciones]);
    filas.push(["Faltas / permisos", "", ...totalesFaltas]);

    const ws = XLSX.utils.aoa_to_sheet([header, ...filas]);

    // Ancho de columnas
    ws["!cols"] = [
      { wch: 6 },  // Día
      { wch: 8 },  // Semana
      ...empleados.map(() => ({ wch: 14 })),
    ];

    XLSX.utils.book_append_sheet(wb, ws, nombreMes.slice(0, 31));
  });

  XLSX.writeFile(wb, `SpecialWash_Vacaciones_${anio}.xlsx`);
}

function imprimirAusencias({ visibles, mes, anio, empleadoNombre }) {
  const titulo = `SpecialWash — Vacaciones y ausencias — ${mes ? MESES[mes - 1] + " " : ""}${anio}${empleadoNombre ? " — " + empleadoNombre : ""}`;
  const filaHtml = (a) => `<tr>
    <td>${a.empleado_nombre || ""}</td>
    <td>${TIPO_LABEL[a.tipo] || a.tipo}</td>
    <td>${formatFecha(a.fecha_inicio)}</td>
    <td>${formatFecha(a.fecha_fin)}</td>
    <td style="text-align:center">${a.dias}</td>
    <td style="text-align:center">${a.estado}</td>
    <td>${a.motivo || "—"}</td>
  </tr>`;
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${titulo}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 11px; color: #000; background: #fff; margin: 12mm; }
    h2 { font-size: 14px; margin: 0 0 2px; }
    p  { font-size: 11px; color: #555; margin: 0 0 14px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th { background: #f0f0f0; font-weight: 700; text-align: left; padding: 5px 7px; border: 1px solid #ccc; }
    td { padding: 4px 7px; border: 1px solid #ccc; vertical-align: top; }
    @page { size: A4 landscape; margin: 12mm; }
  </style>
</head>
<body>
  <h2>SpecialWash — Vacaciones y ausencias</h2>
  <p>${titulo.replace("SpecialWash — Vacaciones y ausencias — ", "")}</p>
  <table>
    <thead><tr>
      <th>Empleado</th><th>Tipo</th><th>Desde</th><th>Hasta</th>
      <th>Días</th><th>Estado</th><th>Motivo</th>
    </tr></thead>
    <tbody>${visibles.map(filaHtml).join("")}</tbody>
  </table>
</body>
</html>`;
  const win = window.open("", "_blank", "width=900,height=700");
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 400);
}

export default function AusenciasPage() {
  const [anio, setAnio] = useState(HOY.getFullYear());
  const [mes, setMes] = useState(0); // 0 = todos los meses
  const [filtroEmpleado, setFiltroEmpleado] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");

  const [ausencias, setAusencias] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [error, setError] = useState("");

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState(null); // null = nuevo
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [errorModal, setErrorModal] = useState("");

  useEffect(() => {
    obtenerEmpleadosActivos()
      .then(setEmpleados)
      .catch(() => setEmpleados([]));
  }, []);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError("");
    try {
      const params = { anio };
      if (mes) params.mes = mes;
      if (filtroEmpleado) params.empleado_id = filtroEmpleado;
      if (!mes) params.periodo = "anio";
      const data = await obtenerAusencias(params);
      setAusencias(data || []);
    } catch (e) {
      setError(e.message || "Error al cargar las ausencias.");
    } finally {
      setCargando(false);
    }
  }, [anio, mes, filtroEmpleado]);

  useEffect(() => { cargar(); }, [cargar]);

  // Filtros locales (tipo y estado se filtran en cliente)
  const visibles = ausencias.filter((a) => {
    if (filtroTipo && a.tipo !== filtroTipo) return false;
    if (filtroEstado && a.estado !== filtroEstado) return false;
    return true;
  });

  // Resumen días por empleado
  const resumen = {};
  visibles.forEach((a) => {
    const nombre = a.empleado_nombre || `Empleado ${a.empleado_id}`;
    if (!resumen[nombre]) resumen[nombre] = { vacaciones: 0, falta: 0, permiso: 0 };
    resumen[nombre][a.tipo] = (resumen[nombre][a.tipo] || 0) + (a.dias || 0);
  });

  const abrirNuevo = () => {
    setEditando(null);
    setForm(FORM_VACIO);
    setErrorModal("");
    setModalAbierto(true);
  };

  const abrirEdicion = (a) => {
    setEditando(a);
    setForm({
      empleado_id: String(a.empleado_id),
      tipo: a.tipo,
      estado: a.estado,
      fecha_inicio: a.fecha_inicio || "",
      fecha_fin: a.fecha_fin || "",
      motivo: a.motivo || "",
    });
    setErrorModal("");
    setModalAbierto(true);
  };

  const cerrarModal = () => {
    if (guardando) return;
    setModalAbierto(false);
    setEditando(null);
    setForm(FORM_VACIO);
    setErrorModal("");
  };

  const setField = (key, val) => setForm((prev) => ({ ...prev, [key]: val }));

  const guardar = async () => {
    setErrorModal("");
    if (!form.empleado_id) { setErrorModal("Selecciona un empleado."); return; }
    if (!form.fecha_inicio || !form.fecha_fin) { setErrorModal("Las fechas son obligatorias."); return; }
    if (form.fecha_fin < form.fecha_inicio) { setErrorModal("La fecha de fin no puede ser anterior a la de inicio."); return; }

    setGuardando(true);
    try {
      const payload = {
        empleado_id: Number(form.empleado_id),
        tipo: form.tipo,
        estado: form.estado,
        fecha_inicio: form.fecha_inicio,
        fecha_fin: form.fecha_fin,
        motivo: form.motivo,
      };
      if (editando) {
        const res = await editarAusencia(editando.id, payload);
        setAusencias((prev) =>
          prev.map((a) => (a.id === editando.id ? res.ausencia || { ...a, ...payload } : a))
        );
      } else {
        const res = await crearAusencia(payload);
        setAusencias((prev) => [...prev, res.ausencia]);
      }
      cerrarModal();
    } catch (e) {
      setErrorModal(e.message || "Error al guardar.");
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (a) => {
    if (!window.confirm(`Eliminar ${a.tipo} de ${a.empleado_nombre} (${formatFecha(a.fecha_inicio)} – ${formatFecha(a.fecha_fin)})?`)) return;
    setError("");
    try {
      await eliminarAusencia(a.id);
      setAusencias((prev) => prev.filter((x) => x.id !== a.id));
    } catch (e) {
      setError(e.message || "Error al eliminar.");
    }
  };

  const diasCalculados = calcularDias(form.fecha_inicio, form.fecha_fin);

  return (
    <>
      <div className="container-fluid py-4">
        {/* Cabecera */}
        <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2">
          <div>
            <h4 className="fw-bold mb-0">Vacaciones y Ausencias</h4>
            <p className="text-muted small mb-0">Gestión de días no trabajados del equipo</p>
          </div>
          <div className="d-flex gap-2">
            <button
              className="btn btn-outline-success"
              disabled={exportando}
              title={`Descarga Excel con una pestaña por mes — año ${anio}`}
              onClick={async () => {
                setExportando(true);
                try {
                  const datos = await obtenerAusencias({ anio, periodo: "anio" });
                  exportarExcelCompleto({ ausenciasAnio: datos || [], empleados, anio });
                } catch (e) {
                  alert("Error al generar el Excel: " + (e.message || e));
                } finally {
                  setExportando(false);
                }
              }}
            >
              {exportando
                ? <><span className="spinner-border spinner-border-sm me-2" />Generando...</>
                : <><i className="fa-solid fa-file-excel me-2" />Exportar Excel</>
              }
            </button>
            <button
              className="btn btn-outline-primary"
              onClick={() => imprimirAusencias({ visibles, mes, anio, empleadoNombre: empleados.find(e => String(e.id) === String(filtroEmpleado))?.nombre || "" })}
              disabled={visibles.length === 0}
            >
              <i className="fa-solid fa-file-pdf me-2" />Exportar PDF
            </button>
            <button className="btn btn-success" onClick={abrirNuevo}>
              <i className="fa-solid fa-plus me-2" />Nueva ausencia
            </button>
          </div>
        </div>

        {/* Estado del equipo HOY */}
        {empleados.length > 0 && (
          <div className="card mb-4 shadow-sm border-0" style={{ background: "var(--sw-surface-2, #f8fafc)" }}>
            <div className="card-body py-3">
              <h6 className="fw-semibold mb-3">
                <i className="fa-solid fa-users me-2 text-primary" />
                Estado del equipo hoy — {formatFecha(HOY_ISO)}
              </h6>
              <div className="d-flex flex-wrap gap-2">
                {empleados.map((emp) => {
                  const ausenciaHoy = ausencias.find(
                    (a) =>
                      a.empleado_id === emp.id &&
                      a.estado !== "rechazado" &&
                      HOY_ISO >= a.fecha_inicio &&
                      HOY_ISO <= a.fecha_fin
                  );
                  return (
                    <div
                      key={emp.id}
                      className={`badge d-flex align-items-center gap-1 py-2 px-3 fs-6 fw-normal ${
                        ausenciaHoy
                          ? ausenciaHoy.tipo === "vacaciones"
                            ? "bg-success"
                            : ausenciaHoy.tipo === "falta"
                            ? "bg-danger"
                            : "bg-warning text-dark"
                          : "bg-light text-dark border"
                      }`}
                      title={ausenciaHoy ? `${TIPO_LABEL[ausenciaHoy.tipo]} — ${ausenciaHoy.motivo || "sin motivo"}` : "Trabajando"}
                    >
                      <i className={`fa-solid ${ausenciaHoy ? "fa-person-walking-luggage" : "fa-circle-check"} me-1`} />
                      {emp.nombre}
                      {ausenciaHoy && (
                        <span className="ms-1 opacity-75 small">({TIPO_LABEL[ausenciaHoy.tipo]})</span>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 d-flex gap-3 small text-muted">
                <span><span className="badge bg-light text-dark border me-1">●</span>Trabajando</span>
                <span><span className="badge bg-success me-1">●</span>Vacaciones</span>
                <span><span className="badge bg-danger me-1">●</span>Falta</span>
                <span><span className="badge bg-warning text-dark me-1">●</span>Permiso</span>
              </div>
            </div>
          </div>
        )}

        {/* Filtros */}
        <div className="card mb-4 shadow-sm">
          <div className="card-body py-3">
            <div className="d-flex flex-wrap gap-3 align-items-end">
              <div>
                <label className="form-label small mb-1">Año</label>
                <select className="form-select form-select-sm" value={anio} onChange={(e) => setAnio(Number(e.target.value))} style={{ width: 90 }}>
                  {[HOY.getFullYear() - 1, HOY.getFullYear(), HOY.getFullYear() + 1].map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label small mb-1">Mes</label>
                <select className="form-select form-select-sm" value={mes} onChange={(e) => setMes(Number(e.target.value))} style={{ width: 140 }}>
                  <option value={0}>Todo el año</option>
                  {MESES.map((m, i) => (
                    <option key={i + 1} value={i + 1}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label small mb-1">Empleado</label>
                <select className="form-select form-select-sm" value={filtroEmpleado} onChange={(e) => setFiltroEmpleado(e.target.value)} style={{ width: 180 }}>
                  <option value="">Todos</option>
                  {empleados.map((e) => (
                    <option key={e.id} value={e.id}>{e.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label small mb-1">Tipo</label>
                <select className="form-select form-select-sm" value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} style={{ width: 140 }}>
                  <option value="">Todos</option>
                  <option value="vacaciones">Vacaciones</option>
                  <option value="falta">Falta</option>
                  <option value="permiso">Permiso</option>
                </select>
              </div>
              <div>
                <label className="form-label small mb-1">Estado</label>
                <select className="form-select form-select-sm" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} style={{ width: 140 }}>
                  <option value="">Todos</option>
                  <option value="pendiente">Pendiente</option>
                  <option value="aprobado">Aprobado</option>
                  <option value="rechazado">Rechazado</option>
                </select>
              </div>
              <button className="btn btn-outline-secondary btn-sm" onClick={cargar} disabled={cargando}>
                <i className="fa-solid fa-rotate-right me-1" />Actualizar
              </button>
            </div>
          </div>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}

        {/* Tabla */}
        {cargando ? (
          <div className="text-center py-5">
            <span className="spinner-border spinner-border-sm me-2" />Cargando...
          </div>
        ) : visibles.length === 0 ? (
          <div className="text-center py-5 text-muted">
            <i className="fa-solid fa-calendar-xmark fa-2x mb-3 d-block" />
            No hay ausencias registradas para este período.
            <div className="mt-3">
              <button className="btn btn-success btn-sm" onClick={abrirNuevo}>
                <i className="fa-solid fa-plus me-1" />Añadir primera ausencia
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="table-responsive shadow-sm rounded">
              <table className="table table-sm table-bordered table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Empleado</th>
                    <th>Tipo</th>
                    <th>Desde</th>
                    <th>Hasta</th>
                    <th className="text-center">Días</th>
                    <th className="text-center">Estado</th>
                    <th>Motivo</th>
                    <th className="text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((a) => (
                    <tr key={a.id}>
                      <td className="fw-semibold">{a.empleado_nombre}</td>
                      <td>{TIPO_LABEL[a.tipo] || a.tipo}</td>
                      <td className="text-nowrap">{formatFecha(a.fecha_inicio)}</td>
                      <td className="text-nowrap">{formatFecha(a.fecha_fin)}</td>
                      <td className="text-center fw-bold">{a.dias}</td>
                      <td className="text-center">
                        <span className={`badge bg-${ESTADO_BADGE[a.estado] || "secondary"}`}>
                          {a.estado}
                        </span>
                      </td>
                      <td className="text-muted" style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {a.motivo || "—"}
                      </td>
                      <td className="text-center text-nowrap">
                        <button
                          className="btn btn-sm btn-outline-primary me-1"
                          title="Editar"
                          onClick={() => abrirEdicion(a)}
                        >
                          <i className="fa-solid fa-pen" />
                        </button>
                        <button
                          className="btn btn-sm btn-outline-danger"
                          title="Eliminar"
                          onClick={() => eliminar(a)}
                        >
                          <i className="fa-solid fa-trash" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Resumen por empleado */}
            <div className="mt-4">
              <h6 className="fw-semibold mb-3">Resumen de días — {mes ? MESES[mes - 1] : "año"} {anio}</h6>
              <div className="d-flex flex-wrap gap-3">
                {Object.entries(resumen).map(([nombre, dias]) => (
                  <div key={nombre} className="card shadow-sm" style={{ minWidth: 200 }}>
                    <div className="card-body py-2 px-3">
                      <div className="fw-semibold mb-1">{nombre}</div>
                      {dias.vacaciones > 0 && (
                        <div className="small"><span className="badge bg-success me-1">{dias.vacaciones}d</span>Vacaciones</div>
                      )}
                      {dias.falta > 0 && (
                        <div className="small"><span className="badge bg-danger me-1">{dias.falta}d</span>Faltas</div>
                      )}
                      {dias.permiso > 0 && (
                        <div className="small"><span className="badge bg-warning text-dark me-1">{dias.permiso}d</span>Permisos</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modal crear / editar */}
      {modalAbierto && (
        <div className="modal show d-block" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  {editando ? "Editar ausencia" : "Nueva ausencia"}
                </h5>
                <button className="btn-close" onClick={cerrarModal} disabled={guardando} />
              </div>
              <div className="modal-body">
                {errorModal && <div className="alert alert-danger py-2">{errorModal}</div>}

                {/* Empleado */}
                <div className="mb-3">
                  <label className="form-label fw-semibold">Empleado <span className="text-danger">*</span></label>
                  <select
                    className="form-select"
                    value={form.empleado_id}
                    onChange={(e) => setField("empleado_id", e.target.value)}
                  >
                    <option value="">Selecciona empleado...</option>
                    {empleados.map((e) => (
                      <option key={e.id} value={e.id}>{e.nombre}</option>
                    ))}
                  </select>
                </div>

                {/* Tipo y Estado en fila */}
                <div className="row gx-2 mb-3">
                  <div className="col-6">
                    <label className="form-label fw-semibold">Tipo</label>
                    <select className="form-select" value={form.tipo} onChange={(e) => setField("tipo", e.target.value)}>
                      <option value="vacaciones">Vacaciones</option>
                      <option value="falta">Falta</option>
                      <option value="permiso">Permiso</option>
                    </select>
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-semibold">Estado</label>
                    <select className="form-select" value={form.estado} onChange={(e) => setField("estado", e.target.value)}>
                      <option value="pendiente">Pendiente</option>
                      <option value="aprobado">Aprobado</option>
                      <option value="rechazado">Rechazado</option>
                    </select>
                  </div>
                </div>

                {/* Fechas */}
                <div className="row gx-2 mb-1">
                  <div className="col-6">
                    <label className="form-label fw-semibold">Desde <span className="text-danger">*</span></label>
                    <input
                      type="date"
                      className="form-control"
                      value={form.fecha_inicio}
                      onChange={(e) => setField("fecha_inicio", e.target.value)}
                    />
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-semibold">Hasta <span className="text-danger">*</span></label>
                    <input
                      type="date"
                      className="form-control"
                      value={form.fecha_fin}
                      min={form.fecha_inicio || undefined}
                      onChange={(e) => setField("fecha_fin", e.target.value)}
                    />
                  </div>
                </div>
                {diasCalculados && (
                  <p className="text-muted small mb-3 ps-1">
                    <i className="fa-solid fa-calendar-days me-1" />
                    {diasCalculados} día{diasCalculados !== 1 ? "s" : ""}
                  </p>
                )}

                {/* Motivo */}
                <div className="mb-2">
                  <label className="form-label fw-semibold">Motivo <span className="text-muted fw-normal">(opcional)</span></label>
                  <textarea
                    className="form-control"
                    rows={3}
                    placeholder="Describe el motivo de la ausencia..."
                    value={form.motivo}
                    onChange={(e) => setField("motivo", e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={cerrarModal} disabled={guardando}>
                  Cancelar
                </button>
                <button className="btn btn-primary" onClick={guardar} disabled={guardando}>
                  {guardando
                    ? <><span className="spinner-border spinner-border-sm me-2" />Guardando...</>
                    : editando ? "Guardar cambios" : "Crear ausencia"
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
